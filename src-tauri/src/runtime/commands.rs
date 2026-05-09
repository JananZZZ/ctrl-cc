use crate::runtime::claude_runner::ClaudeSession;
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
pub struct ClaudeChatOptions {
    pub session_id: String,
    pub project_id: String,
    pub cwd: String,
    pub model: String,
    pub prompt: String,
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
