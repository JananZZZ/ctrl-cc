use crate::error::AppError;
use crate::pty::pty_types::*;
use chrono::Utc;
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use std::io::Write;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

use super::pty_log::PtyLogWriter;
use super::pty_parser::PtySemanticParser;

type PtyReader = Box<dyn std::io::Read + Send>;
type PtyWriter = Box<dyn Write + Send>;
type PtyMaster = Box<dyn MasterPty + Send>;

/// Inner PTY resources — owned exclusively by the supervision thread.
struct PtyInner {
    reader: PtyReader,
    child: Box<dyn portable_pty::Child + Send + Sync>,
}

/// Thread-safe PTY session handle.
pub struct PtySessionHandle {
    pub info: PtySessionInfo,
    pub status: Arc<Mutex<PtySessionStatus>>,
    master: Arc<Mutex<PtyMaster>>,
    writer: Arc<Mutex<PtyWriter>>,
    running: Arc<Mutex<bool>>,
    pub log_writer: PtyLogWriter,
}

impl PtySessionHandle {
    pub fn spawn(options: PtyStartOptions, app: AppHandle) -> Result<Self, AppError> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        let log_writer = PtyLogWriter::new(&id)?;

        let pty_system = native_pty_system();

        let mut cmd = if cfg!(windows) && !options.cli_path.ends_with(".exe") {
            let mut c = CommandBuilder::new("cmd");
            c.arg("/c");
            c.arg(&options.cli_path);
            for arg in &options.extra_args {
                c.arg(arg);
            }
            c
        } else {
            let mut c = CommandBuilder::new(&options.cli_path);
            for arg in &options.extra_args {
                c.arg(arg);
            }
            c
        };
        cmd.cwd(&options.cwd);
        cmd.env("TERM", "xterm-256color");

        let rows = 500u16;
        let cols = 200u16;

        let pty_pair = pty_system
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| AppError::Process(format!("PTY openpty failed: {}", e)))?;

        let child = pty_pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| AppError::Process(format!("PTY spawn failed: {}", e)))?;

        let pid = child.process_id();

        let reader = pty_pair
            .master
            .try_clone_reader()
            .map_err(|e| AppError::Process(format!("PTY clone reader failed: {}", e)))?;

        let writer = pty_pair
            .master
            .take_writer()
            .map_err(|e| AppError::Process(format!("PTY take writer failed: {}", e)))?;

        let master: PtyMaster = pty_pair.master;

        let command = {
            let mut v = vec![options.cli_path.clone()];
            v.extend(options.extra_args.clone());
            v
        };

        log_writer.write_command(&command)?;

        let info = PtySessionInfo {
            id: id.clone(),
            session_id: options.session_id,
            project_id: options.project_id,
            cwd: std::path::PathBuf::from(options.cwd).to_string_lossy().to_string(),
            command,
            rows,
            cols,
            status: PtySessionStatus::Starting,
            pid,
            created_at: now,
        };

        let status = Arc::new(Mutex::new(PtySessionStatus::Starting));
        let master_arc = Arc::new(Mutex::new(master));
        let writer_arc = Arc::new(Mutex::new(writer));
        let running = Arc::new(Mutex::new(true));

        // Spawn supervision thread — takes ownership of reader and child.
        let session_id = info.session_id.clone();
        let pty_id = info.id.clone();
        let running_clone = running.clone();
        let log_clone = log_writer.clone();
        let app_clone = app.clone();
        let status_clone = status.clone();

        let inner = PtyInner { reader, child };

        std::thread::spawn(move || {
            supervise_pty_output(inner, app_clone, session_id, pty_id, running_clone, log_clone, status_clone);
        });

        // Emit status event
        let _ = app.emit(
            "pty://status",
            serde_json::json!({
                "session_id": info.session_id,
                "pty_id": info.id,
                "status": "starting",
            }),
        );

        Ok(Self {
            info,
            status,
            master: master_arc,
            writer: writer_arc,
            running,
            log_writer,
        })
    }

    /// Write data to PTY stdin.
    pub fn write(&self, data: &str) -> Result<(), AppError> {
        let mut writer = self
            .writer
            .lock()
            .map_err(|e| AppError::Process(format!("PTY writer lock: {}", e)))?;
        writer
            .write_all(data.as_bytes())
            .map_err(|e| AppError::Process(format!("PTY write: {}", e)))
    }

    /// Resize the PTY.
    pub fn resize(&self, rows: u16, cols: u16) -> Result<(), AppError> {
        let master = self
            .master
            .lock()
            .map_err(|e| AppError::Process(format!("PTY master lock: {}", e)))?;
        master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| AppError::Process(format!("PTY resize: {}", e)))?;
        self.log_writer.write_size_event(rows, cols)?;
        Ok(())
    }

    /// Send Ctrl+C.
    pub fn send_ctrl_c(&self) -> Result<(), AppError> {
        self.write("\x03")
    }

    /// Send Ctrl+D.
    pub fn send_ctrl_d(&self) -> Result<(), AppError> {
        self.write("\x04")
    }

    /// Stop the session.
    pub fn stop(&self) {
        if let Ok(mut r) = self.running.lock() { *r = false; }
        if let Ok(mut s) = self.status.lock() { *s = PtySessionStatus::Killed; }
    }

    pub fn log_path(&self) -> PathBuf {
        self.log_writer.session_dir()
    }
}

