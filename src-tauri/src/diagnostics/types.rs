use serde::{Deserialize, Serialize};

/// 诊断事件严重级别
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DiagnosticSeverity {
    Info,
    Warning,
    Error,
    Critical,
}

/// 诊断事件结构
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticEvent {
    pub id: String,
    pub ts: String,
    pub source: String,
    pub severity: DiagnosticSeverity,
    pub title: String,
    pub detail: Option<String>,
    pub task_id: Option<String>,
    pub session_id: Option<String>,
}
