use serde::Serialize;
use std::collections::VecDeque;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize)]
pub struct HookEvent {
    pub id: String,
    #[serde(rename = "hookType")]
    pub hook_type: String,
    pub timestamp: String,
    pub data: String,
    pub session_id: Option<String>,
}

pub struct HooksCollector {
    events: Mutex<VecDeque<HookEvent>>,
}

impl HooksCollector {
    pub fn new() -> Self {
        Self { events: Mutex::new(VecDeque::with_capacity(1000)) }
    }

    pub fn record(&self, hook_type: &str, data: &str, session_id: Option<&str>) {
        let mut events = self.events.lock().expect("mutex poisoned");
        events.push_back(HookEvent {
            id: uuid::Uuid::new_v4().to_string(),
            hook_type: hook_type.to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
            data: data.to_string(),
            session_id: session_id.map(|s| s.to_string()),
        });
        if events.len() > 1000 { events.pop_front(); }
    }

    pub fn list(&self, limit: Option<usize>) -> Vec<HookEvent> {
        let events = self.events.lock().expect("mutex poisoned");
        let n = limit.unwrap_or(50);
        events.iter().rev().take(n).cloned().collect()
    }
}

#[tauri::command]
pub fn record_hook_event(
    collector: tauri::State<'_, HooksCollector>,
    hook_type: String,
    data: String,
    session_id: Option<String>,
) -> Result<(), String> {
    collector.record(&hook_type, &data, session_id.as_deref());
    Ok(())
}

#[tauri::command]
pub fn list_hook_events(
    collector: tauri::State<'_, HooksCollector>,
    limit: Option<usize>,
) -> Result<Vec<HookEvent>, String> {
    Ok(collector.list(limit))
}
