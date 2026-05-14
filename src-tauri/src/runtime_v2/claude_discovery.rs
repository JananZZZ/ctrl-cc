use std::collections::HashSet;
use std::env;
use std::path::{Path, PathBuf};

use super::claude_launch_plan::ClaudeLaunchPlan;
use super::process_canary::canary_program_owned;
use super::runtime_types::{ClaudeLaunchPlanDebug, RuntimeDiscoveryResult};

const CLI_RELATIVE_CANDIDATES: &[&str] = &[
    r"node_modules\@anthropic-ai\claude-code\cli.js",
    r"node_modules\@anthropic-ai\claude-code\bin\claude.js",
    r"node_modules\@anthropic-ai\claude-code\index.js",
    r"node_modules/@anthropic-ai/claude-code/cli.js",
    r"node_modules/@anthropic-ai/claude-code/bin/claude.js",
    r"node_modules/@anthropic-ai/claude-code/index.js",
];

const CLI_PACKAGE_RELATIVE_CANDIDATES: &[&str] = &[
    r"@anthropic-ai\claude-code\cli.js",
    r"@anthropic-ai\claude-code\bin\claude.js",
    r"@anthropic-ai\claude-code\index.js",
    r"@anthropic-ai/claude-code/cli.js",
    r"@anthropic-ai/claude-code/bin/claude.js",
    r"@anthropic-ai/claude-code/index.js",
];

pub fn discover_claude() -> RuntimeDiscoveryResult {
    let mut debug = Vec::new();
    let mut selected: Option<ClaudeLaunchPlanDebug> = None;
    let mut errors = Vec::new();

    for plan in collect_launch_plans() {
        let policy_allowed = is_launch_plan_allowed_by_policy(&plan);
        let (canary_ok, version_ok, version_text, error) = if policy_allowed {
            match canary_launch_plan(&plan) {
                Ok(version) => (true, true, Some(version), None),
                Err(err) => (false, false, None, Some(err)),
            }
        } else {
            (
                false,
                false,
                None,
                Some("Blocked by Ctrl-CC policy: shell wrappers are disabled unless CTRL_CC_ALLOW_SHELL_WRAPPER=1".to_string()),
            )
        };

        let mut item = ClaudeLaunchPlanDebug {
            id: plan.id.clone(),
            label: plan.label.clone(),
            program: plan.program.clone(),
            args_prefix: plan.args_prefix.clone(),
            canary_ok,
            version_ok,
            version_text,
            error: error.clone(),
            selected: false,
        };

        if selected.is_none() && item.canary_ok && item.version_ok {
            item.selected = true;
            selected = Some(item.clone());
        }

        if let Some(e) = error {
            errors.push(format!("{}: {}", plan.id, e));
        }

        debug.push(item);
    }

    if selected.is_none() {
        errors.push(
            "No policy-allowed runnable Claude launch plan was found. Set CTRL_CC_CLAUDE_JS to Claude CLI JS path, or set CTRL_CC_ALLOW_SHELL_WRAPPER=1 only as a temporary fallback.".to_string(),
        );
    }

    RuntimeDiscoveryResult { selected, plans: debug, errors }
}

pub fn select_launch_plan() -> Result<ClaudeLaunchPlan, String> {
    let mut errors = Vec::new();

    for plan in collect_launch_plans() {
        if !is_launch_plan_allowed_by_policy(&plan) {
            errors.push(format!(
                "{} blocked by policy. Set CTRL_CC_ALLOW_SHELL_WRAPPER=1 to allow shell wrappers temporarily.",
                plan.id
            ));
            continue;
        }

        match canary_launch_plan(&plan) {
            Ok(_) => return Ok(plan),
            Err(err) => errors.push(format!("{} failed canary: {}", plan.id, err)),
        }
    }

    Err(format!(
        "No runnable Claude launch plan found.\n{}\n\nRecommended fixes:\n1. Find Claude CLI JS path and set CTRL_CC_CLAUDE_JS.\n2. Or reinstall Claude Code CLI globally.\n3. Temporary fallback only: set CTRL_CC_ALLOW_SHELL_WRAPPER=1.",
        errors.join("\n")
    ))
}

fn is_launch_plan_allowed_by_policy(plan: &ClaudeLaunchPlan) -> bool {
    if plan.id == "user-override-program" || plan.id == "user-override-js" {
        return true;
    }

    let is_shell_wrapper = plan.id.contains("powershell")
        || plan.id.contains("pwsh")
        || plan.id.contains("cmd")
        || plan.id.contains("ps1")
        || plan.id.contains("claude-cmd");

    if is_shell_wrapper && env::var("CTRL_CC_ALLOW_SHELL_WRAPPER").is_err() {
        return false;
    }

    true
}

