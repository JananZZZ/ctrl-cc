use crate::setup::types::SetupTaskProgress;
use std::sync::Arc;
use parking_lot::Mutex;
use tauri::Emitter;

#[derive(Clone, Default)]
pub struct SetupTaskManager {
    tasks: Arc<Mutex<Vec<SetupTaskProgress>>>,
}

impl SetupTaskManager {
    pub fn new() -> Self {
        Self {
            tasks: Arc::new(Mutex::new(Vec::new())),
        }
    }

    pub fn inner(&self) -> Arc<Mutex<Vec<SetupTaskProgress>>> {
        self.tasks.clone()
    }

    pub fn new_task(&self, action_id: &str) -> String {
        let task_id = format!("task-{}", uuid::Uuid::new_v4());
        let progress = SetupTaskProgress {
            task_id: task_id.clone(),
            action_id: action_id.to_string(),
            status: "queued".to_string(),
            step: "初始化".to_string(),
            progress: 0.0,
            message: "任务已排队".to_string(),
            error: None,
            updated_at: chrono::Utc::now().to_rfc3339(),
        };
        self.tasks.lock().push(progress);
        task_id
    }

    pub fn emit(
        &self,
        app: &tauri::AppHandle,
        task_id: &str,
        action_id: &str,
        status: &str,
        step: &str,
        progress: f32,
        message: &str,
        error: Option<&str>,
    ) {
        let p = SetupTaskProgress {
            task_id: task_id.to_string(),
            action_id: action_id.to_string(),
            status: status.to_string(),
            step: step.to_string(),
            progress,
            message: message.to_string(),
            error: error.map(|s| s.to_string()),
            updated_at: chrono::Utc::now().to_rfc3339(),
        };

        {
            let mut tasks = self.tasks.lock();
            if let Some(existing) = tasks.iter_mut().find(|t| t.task_id == task_id) {
                *existing = p.clone();
            } else {
                tasks.push(p.clone());
            }
        }

        let _ = app.emit("setup://task-progress", p);
    }

    pub fn get_tasks(&self) -> Vec<SetupTaskProgress> {
        self.tasks.lock().clone()
    }
}
