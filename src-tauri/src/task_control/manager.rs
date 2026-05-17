use std::collections::HashMap;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::thread;
use std::time::Duration;

use tauri::{AppHandle, Emitter};

use super::types::TaskProgress;

/// 全局任务控制器。
/// 每个后台任务都会注册一个 TaskControlToken。
/// UI 发起 pause/resume/cancel/terminate 时，通过这里修改 token 状态。
#[derive(Clone, Default)]
pub struct TaskControlManager {
    inner: Arc<Mutex<HashMap<String, Arc<TaskControlToken>>>>,
}

/// 单个任务的控制令牌。
/// 这里使用 AtomicBool，避免后台线程读取控制状态时长期持锁。
pub struct TaskControlToken {
    pub task_id: String,
    paused: AtomicBool,
    cancelled: AtomicBool,
    terminated: AtomicBool,
}

impl TaskControlToken {
    /// 创建一个新的任务控制令牌。
    pub fn new(task_id: String) -> Self {
        Self {
            task_id,
            paused: AtomicBool::new(false),
            cancelled: AtomicBool::new(false),
            terminated: AtomicBool::new(false),
        }
    }

    /// 判断任务是否已经被取消或强制终止。
    pub fn is_cancelled(&self) -> bool {
        self.cancelled.load(Ordering::SeqCst) || self.terminated.load(Ordering::SeqCst)
    }

    /// 判断任务是否强制终止。
    pub fn is_terminated(&self) -> bool {
        self.terminated.load(Ordering::SeqCst)
    }

    /// 如果任务处于暂停状态，则在步骤边界等待。
    /// 注意：这是协作式暂停，不会强行中断正在运行的外部命令。
    pub fn wait_if_paused(&self) -> Result<(), String> {
        while self.paused.load(Ordering::SeqCst) {
            if self.is_cancelled() {
                return Err("任务已取消".to_string());
            }

            thread::sleep(Duration::from_millis(80));
        }

        Ok(())
    }

    /// 暂停任务。
    pub fn pause(&self) {
        self.paused.store(true, Ordering::SeqCst);
    }

    /// 继续任务。
    pub fn resume(&self) {
        self.paused.store(false, Ordering::SeqCst);
    }

    /// 取消任务。
    pub fn cancel(&self) {
        self.cancelled.store(true, Ordering::SeqCst);
        self.paused.store(false, Ordering::SeqCst);
    }

    /// 强制终止任务。
    pub fn terminate(&self) {
        self.terminated.store(true, Ordering::SeqCst);
        self.cancelled.store(true, Ordering::SeqCst);
        self.paused.store(false, Ordering::SeqCst);
    }
}

impl TaskControlManager {
    /// 注册一个新任务。
    pub fn create(&self, task_id: String) -> Arc<TaskControlToken> {
        let token = Arc::new(TaskControlToken::new(task_id.clone()));
        self.inner.lock().unwrap().insert(task_id, token.clone());
        token
    }

    /// 获取任务控制令牌。
    pub fn get(&self, task_id: &str) -> Option<Arc<TaskControlToken>> {
        self.inner.lock().unwrap().get(task_id).cloned()
    }

    /// 移除任务控制令牌。
    pub fn remove(&self, task_id: &str) {
        self.inner.lock().unwrap().remove(task_id);
    }

    /// 暂停指定任务。
    pub fn pause(&self, task_id: &str) -> Result<(), String> {
        self.get(task_id)
            .ok_or_else(|| "任务不存在".to_string())?
            .pause();

        Ok(())
    }

    /// 继续指定任务。
    pub fn resume(&self, task_id: &str) -> Result<(), String> {
        self.get(task_id)
            .ok_or_else(|| "任务不存在".to_string())?
            .resume();

        Ok(())
    }

    /// 取消指定任务。
    pub fn cancel(&self, task_id: &str) -> Result<(), String> {
        self.get(task_id)
            .ok_or_else(|| "任务不存在".to_string())?
            .cancel();

        Ok(())
    }

    /// 强制终止指定任务。
    pub fn terminate(&self, task_id: &str) -> Result<(), String> {
        self.get(task_id)
            .ok_or_else(|| "任务不存在".to_string())?
            .terminate();

        Ok(())
    }
}

/// 发送任务进度到前端。
pub fn emit_task(app: &AppHandle, progress: TaskProgress) {
    let _ = app.emit("task://progress", progress);
}

/// 当前 UTC 时间字符串。
pub fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339()
}
