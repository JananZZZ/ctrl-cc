use serde::Serialize;
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize)]
pub struct FileChangeEvent {
    pub path: String,
    #[serde(rename = "changeType")]
    pub change_type: String,
    pub timestamp: String,
}

pub struct FileWatcher {
    handles: Mutex<HashMap<String, std::thread::JoinHandle<()>>>,
    running: Mutex<HashMap<String, bool>>,
}

impl FileWatcher {
    pub fn new() -> Self {
        Self { handles: Mutex::new(HashMap::new()), running: Mutex::new(HashMap::new()) }
    }

    pub fn watch(&self, id: String, path: String, app: AppHandle) {
        let _running_map = self.running.lock().expect("mutex poisoned");
        // Simple polling-based watcher (1s interval)
        let mut handles = self.handles.lock().expect("mutex poisoned");
        let app_clone = app.clone();
        let path_clone = path.clone();
        let _id_clone = id.clone();

        let handle = std::thread::spawn(move || {
            let mut last_modified = std::time::SystemTime::now();
            loop {
                std::thread::sleep(std::time::Duration::from_secs(2));
                if let Ok(metadata) = std::fs::metadata(&path_clone) {
                    if let Ok(modified) = metadata.modified() {
                        if modified > last_modified {
                            last_modified = modified;
                            let event = FileChangeEvent {
                                path: path_clone.clone(),
                                change_type: "modified".to_string(),
                                timestamp: chrono::Utc::now().to_rfc3339(),
                            };
                            let _ = app_clone.emit("file:changed", &event);
                        }
                    }
                }
            }
        });
        handles.insert(id, handle);
    }

    pub fn unwatch(&self, id: &str) {
        let mut handles = self.handles.lock().expect("mutex poisoned");
        handles.remove(id);
    }
}

#[tauri::command]
pub fn watch_directory(
    id: String, path: String, app: tauri::AppHandle,
    watcher: tauri::State<'_, FileWatcher>,
) -> Result<(), String> {
    watcher.watch(id, path, app);
    Ok(())
}

#[tauri::command]
pub fn unwatch_directory(
    id: String,
    watcher: tauri::State<'_, FileWatcher>,
) -> Result<(), String> {
    watcher.unwatch(&id);
    Ok(())
}
