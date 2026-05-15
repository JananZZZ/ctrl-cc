#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod database;
mod error;
mod pty;
mod runtime;
mod runtime_v2;
mod setup;

use pty::PtyManager;
use runtime::commands::ClaudeManager;
use runtime::claude_discovery::probe_claude_capability;
use runtime::event_payloads::{
    ClaudeCapabilityPayload, PtyResizeRequest, PtyStopRequest, PtyWriteRequest,
    StartClaudePtyRequest, StartClaudePtyResponse,
};
use runtime::pty_session::PtySessionManager;
use runtime::structured_runtime::{start_structured_run, StructuredRunRequest, StructuredRunResponse};

// --- New runtime PTY commands (plan P0-P10) ---

#[tauri::command]
fn claude_probe_capabilities() -> ClaudeCapabilityPayload {
    probe_claude_capability()
}

#[tauri::command]
fn pty_start_claude(
    app: tauri::AppHandle,
    manager: tauri::State<'_, PtySessionManager>,
    req: StartClaudePtyRequest,
) -> Result<StartClaudePtyResponse, String> {
    manager.start_claude(app, req).map_err(|e| e.to_string())
}

#[tauri::command]
fn pty_write(
    manager: tauri::State<'_, PtySessionManager>,
    req: PtyWriteRequest,
) -> Result<(), String> {
    manager.write(req).map_err(|e| e.to_string())
}

#[tauri::command]
fn pty_resize(
    manager: tauri::State<'_, PtySessionManager>,
    req: PtyResizeRequest,
) -> Result<(), String> {
    manager.resize(req).map_err(|e| e.to_string())
}

#[tauri::command]
fn pty_stop(
    manager: tauri::State<'_, PtySessionManager>,
    req: PtyStopRequest,
) -> Result<(), String> {
    manager.stop(req).map_err(|e| e.to_string())
}

#[tauri::command]
fn structured_run(
    app: tauri::AppHandle,
    req: StructuredRunRequest,
) -> Result<StructuredRunResponse, String> {
    start_structured_run(app, req).map_err(|e| e.to_string())
}

// Section 6: Runtime Smoke Test — 诊断 cmd/claude 环境
#[tauri::command]
fn runtime_smoke_test() -> serde_json::Value {
    use std::process::{Command, Stdio};
    let comspec = std::env::var("ComSpec").ok();
    let system_root = std::env::var("SystemRoot").ok();
    let windir = std::env::var("WINDIR").ok();
    let path_len = std::env::var("PATH").unwrap_or_default().len();
    let cmd_path = comspec.clone().unwrap_or_else(|| {
        let root = system_root.clone().or(windir.clone()).unwrap_or_else(|| "C:\\Windows".to_string());
        format!("{}\\System32\\cmd.exe", root)
    });
    let cmd_echo = Command::new(&cmd_path).args(["/d","/s","/c","echo CMD_OK"]).stdin(Stdio::null()).output();
    let where_claude = Command::new(&cmd_path).args(["/d","/s","/c","where claude"]).stdin(Stdio::null()).output();
    let claude_version = Command::new(&cmd_path).args(["/d","/s","/c","claude --version"]).stdin(Stdio::null()).output();
    fn fmt(r: std::io::Result<std::process::Output>) -> serde_json::Value {
        match r { Ok(o) => serde_json::json!({"success":o.status.success(),"code":o.status.code(),"stdout":String::from_utf8_lossy(&o.stdout),"stderr":String::from_utf8_lossy(&o.stderr)}), Err(e) => serde_json::json!({"success":false,"error":e.to_string()}) }
    }
    serde_json::json!({"comspec":comspec,"systemRoot":system_root,"windir":windir,"pathLen":path_len,"cmdPath":cmd_path,"cmdEcho":fmt(cmd_echo),"whereClaude":fmt(where_claude),"claudeVersion":fmt(claude_version)})
}

