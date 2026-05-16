use std::collections::HashMap;
use std::io::Write;
use std::sync::{Arc, Mutex};
use chrono::Utc;
use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use tauri::{AppHandle, Emitter};
use crate::runtime_v2::claude_command_resolver::{build_invocation, select_for_terminal};
use super::types::*;

#[derive(Clone, Default)]
pub struct RuntimeKernel {
    inner: Arc<Mutex<HashMap<String, RuntimeKernelHandle>>>,
}

impl RuntimeKernel {
    pub fn inner(&self) -> &Arc<Mutex<HashMap<String, RuntimeKernelHandle>>> {
        &self.inner
    }
}

pub struct RuntimeKernelHandle {
    pub trace_id: String,
    pub gui_session_id: String,
    pub runtime_session_id: String,
    pub claude_session_id: Option<String>,
    pub project_id: String,
    pub cwd: String,
    pub pid: Option<u32>,
    pub status: RuntimeStatus,
    pub has_writer: bool,
    pub reader_alive: bool,
    pub created_at: String,
    pub updated_at: String,
    pub last_error: Option<String>,
    pub seq: u64,
    pub writer: Box<dyn Write + Send>,
    #[allow(dead_code)]
    pub child: Box<dyn portable_pty::Child + Send + Sync>,
}

fn is_alive(snapshot: &RuntimeKernelSnapshot) -> bool {
    snapshot.has_writer
        && snapshot.reader_alive
        && !matches!(
            snapshot.status,
            RuntimeStatus::Failed | RuntimeStatus::Exited | RuntimeStatus::Stopped
        )
}

