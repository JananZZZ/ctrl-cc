use super::event_types::*;
use crate::error::AppError;

/// Parses a single NDJSON line into a ClaudeEvent.
pub fn parse_line(line: &str) -> Result<Option<ClaudeEvent>, AppError> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }
    if !trimmed.starts_with('{') {
        return Ok(None);
    }
    match serde_json::from_str::<ClaudeEvent>(trimmed) {
        Ok(event) => Ok(Some(event)),
        Err(e) => {
            log::warn!("NDJSON parse error: {} — line: {}", e, &trimmed[..trimmed.len().min(200)]);
            Ok(None) // Skip unparseable lines gracefully
        }
    }
}

/// Convert a ClaudeEvent to a frontend-friendly RuntimeEvent.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatRuntimeEvent {
    pub session_id: String,
    pub event_type: String,
    pub content: String,
    pub title: Option<String>,
    pub tool_name: Option<String>,
    pub tool_input: Option<serde_json::Value>,
    pub tool_use_id: Option<String>,
    pub is_error: Option<bool>,
    pub input_tokens: Option<u32>,
    pub output_tokens: Option<u32>,
    pub total_cost_usd: Option<f64>,
    pub duration_ms: Option<u64>,
}

pub fn event_to_runtime(session_id: &str, event: &ClaudeEvent) -> Vec<ChatRuntimeEvent> {
    let mut out = Vec::new();
    let sid = session_id.to_string();

    match event {
        ClaudeEvent::System(sys) => {
            out.push(ChatRuntimeEvent {
                session_id: sid, event_type: "system_init".into(),
                content: format!("Session started — model: {}", sys.model.as_deref().unwrap_or("unknown")),
                title: Some("System".into()), tool_name: None, tool_input: None,
                tool_use_id: None, is_error: None, input_tokens: None, output_tokens: None,
                total_cost_usd: None, duration_ms: None,
            });
        }
        ClaudeEvent::Assistant(assist) => {
            if let Some(msg) = &assist.message {
                if let Some(blocks) = &msg.content {
                    for block in blocks {
                        match block {
                            ContentBlock::Text { text } => {
                                out.push(ChatRuntimeEvent {
                                    session_id: sid.clone(), event_type: "assistant_text".into(),
                                    content: text.clone(), title: None, tool_name: None, tool_input: None,
                                    tool_use_id: None, is_error: None, input_tokens: None, output_tokens: None,
                                    total_cost_usd: None, duration_ms: None,
                                });
                            }
                            ContentBlock::ToolUse { id, name, input } => {
                                out.push(ChatRuntimeEvent {
                                    session_id: sid.clone(), event_type: "tool_use".into(),
                                    content: format!("Tool: {}", name), title: Some(name.clone()),
                                    tool_name: Some(name.clone()), tool_input: Some(input.clone()),
                                    tool_use_id: Some(id.clone()), is_error: None,
                                    input_tokens: None, output_tokens: None, total_cost_usd: None, duration_ms: None,
                                });
                            }
                            ContentBlock::Thinking { thinking, .. } => {
                                out.push(ChatRuntimeEvent {
                                    session_id: sid.clone(), event_type: "thinking".into(),
                                    content: thinking.clone(), title: Some("Thinking".into()),
                                    tool_name: None, tool_input: None, tool_use_id: None, is_error: None,
                                    input_tokens: None, output_tokens: None, total_cost_usd: None, duration_ms: None,
                                });
                            }
                            ContentBlock::ToolResult { tool_use_id, content, is_error } => {
                                out.push(ChatRuntimeEvent {
                                    session_id: sid.clone(), event_type: "tool_result".into(),
                                    content: format!("{:?}", content), title: None, tool_name: None,
                                    tool_input: None, tool_use_id: Some(tool_use_id.clone()),
                                    is_error: *is_error, input_tokens: None, output_tokens: None,
                                    total_cost_usd: None, duration_ms: None,
                                });
                            }
                            _ => {}
                        }
                    }
                }
            }
        }
        ClaudeEvent::StreamEvent(stream) => {
            if let Some(inner) = &stream.event {
                match inner {
                    InnerStreamEvent::ContentBlockDelta { delta, .. } => {
                        match delta {
                            ContentDelta::TextDelta { text } => {
                                out.push(ChatRuntimeEvent {
                                    session_id: sid, event_type: "assistant_delta".into(),
                                    content: text.clone(), title: None, tool_name: None, tool_input: None,
                                    tool_use_id: None, is_error: None, input_tokens: None, output_tokens: None,
                                    total_cost_usd: None, duration_ms: None,
                                });
                            }
                            ContentDelta::ThinkingDelta { thinking } => {
                                out.push(ChatRuntimeEvent {
                                    session_id: sid, event_type: "thinking_delta".into(),
                                    content: thinking.clone(), title: Some("Thinking".into()),
                                    tool_name: None, tool_input: None, tool_use_id: None, is_error: None,
                                    input_tokens: None, output_tokens: None, total_cost_usd: None, duration_ms: None,
                                });
                            }
                            _ => {}
                        }
                    }
                    InnerStreamEvent::MessageDelta { usage, .. } => {
                        if let Some(u) = usage {
                            out.push(ChatRuntimeEvent {
                                session_id: sid, event_type: "token_usage".into(),
                                content: format!("↑{} ↓{}", u.output_tokens.unwrap_or(0), u.input_tokens.unwrap_or(0)),
                                title: None, tool_name: None, tool_input: None, tool_use_id: None, is_error: None,
                                input_tokens: u.input_tokens, output_tokens: u.output_tokens,
                                total_cost_usd: None, duration_ms: None,
                            });
                        }
                    }
                    _ => {}
                }
            }
        }
        ClaudeEvent::Result(result) => {
            out.push(ChatRuntimeEvent {
                session_id: sid, event_type: "summary".into(),
                content: result.result.clone().unwrap_or_default(), title: Some("Complete".into()),
                tool_name: None, tool_input: None, tool_use_id: None, is_error: None,
                input_tokens: result.usage.as_ref().and_then(|u| u.input_tokens),
                output_tokens: result.usage.as_ref().and_then(|u| u.output_tokens),
                total_cost_usd: result.total_cost_usd, duration_ms: result.duration_ms,
            });
        }
        ClaudeEvent::Error(err) => {
            out.push(ChatRuntimeEvent {
                session_id: sid, event_type: "error".into(),
                content: err.message.clone().unwrap_or_default(), title: Some("Error".into()),
                tool_name: None, tool_input: None, tool_use_id: None, is_error: Some(true),
                input_tokens: None, output_tokens: None, total_cost_usd: None, duration_ms: None,
            });
        }
        _ => {}
    }
    out
}
