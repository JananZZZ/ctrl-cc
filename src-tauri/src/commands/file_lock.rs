use serde::Serialize;
use std::collections::HashMap;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize)]
pub struct FileLock {
    pub path: String,
    #[serde(rename = "sessionId")]
    pub session_id: String,
    pub timestamp: String,
    #[serde(rename = "lockType")]
    pub lock_type: String,
}

pub struct FileLockManager {
    locks: Mutex<HashMap<String, FileLock>>,
}

impl FileLockManager {
    pub fn new() -> Self { Self { locks: Mutex::new(HashMap::new()) } }

    pub fn acquire(&self, path: &str, session_id: &str, lock_type: &str) -> Result<(), String> {
        let mut locks = self.locks.lock().expect("mutex poisoned");
        if let Some(existing) = locks.get(path) {
            if existing.session_id != session_id {
                return Err(format!("File '{}' locked by session {}", path, existing.session_id));
            }
        }
        locks.insert(path.to_string(), FileLock {
            path: path.to_string(), session_id: session_id.to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(), lock_type: lock_type.to_string(),
        });
        Ok(())
    }

    pub fn release(&self, path: &str, session_id: &str) {
        let mut locks = self.locks.lock().expect("mutex poisoned");
        if let Some(lock) = locks.get(path) {
            if lock.session_id == session_id { locks.remove(path); }
        }
    }

    pub fn list(&self) -> Vec<FileLock> { self.locks.lock().expect("mutex poisoned").values().cloned().collect() }
}

#[tauri::command]
pub fn acquire_file_lock(manager: tauri::State<'_, FileLockManager>, path: String, session_id: String, lock_type: Option<String>) -> Result<(), String> {
    manager.acquire(&path, &session_id, &lock_type.unwrap_or_else(|| "write".into()))
}

#[tauri::command]
pub fn release_file_lock(manager: tauri::State<'_, FileLockManager>, path: String, session_id: String) -> Result<(), String> {
    manager.release(&path, &session_id);
    Ok(())
}

#[tauri::command]
pub fn list_file_locks(manager: tauri::State<'_, FileLockManager>) -> Result<Vec<FileLock>, String> {
    Ok(manager.list())
}
