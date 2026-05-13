use std::env;
use std::path::PathBuf;

use super::claude_launch_plan::ClaudeLaunchPlan;
use super::process_canary::canary_program_owned;
use super::runtime_types::{ClaudeLaunchPlanDebug, RuntimeDiscoveryResult};

pub fn discover_claude() -> RuntimeDiscoveryResult {
    let mut debug = Vec::new();
    let mut selected: Option<ClaudeLaunchPlanDebug> = None;
    let mut errors = Vec::new();

    for plan in collect_launch_plans() {
        let (canary_ok, version_ok, version_text, error) = match canary_launch_plan(&plan) {
            Ok(version) => (true, true, Some(version), None),
            Err(err) => (false, false, None, Some(err)),
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

    RuntimeDiscoveryResult { selected, plans: debug, errors }
}

pub fn select_launch_plan() -> Result<ClaudeLaunchPlan, String> {
    for plan in collect_launch_plans() {
        if canary_launch_plan(&plan).is_ok() {
            return Ok(plan);
        }
    }

    Err("No runnable Claude launch plan found. Install Node.js and Claude Code CLI, or set CTRL_CC_CLAUDE_COMMAND.".to_string())
}

fn collect_launch_plans() -> Vec<ClaudeLaunchPlan> {
    let mut plans = Vec::new();

    if let Ok(command) = env::var("CTRL_CC_CLAUDE_COMMAND") {
        let trimmed = command.trim();
        if !trimmed.is_empty() {
            plans.push(ClaudeLaunchPlan {
                id: "user-override".to_string(),
                label: "User override".to_string(),
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

    if let Some(claude_exe) = find_on_path("claude.exe") {
        plans.push(ClaudeLaunchPlan {
            id: "native-claude-exe".to_string(),
            label: "Native claude.exe".to_string(),
            program: claude_exe.to_string_lossy().to_string(),
            args_prefix: vec![],
            reason: "Native executable".to_string(),
        });
    }

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
                reason: "pwsh + npm PowerShell shim".to_string(),
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
                reason: "Windows PowerShell + npm PowerShell shim".to_string(),
            });
        }
    }

    if let Some(cmd) = find_cmd_exe() {
        if let Some(cmd_shim) = find_claude_cmd() {
            plans.push(ClaudeLaunchPlan {
                id: "cmd-claude-cmd".to_string(),
                label: "cmd.exe + claude.cmd".to_string(),
                program: cmd.to_string_lossy().to_string(),
                args_prefix: vec![
                    "/d".into(),
                    "/s".into(),
                    "/c".into(),
                    cmd_shim.to_string_lossy().to_string(),
                ],
                reason: "Last resort. Avoid if cmd.exe fails 0xc0000142.".to_string(),
            });
        }
    }

    plans
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
    let appdata = env::var("APPDATA").ok().map(PathBuf::from);
    let mut candidates = Vec::new();

    if let Some(appdata) = appdata {
        candidates.push(appdata.join(r"npm\node_modules\@anthropic-ai\claude-code\cli.js"));
        candidates.push(appdata.join(r"npm\node_modules\@anthropic-ai\claude-code\bin\claude.js"));
        candidates.push(appdata.join(r"npm\node_modules\@anthropic-ai\claude-code\index.js"));
    }

    candidates.into_iter().find(|p| p.exists())
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
