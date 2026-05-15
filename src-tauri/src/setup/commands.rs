use crate::setup::config_writer::{ProviderConfigRequest, ProviderConfigSafe};
use crate::setup::task_manager::SetupTaskManager;
use crate::setup::types::SetupSnapshot;
use tauri::{AppHandle, State};

#[tauri::command]
pub fn setup_detect_all() -> SetupSnapshot {
    crate::setup::detector::detect_all_setup()
}

#[tauri::command]
pub fn setup_fix_powershell_policy(
    app: AppHandle,
    tasks: State<SetupTaskManager>,
) -> Result<String, String> {
    crate::setup::installer::fix_powershell_policy(app, &tasks)
}

#[tauri::command]
pub fn setup_set_npm_mirror(
    app: AppHandle,
    tasks: State<SetupTaskManager>,
) -> Result<String, String> {
    crate::setup::installer::set_npm_mirror(app, &tasks)
}

#[tauri::command]
pub fn setup_install_claude_code_cli(
    app: AppHandle,
    tasks: State<SetupTaskManager>,
) -> Result<String, String> {
    crate::setup::installer::install_claude_code_cli(app, &tasks)
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
pub fn setup_install_nodejs_lts(
    app: AppHandle,
    tasks: State<SetupTaskManager>,
) -> Result<String, String> {
    crate::setup::installer::install_nodejs_lts(app, &tasks)
}

#[tauri::command]
pub fn setup_install_git_for_windows(
    app: AppHandle,
    tasks: State<SetupTaskManager>,
) -> Result<String, String> {
    crate::setup::installer::install_git_for_windows(app, &tasks)
}

#[tauri::command]
pub fn setup_get_task_progress(
    tasks: State<SetupTaskManager>,
) -> Vec<crate::setup::types::SetupTaskProgress> {
    tasks.get_tasks()
}
