use serde::{Deserialize, Serialize};
use std::env;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use crate::utils::hidden_command::hidden_command;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeCommandSpec {
    pub id: String,
    pub label: String,
    pub program: String,
    pub args_prefix: Vec<String>,
    pub kind: String,
    pub source: String,
    pub version_ok: bool,
    pub version_text: Option<String>,
    pub print_ok: bool,
    pub interactive_pty_ok: bool,
    pub selectable_for_chat: bool,
    pub selectable_for_terminal: bool,
    pub error: Option<String>,
}

pub fn discover_claude_commands() -> Vec<ClaudeCommandSpec> {
    let mut specs = Vec::new();

    if let Ok(p) = env::var("CTRL_CC_CLAUDE_BIN") {
        specs.push(native_spec(PathBuf::from(p), "CTRL_CC_CLAUDE_BIN"));
    }

    if let Ok(user_profile) = env::var("USERPROFILE") {
        specs.push(native_spec(
            PathBuf::from(user_profile).join(r".local\bin\claude.exe"),
            "native installer ~/.local/bin",
        ));
    }

    for p in find_path_candidates("claude.exe") {
        specs.push(native_spec(p, "PATH claude.exe"));
    }

    for p in find_npm_optional_native_candidates() {
        specs.push(native_spec(p, "npm optional native binary"));
    }

    for p in find_claude_npm_wrapper_candidates() {
        if let Some(spec) = node_wrapper_spec(p, "npm global @anthropic-ai/claude-code wrapper") {
            specs.push(spec);
        }
    }

    if let Some(bash) = find_git_bash() {
        specs.push(shell_spec(
            "git-bash-claude",
            "Git Bash + claude",
            bash,
            vec!["-lc".to_string(), "claude".to_string()],
            "gitBash",
            "Git for Windows",
            true,
            true,
        ));
    }

    if let Some(cmd) = find_cmd_shim() {
        specs.push(shell_spec(
            "cmd-claude-cmd",
            "cmd.exe + claude.cmd",
            PathBuf::from(r"C:\Windows\System32\cmd.exe"),
            vec!["/d".to_string(), "/s".to_string(), "/c".to_string(), format!("\"{}\"", cmd.to_string_lossy())],
            "cmdShim",
            "APPDATA npm shim",
            true,
            true,
        ));
    }

    if let Some(npx) = find_npx_cli_js() {
        if let Some(node) = find_node_exe() {
            specs.push(shell_spec(
                "npx-diagnostic-anthropic-claude-code",
                "Diagnostic only: node+npx @anthropic-ai/claude-code",
                node,
                vec![npx.to_string_lossy().to_string(), "--yes".into(), "@anthropic-ai/claude-code".into()],
                "npxDiagnostic",
                "npx diagnostic",
                false,
                false,
            ));
        }
    }

    dedupe_specs(specs).into_iter().map(inspect_spec).collect()
}

fn terminal_priority(plan: &ClaudeCommandSpec) -> i32 {
    match plan.kind.as_str() {
        "nativeExe" => 0,
        "cmdShim" => 10,
        "gitBash" => 20,
        "nodeWrapper" => 30,
        _ => 1000,
    }
}

fn command_rank(spec: &ClaudeCommandSpec, for_terminal: bool) -> i32 {
    if !spec.version_ok {
        return 10_000;
    }

    match spec.kind.as_str() {
        "nativeExe" => 0,
        "nodeWrapper" => 10,
        "cmdShim" => if for_terminal { 40 } else { 30 },
        "gitBash" => 50,
        _ => 1000,
    }
}

pub fn select_for_chat() -> Result<ClaudeCommandSpec, String> {
    let mut specs: Vec<_> = discover_claude_commands()
        .into_iter()
        .filter(|s| s.version_ok && s.selectable_for_chat)
        .collect();

    specs.sort_by_key(|s| command_rank(s, false));

    specs.into_iter().next().ok_or_else(|| {
        "No Claude command available for Chat. Install Claude Code CLI or run Setup Center.".to_string()
    })
}

