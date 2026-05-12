use crate::error::AppError;
use crate::pty::pty_session::PtySessionHandle;
use crate::pty::pty_types::{PtySessionDebugInfo, PtySessionInfo, PtySessionStatus, PtyStartOptions, PtySupportInfo};
use portable_pty::native_pty_system;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::AppHandle;

pub struct PtyManager {
    sessions: Arc<Mutex<HashMap<String, PtySessionHandle>>>,
}

impl PtyManager {
    pub fn new() -> Self { Self { sessions: Arc::new(Mutex::new(HashMap::new())) } }

    /// Create a new PTY session. spawn() returns immediately — no blocking.
    pub fn create(&self, options: PtyStartOptions, app: AppHandle) -> Result<PtySessionInfo, AppError> {
        let handle = PtySessionHandle::spawn(options, app)?;
        let info = handle.info.clone();
        self.sessions.lock()
            .map_err(|e| AppError::Process(format!("PtyManager lock: {}", e)))?
            .insert(info.id.clone(), handle);
        Ok(info)
    }

    /// Return debug info for all sessions in registry (Session Mapping diagnostic).
    pub fn list_debug_sessions(&self) -> Result<Vec<PtySessionDebugInfo>, String> {
        let sessions = self.sessions.lock().map_err(|e| e.to_string())?;
        Ok(sessions.values().map(|h| {
            let info = &h.info;
            let pid = info.pid;
            let has_writer = h.has_writer();
            let status = h.status.lock().map(|s| format!("{:?}", s)).unwrap_or_else(|_| "unknown".into());
            PtySessionDebugInfo {
                pty_session_id: info.id.clone(),
                ui_session_id: Some(info.session_id.clone()),
                project_id: Some(info.project_id.clone()),
                cwd: info.cwd.clone(),
                pid,
                status,
                has_writer,
                reader_alive: true, // reader thread spawned = alive unless proven otherwise
                created_at: info.created_at.clone(),
                last_error: None,
            }
        }).collect())
    }

    #[allow(dead_code)]
    pub fn info(&self, id: &str) -> Result<PtySessionInfo, AppError> {
        let sessions = self.sessions.lock()
            .map_err(|e| AppError::Process(format!("PtyManager lock: {}", e)))?;
        sessions.get(id).map(|h| h.info.clone())
            .ok_or_else(|| AppError::SessionNotFound(id.into()))
    }

    /// Run an operation on the handle. session_id IS the HashMap key (ses-xxx).
    /// CRITICAL: Single lock acquisition — find AND operate atomically to prevent TOCTOU.
    fn with_handle<F, R>(&self, session_id: &str, f: F) -> Result<R, AppError>
    where F: FnOnce(&PtySessionHandle) -> Result<R, AppError>
    {
        let sessions = self.sessions.lock()
            .map_err(|e| AppError::Process(format!("PtyManager lock: {}", e)))?;
        // Direct key lookup — session_id IS the registry key since spawn() fix
        let handle = sessions.get(session_id)
            .ok_or_else(|| AppError::SessionNotFound(session_id.into()))?;
        f(handle)
    }

    pub fn write(&self, session_id: &str, data: &str) -> Result<(), AppError> {
        self.with_handle(session_id, |h| h.write(data))
    }

    pub fn resize(&self, session_id: &str, rows: u16, cols: u16) -> Result<(), AppError> {
        self.with_handle(session_id, |h| h.resize(rows, cols))
    }

    pub fn send_ctrl_c(&self, session_id: &str) -> Result<(), AppError> {
        self.with_handle(session_id, |h| h.send_ctrl_c())
    }

    pub fn send_ctrl_d(&self, session_id: &str) -> Result<(), AppError> {
        self.with_handle(session_id, |h| h.send_ctrl_d())
    }

    pub fn stop(&self, session_id: &str) -> Result<(), AppError> {
        // Direct key lookup — session_id IS the registry key
        let mut sessions = self.sessions.lock()
            .map_err(|e| AppError::Process(format!("PtyManager lock: {}", e)))?;
        if let Some(handle) = sessions.remove(session_id) {
            handle.stop();
        }
        Ok(())
    }

    pub fn get_status(&self, session_id: &str) -> Option<PtySessionStatus> {
        let sessions = self.sessions.lock().ok()?;
        sessions.get(session_id)
            .and_then(|h| h.status.lock().ok().map(|s| s.clone()))
    }

    pub fn get_raw_log_path(&self, session_id: &str) -> Option<String> {
        let sessions = self.sessions.lock().ok()?;
        sessions.get(session_id)
            .map(|h| h.log_path().to_string_lossy().to_string())
    }

    pub fn get_raw_log(&self, session_id: &str, offset: u64, limit: u64) -> Result<String, AppError> {
        self.with_handle(session_id, |h| h.log_writer.read_log(offset, limit))
    }

    pub fn list_all(&self) -> Vec<PtySessionInfo> {
        match self.sessions.lock() {
            Ok(s) => s.values().map(|h| h.info.clone()).collect(),
            Err(_) => vec![],
        }
    }

    #[allow(dead_code)]
    pub fn remove(&self, id: &str) {
        if let Ok(mut sessions) = self.sessions.lock() { sessions.remove(id); }
    }

    pub fn check_support() -> PtySupportInfo {
        match native_pty_system() {
            _ => PtySupportInfo {
                supported: true,
                backend: if cfg!(windows) {
                    "Windows ConPTY (via portable-pty)".into()
                } else if cfg!(target_os = "macos") {
                    "macOS PTY (via portable-pty)".into()
                } else {
                    "Unix PTY (via portable-pty)".into()
                },
                details: String::new(),
            },
        }
    }
}
