use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct SystemHealth {
    pub os: String,
    #[serde(rename = "totalMemoryGB")]
    pub total_memory_gb: f64,
    #[serde(rename = "freeMemoryGB")]
    pub free_memory_gb: f64,
    #[serde(rename = "cpuCount")]
    pub cpu_count: u32,
    #[serde(rename = "processCount")]
    pub process_count: u32,
    #[serde(rename = "claudeRunning")]
    pub claude_running: bool,
    #[serde(rename = "dbSizeKB")]
    pub db_size_kb: u64,
}

#[tauri::command]
pub fn get_system_health() -> Result<SystemHealth, String> {
    let mut health = SystemHealth {
        os: std::env::consts::OS.to_string(),
        total_memory_gb: 0.0,
        free_memory_gb: 0.0,
        cpu_count: num_cpus::get() as u32,
        process_count: 0,
        claude_running: false,
        db_size_kb: 0,
    };

    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        if let Ok(out) = Command::new("wmic").args(["OS", "get", "TotalVisibleMemorySize", "/Value"]).output() {
            let s = String::from_utf8_lossy(&out.stdout);
            for line in s.lines() {
                if let Some(v) = line.split('=').nth(1) {
                    if let Ok(kb) = v.trim().parse::<f64>() {
                        health.total_memory_gb = kb / (1024.0 * 1024.0);
                    }
                }
            }
        }
        if let Ok(out) = Command::new("wmic").args(["OS", "get", "FreePhysicalMemory", "/Value"]).output() {
            let s = String::from_utf8_lossy(&out.stdout);
            for line in s.lines() {
                if let Some(v) = line.split('=').nth(1) {
                    if let Ok(kb) = v.trim().parse::<f64>() {
                        health.free_memory_gb = kb / (1024.0 * 1024.0);
                    }
                }
            }
        }
        // Count processes
        if let Ok(out) = Command::new("tasklist").output() {
            health.process_count = String::from_utf8_lossy(&out.stdout).lines().count() as u32;
        }
        // Check if claude is running
        if let Ok(out) = Command::new("tasklist").args(["/FI", "IMAGENAME eq claude.exe"]).output() {
            health.claude_running = String::from_utf8_lossy(&out.stdout).contains("claude.exe");
        }
    }

    // DB size
    if let Some(data_dir) = dirs::data_dir() {
        let db_path = data_dir.join("Ctrl-CC").join("ctrlcc.db");
        if let Ok(meta) = std::fs::metadata(&db_path) {
            health.db_size_kb = meta.len() / 1024;
        }
    }

    Ok(health)
}
