use crate::database::{self, DbConn};
use tauri::State;

#[tauri::command]
pub fn save_session_to_db(db: State<'_, DbConn>, session: serde_json::Value) -> Result<(), String> {
    database::save_session(&db, &session)
}

#[tauri::command]
pub fn load_sessions_from_db(db: State<'_, DbConn>) -> Result<Vec<serde_json::Value>, String> {
    database::load_sessions(&db)
}