fn collect_launch_plans() -> Vec<ClaudeLaunchPlan> {
    let mut plans = Vec::new();

    // Highest priority: explicit JS path.
    if let Some(node) = find_node_exe() {
        if let Ok(js) = env::var("CTRL_CC_CLAUDE_JS") {
            let trimmed = js.trim();
            if !trimmed.is_empty() && Path::new(trimmed).exists() {
                plans.push(ClaudeLaunchPlan {
                    id: "user-override-js".to_string(),
                    label: "User override Claude CLI JS".to_string(),
                    program: node.to_string_lossy().to_string(),
                    args_prefix: vec![trimmed.to_string()],
                    reason: "CTRL_CC_CLAUDE_JS".to_string(),
                });
            }
        }
    }

    // Program-only override. Use for native exe only.
    if let Ok(command) = env::var("CTRL_CC_CLAUDE_COMMAND") {
        let trimmed = command.trim();
        if !trimmed.is_empty() {
            plans.push(ClaudeLaunchPlan {
                id: "user-override-program".to_string(),
                label: "User override program".to_string(),
                program: trimmed.to_string(),
                args_prefix: vec![],
                reason: "CTRL_CC_CLAUDE_COMMAND".to_string(),
            });
        }
    }

    if let (Some(node), Some(cli_js)) = (find_node_exe(), find_claude_cli_js()) {
        plans.push(ClaudeLaunchPlan {
            id: "direct-node-js".to_string(),
            label: "Direct Node.js + Claude CLI JS".to_string(),
            program: node.to_string_lossy().to_string(),
            args_prefix: vec![cli_js.to_string_lossy().to_string()],
            reason: "Bypasses cmd.exe / powershell.exe shims".to_string(),
        });
    }

    if let Some(plan) = resolve_node_plan_from_claude_shim() {
        plans.push(plan);
    }

    if let Some(claude_exe) = find_on_path("claude.exe") {
        plans.push(ClaudeLaunchPlan {
            id: "native-claude-exe".to_string(),
            label: "Native claude.exe".to_string(),
            program: claude_exe.to_string_lossy().to_string(),
            args_prefix: vec![],
            reason: "Native executable".to_string(),
        });
    }

    // Shell wrappers are listed for diagnostics, but blocked by default policy.
    if let Some(pwsh) = find_on_path("pwsh.exe") {
        if let Some(ps1) = find_claude_ps1() {
            plans.push(ClaudeLaunchPlan {
                id: "pwsh-ps1".to_string(),
                label: "PowerShell Core + claude.ps1".to_string(),
                program: pwsh.to_string_lossy().to_string(),
                args_prefix: vec![
                    "-NoLogo".into(),
                    "-NoProfile".into(),
                    "-ExecutionPolicy".into(),
                    "Bypass".into(),
                    "-File".into(),
                    ps1.to_string_lossy().to_string(),
                ],
                reason: "Shell wrapper fallback only".to_string(),
            });
        }
    }

    let windows_ps = PathBuf::from(r"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe");
    if windows_ps.exists() {
        if let Some(ps1) = find_claude_ps1() {
            plans.push(ClaudeLaunchPlan {
                id: "windows-powershell-ps1".to_string(),
                label: "Windows PowerShell + claude.ps1".to_string(),
                program: windows_ps.to_string_lossy().to_string(),
                args_prefix: vec![
                    "-NoLogo".into(),
                    "-NoProfile".into(),
                    "-ExecutionPolicy".into(),
                    "Bypass".into(),
                    "-File".into(),
                    ps1.to_string_lossy().to_string(),
                ],
                reason: "Shell wrapper fallback only; can trigger 0xc0000142 on this machine".to_string(),
            });
        }
    }

    if let Some(cmd) = find_cmd_exe() {
        if let Some(cmd_shim) = find_claude_cmd() {
            plans.push(ClaudeLaunchPlan {
                id: "cmd-claude-cmd".to_string(),
                label: "cmd.exe + claude.cmd".to_string(),
                program: cmd.to_string_lossy().to_string(),
                args_prefix: vec!["/d".into(), "/s".into(), "/c".into(), cmd_shim.to_string_lossy().to_string()],
                reason: "Shell wrapper fallback only; avoid if cmd.exe/powershell.exe fails".to_string(),
            });
        }
    }

    dedupe_plans(plans)
}

fn dedupe_plans(plans: Vec<ClaudeLaunchPlan>) -> Vec<ClaudeLaunchPlan> {
    let mut out = Vec::new();
    let mut seen = HashSet::new();
    for p in plans {
        let key = format!("{}::{:?}", p.program, p.args_prefix);
        if seen.insert(key) {
            out.push(p);
        }
    }
    out
}

fn canary_launch_plan(plan: &ClaudeLaunchPlan) -> Result<String, String> {
    let args = plan.version_args();
    canary_program_owned(&plan.program, &args)
}

fn find_node_exe() -> Option<PathBuf> {
    find_on_path("node.exe").or_else(|| {
        let p = PathBuf::from(r"C:\Program Files\nodejs\node.exe");
        p.exists().then_some(p)
    })
}

fn find_cmd_exe() -> Option<PathBuf> {
    if let Ok(comspec) = env::var("ComSpec") {
        let p = PathBuf::from(comspec);
        if p.exists() {
            return Some(p);
        }
    }
    let p = PathBuf::from(r"C:\Windows\System32\cmd.exe");
    p.exists().then_some(p)
}

