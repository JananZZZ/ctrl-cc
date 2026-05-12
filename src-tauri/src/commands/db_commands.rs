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

#[tauri::command]
pub fn save_project_to_db(db: State<'_, DbConn>, project: serde_json::Value) -> Result<(), String> {
    database::save_project(&db, &project)
}

#[tauri::command]
pub fn load_projects_from_db(db: State<'_, DbConn>) -> Result<Vec<serde_json::Value>, String> {
    database::load_projects(&db)
}

#[tauri::command]
pub fn delete_project_from_db(db: State<'_, DbConn>, id: String) -> Result<(), String> {
    database::delete_project(&db, &id)
}

#[tauri::command]
pub fn save_error_log_to_db(db: State<'_, DbConn>, entry: serde_json::Value) -> Result<(), String> {
    database::save_error_log(&db, &entry)
}

#[tauri::command]
pub fn load_error_logs_from_db(db: State<'_, DbConn>, limit: u32) -> Result<Vec<serde_json::Value>, String> {
    database::load_error_logs(&db, limit)
}

#[tauri::command]
pub fn delete_session_from_db(db: State<'_, DbConn>, id: String) -> Result<(), String> {
    database::delete_session(&db, &id)
}
