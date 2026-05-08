use crate::error::AppError;
use crate::pty::pty_session::PtySessionHandle;
use crate::pty::pty_types::{PtySessionInfo, PtySessionStatus, PtyStartOptions, PtySupportInfo};
use portable_pty::native_pty_system;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::AppHandle;

pub struct PtyManager {
    sessions: Arc<Mutex<HashMap<String, PtySessionHandle>>>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Create a new PTY session.
    pub fn create(
        &self,
        options: PtyStartOptions,
        app: AppHandle,
    ) -> Result<PtySessionInfo, AppError> {
        let handle = PtySessionHandle::spawn(options, app)?;
        let info = handle.info.clone();
        self.sessions
            .lock()
            .map_err(|e| AppError::Process(format!("PtyManager lock: {}", e)))?
            .insert(info.id.clone(), handle);
        Ok(info)
    }

    /// Get info by PTY ID.
    pub fn info(&self, id: &str) -> Result<PtySessionInfo, AppError> {
        let sessions = self
            .sessions
            .lock()
            .map_err(|e| AppError::Process(format!("PtyManager lock: {}", e)))?;
        sessions
            .get(id)
            .map(|h| h.info.clone())
            .ok_or_else(|| AppError::SessionNotFound(id.into()))
    }

    /// Find a PTY session handle by Claude session_id.
    fn find_by_session(&self, sid: &str) -> Result<String, AppError> {
        let sessions = self
            .sessions
            .lock()
            .map_err(|e| AppError::Process(format!("PtyManager lock: {}", e)))?;
        sessions
            .values()
            .find(|h| h.info.session_id == sid)
            .map(|h| h.info.id.clone())
            .ok_or_else(|| AppError::SessionNotFound(sid.into()))
    }

    /// Run an operation on the handle matching a Claude session_id.
    fn with_handle<F, R>(&self, session_id: &str, f: F) -> Result<R, AppError>
    where
        F: FnOnce(&PtySessionHandle) -> Result<R, AppError>,
    {
        let pty_id = self.find_by_session(session_id)?;
        let sessions = self
            .sessions
            .lock()
            .map_err(|e| AppError::Process(format!("PtyManager lock: {}", e)))?;
        let handle = sessions
            .get(&pty_id)
            .ok_or_else(|| AppError::SessionNotFound(pty_id))?;
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
        let pty_id = self.find_by_session(session_id)?;
        let mut sessions = self
            .sessions
            .lock()
            .map_err(|e| AppError::Process(format!("PtyManager lock: {}", e)))?;
        if let Some(handle) = sessions.remove(&pty_id) {
            handle.stop();
        }
        Ok(())
    }

    pub fn get_status(&self, session_id: &str) -> Option<PtySessionStatus> {
        let sessions = self.sessions.lock().ok()?;
        let handle = sessions.values().find(|h| h.info.session_id == session_id)?;
        let status_guard = handle.status.lock().ok()?;
        Some(status_guard.clone())
    }

    pub fn get_raw_log_path(&self, session_id: &str) -> Option<String> {
        let sessions = self.sessions.lock().ok()?;
        sessions
            .values()
            .find(|h| h.info.session_id == session_id)
            .map(|h| h.log_path().to_string_lossy().to_string())
    }

    pub fn get_raw_log(
        &self,
        session_id: &str,
        offset: u64,
        limit: u64,
    ) -> Result<String, AppError> {
        let pty_id = self.find_by_session(session_id)?;
        let sessions = self
            .sessions
            .lock()
            .map_err(|e| AppError::Process(format!("PtyManager lock: {}", e)))?;
        let handle = sessions
            .get(&pty_id)
            .ok_or_else(|| AppError::SessionNotFound(pty_id))?;
        handle.log_writer.read_log(offset, limit)
    }

    pub fn list_all(&self) -> Vec<PtySessionInfo> {
        match self.sessions.lock() {
            Ok(s) => s.values().map(|h| h.info.clone()).collect(),
            Err(_) => vec![],
        }
    }

    pub fn remove(&self, id: &str) {
        if let Ok(mut sessions) = self.sessions.lock() {
            sessions.remove(id);
        }
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