fn find_claude_cli_js() -> Option<PathBuf> {
    let mut bases: Vec<PathBuf> = Vec::new();

    for key in ["NPM_CONFIG_PREFIX", "npm_config_prefix", "PREFIX"] {
        if let Ok(v) = env::var(key) {
            let p = PathBuf::from(v);
            bases.push(p.clone());
            bases.push(p.join("node_modules"));
        }
    }

    if let Ok(appdata) = env::var("APPDATA") {
        bases.push(PathBuf::from(&appdata).join("npm"));
        bases.push(PathBuf::from(&appdata).join("npm").join("node_modules"));
    }

    if let Ok(local) = env::var("LOCALAPPDATA") {
        bases.push(PathBuf::from(&local).join("npm"));
        bases.push(PathBuf::from(&local).join("npm").join("node_modules"));
    }

    if let Ok(user) = env::var("USERPROFILE") {
        bases.push(PathBuf::from(&user).join("AppData").join("Roaming").join("npm"));
        bases.push(PathBuf::from(&user).join("AppData").join("Roaming").join("npm").join("node_modules"));
        bases.push(PathBuf::from(&user).join(".npm-global"));
        bases.push(PathBuf::from(&user).join(".npm-global").join("lib").join("node_modules"));
    }

    if let Ok(program_files) = env::var("ProgramFiles") {
        bases.push(PathBuf::from(program_files).join("nodejs").join("node_modules"));
    }

    for base in bases {
        for rel in CLI_RELATIVE_CANDIDATES.iter().chain(CLI_PACKAGE_RELATIVE_CANDIDATES.iter()) {
            let p = base.join(rel);
            if p.exists() {
                return Some(p);
            }
        }
    }

    None
}

fn find_claude_ps1() -> Option<PathBuf> {
    env::var("APPDATA")
        .ok()
        .map(PathBuf::from)
        .map(|p| p.join(r"npm\claude.ps1"))
        .filter(|p| p.exists())
        .or_else(|| find_on_path("claude.ps1"))
}

fn find_claude_cmd() -> Option<PathBuf> {
    env::var("APPDATA")
        .ok()
        .map(PathBuf::from)
        .map(|p| p.join(r"npm\claude.cmd"))
        .filter(|p| p.exists())
        .or_else(|| find_on_path("claude.cmd"))
}

fn resolve_node_plan_from_claude_shim() -> Option<ClaudeLaunchPlan> {
    let shim = find_on_path("claude.cmd")
        .or_else(|| find_on_path("claude.ps1"))
        .or_else(|| find_on_path("claude"))?;

    let node = find_node_exe()?;
    let shim_dir = shim.parent()?.to_path_buf();
    let content = std::fs::read_to_string(&shim).unwrap_or_default();

    if let Some(js) = extract_cli_js_from_shim_content(&content, &shim_dir) {
        if js.exists() {
            return Some(ClaudeLaunchPlan {
                id: "direct-node-from-shim".to_string(),
                label: "Direct Node.js resolved from Claude npm shim".to_string(),
                program: node.to_string_lossy().to_string(),
                args_prefix: vec![js.to_string_lossy().to_string()],
                reason: format!("Resolved from shim {}", shim.to_string_lossy()),
            });
        }
    }

    let common_roots = [
        shim_dir.join("node_modules").join("@anthropic-ai").join("claude-code"),
        shim_dir.join("..").join("node_modules").join("@anthropic-ai").join("claude-code"),
    ];

    for root in common_roots {
        for file in ["cli.js", "bin/claude.js", "index.js"] {
            let p = root.join(file);
            if p.exists() {
                return Some(ClaudeLaunchPlan {
                    id: "direct-node-from-shim-dir".to_string(),
                    label: "Direct Node.js resolved from shim directory".to_string(),
                    program: node.to_string_lossy().to_string(),
                    args_prefix: vec![p.to_string_lossy().to_string()],
                    reason: format!("Resolved from shim dir {}", shim_dir.to_string_lossy()),
                });
            }
        }
    }

    None
}

fn extract_cli_js_from_shim_content(content: &str, shim_dir: &Path) -> Option<PathBuf> {
    for line in content.lines() {
        if !line.contains("@anthropic-ai") || !line.contains("claude-code") {
            continue;
        }

        let cleaned = line
            .replace("%dp0%", &shim_dir.to_string_lossy())
            .replace("%~dp0", &shim_dir.to_string_lossy())
            .replace("$basedir", &shim_dir.to_string_lossy())
            .replace("$PSScriptRoot", &shim_dir.to_string_lossy())
            .replace('"', " ")
            .replace('\'', " ");

        for token in cleaned.split_whitespace() {
            if token.contains("@anthropic-ai") && token.contains("claude-code") && token.ends_with(".js") {
                let p = PathBuf::from(token);
                if p.is_absolute() {
                    return Some(p);
                }
                return Some(shim_dir.join(p));
            }
        }
    }

    None
}

fn find_on_path(exe: &str) -> Option<PathBuf> {
    let path = env::var_os("PATH")?;
    for dir in env::split_paths(&path) {
        let candidate = dir.join(exe);
        if candidate.exists() {
            return Some(candidate);
        }
    }
    None
}
