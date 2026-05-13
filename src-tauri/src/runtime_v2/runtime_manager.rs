use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};

use chrono::Utc;
use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use tauri::{AppHandle, Emitter};

use super::claude_discovery::select_launch_plan;
use super::runtime_types::{
    RuntimePtySessionDebugInfo, RuntimeStartInteractiveRequest, RuntimeStartInteractiveResponse,
    RuntimeStopRequest, RuntimeWriteRequest,
};

pub struct RuntimeManager {
    sessions: Arc<Mutex<HashMap<String, RuntimePtyHandle>>>,
}

pub struct RuntimePtyHandle {
    pub trace_id: String,
    pub ui_session_id: String,
    pub pty_session_id: String,
    pub project_id: String,
    pub cwd: String,
    pub pid: Option<u32>,
    pub status: String,
    pub has_writer: bool,
    pub reader_alive: bool,
    pub created_at: String,
    pub last_error: Option<String>,
    pub writer: Box<dyn Write + Send>,
    pub child: Box<dyn portable_pty::Child + Send + Sync>,
}

impl Default for RuntimeManager {
    fn default() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

impl RuntimeManager {
    pub fn start_interactive(
        &self,
        app: AppHandle,
        req: RuntimeStartInteractiveRequest,
    ) -> Result<RuntimeStartInteractiveResponse, String> {
        if req.cwd.trim().is_empty() {
            return Err("cwd is empty".into());
        }

        let cwd_path = std::path::PathBuf::from(&req.cwd);
        if !cwd_path.exists() {
            return Err(format!("cwd not found: {}", req.cwd));
        }
        if !cwd_path.is_dir() {
            return Err(format!("cwd is not a directory: {}", req.cwd));
        }

        let plan = select_launch_plan()?;
        let mut claude_args = build_claude_args(&req);
        if let Some(initial) = &req.initial_prompt {
            if !initial.trim().is_empty() {
                claude_args.push(initial.clone());
            }
        }

        let (program, args) = plan.command_parts(&claude_args);

        let pty_system = NativePtySystem::default();
        let pair = pty_system
            .openpty(PtySize {
                rows: 32,
                cols: 120,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("openpty failed: {}", e))?;

        let mut cmd = CommandBuilder::new(program.clone());
        for arg in &args {
            cmd.arg(arg);
        }
        cmd.cwd(&req.cwd);

        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("pty spawn failed: {}", e))?;

        drop(pair.slave);

        let mut reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| format!("clone reader failed: {}", e))?;

        let writer = pair
            .master
            .take_writer()
            .map_err(|e| format!("take writer failed: {}", e))?;

        let pid = child.process_id();

        let handle = RuntimePtyHandle {
            trace_id: req.trace_id.clone(),
            ui_session_id: req.ui_session_id.clone(),
            pty_session_id: req.pty_session_id.clone(),
            project_id: req.project_id.clone(),
            cwd: req.cwd.clone(),
            pid,
            status: "pty-ready".into(),
            has_writer: true,
            reader_alive: true,
            created_at: Utc::now().to_rfc3339(),
            last_error: None,
            writer,
            child,
        };

        {
            let mut sessions = self.sessions.lock().map_err(|e| e.to_string())?;
            sessions.insert(req.pty_session_id.clone(), handle);
        }

        let app_for_reader = app.clone();
        let ui_session_id = req.ui_session_id.clone();
        let pty_session_id = req.pty_session_id.clone();
        let trace_id = req.trace_id.clone();
        let sessions_ref = self.sessions.clone();

        std::thread::spawn(move || {
            let _ = app_for_reader.emit(
                "runtime://session-status",
                serde_json::json!({
                    "traceId": trace_id,
                    "uiSessionId": ui_session_id,
                    "ptySessionId": pty_session_id,
                    "status": "reader-started",
                }),
            );

            let mut buf = [0u8; 8192];

            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        let data = String::from_utf8_lossy(&buf[..n]).to_string();
                        let _ = app_for_reader.emit(
                            "pty://data",
                            serde_json::json!({
                                "traceId": trace_id,
                                "uiSessionId": ui_session_id,
                                "ptySessionId": pty_session_id,
                                "session_id": ui_session_id,
                                "data": data,
                            }),
                        );
                    }
                    Err(err) => {
                        let _ = app_for_reader.emit(
                            "pty://error",
                            serde_json::json!({
                                "traceId": trace_id,
                                "uiSessionId": ui_session_id,
                                "ptySessionId": pty_session_id,
                                "error": err.to_string(),
                            }),
                        );
                        break;
                    }
                }
            }

