use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use super::types::TaskProgress;
use tauri::Emitter;

/// 单个后台任务的控制令牌。
///
/// 任务运行循环在每次迭代前检查这些标志，以决定是否暂停、取消或终止。
pub struct TaskControlToken {
    /// 任务标识符。
    pub task_id: String,
    /// 任务是否被暂停。暂停时运行循环应阻塞等待恢复。
    paused: AtomicBool,
    /// 任务是否被取消。取消意味着优雅停止（请求退出）。
    cancelled: AtomicBool,
    /// 任务是否被终止。终止意味着强制停止（立即中止）。
    terminated: AtomicBool,
}

impl TaskControlToken {
    /// 创建一个新的控制令牌。
    pub fn new(task_id: String) -> Self {
        Self {
            task_id,
            paused: AtomicBool::new(false),
            cancelled: AtomicBool::new(false),
            terminated: AtomicBool::new(false),
        }
    }

    /// 返回任务是否已被取消。
    pub fn is_cancelled(&self) -> bool {
        self.cancelled.load(Ordering::Acquire)
    }

    /// 返回任务是否已被终止。
    pub fn is_terminated(&self) -> bool {
        self.terminated.load(Ordering::Acquire)
    }

    /// 如果任务被暂停，则阻塞等待直到恢复。
    ///
    /// 调用方应在每次循环迭代前调用此方法。
    /// 如果任务同时被取消或终止，此方法会立即返回。
    pub fn wait_if_paused(&self) -> Result<(), String> {
        while self.paused.load(Ordering::Acquire) {
            if self.cancelled.load(Ordering::Relaxed) || self.terminated.load(Ordering::Relaxed) {
                return Err("任务已取消".to_string());
            }
            std::thread::sleep(std::time::Duration::from_millis(80));
        }
        Ok(())
    }

    /// 暂停任务。
    pub fn pause(&self) {
        self.paused.store(true, Ordering::Release);
    }

    /// 恢复已暂停的任务。
    pub fn resume(&self) {
        self.paused.store(false, Ordering::Release);
    }

    /// 取消任务（优雅停止）。
    pub fn cancel(&self) {
        self.cancelled.store(true, Ordering::Release);
        // 取消时自动恢复暂停，确保 wait_if_paused 返回
        self.resume();
    }

    /// 终止任务（强制停止）。
    pub fn terminate(&self) {
        self.terminated.store(true, Ordering::Release);
        // 终止时自动恢复暂停，确保 wait_if_paused 返回
        self.resume();
    }
}

/// 后台任务控制管理器。
///
/// 管理所有活跃后台任务的控制令牌。
/// 作为 Tauri 状态注入，前端通过命令与之交互。
#[derive(Clone, Default)]
pub struct TaskControlManager {
    tokens: Arc<Mutex<HashMap<String, Arc<TaskControlToken>>>>,
}

impl TaskControlManager {
    /// 创建一个新的任务控制令牌并注册到管理器中。
    ///
    /// 如果 task_id 已存在，返回现有令牌。
    pub fn create(&self, task_id: String) -> Arc<TaskControlToken> {
        let mut tokens = self.tokens.lock().unwrap();
        tokens
            .entry(task_id.clone())
            .or_insert_with(|| Arc::new(TaskControlToken::new(task_id)))
            .clone()
    }

    /// 获取指定任务的控制令牌。
    pub fn get(&self, task_id: &str) -> Option<Arc<TaskControlToken>> {
        let tokens = self.tokens.lock().unwrap();
        tokens.get(task_id).cloned()
    }

    /// 移除指定任务的控制令牌。
    pub fn remove(&self, task_id: &str) -> Option<Arc<TaskControlToken>> {
        let mut tokens = self.tokens.lock().unwrap();
        tokens.remove(task_id)
    }
}

/// 向后端推送任务进度事件。
///
/// 前端通过监听 `task://progress` 事件接收此数据。
pub fn emit_task(app: &tauri::AppHandle, task: TaskProgress) {
    let _ = app.emit("task://progress", task);
}

/// 返回当前 UTC 时间的 ISO 8601 字符串。
pub fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339()
}
