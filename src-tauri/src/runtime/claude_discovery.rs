use crate::runtime::event_payloads::ClaudeCapabilityPayload;
use std::process::Command;

/// Multi-strategy Claude CLI path discovery.
/// Tries: which → known install paths → npx fallback.
pub fn discover_claude_path() -> Option<String> {
    // Strategy 1: which (cross-platform, checks system PATH)
    if let Ok(path) = which::which("claude") {
        let p = path.to_string_lossy().to_string();
        log::info!("Claude CLI found via which: {}", p);
        return Some(p);
    }

    // Strategy 2: Known install locations
    #[cfg(target_os = "windows")]
    {
        let pf = std::env::var("ProgramFiles").unwrap_or_else(|_| r"C:\Program Files".to_string());
        let pfx86 = std::env::var("ProgramFiles(x86)").unwrap_or_else(|_| r"C:\Program Files (x86)".to_string());
        let candidates: Vec<Option<String>> = vec![
            std::env::var("APPDATA").ok().map(|d| format!("{}\\npm\\claude.cmd", d)),
            std::env::var("LOCALAPPDATA").ok().map(|d| format!("{}\\npm\\claude.cmd", d)),
            std::env::var("USERPROFILE").ok().map(|d| format!("{}\\AppData\\Roaming\\npm\\claude.cmd", d)),
            Some(format!("{}\\nodejs\\claude.cmd", pf)),
            Some(format!("{}\\nodejs\\claude.cmd", pfx86)),
        ];
        for cand in candidates.iter().flatten() {
            if std::path::Path::new(&cand).exists() {
                log::info!("Claude CLI found at known path: {}", cand);
                return Some(cand.clone());
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let home = std::env::var("HOME").unwrap_or_default();
        let candidates = [
            format!("{}/.local/bin/claude", home),
            "/usr/local/bin/claude".to_string(),
            "/opt/homebrew/bin/claude".to_string(),
            format!("{}/.nvm/versions/node/*/bin/claude", home),
        ];
        for cand in &candidates {
            if std::path::Path::new(cand).exists() {
                return Some(cand.to_string());
            }
        }
    }

    // Strategy 3: npx — ultimate fallback (downloads if needed)
    if Command::new("npx").arg("--version").output().is_ok() {
        log::info!("Claude CLI not found locally; will use npx @anthropic-ai/claude-code");
        return Some("npx".to_string());
    }

    log::warn!("Claude CLI not found by any strategy");
    None
}

/// Get the command vector to run Claude CLI.
/// If discovered via `npx`, returns `["npx", "-y", "@anthropic-ai/claude-code"]`.
/// Otherwise returns the full path to the CLI binary.
#[allow(dead_code)]
pub fn get_claude_command() -> Vec<String> {
    match discover_claude_path() {
        Some(ref path) if path == "npx" => {
            vec!["npx".to_string(), "-y".to_string(), "@anthropic-ai/claude-code".to_string()]
        }
        Some(path) => vec![path],
        None => vec!["claude".to_string()],
    }
}

fn run_shell_command(command_line: &str) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    let output = Command::new(std::env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".to_string()))
        .args(["/d", "/s", "/c", command_line])
        .output()
        .map_err(|e| format!("failed to spawn command: {e}"))?;

    #[cfg(not(target_os = "windows"))]
    let output = Command::new("bash")
        .args(["-lc", command_line])
        .output()
        .map_err(|e| format!("failed to spawn command: {e}"))?;

    let mut text = String::new();
    text.push_str(&String::from_utf8_lossy(&output.stdout));
    text.push_str(&String::from_utf8_lossy(&output.stderr));

    if output.status.success() {
        Ok(text)
    } else {
        Err(text)
    }
}

pub fn probe_claude_capability() -> ClaudeCapabilityPayload {
    let mut errors = Vec::new();

    let claude_path = discover_claude_path();
    if claude_path.is_none() {
        errors.push("claude not found in PATH or any known location".to_string());
    }

    let version = match run_shell_command("claude --version") {
        Ok(v) => Some(v.trim().to_string()),
        Err(e) => {
            errors.push(format!("claude --version failed: {e}"));
            None
        }
    };

    let auth_status_raw = match run_shell_command("claude auth status") {
        Ok(v) => v,
        Err(e) => {
            errors.push(format!("claude auth status failed: {e}"));
            e
        }
    };
    let auth_ok = auth_status_raw.to_lowercase().contains("logged")
        || auth_status_raw.to_lowercase().contains("authenticated")
        || auth_status_raw.contains("\"status\"");

    let stream_json_raw = match run_shell_command(
        "claude -p \"Return exactly: pong\" --output-format stream-json --include-partial-messages --verbose",
    ) {
        Ok(v) => v,
        Err(e) => {
            errors.push(format!("claude stream-json probe failed: {e}"));
            e
        }
    };

    let stream_json_ok = stream_json_raw.contains("pong")
        || stream_json_raw.contains("\"type\"")
        || stream_json_raw.contains("\"result\"");

    ClaudeCapabilityPayload {
        claude_path,
        version,
        auth_ok,
        auth_status_raw,
        stream_json_ok,
        stream_json_raw,
        errors,
    }
}

#[allow(dead_code)]
pub fn shell_quote_path(path: &str) -> String {
    #[cfg(target_os = "windows")]
    {
        format!("\"{}\"", path.replace('"', "\\\""))
    }

    #[cfg(not(target_os = "windows"))]
    {
        shell_words::quote(path).to_string()
    }
}
