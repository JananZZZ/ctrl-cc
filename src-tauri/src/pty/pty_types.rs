use chrono::Utc;
use serde::Serialize;

/// PTY session status machine.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
#[allow(dead_code)]
pub enum PtySessionStatus {
    Created,
    Starting,
    Running,
    Exited { code: i32 },
    Failed { reason: String },
    Killed,
}

/// Semantic event extracted from PTY raw output (best-effort).
#[derive(Debug, Clone, Serialize)]
pub struct PtySemanticEvent {
    pub session_id: String,
    pub event_type: PtyEventType,
    pub content: String,
    pub risk_level: RiskLevel,
    pub timestamp: String,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
#[allow(dead_code)]
pub enum PtyEventType {
    SessionInitialized,
    PermissionRequested,
    CommandStarted,
    CommandOutput,
    CommandCompleted,
    CommandFailed,
    FileEdited,
    FileCreated,
    FileDeleted,
    Error,
    Summary,
    Unknown,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum RiskLevel {
    Low,
    Medium,
    High,
    Critical,
}

impl Default for RiskLevel {
    fn default() -> Self {
        RiskLevel::Low
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PtyStartOptions {
    pub session_id: String,
    pub project_id: String,
    pub cli_path: String,
    pub cwd: String,
    pub extra_args: Vec<String>,
}

/// Result returned to frontend after PTY session creation.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PtySessionInfo {
    pub id: String,
    pub session_id: String,
    pub project_id: String,
    pub cwd: String,
    pub command: Vec<String>,
    pub rows: u16,
    pub cols: u16,
    pub status: PtySessionStatus,
    pub pid: Option<u32>,
    pub created_at: String,
}

/// Static check result for PTY support.
#[derive(Debug, Clone, Serialize)]
pub struct PtySupportInfo {
    pub supported: bool,
    pub backend: String,
    pub details: String,
}

/// Session Mapping diagnostic info for runtime_list_pty_sessions.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PtySessionDebugInfo {
    pub pty_session_id: String,
    pub ui_session_id: Option<String>,
    pub project_id: Option<String>,
    pub cwd: String,
    pub pid: Option<u32>,
    pub status: String,
    pub has_writer: bool,
    pub reader_alive: bool,
    pub created_at: String,
    pub last_error: Option<String>,
}

/// Raw log chunk for retrieval.
#[derive(Debug, Clone, Serialize)]
#[allow(dead_code)]
pub struct RawLogChunk {
    pub session_id: String,
    pub offset: u64,
    pub data: String,
    pub is_utf8: bool,
}

impl PtySemanticEvent {
    pub fn new(
        session_id: String,
        event_type: PtyEventType,
        content: String,
        risk_level: RiskLevel,
    ) -> Self {
        Self {
            session_id,
            event_type,
            content,
            risk_level,
            timestamp: Utc::now().to_rfc3339(),
        }
    }
}
