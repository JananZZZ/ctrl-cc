//! Claude Discovery Matrix — returns shell strategies and Claude candidates.
use crate::utils::hidden_command::hidden_command;
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

    let priority_order = ["node_direct", "claude_js", "claude", "claude.ps1", "claude.cmd", "npx"];
    if let Some(best) = priority_order.iter()
        .find_map(|name| matrix.claude_candidates.iter().find(|c| c.name == *name && c.found && c.version_ok))
    {
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
    let appdata = std::env::var("APPDATA").unwrap_or_default();
    let npm_prefix = std::env::var("NPM_PREFIX").ok()
        .or_else(|| std::env::var("npm_config_prefix").ok())
        .unwrap_or_else(|| format!("{}\\npm", appdata));

    // v9.0 Priority 0: node.exe + Claude CLI JS — avoids cmd.exe 0xc0000142 entirely
    let node_available = which::which("node");
    let cli_js_candidates = find_claude_cli_js(&npm_prefix, &appdata);
    if node_available.is_ok() && !cli_js_candidates.is_empty() {
        let node_path = node_available.as_ref().unwrap().to_string_lossy().to_string();
        let best_js = &cli_js_candidates[0];
        candidates.push(ClaudeCandidate {
            name: "node_direct".into(),
            path: format!("{} | {}", node_path, best_js),
            found: true,
            version_ok: true,
            version_text: Some("node.exe + Claude CLI JS (direct — safest, no cmd.exe)".into()),
            error: None,
            runnable_by: "node.exe (no shell wrapper)".into(),
        });
    } else {
        candidates.push(ClaudeCandidate {
            name: "node_direct".into(),
            path: format!("node={} js_candidates={}",
                node_available.as_ref().map(|p| p.to_string_lossy().to_string()).unwrap_or_default(),
                cli_js_candidates.len()),
            found: false,
            version_ok: false,
            version_text: None,
            error: Some(if node_available.is_err() { "node.exe not found in PATH".into() } else { "Claude CLI JS not found".into() }),
            runnable_by: "node.exe (no shell wrapper)".into(),
        });
    }

    // Priority 1: standalone claude.exe
    let claude_exe = std::path::PathBuf::from(&npm_prefix).join("node_modules").join("@anthropic-ai").join("claude-code").join("cli.js");
    let exe_found = claude_exe.exists();
    candidates.push(ClaudeCandidate {
        name: "claude_js".into(),
        path: claude_exe.to_string_lossy().to_string(),
        found: exe_found,
        version_ok: exe_found,
        version_text: if exe_found { Some("Claude CLI JS entry found".into()) } else { None },
        error: if exe_found { None } else { Some("@anthropic-ai/claude-code not found in npm prefix".into()) },
        runnable_by: "node.exe (direct JS)".into(),
    });

    // Priority 2: claude (bare — relies on PATHEXT on Windows, likely cmd wrapper)
    let which_result = which::which("claude");
    let (found, path, version_ok, version_text, error) = probe_candidate("claude", which_result.ok().as_ref().map(|p| p.to_str().unwrap_or("")));
    candidates.push(ClaudeCandidate {
        name: "claude".into(), path, found, version_ok, version_text, error,
        runnable_by: "any shell (via PATHEXT)".into(),
    });

    // Priority 3: claude.ps1 (PowerShell — avoids cmd.exe)
    let ps1_path = std::path::PathBuf::from(&appdata).join("npm").join("claude.ps1");
    let (found, path, version_ok, version_text, error) = probe_candidate("claude.ps1", Some(ps1_path.to_str().unwrap_or("")));
    candidates.push(ClaudeCandidate {
        name: "claude.ps1".into(), path, found, version_ok, version_text, error,
        runnable_by: "PowerShell".into(),
    });

    // Priority 4: claude.cmd (npm global — requires cmd.exe, 0xc0000142 risk)
    let cmd_path = std::path::PathBuf::from(&appdata).join("npm").join("claude.cmd");
    let (found, path, version_ok, version_text, error) = probe_candidate("claude.cmd (npm)", Some(cmd_path.to_str().unwrap_or("")));
    candidates.push(ClaudeCandidate {
        name: "claude.cmd".into(), path, found, version_ok, version_text, error,
        runnable_by: "cmd.exe, PowerShell (0xc0000142 risk)".into(),
    });

    // Priority 5: npx fallback
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

/// Find Claude CLI JS entry points in npm installation paths.
fn find_claude_cli_js(npm_prefix: &str, appdata: &str) -> Vec<String> {
    let mut paths = vec![];
    let bases = [
        format!("{}\\node_modules\\@anthropic-ai\\claude-code\\cli.js", npm_prefix),
        format!("{}\\node_modules\\@anthropic-ai\\claude-code\\bin\\claude.js", npm_prefix),
        format!("{}\\npm\\node_modules\\@anthropic-ai\\claude-code\\cli.js", appdata),
        format!("{}\\npm\\node_modules\\@anthropic-ai\\claude-code\\bin\\claude.js", appdata),
    ];
    for p in &bases {
        if std::path::Path::new(p).exists() {
            paths.push(p.clone());
        }
    }
    paths
}

fn probe_candidate(name: &str, path: Option<&str>) -> (bool, String, bool, Option<String>, Option<String>) {
    let path_str = path.unwrap_or(name).to_string();
    let found = path.is_some() || which::which(name).is_ok();
    if !found || path_str.is_empty() {
        return (false, path_str, false, None, Some(format!("{} not found", name)));
    }

    // Try claude --version
    match hidden_command(&path_str).arg("--version").output() {
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
