use tauri::AppHandle;
use tauri::Emitter;
use crate::diagnostics::types::DiagnosticEvent;

/// 发射诊断事件到前端
#[tauri::command]
pub fn emit_diagnostic(app: AppHandle, event: DiagnosticEvent) {
    let _ = app.emit("diagnostic://event", event);
}
