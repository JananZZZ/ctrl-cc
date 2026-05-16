use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeKernelStartRequest {
    pub trace_id: String,
    pub gui_session_id: String,
    pub project_id: String,
    pub cwd: String,
    pub model: Option<String>,
    pub permission_mode: Option<String>,
    pub session_name: Option<String>,
    pub resume_target: Option<String>,
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
    pub force: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeKernelSessionSnapshot {
    pub trace_id: String,
    pub gui_session_id: String,
    pub runtime_process_id: String,
    pub project_id: String,
    pub cwd: String,
    pub pid: Option<u32>,
    pub status: String,
    pub has_writer: bool,
    pub reader_alive: bool,
    pub created_at: String,
    pub updated_at: String,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeKernelEvent {
    pub trace_id: String,
    pub gui_session_id: String,
    pub runtime_process_id: String,
    pub event_type: String,
    pub status: Option<String>,
    pub data: Option<String>,
    pub message: Option<String>,
    pub pid: Option<u32>,
    pub cwd: Option<String>,
    pub created_at: String,
}