            if let Ok(mut sessions) = sessions_ref.lock() {
                if let Some(handle) = sessions.get_mut(&pty_session_id) {
                    handle.reader_alive = false;
                    handle.status = "exited".into();
                }
            }

            let _ = app_for_reader.emit(
                "pty://exit",
                serde_json::json!({
                    "traceId": trace_id,
                    "uiSessionId": ui_session_id,
                    "ptySessionId": pty_session_id,
                }),
            );
        });

        let _ = app.emit(
            "runtime://session-status",
            serde_json::json!({
                "traceId": req.trace_id,
                "uiSessionId": req.ui_session_id,
                "ptySessionId": req.pty_session_id,
                "status": "pty-ready",
            }),
        );

        Ok(RuntimeStartInteractiveResponse {
            trace_id: req.trace_id,
            ui_session_id: req.ui_session_id,
            pty_session_id: req.pty_session_id,
            pid,
            cwd: req.cwd,
            status: "pty-ready".into(),
            launch_plan_id: plan.id,
            program,
            args,
        })
    }

    pub fn write(&self, req: RuntimeWriteRequest) -> Result<(), String> {
        let mut sessions = self.sessions.lock().map_err(|e| e.to_string())?;

        let handle = sessions.get_mut(&req.pty_session_id).ok_or_else(|| {
            format!(
                "PTY session not found: {} (uiSessionId={})",
                req.pty_session_id, req.ui_session_id
            )
        })?;

        handle
            .writer
            .write_all(req.data.as_bytes())
            .map_err(|e| format!("PTY write failed: {}", e))?;

        handle
            .writer
            .flush()
            .map_err(|e| format!("PTY flush failed: {}", e))?;

        Ok(())
    }

    pub fn stop(&self, req: RuntimeStopRequest) -> Result<(), String> {
        let mut sessions = self.sessions.lock().map_err(|e| e.to_string())?;

        let mut handle = sessions.remove(&req.pty_session_id).ok_or_else(|| {
            format!(
                "PTY session not found: {} (uiSessionId={})",
                req.pty_session_id, req.ui_session_id
            )
        })?;

        handle
            .child
            .kill()
            .map_err(|e| format!("kill failed: {}", e))?;

        Ok(())
    }

    pub fn list_sessions(&self) -> Result<Vec<RuntimePtySessionDebugInfo>, String> {
        let sessions = self.sessions.lock().map_err(|e| e.to_string())?;

        Ok(sessions
            .values()
            .map(|h| RuntimePtySessionDebugInfo {
                ui_session_id: h.ui_session_id.clone(),
                pty_session_id: h.pty_session_id.clone(),
                project_id: h.project_id.clone(),
                cwd: h.cwd.clone(),
                pid: h.pid,
                status: h.status.clone(),
                has_writer: h.has_writer,
                reader_alive: h.reader_alive,
                created_at: h.created_at.clone(),
                last_error: h.last_error.clone(),
            })
            .collect())
    }
}

fn build_claude_args(req: &RuntimeStartInteractiveRequest) -> Vec<String> {
    let mut args = Vec::new();

    if let Some(permission) = &req.permission_mode {
        args.push("--permission-mode".into());
        args.push(permission.clone());
    }

    if let Some(model) = &req.model {
        args.push("--model".into());
        args.push(model.clone());
    }

    match req.mode.as_str() {
        "continue" => args.push("--continue".into()),
        "resume" => {
            args.push("--resume".into());
            if let Some(target) = &req.resume_target {
                args.push(target.clone());
            }
        }
        _ => {}
    }

    args
}