impl RuntimeKernel {
    pub fn start_session(&self, app: AppHandle, req: RuntimeKernelStartRequest) -> Result<RuntimeKernelSnapshot, String> {
        let cwd_path = std::path::PathBuf::from(&req.cwd);
        if !cwd_path.exists() || !cwd_path.is_dir() {
            return Err(format!("Invalid cwd: {}", req.cwd));
        }

        // Reuse existing alive session
        {
            let sessions = self.inner.lock().map_err(|e| e.to_string())?;
            if let Some(existing) = sessions.get(&req.gui_session_id) {
                let snap = snapshot(existing);
                if is_alive(&snap) {
                    let trace_id = req.trace_id.clone();
                    let gui_session_id = existing.gui_session_id.clone();
                    let runtime_session_id = existing.runtime_session_id.clone();
                    let seq = existing.seq + 1;
                    let pid = existing.pid;
                    let cwd = existing.cwd.clone();
                    drop(sessions);
                    emit(&app, &make_event(
                        &trace_id, &gui_session_id, &runtime_session_id, seq,
                        "runtime.reuse", "status",
                        Some("Reusing existing runtime session".to_string()),
                        Some(RuntimeStatus::Ready),
                        pid, Some(cwd),
                    ));
                    return Ok(snap);
                }
            }
        }

        let spec = select_for_terminal()?;
        let claude_args = build_claude_args(&req);
        let invocation = build_invocation(&spec, &claude_args);

        let pty_system = NativePtySystem::default();
        let pair = pty_system.openpty(PtySize { rows: 32, cols: 120, pixel_width: 0, pixel_height: 0 })
            .map_err(|e| format!("openpty failed: {}", e))?;

        let mut cmd = CommandBuilder::new(invocation.program.clone());
        for arg in invocation.args { cmd.arg(arg); }
        cmd.cwd(&req.cwd);

        let child = pair.slave.spawn_command(cmd).map_err(|e| format!("spawn Claude failed: {}", e))?;
        drop(pair.slave);

        let mut reader = pair.master.try_clone_reader().map_err(|e| format!("clone PTY reader failed: {}", e))?;
        let writer = pair.master.take_writer().map_err(|e| format!("take PTY writer failed: {}", e))?;

        let now = Utc::now().to_rfc3339();
        let pid = child.process_id();
        let runtime_session_id = format!("rt-{}-{}", req.gui_session_id, Utc::now().timestamp_millis());

        let handle = RuntimeKernelHandle {
            trace_id: req.trace_id.clone(),
            gui_session_id: req.gui_session_id.clone(),
            runtime_session_id: runtime_session_id.clone(),
            claude_session_id: None,
            project_id: req.project_id.clone(),
            cwd: req.cwd.clone(),
            pid,
            status: RuntimeStatus::Ready,
            has_writer: true,
            reader_alive: true,
            created_at: now.clone(),
            updated_at: now.clone(),
            last_error: None,
            seq: 0,
            writer,
            child,
        };

        self.inner.lock().map_err(|e| e.to_string())?.insert(req.gui_session_id.clone(), handle);

        emit(&app, &make_event(
            &req.trace_id, &req.gui_session_id, &runtime_session_id, 1,
            "session.ready", "lifecycle",
            Some("Claude runtime started".to_string()),
            Some(RuntimeStatus::Ready),
            pid, Some(req.cwd.clone()),
        ));

        // Reader thread
        let inner = self.inner.clone();
        let app2 = app.clone();
        let trace_id = req.trace_id.clone();
        let gui_session_id = req.gui_session_id.clone();
        let cwd = req.cwd.clone();
        let runtime_session_id2 = runtime_session_id.clone();

        std::thread::spawn(move || {
            let mut buf = [0u8; 8192];
            let mut received_any = false;
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        if !received_any {
                            received_any = true;
                            if let Ok(mut sessions) = inner.lock() {
                                if let Some(handle) = sessions.get_mut(&gui_session_id) {
                                    handle.status = RuntimeStatus::Ready;
                                    handle.updated_at = Utc::now().to_rfc3339();
                                }
                            }
                            emit(&app2, &make_event(
                                &trace_id, &gui_session_id, &runtime_session_id2, 0,
                                "runtime.ready", "status",
                                None,
                                Some(RuntimeStatus::Ready),
                                pid, Some(cwd.clone()),
                            ));
                        }
                        let data = String::from_utf8_lossy(&buf[..n]).to_string();
                        let seq = {
                            let sessions = inner.lock().ok();
                            sessions.and_then(|mut s| {
                                let h = s.get_mut(&gui_session_id)?;
                                h.seq += 1;
                                Some(h.seq)
                            }).unwrap_or(0)
                        };
                        emit(&app2, &make_event(
                            &trace_id, &gui_session_id, &runtime_session_id2, seq,
                            "pty.data", "raw",
                            Some(data), None,
                            pid, Some(cwd.clone()),
                        ));
                    }
                    Err(err) => {
                        let seq = {
                            let sessions = inner.lock().ok();
                            sessions.and_then(|mut s| {
                                let h = s.get_mut(&gui_session_id)?;
                                h.seq += 1;
                                h.status = RuntimeStatus::Failed;
                                Some(h.seq)
                            }).unwrap_or(0)
                        };
                        emit(&app2, &make_event(
                            &trace_id, &gui_session_id, &runtime_session_id2, seq,
                            "reader.error", "error",
                            Some(err.to_string()),
                            Some(RuntimeStatus::Failed),
                            pid, Some(cwd.clone()),
                        ));
                        break;
                    }
                }
            }
            // Reader exited — update status based on whether any data was received
            if let Ok(mut sessions) = inner.lock() {
                if let Some(h) = sessions.get_mut(&gui_session_id) {
                    h.reader_alive = false;
                    h.has_writer = false;
                    if !received_any {
                        h.status = RuntimeStatus::Failed;
                        h.last_error = Some("Claude 进程启动后未产生任何输出即退出".to_string());
                    } else if h.status != RuntimeStatus::Failed {
                        h.status = RuntimeStatus::Exited;
                        h.last_error = Some("PTY reader exited".to_string());
                    }
                    h.updated_at = Utc::now().to_rfc3339();
                }
            }
            emit(&app2, &make_event(
                &trace_id, &gui_session_id, &runtime_session_id2, 0,
                "session.exited", "lifecycle",
                Some("Claude runtime exited".to_string()),
                Some(RuntimeStatus::Exited),
                pid, Some(cwd),
            ));
        });

        let sessions = self.inner.lock().map_err(|e| e.to_string())?;
        let h = sessions.get(&req.gui_session_id).ok_or("session not found after start")?;
        Ok(snapshot(h))
    }

    pub fn submit_user_message(&self, req: RuntimeKernelSubmitRequest) -> Result<(), String> {
        let mut sessions = self.inner.lock().map_err(|e| e.to_string())?;

        let handle = sessions
            .get_mut(&req.gui_session_id)
            .ok_or_else(|| {
                format!(
                    "Runtime session not found: {}. Start or reconnect the session first.",
                    req.gui_session_id
                )
            })?;

        if !handle.has_writer || !handle.reader_alive {
            return Err(format!(
                "Runtime session is not writable: {}. Use reconnect/resume/restart.",
                req.gui_session_id
            ));
        }

        if matches!(
            handle.status,
            RuntimeStatus::Failed | RuntimeStatus::Exited | RuntimeStatus::Stopped
        ) {
            return Err(format!(
                "Runtime session is not alive: {:?}. Use reconnect/resume/restart.",
                handle.status
            ));
        }

        handle
            .writer
            .write_all(req.text.as_bytes())
            .map_err(|e| format!("PTY write failed: {}", e))?;

        handle
            .writer
            .write_all(b"\r")
            .map_err(|e| format!("PTY newline write failed: {}", e))?;

        handle
            .writer
            .flush()
            .map_err(|e| format!("PTY flush failed: {}", e))?;

        handle.status = RuntimeStatus::Busy;
        handle.updated_at = Utc::now().to_rfc3339();

        Ok(())
    }

    pub fn write_terminal(&self, req: RuntimeKernelWriteRequest) -> Result<(), String> {
        let mut sessions = self.inner.lock().map_err(|e| e.to_string())?;
        let handle = sessions
            .get_mut(&req.gui_session_id)
            .ok_or_else(|| format!("Runtime session not found: {}", req.gui_session_id))?;

        if !handle.has_writer || !handle.reader_alive {
            return Err("Runtime session is not writable".to_string());
        }

        handle.writer.write_all(req.data.as_bytes()).map_err(|e| e.to_string())?;
        handle.writer.flush().map_err(|e| e.to_string())?;
        handle.updated_at = Utc::now().to_rfc3339();
        Ok(())
    }

    pub fn stop_session(&self, req: RuntimeKernelStopRequest) -> Result<(), String> {
        let mut sessions = self.inner.lock().map_err(|e| e.to_string())?;
        let mut h = sessions
            .remove(&req.gui_session_id)
            .ok_or_else(|| format!("runtime session not found: {}", req.gui_session_id))?;

        h.status = RuntimeStatus::Stopped;
        h.has_writer = false;
        h.reader_alive = false;
        h.child.kill().map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn detach_session(&self, _gui_session_id: String) -> Result<(), String> {
        // Backend keeps the process. This command only exists for explicit audit.
        let sessions = self.inner.lock().map_err(|e| e.to_string())?;
        if sessions.contains_key(&_gui_session_id) {
            Ok(())
        } else {
            Ok(())
        }
    }

    pub fn list_sessions(&self) -> Result<Vec<RuntimeKernelSnapshot>, String> {
        let sessions = self.inner.lock().map_err(|e| e.to_string())?;
        Ok(sessions.values().map(snapshot).collect())
    }
}

