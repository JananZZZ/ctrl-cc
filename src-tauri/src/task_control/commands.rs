use tauri::State;

use super::manager::TaskControlManager;

#[tauri::command]
pub fn task_pause(task_id: String, ctrl: State<'_, TaskControlManager>) -> Result<(), String> {
    ctrl.get(&task_id)
        .ok_or_else(|| format!("任务不存在: {}", task_id))?
        .pause();
    Ok(())
}

#[tauri::command]
pub fn task_resume(task_id: String, ctrl: State<'_, TaskControlManager>) -> Result<(), String> {
    ctrl.get(&task_id)
        .ok_or_else(|| format!("任务不存在: {}", task_id))?
        .resume();
    Ok(())
}

#[tauri::command]
pub fn task_cancel(task_id: String, ctrl: State<'_, TaskControlManager>) -> Result<(), String> {
    ctrl.get(&task_id)
        .ok_or_else(|| format!("任务不存在: {}", task_id))?
        .cancel();
    Ok(())
}

#[tauri::command]
pub fn task_terminate(task_id: String, ctrl: State<'_, TaskControlManager>) -> Result<(), String> {
    ctrl.get(&task_id)
        .ok_or_else(|| format!("任务不存在: {}", task_id))?
        .terminate();
    Ok(())
}
