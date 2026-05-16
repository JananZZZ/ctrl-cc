use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum RuntimeStatus {
    Starting,
    Ready,
    Busy,
    WaitingInput,
    WaitingPermission,
    Exited,
    Failed,
    Stopped,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeKernelStartRequest {
    pub trace_id: String,
    pub gui_session_id: String,
    pub project_id: String,
    pub cwd: String,
    pub model: String,
    pub effort: String,
    pub permission_mode: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeKernelSubmitRequest {
    pub trace_id: String,
    pub gui_session_id: String,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeKernelWriteRequest {
    pub trace_id: String,
    pub gui_session_id: String,
    pub data: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeKernelStopRequest {
    pub trace_id: String,
    pub gui_session_id: String,
    pub force: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeKernelSnapshot {
    pub trace_id: String,
    pub gui_session_id: String,
    pub runtime_session_id: String,
    pub claude_session_id: Option<String>,
    pub project_id: String,
    pub cwd: String,
    pub pid: Option<u32>,
    pub status: RuntimeStatus,
    pub has_writer: bool,
    pub reader_alive: bool,
    pub created_at: String,
    pub updated_at: String,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeKernelEvent {
    pub seq: u64,
    pub trace_id: String,
    pub gui_session_id: String,
    pub runtime_session_id: String,
    pub event_type: String,
    pub channel: String,
    pub data: Option<String>,
    pub status: Option<RuntimeStatus>,
    pub pid: Option<u32>,
    pub cwd: Option<String>,
    pub created_at: String,
}
