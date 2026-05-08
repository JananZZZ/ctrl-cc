use crate::error::AppError;
use crate::pty::pty_manager::PtyManager;
use crate::pty::pty_types::PtyStartOptions;
use tauri::State;

#[tauri::command]
pub fn pty_check_support() -> Result<crate::pty::pty_types::PtySupportInfo, AppError> {
    Ok(PtyManager::check_support())
}

#[tauri::command]
pub fn pty_start_claude_session(
    app: tauri::AppHandle,
    manager: State<'_, PtyManager>,
    session_id: String,
    project_id: String,
    cli_path: String,
    cwd: String,
    extra_args: Vec<String>,
) -> Result<crate::pty::pty_types::PtySessionInfo, AppError> {
    let options = PtyStartOptions {
        session_id,
        project_id,
        cli_path,
        cwd,
        extra_args,
    };
    manager.create(options, app)
}

#[tauri::command]
pub fn pty_v2_write(
    manager: State<'_, PtyManager>,
    session_id: String,
    data: String,
) -> Result<(), AppError> {
    manager.write(&session_id, &data)
}

#[tauri::command]
pub fn pty_v2_resize(
    manager: State<'_, PtyManager>,
    session_id: String,
    rows: u16,
    cols: u16,
) -> Result<(), AppError> {
    manager.resize(&session_id, rows, cols)
}

#[tauri::command]
pub fn pty_send_ctrl_c(
    manager: State<'_, PtyManager>,
    session_id: String,
) -> Result<(), AppError> {
    manager.send_ctrl_c(&session_id)
}

#[tauri::command]
pub fn pty_send_ctrl_d(
    manager: State<'_, PtyManager>,
    session_id: String,
) -> Result<(), AppError> {
    manager.send_ctrl_d(&session_id)
}

#[tauri::command]
pub fn pty_v2_stop(
    manager: State<'_, PtyManager>,
    session_id: String,
) -> Result<(), AppError> {
    manager.stop(&session_id)
}

#[tauri::command]
pub fn pty_get_status(
    manager: State<'_, PtyManager>,
    session_id: String,
) -> Result<Option<crate::pty::pty_types::PtySessionStatus>, AppError> {
    Ok(manager.get_status(&session_id))
}

#[tauri::command]
pub fn pty_get_raw_log(
    manager: State<'_, PtyManager>,
    session_id: String,
    offset: u64,
    limit: u64,
) -> Result<String, AppError> {
    manager.get_raw_log(&session_id, offset, limit)
}

#[tauri::command]
pub fn pty_get_log_directory(
    manager: State<'_, PtyManager>,
    session_id: String,
) -> Result<String, AppError> {
    match manager.get_raw_log_path(&session_id) {
        Some(path) => Ok(path),
        None => Err(AppError::SessionNotFound(session_id)),
    }
}

#[tauri::command]
pub fn pty_list_sessions(
    manager: State<'_, PtyManager>,
) -> Result<Vec<crate::pty::pty_types::PtySessionInfo>, AppError> {
    Ok(manager.list_all())
}
