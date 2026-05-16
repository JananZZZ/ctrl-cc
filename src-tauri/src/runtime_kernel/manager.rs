use std::collections::HashMap;
use std::io::{Read, Write};
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

pub struct RuntimeKernelHandle {
    pub trace_id: String,
    pub gui_session_id: String,
    pub runtime_process_id: String,
    pub project_id: String,
    pub cwd: String,
    pub pid: Option<u32>,
    pub status: String,
    pub has_writer: bool,
    pub reader_alive: bool,
    pub created_at: String,
    pub updated_at: String,
    pub last_error: Option<String>,
    pub writer: Box<dyn Write + Send>,
    pub child: Box<dyn portable_pty::Child + Send + Sync>,
}

impl RuntimeKernel {
    pub fn start_session(&self, app: AppHandle, req: RuntimeKernelStartRequest) -> Result<RuntimeKernelSessionSnapshot, String> {
        let cwd_path = std::path::PathBuf::from(&req.cwd);
        if !cwd_path.exists() || !cwd_path.is_dir() { return Err(format!("Invalid cwd: {}", req.cwd)); }

        {
            let sessions = self.inner.lock().map_err(|e| e.to_string())?;
            if let Some(existing) = sessions.get(&req.gui_session_id) { return Ok(snapshot(existing)); }
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
        let runtime_process_id = format!("rt-{}-{}", req.gui_session_id, Utc::now().timestamp_millis());

        let handle = RuntimeKernelHandle {
            trace_id: req.trace_id.clone(), gui_session_id: req.gui_session_id.clone(), runtime_process_id: runtime_process_id.clone(),
            project_id: req.project_id.clone(), cwd: req.cwd.clone(), pid, status: "ready".to_string(),
            has_writer: true, reader_alive: true, created_at: now.clone(), updated_at: now.clone(), last_error: None, writer, child,
        };

        self.inner.lock().map_err(|e| e.to_string())?.insert(req.gui_session_id.clone(), handle);

        emit(&app, RuntimeKernelEvent { trace_id: req.trace_id.clone(), gui_session_id: req.gui_session_id.clone(), runtime_process_id: runtime_process_id.clone(), event_type: "session.ready".to_string(), status: Some("ready".to_string()), data: None, message: Some("Claude runtime started".to_string()), pid, cwd: Some(req.cwd.clone()), created_at: Utc::now().to_rfc3339() });

        let inner = self.inner.clone();
        let app2 = app.clone();
        let trace_id = req.trace_id.clone();
        let gui_session_id = req.gui_session_id.clone();
        let cwd = req.cwd.clone();
        let runtime_process_id2 = runtime_process_id.clone();

        std::thread::spawn(move || {
            let mut buf = [0u8; 8192];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        let data = String::from_utf8_lossy(&buf[..n]).to_string();
                        emit(&app2, RuntimeKernelEvent { trace_id: trace_id.clone(), gui_session_id: gui_session_id.clone(), runtime_process_id: runtime_process_id2.clone(), event_type: "pty.data".to_string(), status: None, data: Some(data), message: None, pid, cwd: Some(cwd.clone()), created_at: Utc::now().to_rfc3339() });
                    }
                    Err(err) => {
                        emit(&app2, RuntimeKernelEvent { trace_id: trace_id.clone(), gui_session_id: gui_session_id.clone(), runtime_process_id: runtime_process_id2.clone(), event_type: "reader.error".to_string(), status: Some("failed".to_string()), data: None, message: Some(err.to_string()), pid, cwd: Some(cwd.clone()), created_at: Utc::now().to_rfc3339() });
                        break;
                    }
                }
            }
            if let Ok(mut sessions) = inner.lock() {
                if let Some(h) = sessions.get_mut(&gui_session_id) {
                    h.reader_alive = false;
                    h.has_writer = false;
                    h.status = "exited".to_string();
                    h.updated_at = Utc::now().to_rfc3339();
                    h.last_error = Some("PTY reader exited".to_string());
                }
            }
            emit(&app2, RuntimeKernelEvent { trace_id, gui_session_id, runtime_process_id: runtime_process_id2, event_type: "session.exited".to_string(), status: Some("exited".to_string()), data: None, message: Some("Claude runtime exited".to_string()), pid, cwd: Some(cwd), created_at: Utc::now().to_rfc3339() });
        });

        let sessions = self.inner.lock().map_err(|e| e.to_string())?;
        let h = sessions.get(&req.gui_session_id).ok_or("session not found after start")?;
        Ok(snapshot(h))
    }

    pub fn submit_user_message(&self, req: RuntimeKernelSubmitRequest) -> Result<(), String> {
        let mut sessions = self.inner.lock().map_err(|e| e.to_string())?;
        let h = writable(&mut sessions, &req.gui_session_id)?;
        h.writer.write_all(req.text.as_bytes()).map_err(|e| e.to_string())?;
        h.writer.write_all(b"\r").map_err(|e| e.to_string())?;
        h.writer.flush().map_err(|e| e.to_string())?;
        h.status = "streaming".to_string();
        h.updated_at = Utc::now().to_rfc3339();
        Ok(())
    }

    pub fn write_terminal(&self, req: RuntimeKernelWriteRequest) -> Result<(), String> {
        let mut sessions = self.inner.lock().map_err(|e| e.to_string())?;
        let h = writable(&mut sessions, &req.gui_session_id)?;
        h.writer.write_all(req.data.as_bytes()).map_err(|e| e.to_string())?;
        h.writer.flush().map_err(|e| e.to_string())?;
        h.updated_at = Utc::now().to_rfc3339();
        Ok(())
    }

    pub fn stop_session(&self, req: RuntimeKernelStopRequest) -> Result<(), String> {
        let mut sessions = self.inner.lock().map_err(|e| e.to_string())?;
        let mut h = sessions.remove(&req.gui_session_id).ok_or_else(|| format!("runtime session not found: {}", req.gui_session_id))?;
        h.child.kill().map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn list_sessions(&self) -> Result<Vec<RuntimeKernelSessionSnapshot>, String> {
        let sessions = self.inner.lock().map_err(|e| e.to_string())?;
        Ok(sessions.values().map(snapshot).collect())
    }
}

