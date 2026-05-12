use serde::Serialize;
use std::fs;

#[derive(Debug, Serialize)]
pub struct ScannedSession {
    pub id: String,
    pub title: String,
    pub cwd: String,
    pub model: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "claudeSessionId")]
    pub claude_session_id: Option<String>,
    pub status: String,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}

/// Scan the user's computer for Claude Code CLI sessions.
/// Searches: ~/.claude/transcripts/ for session directories,
/// ~/.claude/projects/ for project metadata.
#[tauri::command]
pub fn scan_claude_sessions() -> Result<Vec<ScannedSession>, String> {
    let mut sessions = Vec::new();

    let home = dirs::home_dir().ok_or_else(|| "Cannot find home directory".to_string())?;
    let claude_dir = home.join(".claude");

    if !claude_dir.exists() {
        return Ok(sessions); // No Claude Code data found
    }

    // 1. Scan projects for metadata
    let mut project_names: std::collections::HashMap<String, String> = std::collections::HashMap::new();
    let projects_dir = claude_dir.join("projects");
    if projects_dir.exists() {
        if let Ok(entries) = fs::read_dir(&projects_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                        // Check for CLAUDE.md or other markers to confirm it's a Claude project
                        let claude_md = path.join("CLAUDE.md");
                        let memory_dir = path.join("memory");
                        if claude_md.exists() || memory_dir.exists() {
                            project_names.insert(name.to_string(), name.to_string());
                        }
                    }
                }
            }
        }
    }

    // 2. Scan transcripts directory for sessions
    let transcripts_dir = claude_dir.join("transcripts");
    if transcripts_dir.exists() {
        if let Ok(entries) = fs::read_dir(&transcripts_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    if let Some(session_name) = path.file_name().and_then(|n| n.to_str()) {
                        let metadata = entry.metadata().ok();
                        let created = metadata
                            .and_then(|m| m.created().ok())
                            .and_then(|t| {
                                chrono::DateTime::from_timestamp(
                                    t.duration_since(std::time::UNIX_EPOCH)
                                        .unwrap_or_default()
                                        .as_secs() as i64,
                                    0,
                                )
                            })
                            .map(|dt| dt.to_rfc3339())
                            .unwrap_or_else(|| chrono::Utc::now().to_rfc3339());

                        let modified = entry.metadata().ok()
                            .and_then(|m| m.modified().ok())
                            .and_then(|t| {
                                chrono::DateTime::from_timestamp(
                                    t.duration_since(std::time::UNIX_EPOCH)
                                        .unwrap_or_default()
                                        .as_secs() as i64,
                                    0,
                                )
                            })
                            .map(|dt| dt.to_rfc3339())
                            .unwrap_or_else(|| created.clone());

                        // Try to determine project from session data
                        let (project_id, cwd) = detect_session_project(&transcripts_dir, session_name, &project_names);

                        sessions.push(ScannedSession {
                            id: format!("scanned-{}", session_name),
                            title: session_name.to_string(),
                            cwd,
                            model: "sonnet".to_string(),
                            project_id,
                            claude_session_id: Some(session_name.to_string()),
                            status: "completed".to_string(),
                            created_at: created,
                            updated_at: modified,
                        });
                    }
                }
            }
        }

        // Sort by creation time, newest first
        sessions.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    }

    // 3. If no sessions found, check for Claude config as fallback
    if sessions.is_empty() {
        let settings_json = claude_dir.join("settings.json");
        if settings_json.exists() {
            // At least Claude Code is installed — return empty but indicate it's available
            log::info!("Claude Code settings found but no sessions to import");
        }
    }

    Ok(sessions)
}

/// Try to detect which project a session belongs to and its CWD.
fn detect_session_project(
    transcripts_dir: &std::path::Path,
    session_name: &str,
    project_names: &std::collections::HashMap<String, String>,
) -> (String, String) {
    // Check for project-specific session linking
    let session_dir = transcripts_dir.join(session_name);

    // Look for any JSON files that might contain metadata
    if let Ok(entries) = fs::read_dir(&session_dir) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.ends_with(".json") {
                if let Ok(content) = fs::read_to_string(entry.path()) {
                    // Try to extract cwd from JSON
                    if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
                        if let Some(cwd) = val.get("cwd").and_then(|v| v.as_str()) {
                            let cwd_str = cwd.to_string();
                            // Match cwd to known project
                            for (pid, _pname) in project_names {
                                if cwd_str.contains(pid) {
                                    return (pid.clone(), cwd_str);
                                }
                            }
                            return ("default".to_string(), cwd_str);
                        }
                    }
                }
            }
        }
    }

    // Default fallback
    ("default".to_string(), ".".to_string())
}
