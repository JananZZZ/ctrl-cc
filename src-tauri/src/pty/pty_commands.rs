use crate::error::AppError;
use crate::pty::pty_manager::PtyManager;
use crate::pty::pty_session::runtime_trace_log;
use crate::pty::pty_types::{PtySessionDebugInfo, PtyStartOptions};
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
    runtime_trace_log("no-trace", &session_id, &session_id, "pty.start.request", "start", "");
    let options = PtyStartOptions {
        session_id: session_id.clone(),
        project_id,
        cli_path,
        cwd,
        extra_args,
    };
    let result = manager.create(options, app);
    match &result {
        Ok(info) => runtime_trace_log("no-trace", &session_id, &info.id, "pty.start.request", "success", ""),
        Err(e) => runtime_trace_log("no-trace", &session_id, &session_id, "pty.start.request", "failed", &e.to_string()),
    }
    result
}

#[tauri::command]
pub fn pty_v2_write(
    manager: State<'_, PtyManager>,
    session_id: String,
    data: String,
    trace_id: Option<String>,
) -> Result<(), AppError> {
    let ui_id = &session_id;
    let pty_id = &session_id;
    runtime_trace_log(
        trace_id.as_deref().unwrap_or("no-trace"),
        ui_id, pty_id,
        "pty_v2_write", "start", ""
    );
    let result = manager.write(&session_id, &data);
    match &result {
        Ok(()) => runtime_trace_log(
            trace_id.as_deref().unwrap_or("no-trace"),
            ui_id, pty_id,
            "pty_v2_write", "success", ""
        ),
        Err(e) => runtime_trace_log(
            trace_id.as_deref().unwrap_or("no-trace"),
            ui_id, pty_id,
            "pty_v2_write", "failed", &e.to_string()
        ),
    }
    result
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

/// Session Mapping diagnostic: returns detailed debug info for contract probe.
#[tauri::command]
pub fn runtime_list_pty_sessions(
    manager: State<'_, PtyManager>,
) -> Result<Vec<PtySessionDebugInfo>, String> {
    manager.list_debug_sessions()
}
