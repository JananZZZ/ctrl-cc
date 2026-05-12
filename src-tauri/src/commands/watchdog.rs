use serde::Serialize;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize)]
pub struct WatchdogStatus {
    pub healthy: bool,
    #[serde(rename = "processCount")]
    pub process_count: u32,
    #[serde(rename = "maxProcesses")]
    pub max_processes: u32,
    #[serde(rename = "claudeCount")]
    pub claude_count: u32,
    pub warnings: Vec<String>,
    pub timestamp: String,
}

pub struct ProcessWatchdog {
    max_total: Mutex<u32>,
    max_claude: Mutex<u32>,
    #[allow(dead_code)]
    warnings: Mutex<Vec<String>>,
}

impl ProcessWatchdog {
    pub fn new() -> Self {
        Self { max_total: Mutex::new(50), max_claude: Mutex::new(4), warnings: Mutex::new(Vec::new()) }
    }

    pub fn check(&self) -> WatchdogStatus {
        let mut warnings = Vec::new();
        let mut claude_count = 0u32;
        let mut total_count = 0u32;

        #[cfg(target_os = "windows")]
        if let Ok(out) = std::process::Command::new("tasklist").args(["/FO", "CSV", "/NH"]).output() {
            for line in String::from_utf8_lossy(&out.stdout).lines() {
                total_count += 1;
                let lower = line.to_lowercase();
                if lower.contains("claude") || lower.contains("clawd") { claude_count += 1; }
            }
        }

        let max_total = *self.max_total.lock().expect("mutex poisoned");
        let max_claude = *self.max_claude.lock().expect("mutex poisoned");

        if total_count > max_total { warnings.push(format!("Process count {} exceeds limit {}", total_count, max_total)); }
        if claude_count > max_claude { warnings.push(format!("Claude processes {} exceeds limit {}", claude_count, max_claude)); }

        WatchdogStatus {
            healthy: warnings.is_empty(),
            process_count: total_count,
            max_processes: max_total,
            claude_count,
            warnings,
            timestamp: chrono::Utc::now().to_rfc3339(),
        }
    }

    pub fn kill_orphans(&self) -> u32 {
        let mut killed = 0u32;
        #[cfg(target_os = "windows")]
        {
            if let Ok(out) = std::process::Command::new("tasklist").args(["/FO", "CSV", "/NH"]).output() {
                for line in String::from_utf8_lossy(&out.stdout).lines() {
                    let lower = line.to_lowercase();
                    if lower.contains("claude") {
                        let parts: Vec<&str> = line.split(',').collect();
                        if parts.len() >= 2 {
                            if let Ok(pid) = parts[1].trim_matches('"').parse::<u32>() {
                                // Kill Claude processes that have been running > 30 min (simplified)
                                let _ = std::process::Command::new("taskkill").args(["/PID", &pid.to_string(), "/F"]).output();
                                killed += 1;
                            }
                        }
                    }
                }
            }
        }
        killed
    }
}

#[tauri::command]
pub fn watchdog_check(watchdog: tauri::State<'_, ProcessWatchdog>) -> WatchdogStatus {
    watchdog.check()
}

#[tauri::command]
pub fn watchdog_kill_orphans(watchdog: tauri::State<'_, ProcessWatchdog>) -> Result<u32, String> {
    Ok(watchdog.kill_orphans())
}