pub fn select_for_terminal() -> Result<ClaudeCommandSpec, String> {
    let mut specs: Vec<_> = discover_claude_commands()
        .into_iter()
        .filter(|s| s.version_ok && s.selectable_for_terminal && s.interactive_pty_ok)
        .collect();

    specs.sort_by_key(|s| terminal_priority(s));

    specs.into_iter().next().ok_or_else(|| {
        "No Claude command available for Terminal PTY. Install native Claude Code or npm wrapper, then run diagnostics.".to_string()
    })
}

fn native_spec(path: PathBuf, source: &str) -> ClaudeCommandSpec {
    ClaudeCommandSpec {
        id: format!("native-{}", sanitize(&path.to_string_lossy())),
        label: "Native claude.exe".to_string(),
        program: path.to_string_lossy().to_string(),
        args_prefix: vec![],
        kind: "nativeExe".to_string(),
        source: source.to_string(),
        version_ok: false,
        version_text: None,
        print_ok: false,
        interactive_pty_ok: false,
        selectable_for_chat: false,
        selectable_for_terminal: false,
        error: None,
    }
}

fn shell_spec(
    id: &str,
    label: &str,
    program: PathBuf,
    args_prefix: Vec<String>,
    kind: &str,
    source: &str,
    selectable_for_chat: bool,
    selectable_for_terminal: bool,
) -> ClaudeCommandSpec {
    ClaudeCommandSpec {
        id: id.to_string(),
        label: label.to_string(),
        program: program.to_string_lossy().to_string(),
        args_prefix,
        kind: kind.to_string(),
        source: source.to_string(),
        version_ok: false,
        version_text: None,
        print_ok: false,
        interactive_pty_ok: false,
        selectable_for_chat,
        selectable_for_terminal,
        error: None,
    }
}

fn is_forbidden_windows_extensionless(path: &Path) -> bool {
    cfg!(windows)
        && path.file_name().and_then(|s| s.to_str()).map(|s| s.eq_ignore_ascii_case("claude")).unwrap_or(false)
        && path.extension().is_none()
}

fn inspect_spec(mut spec: ClaudeCommandSpec) -> ClaudeCommandSpec {
    let prog_path = Path::new(&spec.program);

    if !prog_path.exists() {
        spec.error = Some("program not found".to_string());
        return spec;
    }

    // v25: Permanently blacklist extensionless npm shim on Windows
    if is_forbidden_windows_extensionless(prog_path) {
        spec.error = Some("EXTENSIONLESS_WINDOWS_SHIM: Do not execute extensionless npm shim directly on Windows.".to_string());
        spec.selectable_for_chat = false;
        spec.selectable_for_terminal = false;
        spec.interactive_pty_ok = false;
        return spec;
    }

    match run_version(&spec) {
        Ok(v) => {
            spec.version_ok = true;
            spec.version_text = Some(v);
        }
        Err(e) => {
            spec.error = Some(e);
            return spec;
        }
    }

    match spec.kind.as_str() {
        "nativeExe" => {
            spec.selectable_for_chat = true;
            spec.selectable_for_terminal = true;
            spec.interactive_pty_ok = true;
        }
        "gitBash" => {
            spec.selectable_for_chat = true;
            spec.selectable_for_terminal = true;
            spec.interactive_pty_ok = true;
        }
        "cmdShim" => {
            spec.selectable_for_chat = true;
            spec.selectable_for_terminal = true;
            spec.interactive_pty_ok = true;
        }
        "nodeWrapper" => {
            spec.selectable_for_chat = true;
            spec.selectable_for_terminal = true;
            spec.interactive_pty_ok = true;
        }
        "npxDiagnostic" => {
            spec.selectable_for_chat = false;
            spec.selectable_for_terminal = false;
            spec.interactive_pty_ok = false;
        }
        _ => {}
    }

    spec
}

fn run_version(spec: &ClaudeCommandSpec) -> Result<String, String> {
    let mut args = spec.args_prefix.clone();
    args.push("--version".to_string());

    let mut cmd = hidden_command(&spec.program);
    cmd.args(&args).stdin(Stdio::null());
    let output = cmd.output().map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}