fn main() {
    std::panic::set_hook(Box::new(|info| {
        log::error!("FATAL PANIC: {}", info);
        eprintln!("[Ctrl-CC] FATAL PANIC: {}", info);
    }));

    env_logger::init();

    let db_conn = database::init_db().expect("Failed to initialize database");
    let pty_manager = PtyManager::new();
    let claude_manager = ClaudeManager::new();
    let file_watcher = commands::watcher::FileWatcher::new();
    let statusline_probe = commands::statusline::StatusLineProbe::new();
    let hooks_collector = commands::hooks_collector::HooksCollector::new();
    let process_watcher = commands::process_watcher::ProcessWatcher::new();
    let permission_center = commands::permission_center::PermissionCenter::new();
    let file_lock_manager = commands::file_lock::FileLockManager::new();
    let process_watchdog = commands::watchdog::ProcessWatchdog::new();
    let pty_session_manager = PtySessionManager::default();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .manage(db_conn)
        .manage(pty_manager)
        .manage(claude_manager)
        .manage(file_watcher)
        .manage(statusline_probe)
        .manage(hooks_collector)
        .manage(process_watcher)
        .manage(permission_center)
        .manage(file_lock_manager)
        .manage(process_watchdog)
        .manage(pty_session_manager)
        .manage(runtime_v2::runtime_manager::RuntimeManager::default())
        .manage(setup::task_manager::SetupTaskManager::new())
        .invoke_handler(tauri::generate_handler![
            // Database persistence
            commands::db_commands::save_session_to_db,
            commands::db_commands::load_sessions_from_db,
            commands::db_commands::delete_session_from_db,
            commands::db_commands::save_project_to_db,
            commands::db_commands::load_projects_from_db,
            commands::db_commands::delete_project_from_db,
            commands::db_commands::save_error_log_to_db,
            commands::db_commands::load_error_logs_from_db,
            commands::scanner::scan_claude_sessions,
            commands::system_commands::get_system_health,
            commands::watcher::watch_directory,
            commands::watcher::unwatch_directory,
            commands::risk_engine::assess_risk,
            commands::statusline::start_statusline_probe,
            commands::statusline::stop_statusline_probe,
            commands::hooks_collector::record_hook_event,
            commands::hooks_collector::list_hook_events,
            commands::process_watcher::start_process_watcher,
            commands::process_watcher::stop_process_watcher,
            commands::permission_center::check_permission,
            commands::permission_center::set_auto_trust_level,
            commands::permission_center::list_permission_rules,
            commands::permission_center::add_allow_tool,
            commands::permission_center::add_deny_pattern,
            commands::file_lock::acquire_file_lock,
            commands::file_lock::release_file_lock,
            commands::file_lock::list_file_locks,
            commands::worktree::list_worktrees,
            commands::worktree::create_worktree,
            commands::worktree::remove_worktree,
            commands::watchdog::watchdog_check,
            commands::watchdog::watchdog_kill_orphans,
            commands::audit_export::export_audit_bundle,
            commands::credential_guard::scan_for_secrets,
            commands::credential_guard::redact_secrets,
            commands::session_replay::export_session_replay,
            commands::session_replay::get_session_events,
            commands::discovery::runtime_discover_claude,
            // File system
            commands::fs_commands::get_home_dir,
            commands::fs_commands::get_current_dir,
            commands::fs_commands::file_exists,
            commands::fs_commands::list_directory,
            commands::fs_commands::read_file_content,
            commands::fs_commands::write_file_content,
            commands::fs_commands::delete_file,
            // Git integration
            commands::git_commands::detect_git_info,
            commands::git_commands::detect_git_branch,
            commands::git_commands::get_git_branches,
            commands::git_commands::get_git_log,
            // P0 ACTIVE DATA PLANE — 旧 PTY 命令 (唯一主通道)
            pty::pty_commands::pty_check_support,
            pty::pty_commands::pty_start_claude_session,
            pty::pty_commands::pty_v2_write,
            pty::pty_commands::pty_v2_resize,
            pty::pty_commands::pty_send_ctrl_c,
            pty::pty_commands::pty_send_ctrl_d,
            pty::pty_commands::pty_v2_stop,
            pty::pty_commands::pty_get_status,
            pty::pty_commands::pty_get_raw_log,
            pty::pty_commands::pty_get_log_directory,
            pty::pty_commands::pty_list_sessions,
            pty::pty_commands::runtime_list_pty_sessions,
            // Stream-json control plane (one-shot structured tasks only, NOT interactive chat)
            runtime::commands::create_claude_chat,
            runtime::commands::stop_claude_chat,
            runtime::commands::send_claude_input,
            runtime::commands::claude_check_capability,
            // P0 FROZEN — 新 runtime PTY 命令 (待 workspace/runtime 统一后启用)
            // 前端禁止调用: pty_start_claude / pty_write / pty_resize / pty_stop
            claude_probe_capabilities,
            pty_start_claude,
            pty_write,
            pty_resize,
            pty_stop,
            structured_run,
    runtime_smoke_test,
            runtime_v2::runtime_commands::runtime_discover_claude_v2,
            runtime_v2::runtime_commands::runtime_start_interactive_v2,
            runtime_v2::runtime_commands::runtime_write_v2,
            runtime_v2::runtime_commands::runtime_stop_v2,
            runtime_v2::runtime_commands::runtime_list_sessions_v2,
            runtime_v2::runtime_commands::runtime_find_claude_js_candidates,
            runtime_v2::runtime_commands::runtime_discover_native_claude,
            runtime_v2::runtime_commands::runtime_discover_claude_commands,
            runtime_v2::runtime_commands::runtime_start_chat_stream,
            // Setup domain (v23.0)
            setup::commands::setup_detect_all,
            setup::commands::setup_fix_powershell_policy,
            setup::commands::setup_set_npm_mirror,
            setup::commands::setup_install_claude_code_cli,
            setup::commands::setup_write_provider_config,
            setup::commands::setup_read_provider_config_safe,
            setup::commands::setup_install_nodejs_lts,
            setup::commands::setup_install_git_for_windows,
            setup::commands::setup_get_task_progress,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
