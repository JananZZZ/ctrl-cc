use std::env;
use std::path::{Path, PathBuf};

use super::claude_launch_plan::ClaudeLaunchPlan;
use super::process_canary::canary_program_owned;
use super::runtime_types::{ClaudeLaunchPlanDebug, RuntimeDiscoveryResult};

pub fn discover_claude() -> RuntimeDiscoveryResult {
    let mut debug = Vec::new();
    let mut selected: Option<ClaudeLaunchPlanDebug> = None;
    let mut errors = Vec::new();
    for plan in collect_launch_plans() {
        let policy_allowed = is_policy_allowed(&plan);
        let (canary_ok, version_ok, version_text, error) = if !policy_allowed {
            (false, false, None,
             Some("Blocked by Ctrl-CC policy: shell wrappers disabled unless CTRL_CC_ALLOW_SHELL_WRAPPER=1".into()))
        } else { match canary_launch_plan(&plan) {
            Ok(v) => (true, true, Some(v), None),
            Err(e) => (false, false, None, Some(e)),
        }};
        let mut item = ClaudeLaunchPlanDebug {
            id: plan.id.clone(), label: plan.label.clone(),
            program: plan.program.clone(), args_prefix: plan.args_prefix.clone(),
            canary_ok, version_ok, version_text, error: error.clone(), selected: false,
        };
        if selected.is_none() && item.canary_ok && item.version_ok { item.selected = true; selected = Some(item.clone()); }
        if let Some(e) = error { errors.push(format!("{}: {}", plan.id, e)); }
        debug.push(item);
    }
    RuntimeDiscoveryResult { selected, plans: debug, errors }
}

pub fn select_launch_plan() -> Result<ClaudeLaunchPlan, String> {
    let mut blocked_or_failed = Vec::new();
    for plan in collect_launch_plans() {
        if !is_policy_allowed(&plan) {
            blocked_or_failed.push(format!("{}: blocked by policy (shell wrapper)", plan.id));
            continue;
        }
        match canary_launch_plan(&plan) {
            Ok(_) => return Ok(plan),
            Err(e) => blocked_or_failed.push(format!("{}: {}", plan.id, e)),
        }
    }
    Err(format!("{}\nNo policy-allowed runnable launch plan. Set CTRL_CC_CLAUDE_JS to Claude CLI JS path.", blocked_or_failed.join("\n")))
}

fn is_policy_allowed(plan: &ClaudeLaunchPlan) -> bool {
    if env::var("CTRL_CC_ALLOW_SHELL_WRAPPER").ok().as_deref() == Some("1") { return true; }
    !(plan.id.contains("powershell") || plan.id.contains("pwsh") || plan.id.contains("cmd"))
}

fn collect_launch_plans() -> Vec<ClaudeLaunchPlan> {
    let mut plans = Vec::new();
    if let Some(p) = plan_from_user_js_override() { plans.push(p); }
    if let Some(p) = plan_from_user_command_override() { plans.push(p); }
    if let (Some(node), Some(js)) = (find_node_exe(), find_claude_cli_js()) {
        plans.push(ClaudeLaunchPlan {
            id: "direct-node-js".into(), label: "Direct Node.js + Claude CLI JS".into(),
            program: node.to_string_lossy().to_string(), args_prefix: vec![js.to_string_lossy().to_string()],
            reason: "Known npm global locations".into(),
        });
    }
    if let Some(p) = resolve_node_plan_from_claude_shim() { plans.push(p); }
    for p in scan_node_modules_for_claude_js() { plans.push(p); }
    if let Some(exe) = find_on_path("claude.exe") {
        plans.push(ClaudeLaunchPlan {
            id: "native-claude-exe".into(), label: "Native claude.exe".into(),
            program: exe.to_string_lossy().to_string(), args_prefix: vec![], reason: "Native exe".into(),
        });
    }
    // shell wrappers listed for diagnostics, blocked by default
    if let Some(pwsh) = find_on_path("pwsh.exe") {
        if let Some(ps1) = find_claude_ps1() {
            plans.push(ClaudeLaunchPlan { id: "pwsh-ps1".into(), label: "pwsh + claude.ps1".into(),
                program: pwsh.to_string_lossy().to_string(),
                args_prefix: vec!["-NoLogo".into(),"-NoProfile".into(),"-ExecutionPolicy".into(),"Bypass".into(),"-File".into(),ps1.to_string_lossy().to_string()],
                reason: "Shell wrapper fallback".into() });
        }
    }
    let wp = PathBuf::from(r"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe");
    if wp.exists() { if let Some(ps1) = find_claude_ps1() {
        plans.push(ClaudeLaunchPlan { id: "windows-powershell-ps1".into(), label: "PowerShell + claude.ps1".into(),
            program: wp.to_string_lossy().to_string(),
            args_prefix: vec!["-NoLogo".into(),"-NoProfile".into(),"-ExecutionPolicy".into(),"Bypass".into(),"-File".into(),ps1.to_string_lossy().to_string()],
            reason: "Shell wrapper; may trigger 0xc0000142".into() });
    }}
    if let Some(cmd) = find_cmd_exe() { if let Some(shim) = find_claude_cmd() {
        plans.push(ClaudeLaunchPlan { id: "cmd-claude-cmd".into(), label: "cmd.exe + claude.cmd".into(),
            program: cmd.to_string_lossy().to_string(),
            args_prefix: vec!["/d".into(),"/s".into(),"/c".into(),shim.to_string_lossy().to_string()],
            reason: "Shell wrapper fallback".into() });
    }}
    dedupe_plans(plans)
}

