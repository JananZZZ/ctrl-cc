use serde::Serialize;

use crate::utils::hidden_command::hidden_command;

#[derive(Debug, Serialize)]
pub struct GitRepoInfo {
    #[serde(rename = "isRepo")]
    pub is_repo: bool,
    #[serde(rename = "remoteUrl")]
    pub remote_url: Option<String>,
    #[serde(rename = "repoName")]
    pub repo_name: Option<String>,
    pub branch: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct GitBranch {
    pub name: String,
    pub is_current: bool,
}

#[tauri::command]
pub fn detect_git_info(path: String) -> Result<GitRepoInfo, String> {
    let p = std::path::Path::new(&path);
    let git_dir = p.join(".git");
    if !git_dir.exists() {
        return Ok(GitRepoInfo {
            is_repo: false,
            remote_url: None,
            repo_name: None,
            branch: None,
            status: None,
        });
    }

    let remote_url = run_git(&path, &["config", "--get", "remote.origin.url"]);
    let branch = run_git(&path, &["branch", "--show-current"]);
    let status = run_git(&path, &["status", "--short"]);
    let repo_name = remote_url.as_ref().and_then(|url| {
        let s = url.trim();
        let name = s.strip_suffix(".git").unwrap_or(s);
        name.rsplit('/').next().map(|n| n.to_string())
    });

    Ok(GitRepoInfo {
        is_repo: true,
        remote_url,
        repo_name,
        branch,
        status,
    })
}

#[tauri::command]
pub fn detect_git_branch(path: String) -> Result<Option<String>, String> {
    let p = std::path::Path::new(&path);
    let git_dir = p.join(".git");
    if !git_dir.exists() {
        return Ok(None);
    }
    Ok(run_git(&path, &["branch", "--show-current"]))
}

#[tauri::command]
pub fn get_git_branches(path: String) -> Result<Vec<GitBranch>, String> {
    let output = run_git(&path, &["branch"]).ok_or("git branch failed")?;
    let branches: Vec<GitBranch> = output
        .lines()
        .filter_map(|line| {
            let trimmed = line.trim();
            let is_current = trimmed.starts_with('*');
            let name = trimmed.trim_start_matches("* ").to_string();
            if name.is_empty() { None } else { Some(GitBranch { name, is_current }) }
        })
        .collect();
    Ok(branches)
}

#[tauri::command]
pub fn get_git_log(path: String, count: Option<usize>) -> Result<Vec<String>, String> {
    let n = count.unwrap_or(20);
    let output = run_git(&path, &["log", "--oneline", &format!("-{}", n)]).ok_or("git log failed")?;
    Ok(output.lines().map(|l| l.to_string()).collect())
}

fn run_git(cwd: &str, args: &[&str]) -> Option<String> {
    hidden_command("git")
        .args(args)
        .current_dir(cwd)
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .filter(|s| !s.is_empty())
}
