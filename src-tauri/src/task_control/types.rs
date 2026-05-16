use serde::{Deserialize, Serialize};

/// 后台任务状态。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum TaskStatus {
    Queued,
    Running,
    Paused,
    Success,
    Warning,
    Error,
    Cancelled,
}

/// 页面切换或用户执行其他操作时，任务如何被打断。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum TaskInterruptPolicy {
    SafeBackground,
    ConfirmOnLeave,
    CancelOnLeave,
    CriticalNoninterruptible,
    DestructiveConfirm,
}

/// 后端推送给前端的任务进度。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskProgress {
    pub task_id: String,
    pub kind: String,
    pub title: String,
    pub status: TaskStatus,
    pub interrupt_policy: TaskInterruptPolicy,
    pub current_step_id: Option<String>,
    pub current_step_label: Option<String>,
    pub message: Option<String>,
    pub progress: f64,
    pub started_at: String,
    pub updated_at: String,
    pub ended_at: Option<String>,
    pub can_pause: bool,
    pub can_resume: bool,
    pub can_cancel: bool,
    pub can_terminate: bool,
    pub error: Option<String>,
}