fn dedupe_plans(plans: Vec<ClaudeLaunchPlan>) -> Vec<ClaudeLaunchPlan> {
    let mut out = Vec::new(); let mut seen = std::collections::HashSet::new();
    for p in plans { let k = format!("{}|{}", p.program, p.args_prefix.join("|")); if seen.insert(k) { out.push(p); } }
    out
}

fn plan_from_user_js_override() -> Option<ClaudeLaunchPlan> {
    let js = env::var("CTRL_CC_CLAUDE_JS").ok()?; let p = PathBuf::from(js.trim());
    if !p.exists() { return None; } let node = find_node_exe()?;
    Some(ClaudeLaunchPlan { id: "user-override-claude-js".into(), label: "User override Claude JS".into(),
        program: node.to_string_lossy().to_string(), args_prefix: vec![p.to_string_lossy().to_string()],
        reason: "CTRL_CC_CLAUDE_JS".into() })
}

fn plan_from_user_command_override() -> Option<ClaudeLaunchPlan> {
    let cmd = env::var("CTRL_CC_CLAUDE_COMMAND").ok()?; let t = cmd.trim();
    if t.is_empty() { return None; }
    Some(ClaudeLaunchPlan { id: "user-override-command".into(), label: "User override command".into(),
        program: t.to_string(), args_prefix: vec![], reason: "CTRL_CC_CLAUDE_COMMAND".into() })
}

fn canary_launch_plan(plan: &ClaudeLaunchPlan) -> Result<String, String> { canary_program_owned(&plan.program, &plan.version_args()) }

fn find_node_exe() -> Option<PathBuf> {
    find_on_path("node.exe")
        .or_else(|| { let p = PathBuf::from(r"C:\Program Files\nodejs\node.exe"); p.exists().then_some(p) })
        .or_else(|| { let l = env::var("LOCALAPPDATA").ok().map(PathBuf::from)?; let p = l.join(r"Programs\nodejs\node.exe"); p.exists().then_some(p) })
}

fn find_cmd_exe() -> Option<PathBuf> {
    if let Ok(cs) = env::var("ComSpec") { let p = PathBuf::from(cs); if p.exists() { return Some(p); } }
    let p = PathBuf::from(r"C:\Windows\System32\cmd.exe"); p.exists().then_some(p)
}

fn find_claude_cli_js() -> Option<PathBuf> {
    let mut cs: Vec<PathBuf> = Vec::new();
    if let Ok(a) = env::var("APPDATA") { push_js_cands(&mut cs, &PathBuf::from(a).join("npm")); }
    if let Ok(p) = env::var("NPM_CONFIG_PREFIX") { push_js_cands(&mut cs, &PathBuf::from(p)); }
    cs.into_iter().find(|p| p.exists())
}

fn push_js_cands(cs: &mut Vec<PathBuf>, base: &Path) {
    let roots = [base.join(r"node_modules\@anthropic-ai\claude-code"), base.join(r"node_modules\@anthropic-ai\claude"), base.join(r"node_modules\claude-code"), base.join(r"node_modules\claude")];
    let names = ["cli.js","cli.mjs","cli.cjs","index.js","index.mjs","bin/claude.js","bin/claude.mjs","bin/cli.js","dist/cli.js","dist/index.js"];
    for r in roots { for n in names { cs.push(r.join(n)); } }
}

fn find_claude_ps1() -> Option<PathBuf> {
    env::var("APPDATA").ok().map(PathBuf::from).map(|p| p.join(r"npm\claude.ps1")).filter(|p| p.exists())
        .or_else(|| find_on_path("claude.ps1"))
}

