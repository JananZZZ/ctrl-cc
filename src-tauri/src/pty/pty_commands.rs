use crate::error::AppError;
use crate::pty::pty_manager::PtyManager;
use crate::pty::pty_session::runtime_trace_log;
use crate::pty::pty_types::{PtySessionDebugInfo, PtyStartOptions};
use tauri::State;

#[tauri::command]
pub fn pty_check_support() -> Result<crate::pty::pty_types::PtySupportInfo, AppError> {
    Ok(PtyManager::check_support())
}

/// Deprecated wrapper — no frontend surface may call this directly.
/// Use runtime_start_interactive instead.
/// Creates ui_session_id=session_id and pty_session_id for backward compatibility.
#[tauri::command]
pub fn pty_start_claude_session(
    app: tauri::AppHandle,
    manager: State<'_, PtyManager>,
    session_id: Option<String>,       // Deprecated — use ui_session_id
    ui_session_id: Option<String>,    // v9.0: ses-xxx
    pty_session_id: Option<String>,   // v9.0: pty-uuid
    trace_id: Option<String>,         // v9.0: trace-uuid
    project_id: String,
    cli_path: String,
    cwd: String,
    extra_args: Vec<String>,
) -> Result<crate::pty::pty_types::PtySessionInfo, AppError> {
    let ui_sid = ui_session_id
        .or(session_id.clone())
        .unwrap_or_else(|| format!("ses-{}", uuid::Uuid::new_v4()));
    let pty_sid = pty_session_id.unwrap_or_else(|| format!("pty-{}", uuid::Uuid::new_v4()));
    let tr_id = trace_id.unwrap_or_else(|| format!("trace-{}", uuid::Uuid::new_v4()));

    runtime_trace_log(&tr_id, &ui_sid, &pty_sid, "pty.start.request", "start", "");

    let options = PtyStartOptions {
        trace_id: tr_id.clone(),
        ui_session_id: ui_sid.clone(),
        pty_session_id: pty_sid.clone(),
        project_id,
        cli_path,
        cwd,
        extra_args,
        resume_claude_session_id: None,
        selected_strategy: None,
        session_id: Some(ui_sid.clone()),
    };
    let result = manager.create(options, app);
    match &result {
        Ok(info) => runtime_trace_log(&tr_id, &ui_sid, &info.id, "pty.start.request", "success", ""),
        Err(e) => runtime_trace_log(&tr_id, &ui_sid, &pty_sid, "pty.start.request", "failed", &e.to_string()),
    }
    result
}

/// Deprecated wrapper — no frontend surface may call this directly.
/// Use runtime_write instead. Uses pty_session_id for registry lookup.
#[tauri::command]
pub fn pty_v2_write(
    manager: State<'_, PtyManager>,
    session_id: Option<String>,       // Deprecated
    pty_session_id: Option<String>,   // v9.0: pty-uuid registry key
    ui_session_id: Option<String>,    // v9.0: for tracing
    data: String,
    trace_id: Option<String>,
) -> Result<(), AppError> {
    let pty_sid = pty_session_id
        .or(session_id.clone())
        .unwrap_or_default();
    let ui_sid = ui_session_id.unwrap_or_else(|| pty_sid.clone());
    let tr_id = trace_id.unwrap_or_else(|| "no-trace".to_string());

    runtime_trace_log(&tr_id, &ui_sid, &pty_sid, "pty_v2_write", "start", "");
    let result = manager.write(&pty_sid, &data);
    match &result {
        Ok(()) => runtime_trace_log(&tr_id, &ui_sid, &pty_sid, "pty_v2_write", "success", ""),
        Err(e) => runtime_trace_log(&tr_id, &ui_sid, &pty_sid, "pty_v2_write", "failed", &e.to_string()),
    }
    result
}

#[tauri::command]
pub fn pty_v2_resize(
    manager: State<'_, PtyManager>,
    pty_session_id: Option<String>,
    session_id: Option<String>,
    rows: u16,
    cols: u16,
) -> Result<(), AppError> {
    let id = pty_session_id.or(session_id).unwrap_or_default();
    manager.resize(&id, rows, cols)
}

#[tauri::command]
pub fn pty_send_ctrl_c(
    manager: State<'_, PtyManager>,
    pty_session_id: Option<String>,
    session_id: Option<String>,
) -> Result<(), AppError> {
    let id = pty_session_id.or(session_id).unwrap_or_default();
    manager.send_ctrl_c(&id)
}

#[tauri::command]
pub fn pty_send_ctrl_d(
    manager: State<'_, PtyManager>,
    pty_session_id: Option<String>,
    session_id: Option<String>,
) -> Result<(), AppError> {
    let id = pty_session_id.or(session_id).unwrap_or_default();
    manager.send_ctrl_d(&id)
}

#[tauri::command]
pub fn pty_v2_stop(
    manager: State<'_, PtyManager>,
    pty_session_id: Option<String>,
    session_id: Option<String>,
    ui_session_id: Option<String>,
) -> Result<(), AppError> {
    let id = pty_session_id.or(session_id.clone()).unwrap_or_default();
    let _ui = ui_session_id.unwrap_or_else(|| id.clone());
    manager.stop(&id)
}

#[tauri::command]
pub fn pty_get_status(
    manager: State<'_, PtyManager>,
    pty_session_id: Option<String>,
    session_id: Option<String>,
) -> Result<Option<crate::pty::pty_types::PtySessionStatus>, AppError> {
    let id = pty_session_id.or(session_id).unwrap_or_default();
    Ok(manager.get_status(&id))
}

#[tauri::command]
pub fn pty_get_raw_log(
    manager: State<'_, PtyManager>,
    pty_session_id: Option<String>,
    session_id: Option<String>,
    offset: u64,
    limit: u64,
) -> Result<String, AppError> {
    let id = pty_session_id.or(session_id).unwrap_or_default();
    manager.get_raw_log(&id, offset, limit)
}

#[tauri::command]
pub fn pty_get_log_directory(
    manager: State<'_, PtyManager>,
    pty_session_id: Option<String>,
    session_id: Option<String>,
) -> Result<String, AppError> {
    let id = pty_session_id.or(session_id).unwrap_or_default();
    match manager.get_raw_log_path(&id) {
        Some(path) => Ok(path),
        None => Err(AppError::SessionNotFound(id)),
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
