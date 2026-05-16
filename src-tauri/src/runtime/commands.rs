use crate::runtime::claude_runner::ClaudeSession;
use crate::utils::hidden_command::hidden_command;
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::State;

pub struct ClaudeManager {
    pub sessions: Mutex<HashMap<String, ClaudeSession>>,
}

impl ClaudeManager {
    pub fn new() -> Self {
        Self { sessions: Mutex::new(HashMap::new()) }
    }
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeChatOptions {
    pub session_id: String,
    pub project_id: String,
    pub cwd: String,
    pub model: String,
    pub prompt: String,
    #[serde(default)]
    pub effort: Option<String>,
    #[serde(default)]
    pub permission_mode: Option<String>,
    #[serde(default)]
    pub resume_session: Option<String>,
}

#[tauri::command]
pub fn create_claude_chat(
    app: tauri::AppHandle,
    manager: State<'_, ClaudeManager>,
    options: ClaudeChatOptions,
) -> Result<serde_json::Value, String> {
    let session = ClaudeSession::spawn(
        options.session_id.clone(),
        options.project_id,
        options.cwd,
        options.model,
        options.prompt,
        options.effort,
        options.permission_mode,
        options.resume_session,
        app,
    ).map_err(|e| e.to_string())?;

    let sid = session.session_id.clone();
    let mut sessions = manager.sessions.lock().map_err(|e| e.to_string())?;

    // Stop previous session for this ID if exists
    if let Some(mut old) = sessions.remove(&sid) {
        old.stop();
    }
    sessions.insert(sid.clone(), session);

    Ok(serde_json::json!({
        "sessionId": sid,
        "status": "started"
    }))
}

#[tauri::command]
pub fn stop_claude_chat(
    manager: State<'_, ClaudeManager>,
    session_id: String,
) -> Result<(), String> {
    let mut sessions = manager.sessions.lock().map_err(|e| e.to_string())?;
    if let Some(mut session) = sessions.remove(&session_id) {
        session.stop();
    }
    Ok(())
}


#[derive(Debug, Clone, serde::Serialize)]
pub struct ClaudeCapability {
    #[serde(rename = "claudePath")]
    pub claude_path: Option<String>,
    pub version: Option<String>,
    pub exists: bool,
    #[serde(rename = "authStatus")]
    pub auth_status: Option<String>,
    #[serde(rename = "supportsStreamJson")]
    pub supports_stream_json: bool,
    #[serde(rename = "supportsMCP")]
    pub supports_mcp: bool,
    #[serde(rename = "supportsAgents")]
    pub supports_agents: bool,
    #[serde(rename = "checkedAt")]
    pub checked_at: String,
    pub errors: Vec<String>,
}

/// Discover the full path to the Claude CLI on the system.
/// Tries `which`, then falls back to known Windows npm global paths.
pub fn discover_claude_path() -> Option<String> {
    // Strategy 1: Use `which` crate (cross-platform, checks PATHEXT on Windows)
    if let Ok(path) = which::which("claude") {
        let p = path.to_string_lossy().to_string();
        log::info!("Claude CLI found via which: {}", p);
        return Some(p);
    }
    // Strategy 2: Check known npm global install paths (Windows)
    #[cfg(target_os = "windows")]
    {
        let candidates = [
            std::env::var("APPDATA").map(|d| format!("{}\\npm\\claude.cmd", d)).ok(),
            std::env::var("LOCALAPPDATA").map(|d| format!("{}\\npm\\claude.cmd", d)).ok(),
            Some(r"C:\Program Files\nodejs\claude.cmd".to_string()),
            std::env::var("USERPROFILE").map(|d| format!("{}\\AppData\\Roaming\\npm\\claude.cmd", d)).ok(),
        ];
        for cand in candidates.into_iter().flatten() {
            if std::path::Path::new(&cand).exists() {
                log::info!("Claude CLI found at known path: {}", cand);
                return Some(cand);
            }
        }
    }
    log::warn!("Claude CLI not found via which or known paths");
    None
}

#[tauri::command]
pub fn claude_check_capability() -> Result<ClaudeCapability, String> {
    let now = chrono::Utc::now().to_rfc3339();
    let mut cap = ClaudeCapability {
        claude_path: None,
        version: None, exists: false, auth_status: None,
        supports_stream_json: true, supports_mcp: true, supports_agents: true,
        checked_at: now, errors: vec![],
    };

    let cli_path = match discover_claude_path() {
        Some(p) => { cap.claude_path = Some(p.clone()); p }
        None => {
            cap.errors.push("Claude CLI not found in PATH or known install locations. Install with: npm install -g @anthropic-ai/claude-code".into());
            return Ok(cap);
        }
    };

    match hidden_command(&cli_path).arg("--version").output() {
        Ok(out) => {
            cap.exists = true;
            let raw = String::from_utf8_lossy(&out.stdout).trim().to_string();
            cap.version = Some(raw.split_whitespace().next().unwrap_or(&raw).to_string());
        }
        Err(e) => {
            cap.errors.push(format!("CLI --version failed: {}", e));
            return Ok(cap);
        }
    }

    match hidden_command(&cli_path).args(["auth", "status"]).output() {
        Ok(out) => {
            let status = String::from_utf8_lossy(&out.stdout).to_lowercase();
            cap.auth_status = Some(if status.contains("authenticated") || status.contains("logged") {
                "authenticated".into()
            } else {
                "not_authenticated".into()
            });
        }
        Err(e) => { cap.errors.push(format!("Auth check failed: {}", e)); }
    }

    Ok(cap)
}

#[tauri::command]
pub fn send_claude_input(
    manager: State<'_, ClaudeManager>,
    session_id: String,
    text: String,
) -> Result<(), String> {
    let sessions = manager.sessions.lock().map_err(|e| e.to_string())?;
    let session = sessions.get(&session_id).ok_or_else(|| format!("Session not found: {}", session_id))?;
    session.send_input(&text).map_err(|e| e.to_string())
}
