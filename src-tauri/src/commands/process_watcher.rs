use serde::Serialize;
use std::sync::Mutex;
use std::thread;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize)]
pub struct ProcessSnapshot {
    pub pid: u32,
    pub name: String,
    #[serde(rename = "cpuPercent")]
    pub cpu_percent: f64,
    #[serde(rename = "memoryMB")]
    pub memory_mb: f64,
    pub status: String,
    pub timestamp: String,
}

pub struct ProcessWatcher {
    handle: Mutex<Option<thread::JoinHandle<()>>>,
    running: Mutex<bool>,
}

impl ProcessWatcher {
    pub fn new() -> Self {
        Self { handle: Mutex::new(None), running: Mutex::new(false) }
    }

    pub fn start(&self, app: AppHandle, interval_secs: u64) {
        *self.running.lock().expect("mutex poisoned") = true;
        let _running = self.running.lock().expect("mutex poisoned");
        // Simple process count check
        let handle = thread::spawn(move || {
            loop {
                thread::sleep(std::time::Duration::from_secs(interval_secs));
                let mut snapshots = Vec::new();
                
                #[cfg(target_os = "windows")]
                {
                    if let Ok(out) = std::process::Command::new("tasklist")
                        .args(["/FO", "CSV", "/NH"]).output()
                    {
                        for line in String::from_utf8_lossy(&out.stdout).lines() {
                            let parts: Vec<&str> = line.split(',').collect();
                            if parts.len() >= 5 {
                                let name = parts[0].trim_matches('"').to_lowercase();
                                if name.contains("claude") || name.contains("node") || name.contains("git") {
                                    if let Ok(pid) = parts[1].trim_matches('"').parse::<u32>() {
                                        snapshots.push(ProcessSnapshot {
                                            pid, name: parts[0].trim_matches('"').to_string(),
                                            cpu_percent: 0.0,
                                            memory_mb: parts[4].trim_matches('"').replace("K","").parse::<f64>().unwrap_or(0.0) / 1024.0,
                                            status: "running".to_string(),
                                            timestamp: chrono::Utc::now().to_rfc3339(),
                                        });
                                    }
                                }
                            }
                        }
                    }
                }

                if !snapshots.is_empty() {
                    let _ = app.emit("process:snapshot", &snapshots);
                }
            }
        });
        *self.handle.lock().expect("mutex poisoned") = Some(handle);
    }

    pub fn stop(&self) {
        *self.running.lock().expect("mutex poisoned") = false;
    }
}

#[tauri::command]
pub fn start_process_watcher(
    app: AppHandle,
    watcher: tauri::State<'_, ProcessWatcher>,
    interval_secs: Option<u64>,
) -> Result<(), String> {
    watcher.start(app, interval_secs.unwrap_or(10));
    Ok(())
}

#[tauri::command]
pub fn stop_process_watcher(
    watcher: tauri::State<'_, ProcessWatcher>,
) -> Result<(), String> {
    watcher.stop();
    Ok(())
}