fn find_path_candidates(name: &str) -> Vec<PathBuf> {
    let mut out = Vec::new();
    if let Some(path_env) = env::var_os("PATH") {
        for dir in env::split_paths(&path_env) {
            let p = dir.join(name);
            if p.exists() {
                out.push(p);
            }
        }
    }
    out
}

fn find_git_bash() -> Option<PathBuf> {
    [
        r"C:\Program Files\Git\bin\bash.exe",
        r"C:\Program Files\Git\usr\bin\bash.exe",
        r"C:\Program Files (x86)\Git\bin\bash.exe",
    ]
    .iter()
    .map(PathBuf::from)
    .find(|p| p.exists())
}

fn find_cmd_shim() -> Option<PathBuf> {
    env::var("APPDATA").ok()
        .map(PathBuf::from)
        .map(|p| p.join(r"npm\claude.cmd"))
        .filter(|p| p.exists())
}

fn find_node_exe() -> Option<PathBuf> {
    find_path_candidates("node.exe").into_iter().next()
        .or_else(|| {
            let p = PathBuf::from(r"C:\Program Files\nodejs\node.exe");
            p.exists().then_some(p)
        })
}

fn find_npx_cli_js() -> Option<PathBuf> {
    let mut candidates = Vec::new();
    if let Ok(appdata) = env::var("APPDATA") {
        candidates.push(PathBuf::from(appdata).join(r"npm\node_modules\npm\bin\npx-cli.js"));
    }
    candidates.push(PathBuf::from(r"C:\Program Files\nodejs\node_modules\npm\bin\npx-cli.js"));
    candidates.into_iter().find(|p| p.exists())
}

fn find_claude_npm_wrapper_candidates() -> Vec<PathBuf> {
    let mut roots = Vec::new();

    if let Ok(appdata) = env::var("APPDATA") {
        roots.push(PathBuf::from(appdata).join("npm").join("node_modules"));
    }

    if let Some(root) = npm_root_g() {
        roots.push(root);
    }

    let rels = [
        r"@anthropic-ai\claude-code\cli-wrapper.cjs",
        r"@anthropic-ai\claude-code\cli.js",
        r"@anthropic-ai\claude-code\cli.cjs",
        r"@anthropic-ai\claude-code\cli.mjs",
        r"@anthropic-ai\claude-code\index.js",
        r"@anthropic-ai\claude-code\index.mjs",
        r"claude-code\cli-wrapper.cjs",
        r"claude-code\cli.js",
    ];

    let mut out = Vec::new();
    for root in roots {
        for rel in rels {
            let p = root.join(rel);
            if p.exists() {
                out.push(p);
            }
        }
    }
    out
}

fn node_wrapper_spec(path: PathBuf, source: &str) -> Option<ClaudeCommandSpec> {
    let node = find_node_exe()?;
    Some(ClaudeCommandSpec {
        id: format!("node-wrapper-{}", sanitize(&path.to_string_lossy())),
        label: "Node + Claude npm wrapper".to_string(),
        program: node.to_string_lossy().to_string(),
        args_prefix: vec![path.to_string_lossy().to_string()],
        kind: "nodeWrapper".to_string(),
        source: source.to_string(),
        version_ok: false,
        version_text: None,
        print_ok: false,
        interactive_pty_ok: false,
        selectable_for_chat: false,
        selectable_for_terminal: false,
        error: None,
    })
}

fn find_npm_optional_native_candidates() -> Vec<PathBuf> {
    let mut roots = Vec::new();

    if let Ok(appdata) = env::var("APPDATA") {
        roots.push(PathBuf::from(appdata).join("npm").join("node_modules"));
    }

    if let Some(root) = npm_root_g() {
        roots.push(root);
    }

    let mut out = Vec::new();
    for root in roots {
        scan_for_claude_exe(&root, 0, &mut out);
    }
    out
}

fn npm_root_g() -> Option<PathBuf> {
    let npm_cmd = find_path_candidates("npm.cmd").into_iter().next()?;
    let mut cmd = hidden_command(r"C:\Windows\System32\cmd.exe");
    cmd.args(["/d", "/s", "/c", &format!("\"{}\" root -g", npm_cmd.to_string_lossy())])
        .stdin(Stdio::null());
    let output = cmd.output().ok()?;
    if !output.status.success() {
        return None;
    }
    let txt = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if txt.is_empty() { None } else { Some(PathBuf::from(txt)) }
}