fn snapshot(h: &RuntimeKernelHandle) -> RuntimeKernelSnapshot {
    RuntimeKernelSnapshot {
        trace_id: h.trace_id.clone(),
        gui_session_id: h.gui_session_id.clone(),
        runtime_session_id: h.runtime_session_id.clone(),
        claude_session_id: h.claude_session_id.clone(),
        project_id: h.project_id.clone(),
        cwd: h.cwd.clone(),
        pid: h.pid,
        status: h.status.clone(),
        has_writer: h.has_writer,
        reader_alive: h.reader_alive,
        created_at: h.created_at.clone(),
        updated_at: h.updated_at.clone(),
        last_error: h.last_error.clone(),
    }
}

fn make_event(
    trace_id: &str, gui_session_id: &str, runtime_session_id: &str,
    seq: u64, event_type: &str, channel: &str,
    data: Option<String>, status: Option<RuntimeStatus>,
    pid: Option<u32>, cwd: Option<String>,
) -> RuntimeKernelEvent {
    RuntimeKernelEvent {
        seq,
        trace_id: trace_id.to_string(),
        gui_session_id: gui_session_id.to_string(),
        runtime_session_id: runtime_session_id.to_string(),
        event_type: event_type.to_string(),
        channel: channel.to_string(),
        data,
        status,
        pid,
        cwd,
        created_at: Utc::now().to_rfc3339(),
    }
}

fn emit(app: &AppHandle, event: &RuntimeKernelEvent) {
    let _ = app.emit("runtime-kernel://event", event);
}

fn build_claude_args(req: &RuntimeKernelStartRequest) -> Vec<String> {
    let mut args = Vec::new();
    if !req.model.trim().is_empty() && req.model != "default" {
        args.push("--model".to_string());
        args.push(req.model.clone());
    }
    if !req.permission_mode.trim().is_empty() && req.permission_mode != "default" {
        args.push("--permission-mode".to_string());
        args.push(req.permission_mode.clone());
    }
    if !req.effort.trim().is_empty() && req.effort != "default" {
        args.push("--effort".to_string());
        args.push(req.effort.clone());
    }
    args
}
