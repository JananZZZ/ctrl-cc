//! v9.0 Runtime type definitions — ID contract types for backend commands.
//! These structs are used by runtime_commands.rs for the new RuntimeBridge API.
//! Old PTY commands in pty_commands.rs are deprecated wrappers.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeStartInteractiveRequest {
    pub trace_id: String,
    pub ui_session_id: String,
    pub pty_session_id: String,
    pub project_id: String,
    pub cwd: String,
    pub model: Option<String>,
    pub permission_mode: Option<String>,
    pub initial_prompt: Option<String>,
    pub resume_claude_session_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeStartInteractiveResponse {
    pub trace_id: String,
    pub ui_session_id: String,
    pub pty_session_id: String,
    pub pid: Option<u32>,
    pub cwd: String,
    pub status: String,
    pub selected_strategy_id: String,
    pub selected_command: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeWriteRequest {
    pub trace_id: String,
    pub ui_session_id: String,
    pub pty_session_id: String,
    pub data: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeResizeRequest {
    pub trace_id: String,
    pub ui_session_id: String,
    pub pty_session_id: String,
    pub rows: u16,
    pub cols: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeStopRequest {
    pub trace_id: String,
    pub ui_session_id: String,
    pub pty_session_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimePtySessionDebugInfo {
    pub ui_session_id: String,
    pub pty_session_id: String,
    pub project_id: String,
    pub cwd: String,
    pub pid: Option<u32>,
    pub status: String,
    pub has_writer: bool,
    pub reader_alive: bool,
    pub created_at: String,
    pub last_error: Option<String>,
}