/// Runs in a dedicated thread: reads PTY output, writes logs, emits events, runs parser.
fn supervise_pty_output(
    inner: PtyInner,
    app: AppHandle,
    session_id: String,
    pty_id: String,
    running: Arc<Mutex<bool>>,
    log_writer: PtyLogWriter,
    status: Arc<Mutex<PtySessionStatus>>,
) {
    let PtyInner { mut reader, child: mut pty_child } = inner;
    let mut buf = [0u8; 4096];
    let mut parser = PtySemanticParser::new();
    parser.set_session_id(&session_id);

    if let Ok(mut s) = status.lock() { *s = PtySessionStatus::Running; }
    let _ = app.emit(
        "pty://status",
        serde_json::json!({
            "session_id": session_id,
            "pty_id": pty_id,
            "status": "running",
        }),
    );

    loop {
        if !running.lock().map(|r| *r).unwrap_or(false) {
            break;
        }
        match reader.read(&mut buf) {
            Ok(0) => break,
            Ok(n) => {
                let raw_bytes = buf[..n].to_vec();
                log_writer.write_raw(&raw_bytes);

                let text = String::from_utf8_lossy(&raw_bytes).to_string();
                log_writer.write_utf8(&text);

                let _ = app.emit(
                    "pty://data",
                    serde_json::json!({
                        "session_id": session_id,
                        "pty_id": pty_id,
                        "data": text,
                    }),
                );

                if let Some(event) = parser.feed(&text) {
                    let _ = app.emit(
                        "pty://semantic-event",
                        serde_json::json!({
                            "session_id": session_id,
                            "pty_id": pty_id,
                            "event": event,
                        }),
                    );
                }
            }
            Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                std::thread::sleep(std::time::Duration::from_millis(10));
            }
            Err(e) => {
                log::error!("PTY read error for {}: {}", session_id, e);
                let _ = app.emit(
                    "pty://error",
                    serde_json::json!({
                        "session_id": session_id,
                        "pty_id": pty_id,
                        "message": format!("PTY read error: {}", e),
                    }),
                );
                break;
            }
        }
    }

    let exit_code = pty_child.wait().ok().map(|s| if s.success() { 0 } else { 1 });
    if let Ok(mut s) = status.lock() {
        *s = PtySessionStatus::Exited { code: exit_code.unwrap_or(0) };
    }
    let _ = app.emit(
        "pty://exit",
        serde_json::json!({
            "session_id": session_id,
            "pty_id": pty_id,
            "exit_code": exit_code,
        }),
    );
}
