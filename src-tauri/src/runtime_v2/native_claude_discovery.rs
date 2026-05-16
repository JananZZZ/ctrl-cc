use std::env;
use std::path::{Path, PathBuf};
use crate::utils::hidden_command::hidden_command;

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeNativeCandidate {
    pub path: String,
    pub source: String,
    pub exists: bool,
    pub executable: bool,
    pub version_ok: bool,
    pub version_text: Option<String>,
    pub print_ok: bool,
    pub interactive_allowed: bool,
    pub error: Option<String>,
}

pub fn discover_native_claude_candidates() -> Vec<ClaudeNativeCandidate> {
    let mut paths: Vec<(PathBuf, String)> = Vec::new();

    if let Ok(p) = env::var("CTRL_CC_CLAUDE_BIN") {
        paths.push((PathBuf::from(p), "CTRL_CC_CLAUDE_BIN".to_string()));
    }

    if let Ok(user_profile) = env::var("USERPROFILE") {
        paths.push((
            PathBuf::from(user_profile).join(r".local\bin\claude.exe"),
            "native installer: %USERPROFILE%\\.local\\bin\\claude.exe".to_string(),
        ));
    }

    if let Ok(appdata) = env::var("APPDATA") {
        let root = PathBuf::from(appdata).join("npm").join("node_modules");
        collect_native_claude_exes(&root, &mut paths);
    }

    if let Some(path_env) = env::var_os("PATH") {
        for dir in env::split_paths(&path_env) {
            for name in ["claude.exe", "claude"] {
                let p = dir.join(name);
                if p.exists() {
                    paths.push((p, "PATH".to_string()));
                }
            }
        }
    }

    dedupe(paths)
        .into_iter()
        .map(|(path, source)| inspect_candidate(&path, &source))
        .collect()
}

pub fn select_native_claude_for_interactive() -> Result<PathBuf, String> {
    let candidates = discover_native_claude_candidates();

    for c in &candidates {
        if c.exists && c.executable && c.version_ok && c.interactive_allowed {
            return Ok(PathBuf::from(&c.path));
        }
    }

    Err(format!(
        "No native Claude executable is available for interactive PTY. Install native Claude Code, or set CTRL_CC_CLAUDE_BIN to claude.exe. Candidates:\n{}",
        candidates
            .iter()
            .map(|c| format!(
                "- {} | exists={} versionOk={} interactiveAllowed={} error={}",
                c.path,
                c.exists,
                c.version_ok,
                c.interactive_allowed,
                c.error.clone().unwrap_or_default()
            ))
            .collect::<Vec<_>>()
            .join("\n")
    ))
}

pub fn select_claude_for_print_mode() -> Result<PathBuf, String> {
    select_native_claude_for_interactive()
}

fn collect_native_claude_exes(root: &Path, out: &mut Vec<(PathBuf, String)>) {
    if !root.exists() {
        return;
    }

    let mut stack = vec![root.to_path_buf()];
    let mut visited = 0usize;

    while let Some(dir) = stack.pop() {
        visited += 1;
        if visited > 5000 {
            break;
        }

        let entries = match std::fs::read_dir(&dir) {
            Ok(v) => v,
            Err(_) => continue,
        };

        for entry in entries.flatten() {
            let path = entry.path();
            let name = path.file_name().and_then(|v| v.to_str()).unwrap_or("").to_ascii_lowercase();

            if path.is_dir() {
                if name.contains("claude") || name.contains("anthropic") || name.starts_with("@") {
                    stack.push(path);
                }
                continue;
            }

            if name == "claude.exe" {
                out.push((path, "npm optional native dependency scan".to_string()));
            }
        }
    }
}

fn inspect_candidate(path: &Path, source: &str) -> ClaudeNativeCandidate {
    let exists = path.exists();
    let executable = exists && path.extension().and_then(|v| v.to_str()).map(|v| v.eq_ignore_ascii_case("exe")).unwrap_or(true);

    if !exists {
        return ClaudeNativeCandidate {
            path: path.to_string_lossy().to_string(),
            source: source.to_string(),
            exists,
            executable: false,
            version_ok: false,
            version_text: None,
            print_ok: false,
            interactive_allowed: false,
            error: Some("path does not exist".to_string()),
        };
    }

    if is_shell_or_node_wrapper(path) {
        return ClaudeNativeCandidate {
            path: path.to_string_lossy().to_string(),
            source: source.to_string(),
            exists,
            executable,
            version_ok: false,
            version_text: None,
            print_ok: false,
            interactive_allowed: false,
            error: Some("rejected: shell/node/npx wrapper is not allowed for native interactive runtime".to_string()),
        };
    }

    let path_str = path.to_string_lossy();
    let version = hidden_command(&path_str)
        .arg("--version")
        .output();

    match version {
        Ok(output) if output.status.success() => ClaudeNativeCandidate {
            path: path.to_string_lossy().to_string(),
            source: source.to_string(),
            exists,
            executable,
            version_ok: true,
            version_text: Some(String::from_utf8_lossy(&output.stdout).trim().to_string()),
            print_ok: false,
            interactive_allowed: true,
            error: None,
        },
        Ok(output) => ClaudeNativeCandidate {
            path: path.to_string_lossy().to_string(),
            source: source.to_string(),
            exists,
            executable,
            version_ok: false,
            version_text: None,
            print_ok: false,
            interactive_allowed: false,
            error: Some(String::from_utf8_lossy(&output.stderr).trim().to_string()),
        },
        Err(e) => ClaudeNativeCandidate {
            path: path.to_string_lossy().to_string(),
            source: source.to_string(),
            exists,
            executable,
            version_ok: false,
            version_text: None,
            print_ok: false,
            interactive_allowed: false,
            error: Some(e.to_string()),
        },
    }
}

fn is_shell_or_node_wrapper(path: &Path) -> bool {
    let s = path.to_string_lossy().to_ascii_lowercase();
    s.ends_with(".cmd")
        || s.ends_with(".bat")
        || s.ends_with(".ps1")
        || s.ends_with("node.exe")
        || s.ends_with("npx.cmd")
        || s.ends_with("npx.exe")
}

fn dedupe(paths: Vec<(PathBuf, String)>) -> Vec<(PathBuf, String)> {
    let mut seen = std::collections::HashSet::new();
    let mut out = Vec::new();

    for (p, source) in paths {
        let key = p.to_string_lossy().to_ascii_lowercase();
        if seen.insert(key) {
            out.push((p, source));
        }
    }

    out
}
