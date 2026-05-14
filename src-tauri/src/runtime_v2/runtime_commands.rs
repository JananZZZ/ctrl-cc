use tauri::State;

use super::claude_discovery::{discover_claude, list_claude_js_candidates};
use super::chat_stream::start_chat_stream;
use super::claude_command_resolver::{discover_claude_commands, ClaudeCommandSpec};
use super::native_claude_discovery::{discover_native_claude_candidates, ClaudeNativeCandidate};
use super::runtime_types::{ChatStreamRequest, ChatStreamStarted};
use super::runtime_manager::RuntimeManager;
use super::runtime_types::{
    ClaudeJsCandidate, RuntimeDiscoveryResult, RuntimePtySessionDebugInfo,
    RuntimeStartInteractiveRequest, RuntimeStartInteractiveResponse, RuntimeStopRequest,
    RuntimeWriteRequest,
};

#[tauri::command]
pub fn runtime_discover_claude_v2() -> RuntimeDiscoveryResult {
    discover_claude()
}

#[tauri::command]
pub fn runtime_start_interactive_v2(
    app: tauri::AppHandle,
    manager: State<'_, RuntimeManager>,
    req: RuntimeStartInteractiveRequest,
) -> Result<RuntimeStartInteractiveResponse, String> {
    manager.start_interactive(app, req)
}

#[tauri::command]
pub fn runtime_write_v2(
    manager: State<'_, RuntimeManager>,
    req: RuntimeWriteRequest,
) -> Result<(), String> {
    manager.write(req)
}

#[tauri::command]
pub fn runtime_stop_v2(
    manager: State<'_, RuntimeManager>,
    req: RuntimeStopRequest,
) -> Result<(), String> {
    manager.stop(req)
}

#[tauri::command]
pub fn runtime_list_sessions_v2(
    manager: State<'_, RuntimeManager>,
) -> Result<Vec<RuntimePtySessionDebugInfo>, String> {
    manager.list_sessions()
}

#[tauri::command]
pub fn runtime_find_claude_js_candidates() -> Vec<ClaudeJsCandidate> {
    list_claude_js_candidates()
}

#[tauri::command]
pub fn runtime_discover_native_claude() -> Vec<ClaudeNativeCandidate> {
    discover_native_claude_candidates()
}

#[tauri::command]
pub fn runtime_discover_claude_commands() -> Vec<ClaudeCommandSpec> {
    discover_claude_commands()
}

#[tauri::command]
pub fn runtime_start_chat_stream(
    app: tauri::AppHandle,
    req: ChatStreamRequest,
) -> Result<ChatStreamStarted, String> {
    start_chat_stream(app, req)
}
