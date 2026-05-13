use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize)]
pub struct PtyOutputPayload {
    pub session_id: String,
    #[serde(default)]
    pub ui_session_id: Option<String>,
    #[serde(default)]
    pub pty_session_id: Option<String>,
    pub data: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct PtyExitPayload {
    pub session_id: String,
    #[serde(default)]
    pub ui_session_id: Option<String>,
    #[serde(default)]
    pub pty_session_id: Option<String>,
    pub code: Option<i32>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct PtyErrorPayload {
    pub session_id: Option<String>,
    #[serde(default)]
    pub ui_session_id: Option<String>,
    #[serde(default)]
    pub pty_session_id: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ClaudeCapabilityPayload {
    pub claude_path: Option<String>,
    pub version: Option<String>,
    pub auth_ok: bool,
    pub auth_status_raw: String,
    pub stream_json_ok: bool,
    pub stream_json_raw: String,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct StartClaudePtyRequest {
    pub cwd: String,
    pub cols: u16,
    pub rows: u16,
    pub session_name: Option<String>,
    // v9.0 ID contract fields
    #[serde(default)]
    pub ui_session_id: Option<String>,
    #[serde(default)]
    pub pty_session_id: Option<String>,
    #[serde(default)]
    pub trace_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct StartClaudePtyResponse {
    pub session_id: String,
    pub ui_session_id: String,
    pub pty_session_id: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct PtyWriteRequest {
    pub session_id: String,
    pub data: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct PtyResizeRequest {
    pub session_id: String,
    pub cols: u16,
    pub rows: u16,
    pub pixel_width: Option<u16>,
    pub pixel_height: Option<u16>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct PtyStopRequest {
    pub session_id: String,
}