fn writable<'a>(sessions: &'a mut HashMap<String, RuntimeKernelHandle>, id: &str) -> Result<&'a mut RuntimeKernelHandle, String> {
    let h = sessions.get_mut(id).ok_or_else(|| format!("runtime session not found: {}", id))?;
    if !h.has_writer || !h.reader_alive || matches!(h.status.as_str(), "failed" | "exited" | "stopped") {
        return Err(format!("runtime session is not writable: status={} readerAlive={} hasWriter={}", h.status, h.reader_alive, h.has_writer));
    }
    Ok(h)
}

fn snapshot(h: &RuntimeKernelHandle) -> RuntimeKernelSessionSnapshot {
    RuntimeKernelSessionSnapshot { trace_id: h.trace_id.clone(), gui_session_id: h.gui_session_id.clone(), runtime_process_id: h.runtime_process_id.clone(), project_id: h.project_id.clone(), cwd: h.cwd.clone(), pid: h.pid, status: h.status.clone(), has_writer: h.has_writer, reader_alive: h.reader_alive, created_at: h.created_at.clone(), updated_at: h.updated_at.clone(), last_error: h.last_error.clone() }
}

fn emit(app: &AppHandle, event: RuntimeKernelEvent) { let _ = app.emit("runtime-kernel://event", event); }

fn build_claude_args(req: &RuntimeKernelStartRequest) -> Vec<String> {
    let mut args = Vec::new();
    if let Some(model) = &req.model { if !model.trim().is_empty() && model != "default" { args.push("--model".to_string()); args.push(model.clone()); } }
    if let Some(permission) = &req.permission_mode { if !permission.trim().is_empty() && permission != "default" { args.push("--permission-mode".to_string()); args.push(permission.clone()); } }
    if let Some(target) = &req.resume_target { if !target.trim().is_empty() { args.push("--resume".to_string()); args.push(target.clone()); } }
    args
}
