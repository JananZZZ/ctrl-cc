use tauri::State;

use super::manager::TaskControlManager;

/// 暂停后台任务。
#[tauri::command]
pub fn task_pause(
    task_id: String,
    tasks: State<'_, TaskControlManager>,
) -> Result<(), String> {
    tasks.pause(&task_id)
}

/// 继续后台任务。
#[tauri::command]
pub fn task_resume(
    task_id: String,
    tasks: State<'_, TaskControlManager>,
) -> Result<(), String> {
    tasks.resume(&task_id)
}

/// 取消后台任务。
#[tauri::command]
pub fn task_cancel(
    task_id: String,
    tasks: State<'_, TaskControlManager>,
) -> Result<(), String> {
    tasks.cancel(&task_id)
}

/// 强制终止后台任务。
#[tauri::command]
pub fn task_terminate(
    task_id: String,
    tasks: State<'_, TaskControlManager>,
) -> Result<(), String> {
    tasks.terminate(&task_id)
}