fn scan_for_claude_exe(dir: &Path, depth: usize, out: &mut Vec<PathBuf>) {
    if depth > 8 || out.len() > 50 || !dir.exists() {
        return;
    }
    let entries = match std::fs::read_dir(dir) {
        Ok(v) => v,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let name = path.file_name().and_then(|v| v.to_str()).unwrap_or("").to_ascii_lowercase();

        if path.is_dir() {
            if name.contains("claude") || name.contains("anthropic") || name.starts_with("@") || depth > 0 {
                scan_for_claude_exe(&path, depth + 1, out);
            }
        } else if name == "claude.exe" {
            out.push(path);
        }
    }
}

fn dedupe_specs(specs: Vec<ClaudeCommandSpec>) -> Vec<ClaudeCommandSpec> {
    let mut seen = std::collections::HashSet::new();
    let mut out = Vec::new();
    for spec in specs {
        let key = format!("{}|{}", spec.program.to_ascii_lowercase(), spec.args_prefix.join("|"));
        if seen.insert(key) {
            out.push(spec);
        }
    }
    out
}

fn sanitize(s: &str) -> String {
    s.chars().map(|c| if c.is_ascii_alphanumeric() { c } else { '-' }).collect()
}

#[derive(Debug, Clone)]
pub struct ResolvedInvocation {
    pub program: String,
    pub args: Vec<String>,
}

/// Build the actual command invocation for a given spec and Claude CLI args.
/// Handles native, cmdShim, gitBash, and npxDiagnostic formats correctly.
pub fn build_invocation(spec: &ClaudeCommandSpec, claude_args: &[String]) -> ResolvedInvocation {
    match spec.kind.as_str() {
        "cmdShim" => {
            // cmd.exe /d /s /c "C:\Users\...\npm\claude.cmd" <args...>
            let mut cmd_args = vec![
                "/d".to_string(),
                "/s".to_string(),
                "/c".to_string(),
            ];
            // spec.program is cmd.exe, spec.args_prefix contains [/d, /s, /c, shim_path]
            // Reconstruct with quoted shim path + claude args
            if let Some(shim) = spec.args_prefix.get(3) {
                let mut command = shim.clone();
                for a in claude_args {
                    command.push(' ');
                    command.push_str(&shell_quote(a));
                }
                cmd_args.push(command);
            } else {
                cmd_args.extend(claude_args.iter().cloned());
            }
            ResolvedInvocation {
                program: spec.program.clone(),
                args: cmd_args,
            }
        }
        "gitBash" => {
            // bash.exe -lc "claude <args...>"
            let quoted = if claude_args.is_empty() {
                "claude".to_string()
            } else {
                format!("claude {}", shell_quote_args(claude_args))
            };
            ResolvedInvocation {
                program: spec.program.clone(),
                args: vec!["-lc".to_string(), quoted],
            }
        }
        "nodeWrapper" => {
            let mut args = spec.args_prefix.clone();
            args.extend(claude_args.iter().cloned());
            ResolvedInvocation {
                program: spec.program.clone(),
                args,
            }
        }
        "npxDiagnostic" => {
            let mut args = spec.args_prefix.clone();
            args.extend(claude_args.iter().cloned());
            ResolvedInvocation {
                program: spec.program.clone(),
                args,
            }
        }
        _ => {
            // nativeExe and unknown: append args directly
            let mut args = spec.args_prefix.clone();
            args.extend(claude_args.iter().cloned());
            ResolvedInvocation {
                program: spec.program.clone(),
                args,
            }
        }
    }
}

fn shell_quote(s: &str) -> String {
    if s.contains('"') {
        format!("\"{}\"", s.replace('"', "\\\""))
    } else if s.contains(' ') {
        format!("\"{}\"", s)
    } else {
        s.to_string()
    }
}

fn shell_quote_args(args: &[String]) -> String {
    args.iter().map(|a| shell_quote(a)).collect::<Vec<_>>().join(" ")
}
