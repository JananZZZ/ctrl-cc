#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod database;
mod error;
mod pty;
mod runtime;

use pty::PtyManager;
use runtime::commands::ClaudeManager;

fn main() {
    env_logger::init();

    let db_conn = database::init_db().expect("Failed to initialize database");
    let pty_manager = PtyManager::new();
    let claude_manager = ClaudeManager::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .manage(db_conn)
        .manage(pty_manager)
        .manage(claude_manager)
        .invoke_handler(tauri::generate_handler![
            // Database persistence
            commands::db_commands::save_session_to_db,
            commands::db_commands::load_sessions_from_db,
            // Stream-json control plane
            runtime::commands::create_claude_chat,
            runtime::commands::stop_claude_chat,
            // PTY data plane
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
