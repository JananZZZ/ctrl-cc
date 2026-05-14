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
    pub mode: String,
    pub session_name: Option<String>,
    pub resume_target: Option<String>,
    pub initial_prompt: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeStartInteractiveResponse {
    pub trace_id: String,
    pub ui_session_id: String,
    pub pty_session_id: String,
    pub pid: Option<u32>,
    pub cwd: String,
    pub status: String,
    pub launch_plan_id: String,
    pub program: String,
    pub args: Vec<String>,
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

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeDiscoveryResult {
    pub selected: Option<ClaudeLaunchPlanDebug>,
    pub plans: Vec<ClaudeLaunchPlanDebug>,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeJsCandidate {
    pub path: String,
    pub exists: bool,
    pub source: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeLaunchPlanDebug {
    pub id: String,
    pub label: String,
    pub program: String,
    pub args_prefix: Vec<String>,
    pub canary_ok: bool,
    pub version_ok: bool,
    pub version_text: Option<String>,
    pub error: Option<String>,
    pub selected: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatStreamRequest {
    pub trace_id: String,
    pub session_id: String,
    pub channel_id: String,
    pub cwd: String,
    pub prompt: String,
    pub claude_session_id: Option<String>,
    pub model: Option<String>,
    pub permission_mode: Option<String>,
    pub max_turns: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatStreamStarted {
    pub trace_id: String,
    pub session_id: String,
    pub channel_id: String,
    pub pid: Option<u32>,
}
