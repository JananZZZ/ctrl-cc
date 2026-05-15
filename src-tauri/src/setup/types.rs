use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetupCheckResult {
    pub id: String,
    pub label: String,
    pub status: String,
    pub installed: bool,
    pub ok: bool,
    pub required: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub latest_version: Option<String>,
    pub outdated: bool,
    pub paths: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub method: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fix_hint: Option<String>,
    pub details: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetupSnapshot {
    pub generated_at: String,
    pub ready: bool,
    pub severity: String,
    pub summary: String,
    pub checks: HashMap<String, SetupCheckResult>,
    pub claude_commands: Vec<crate::runtime_v2::claude_command_resolver::ClaudeCommandSpec>,
    pub selected_chat_command_id: Option<String>,
    pub selected_terminal_command_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetupTaskProgress {
    pub task_id: String,
    pub action_id: String,
    pub status: String,
    pub step: String,
    pub progress: f32,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    pub updated_at: String,
}
