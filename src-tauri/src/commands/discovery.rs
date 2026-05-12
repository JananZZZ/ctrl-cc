//! Claude Discovery Matrix — returns shell strategies and Claude candidates.
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShellStrategy {
    pub name: String,
    pub path: String,
    pub available: bool,
    pub note: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeCandidate {
    pub name: String,
    pub path: String,
    pub found: bool,
    pub version_ok: bool,
    pub version_text: Option<String>,
    pub error: Option<String>,
    pub runnable_by: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveryMatrix {
    pub shell_strategies: Vec<ShellStrategy>,
    pub claude_candidates: Vec<ClaudeCandidate>,
    pub selected_strategy: Option<String>,
    pub selected_candidate: Option<String>,
    pub overall_status: String,
}

#[tauri::command]
pub fn runtime_discover_claude() -> Result<DiscoveryMatrix, String> {
    let mut matrix = DiscoveryMatrix {
        shell_strategies: vec![],
        claude_candidates: vec![],
        selected_strategy: None,
        selected_candidate: None,
        overall_status: "unknown".into(),
    };

    // Shell strategies
    let system_root = std::env::var("SystemRoot").unwrap_or_else(|_| "C:\\Windows".to_string());

    let ps_path = std::path::PathBuf::from(&system_root)
        .join("System32").join("WindowsPowerShell").join("v1.0").join("powershell.exe");
    matrix.shell_strategies.push(ShellStrategy {
        name: "powershell".into(),
        path: ps_path.to_string_lossy().to_string(),
        available: ps_path.exists(),
        note: if ps_path.exists() { "Windows built-in PowerShell 5.1".into() } else { "PowerShell not found at default path".into() },
    });

    let pwsh_available = which::which("pwsh").ok();
    matrix.shell_strategies.push(ShellStrategy {
        name: "pwsh".into(),
        path: pwsh_available.as_ref().map(|p| p.to_string_lossy().to_string()).unwrap_or_default(),
        available: pwsh_available.is_some(),
        note: if pwsh_available.is_some() { "PowerShell Core found in PATH".into() } else { "pwsh not in PATH".into() },
    });

    let cmd_path = std::env::var("ComSpec").unwrap_or_else(|_| format!("{}\\System32\\cmd.exe", system_root));
    matrix.shell_strategies.push(ShellStrategy {
        name: "cmd".into(),
        path: cmd_path.clone(),
        available: std::path::Path::new(&cmd_path).exists(),
        note: "Windows Command Prompt — fallback only, 0xc0000142 risk on some editions".into(),
    });

    matrix.shell_strategies.push(ShellStrategy {
        name: "user_override".into(),
        path: std::env::var("CTRL_CC_SHELL").unwrap_or_default(),
        available: std::env::var("CTRL_CC_SHELL").is_ok(),
        note: "Set CTRL_CC_SHELL env var to override".into(),
    });

    // Select best strategy
    if ps_path.exists() {
        matrix.selected_strategy = Some("powershell".into());
    } else if pwsh_available.is_some() {
        matrix.selected_strategy = Some("pwsh".into());
    } else if std::env::var("CTRL_CC_SHELL").is_ok() {
        matrix.selected_strategy = Some("user_override".into());
    } else {
        matrix.selected_strategy = Some("cmd".into());
    }

    // Claude candidates
    let candidates = find_claude_candidates();
    matrix.claude_candidates = candidates;

    if let Some(best) = matrix.claude_candidates.iter().find(|c| c.found && c.version_ok) {
        matrix.selected_candidate = Some(best.name.clone());
        matrix.overall_status = format!("found via {} using {}", best.name, matrix.selected_strategy.as_deref().unwrap_or("unknown"));
    } else if matrix.claude_candidates.iter().any(|c| c.found) {
        matrix.overall_status = "found but version check failed".into();
    } else {
        matrix.overall_status = "not found — install Claude Code CLI".into();
    }

    Ok(matrix)
}

fn find_claude_candidates() -> Vec<ClaudeCandidate> {
    let mut candidates = vec![];

    // 1. claude (bare — relies on PATHEXT on Windows)
    let which_result = which::which("claude");
    let (found, path, version_ok, version_text, error) = probe_candidate("claude", which_result.ok().as_ref().map(|p| p.to_str().unwrap_or("")));
    candidates.push(ClaudeCandidate {
        name: "claude".into(), path, found, version_ok, version_text, error,
        runnable_by: "any shell (via PATHEXT)".into(),
    });

    // 2. claude.cmd (npm global)
    let appdata = std::env::var("APPDATA").unwrap_or_default();
    let cmd_path = std::path::PathBuf::from(&appdata).join("npm").join("claude.cmd");
    let (found, path, version_ok, version_text, error) = probe_candidate("claude.cmd (npm)", Some(cmd_path.to_str().unwrap_or("")));
    candidates.push(ClaudeCandidate {
        name: "claude.cmd".into(), path, found, version_ok, version_text, error,
        runnable_by: "cmd.exe, PowerShell".into(),
    });

    // 3. claude.ps1
    let ps1_path = std::path::PathBuf::from(&appdata).join("npm").join("claude.ps1");
    let (found, path, version_ok, version_text, error) = probe_candidate("claude.ps1", Some(ps1_path.to_str().unwrap_or("")));
    candidates.push(ClaudeCandidate {
        name: "claude.ps1".into(), path, found, version_ok, version_text, error,
        runnable_by: "PowerShell".into(),
    });

    // 4. npx fallback
    let npx_available = which::which("npx").ok();
    candidates.push(ClaudeCandidate {
        name: "npx".into(),
        path: npx_available.as_ref().map(|p| p.to_string_lossy().to_string()).unwrap_or_default(),
        found: npx_available.is_some(),
        version_ok: false,
        version_text: None,
        error: if npx_available.is_some() { None } else { Some("npx not found".into()) },
        runnable_by: "npx @anthropic-ai/claude-code".into(),
    });

    candidates
}

fn probe_candidate(name: &str, path: Option<&str>) -> (bool, String, bool, Option<String>, Option<String>) {
    let path_str = path.unwrap_or(name).to_string();
    let found = path.is_some() || which::which(name).is_ok();
    if !found || path_str.is_empty() {
        return (false, path_str, false, None, Some(format!("{} not found", name)));
    }

    // Try claude --version
    match std::process::Command::new(&path_str).arg("--version").output() {
        Ok(output) => {
            let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let version_ok = !version.is_empty() && output.status.success();
            if version_ok {
                (true, path_str, true, Some(version), None)
            } else {
                let err = String::from_utf8_lossy(&output.stderr).trim().to_string();
                (true, path_str, false, Some(version), Some(if err.is_empty() { "version check returned non-zero".into() } else { err }))
            }
        }
        Err(e) => (true, path_str, false, None, Some(format!("failed to run --version: {}", e))),
    }
}
