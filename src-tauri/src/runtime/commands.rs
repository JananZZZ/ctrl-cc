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

#[tauri::command]
pub fn create_claude_chat(
    app: tauri::AppHandle,
    manager: State<'_, ClaudeManager>,
    session_id: String,
    project_id: String,
    cwd: String,
    model: String,
    prompt: String,
) -> Result<String, String> {
    let session = ClaudeSession::spawn(
        session_id.clone(), project_id, cwd, model, prompt, app,
    ).map_err(|e| e.to_string())?;
    let mut sessions = manager.sessions.lock().map_err(|e| e.to_string())?;
    sessions.insert(session_id.clone(), session);
    Ok(session_id)
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