fn find_claude_cmd() -> Option<PathBuf> {
    env::var("APPDATA").ok().map(PathBuf::from).map(|p| p.join(r"npm\claude.cmd")).filter(|p| p.exists())
        .or_else(|| find_on_path("claude.cmd"))
}

fn resolve_node_plan_from_claude_shim() -> Option<ClaudeLaunchPlan> {
    let shim = find_claude_cmd().or_else(find_claude_ps1).or_else(|| find_on_path("claude"))?;
    let node = find_node_exe()?;
    let bytes = std::fs::read(&shim).ok()?;
    let content = String::from_utf8_lossy(&bytes).to_string();
    let shim_dir = shim.parent()?.to_path_buf();
    if let Some(js) = parse_js_from_shim(&content, &shim_dir) { if js.exists() {
        return Some(ClaudeLaunchPlan { id: "direct-node-from-shim".into(), label: "Direct Node.js from shim".into(),
            program: node.to_string_lossy().to_string(), args_prefix: vec![js.to_string_lossy().to_string()],
            reason: format!("Resolved from {}", shim.to_string_lossy()) });
    }}
    for js in search_js_entries(&shim_dir) {
        return Some(ClaudeLaunchPlan { id: "direct-node-from-shim-search".into(), label: "Direct Node.js from shim dir".into(),
            program: node.to_string_lossy().to_string(), args_prefix: vec![js.to_string_lossy().to_string()],
            reason: format!("Searched {}", shim_dir.to_string_lossy()) });
    }
    None
}

fn parse_js_from_shim(content: &str, shim_dir: &Path) -> Option<PathBuf> {
    let n = content.replace('/', "\\");
    for m in [r"node_modules\@anthropic-ai\claude-code\", r"node_modules\@anthropic-ai\claude\", r"node_modules\claude-code\", r"node_modules\claude\"] {
        if let Some(i) = n.find(m) { let t = &n[i..]; let mut e = t.len();
            for s in ['"','\'',' ','\r','\n','`'] { if let Some(p) = t.find(s) { e = e.min(p); } }
            let r = &t[..e]; if r.ends_with(".js")||r.ends_with(".mjs")||r.ends_with(".cjs") { return Some(shim_dir.join(r)); }
        }
    }
    None
}

fn search_js_entries(base: &Path) -> Vec<PathBuf> {
    let mut out = Vec::new();
    for r in [base.join("node_modules"), base.join(r"node_modules\@anthropic-ai")] { collect_js(&r, 0, &mut out); }
    out
}

fn collect_js(dir: &Path, depth: usize, out: &mut Vec<PathBuf>) {
    if depth > 6 || out.len() >= 20 || !dir.exists() { return; }
    let entries = match std::fs::read_dir(dir) { Ok(v) => v, Err(_) => return };
    for e in entries.flatten() { let p = e.path(); let nm = p.file_name().and_then(|v| v.to_str()).unwrap_or("").to_lowercase();
        if p.is_dir() { if nm.contains("claude") || nm == "@anthropic-ai" || depth > 0 { collect_js(&p, depth + 1, out); } continue; }
        let lp = p.to_string_lossy().to_lowercase();
        if (nm=="cli.js"||nm=="cli.mjs"||nm=="index.js"||nm=="index.mjs"||nm=="claude.js"||nm=="claude.mjs") && lp.contains("claude") { out.push(p); }
    }
}

fn scan_node_modules_for_claude_js() -> Vec<ClaudeLaunchPlan> {
    let node = match find_node_exe() { Some(v) => v, None => return Vec::new() };
    let mut roots = Vec::new();
    if let Ok(a) = env::var("APPDATA") { roots.push(PathBuf::from(a).join("npm").join("node_modules")); }
    if let Ok(p) = env::var("NPM_CONFIG_PREFIX") { roots.push(PathBuf::from(p).join("node_modules")); }
    let mut plans = Vec::new();
    for r in roots { let mut es = Vec::new(); collect_js(&r, 0, &mut es);
        for js in es.into_iter().take(5) { plans.push(ClaudeLaunchPlan { id: "direct-node-scanned-js".into(),
            label: "Scanned npm modules".into(), program: node.to_string_lossy().to_string(),
            args_prefix: vec![js.to_string_lossy().to_string()], reason: format!("Scanned {}", r.to_string_lossy()) }); } }
    plans
}

fn find_on_path(exe: &str) -> Option<PathBuf> {
    let path = env::var_os("PATH")?;
    for d in env::split_paths(&path) { let c = d.join(exe); if c.exists() { return Some(c); } }
    None
}
