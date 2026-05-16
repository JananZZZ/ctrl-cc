use crate::setup::config_writer::{ProviderConfigRequest, ProviderConfigSafe};
use crate::setup::task_manager::SetupTaskManager;
use crate::setup::types::SetupSnapshot;
use tauri::{AppHandle, State};

#[tauri::command]
pub async fn setup_detect_all() -> Result<SetupSnapshot, String> {
    tauri::async_runtime::spawn_blocking(|| {
        crate::setup::detector::detect_all_setup()
    })
    .await
    .map_err(|e| format!("setup_detect_all worker failed: {}", e))
}

#[tauri::command]
pub async fn setup_fix_powershell_policy(
    app: AppHandle,
    tasks: State<'_, SetupTaskManager>,
) -> Result<String, String> {
    let tasks = (*tasks).clone();
    tauri::async_runtime::spawn_blocking(move || {
        crate::setup::installer::fix_powershell_policy(app, &tasks)
    })
    .await
    .map_err(|e| format!("setup_fix_powershell_policy worker failed: {}", e))?
}

#[tauri::command]
pub async fn setup_set_npm_mirror(
    app: AppHandle,
    tasks: State<'_, SetupTaskManager>,
) -> Result<String, String> {
    let tasks = (*tasks).clone();
    tauri::async_runtime::spawn_blocking(move || {
        crate::setup::installer::set_npm_mirror(app, &tasks)
    })
    .await
    .map_err(|e| format!("setup_set_npm_mirror worker failed: {}", e))?
}

#[tauri::command]
pub async fn setup_install_claude_code_cli(
    app: AppHandle,
    tasks: State<'_, SetupTaskManager>,
) -> Result<String, String> {
    let tasks = (*tasks).clone();
    tauri::async_runtime::spawn_blocking(move || {
        crate::setup::installer::install_claude_code_cli(app, &tasks)
    })
    .await
    .map_err(|e| format!("setup_install_claude_code_cli worker failed: {}", e))?
}

#[tauri::command]
pub fn setup_write_provider_config(
    req: ProviderConfigRequest,
) -> Result<(), String> {
    crate::setup::config_writer::write_provider_config(req)
}

#[tauri::command]
pub fn setup_read_provider_config_safe() -> ProviderConfigSafe {
    crate::setup::config_writer::read_provider_config_safe()
}

#[tauri::command]
pub async fn setup_install_nodejs_lts(
    app: AppHandle,
    tasks: State<'_, SetupTaskManager>,
) -> Result<String, String> {
    let tasks = (*tasks).clone();
    tauri::async_runtime::spawn_blocking(move || {
        crate::setup::installer::install_nodejs_lts(app, &tasks)
    })
    .await
    .map_err(|e| format!("setup_install_nodejs_lts worker failed: {}", e))?
}

#[tauri::command]
pub async fn setup_install_git_for_windows(
    app: AppHandle,
    tasks: State<'_, SetupTaskManager>,
) -> Result<String, String> {
    let tasks = (*tasks).clone();
    tauri::async_runtime::spawn_blocking(move || {
        crate::setup::installer::install_git_for_windows(app, &tasks)
    })
    .await
    .map_err(|e| format!("setup_install_git_for_windows worker failed: {}", e))?
}

#[tauri::command]
pub fn setup_get_task_progress(
    tasks: State<SetupTaskManager>,
) -> Vec<crate::setup::types::SetupTaskProgress> {
    tasks.get_tasks()
}
