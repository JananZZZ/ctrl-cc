use serde::{Deserialize, Serialize};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusLineData {
    pub model: Option<String>,
    pub cost: Option<f64>,
    #[serde(rename = "contextWindow")]
    pub context_window: Option<u32>,
    pub effort: Option<String>,
    pub thinking: Option<bool>,
    pub session_id: Option<String>,
    pub workspace: Option<String>,
    pub version: Option<String>,
    #[serde(rename = "outputStyle")]
    pub output_style: Option<String>,
    #[serde(rename = "inputTokens")]
    pub input_tokens: Option<u64>,
    #[serde(rename = "outputTokens")]
    pub output_tokens: Option<u64>,
    pub raw: Option<String>,
}

pub struct StatusLineProbe {
    handle: Mutex<Option<thread::JoinHandle<()>>>,
    running: Arc<Mutex<bool>>,
}

impl StatusLineProbe {
    pub fn new() -> Self {
        Self { handle: Mutex::new(None), running: Arc::new(Mutex::new(false)) }
    }

    pub fn start(&self, app: AppHandle) {
        let running = self.running.clone();
        *running.lock().expect("mutex poisoned") = true;
        let r = running.clone();

        let handle = thread::spawn(move || {
            // Poll Claude Code for statusLine output
            while *r.lock().expect("mutex poisoned") {
                // Try reading status from Claude CLI
                if let Ok(output) = Command::new("claude")
                    .args(["status", "--json"])
                    .stdout(Stdio::piped())
                    .stderr(Stdio::null())
                    .output()
                {
                    if output.status.success() {
                        let raw = String::from_utf8_lossy(&output.stdout).to_string();
                        // Parse and emit
                        if let Ok(data) = serde_json::from_str::<serde_json::Value>(&raw) {
                            let status = StatusLineData {
                                model: data["model"].as_str().map(|s| s.to_string()),
                                cost: data["cost"].as_f64(),
                                context_window: data["context_window"].as_u64().map(|v| v as u32),
                                effort: data["effort"].as_str().map(|s| s.to_string()),
                                thinking: data["thinking"].as_bool(),
                                session_id: data["session_id"].as_str().map(|s| s.to_string()),
                                workspace: data["workspace"].as_str().map(|s| s.to_string()),
                                version: data["version"].as_str().map(|s| s.to_string()),
                                output_style: data["output_style"].as_str().map(|s| s.to_string()),
                                input_tokens: data["input_tokens"].as_u64(),
                                output_tokens: data["output_tokens"].as_u64(),
                                raw: Some(raw),
                            };
                            let _ = app.emit("statusline:update", &status);
                        }
                    }
                }
                thread::sleep(std::time::Duration::from_secs(5));
            }
        });

        *self.handle.lock().expect("mutex poisoned") = Some(handle);
    }

    pub fn stop(&self) {
        *self.running.lock().expect("mutex poisoned") = false;
    }
}

#[tauri::command]
pub fn start_statusline_probe(
    app: AppHandle,
    probe: tauri::State<'_, StatusLineProbe>,
) -> Result<(), String> {
    probe.start(app);
    Ok(())
}

#[tauri::command]
pub fn stop_statusline_probe(
    probe: tauri::State<'_, StatusLineProbe>,
) -> Result<(), String> {
    probe.stop();
    Ok(())
}
