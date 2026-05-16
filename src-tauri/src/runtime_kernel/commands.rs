use tauri::State;
use super::manager::RuntimeKernel;
use super::types::*;

#[tauri::command]
pub async fn runtime_kernel_start_session(app: tauri::AppHandle, kernel: State<'_, RuntimeKernel>, req: RuntimeKernelStartRequest) -> Result<RuntimeKernelSessionSnapshot, String> {
    let kernel = kernel.inner().clone();
    tauri::async_runtime::spawn_blocking(move || kernel.start_session(app, req)).await.map_err(|e| format!("runtime_kernel_start_session worker failed: {}", e))?
}

#[tauri::command]
pub async fn runtime_kernel_submit_user_message(kernel: State<'_, RuntimeKernel>, req: RuntimeKernelSubmitRequest) -> Result<(), String> {
    let kernel = kernel.inner().clone();
    tauri::async_runtime::spawn_blocking(move || kernel.submit_user_message(req)).await.map_err(|e| format!("runtime_kernel_submit_user_message worker failed: {}", e))?
}

#[tauri::command]
pub async fn runtime_kernel_write_terminal(kernel: State<'_, RuntimeKernel>, req: RuntimeKernelWriteRequest) -> Result<(), String> {
    let kernel = kernel.inner().clone();
    tauri::async_runtime::spawn_blocking(move || kernel.write_terminal(req)).await.map_err(|e| format!("runtime_kernel_write_terminal worker failed: {}", e))?
}

#[tauri::command]
pub async fn runtime_kernel_stop_session(kernel: State<'_, RuntimeKernel>, req: RuntimeKernelStopRequest) -> Result<(), String> {
    let kernel = kernel.inner().clone();
    tauri::async_runtime::spawn_blocking(move || kernel.stop_session(req)).await.map_err(|e| format!("runtime_kernel_stop_session worker failed: {}", e))?
}

#[tauri::command]
pub fn runtime_kernel_list_sessions(kernel: State<'_, RuntimeKernel>) -> Result<Vec<RuntimeKernelSessionSnapshot>, String> {
    kernel.list_sessions()
}
