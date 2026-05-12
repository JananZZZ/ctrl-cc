use serde::Serialize;
use std::process::Command;

#[derive(Debug, Clone, Serialize)]
pub struct WorktreeInfo {
    pub path: String,
    pub branch: String,
    pub hash: String,
    pub is_current: bool,
}

#[tauri::command]
pub fn list_worktrees(project_path: String) -> Result<Vec<WorktreeInfo>, String> {
    let output = Command::new("git")
        .args(["worktree", "list", "--porcelain"])
        .current_dir(&project_path)
        .output()
        .map_err(|e| format!("Failed to list worktrees: {}", e))?;

    if !output.status.success() {
        return Ok(Vec::new());
    }

    let mut worktrees = Vec::new();
    let mut current_path = String::new();
    let mut current_branch = String::new();
    let mut current_hash = String::new();
    let mut is_current = false;

    for line in String::from_utf8_lossy(&output.stdout).lines() {
        if line.is_empty() {
            if !current_path.is_empty() {
                worktrees.push(WorktreeInfo {
                    path: current_path.clone(), branch: current_branch.clone(),
                    hash: current_hash.clone(), is_current,
                });
            }
            current_path.clear(); current_branch.clear(); current_hash.clear(); is_current = false;
        } else if line.starts_with("worktree ") { current_path = line[9..].to_string(); }
        else if line.starts_with("branch ") { current_branch = line[15..].to_string(); }
        else if line.starts_with("HEAD ") { current_hash = line[5..13].to_string(); }
        else if line == "detached" { current_branch = "(detached)".to_string(); }
    }
    // Add last entry
    if !current_path.is_empty() {
        worktrees.push(WorktreeInfo { path: current_path, branch: current_branch, hash: current_hash, is_current });
    }

    Ok(worktrees)
}

#[tauri::command]
pub fn create_worktree(project_path: String, branch_name: String, target_path: Option<String>) -> Result<String, String> {
    let base = target_path.unwrap_or_else(|| format!("../ctrl-cc-worktree-{}", branch_name));
    let output = Command::new("git")
        .args(["worktree", "add", &base, "-b", &branch_name])
        .current_dir(&project_path)
        .output()
        .map_err(|e| format!("Failed to create worktree: {}", e))?;

    if output.status.success() {
        Ok(format!("Worktree created at {}", base))
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
pub fn remove_worktree(project_path: String, worktree_path: String) -> Result<String, String> {
    let output = Command::new("git")
        .args(["worktree", "remove", &worktree_path, "--force"])
        .current_dir(&project_path)
        .output()
        .map_err(|e| format!("Failed to remove worktree: {}", e))?;

    if output.status.success() {
        Ok("Worktree removed".to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}
