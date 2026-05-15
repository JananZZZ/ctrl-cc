use crate::setup::path_helper;
use crate::setup::subprocess_runner::{run_cmd, run_cmd_shell, run_powershell};
use crate::setup::types::{SetupCheckResult, SetupSnapshot};
use std::collections::HashMap;
use std::path::Path;

fn check(label: &str, id: &str, ok: bool, required: bool) -> SetupCheckResult {
    SetupCheckResult {
        id: id.to_string(),
        label: label.to_string(),
        status: if ok {
            "ok".to_string()
        } else if required {
            "missing".to_string()
        } else {
            "warning".to_string()
        },
        installed: ok,
        ok,
        required,
        version: None,
        latest_version: None,
        outdated: false,
        paths: Vec::new(),
        method: None,
        message: None,
        error: if ok { None } else { Some(format!("{} not found", label)) },
        fix_hint: None,
        details: serde_json::Value::Null,
    }
}

fn check_nodejs() -> SetupCheckResult {
    let out = run_cmd_shell("node --version");
    let ok = out.success && !out.stdout.is_empty();
    let mut r = check("Node.js", "nodejs", ok, true);
    if ok {
        r.version = Some(out.stdout.trim().to_string());
        r.paths = vec![path_helper::find_on_path("node.exe")
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default()];
    } else {
        r.fix_hint = Some("winget install OpenJS.NodeJS.LTS".to_string());
    }
    r
}

fn check_npm() -> SetupCheckResult {
    let out = run_cmd_shell("npm --version");
    let ok = out.success && !out.stdout.is_empty();
    let mut r = check("npm", "npm", ok, true);
    if ok {
        r.version = Some(out.stdout.trim().to_string());
    } else {
        r.fix_hint = Some("安装 Node.js 会自动包含 npm".to_string());
    }
    r
}

fn check_git() -> SetupCheckResult {
    let out = run_cmd_shell("git --version");
    let ok = out.success && !out.stdout.is_empty();
    let mut r = check("Git", "git", ok, true);
    if ok {
        r.version = Some(out.stdout.trim().to_string());
    } else {
        r.fix_hint = Some("winget install Git.Git".to_string());
    }
    r
}

fn check_git_bash() -> SetupCheckResult {
    let candidates = [
        r"C:\Program Files\Git\bin\bash.exe",
        r"C:\Program Files\Git\usr\bin\bash.exe",
        r"C:\Program Files (x86)\Git\bin\bash.exe",
    ];
    let found = candidates.iter().find(|p| Path::new(p).exists());
    let mut r = check("Git Bash", "gitBash", found.is_some(), false);
    if let Some(p) = found {
        r.paths = vec![p.to_string()];
        let out = run_cmd(p, &["--version"]);
        if out.success {
            r.version = Some(out.stdout.lines().next().unwrap_or("").to_string());
        }
    } else {
        r.fix_hint = Some("winget install Git.Git".to_string());
    }
    r
}

fn check_claude_code() -> SetupCheckResult {
    let out = run_cmd_shell("claude --version");
    if out.success && !out.stdout.is_empty() {
        let mut r = check("Claude Code CLI", "claudeCode", true, true);
        r.version = Some(out.stdout.trim().to_string());
        r.method = Some("cmd shell".to_string());
        return r;
    }

    if let Some(npm_root) = path_helper::npm_global_path() {
        let pkg_json = npm_root
            .join("@anthropic-ai")
            .join("claude-code")
            .join("package.json");
        if pkg_json.exists() {
            if let Ok(content) = std::fs::read_to_string(&pkg_json) {
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&content) {
                    let mut r = check("Claude Code CLI", "claudeCode", true, true);
                    r.version = parsed["version"].as_str().map(|s| s.to_string());
                    r.method = Some("npm global package".to_string());
                    r.message = Some(
                        "Claude Code 已通过 npm 安装但 claude 命令不可用，请检查 npm global PATH"
                            .to_string(),
                    );
                    return r;
                }
            }
        }
    }

    let mut r = check("Claude Code CLI", "claudeCode", false, true);
    r.fix_hint = Some("npm install -g @anthropic-ai/claude-code@latest".to_string());
    r
}

fn check_claude_auth() -> SetupCheckResult {
    let settings_path = path_helper::claude_settings_path();
    if !settings_path.exists() {
        let mut r = check("Claude Auth", "claudeAuth", false, false);
        r.message = Some("~/.claude/settings.json 不存在".to_string());
        r.fix_hint = Some("在 Setup Center 中配置 API Key".to_string());
        return r;
    }

    let content = match std::fs::read_to_string(&settings_path) {
        Ok(c) => c,
        Err(e) => {
            let mut r = check("Claude Auth", "claudeAuth", false, false);
            r.error = Some(format!("读取 settings.json 失败: {}", e));
            return r;
        }
    };

    let parsed: serde_json::Value = match serde_json::from_str(&content) {
        Ok(v) => v,
        Err(e) => {
            let mut r = check("Claude Auth", "claudeAuth", false, false);
            r.error = Some(format!("解析 settings.json 失败: {}", e));
            return r;
        }
    };

    let env = &parsed["env"];
    let has_token = env["ANTHROPIC_AUTH_TOKEN"].as_str().is_some()
        && !env["ANTHROPIC_AUTH_TOKEN"]
            .as_str()
            .unwrap_or("")
            .is_empty();
    let has_base_url = env["ANTHROPIC_BASE_URL"].as_str().is_some();

    let mut r = check("Claude Auth", "claudeAuth", has_token, false);
    if has_token {
        r.message = Some("API Token 已配置".to_string());
    }
    if has_base_url {
        r.details = serde_json::json!({"baseUrl": env["ANTHROPIC_BASE_URL"].as_str().unwrap_or("")});
    }
    if !has_token {
        r.fix_hint = Some("在 Setup Center → API 配置中设置 API Key".to_string());
    }
    r
}

fn check_claude_config() -> SetupCheckResult {
    let claude_json = path_helper::claude_json_path();
    let mut r = check("Claude Config", "claudeConfig", claude_json.exists(), false);

    if claude_json.exists() {
        if let Ok(content) = std::fs::read_to_string(&claude_json) {
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&content) {
                let onboarded = parsed["hasCompletedOnboarding"].as_bool().unwrap_or(false);
                r.details = serde_json::json!({"hasCompletedOnboarding": onboarded});
                if !onboarded {
                    r.message = Some(".claude.json exists but onboarding not completed".to_string());
                }
            }
        }
    } else {
        r.message = Some(".claude.json 不存在".to_string());
    }
    r
}

fn check_windows_terminal() -> SetupCheckResult {
    let out = run_cmd_shell("where.exe wt");

    if out.success && !out.stdout.trim().is_empty() {
        let mut r = check("Windows Terminal", "windowsTerminal", true, false);
        r.paths = out.stdout.lines().map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
        r.method = Some("where.exe wt".to_string());
        return r;
    }

    let mut candidates = Vec::new();

    if let Ok(local_appdata) = std::env::var("LOCALAPPDATA") {
        candidates.push(std::path::PathBuf::from(local_appdata).join(r"Microsoft\WindowsApps\wt.exe"));
    }

    if let Ok(userprofile) = std::env::var("USERPROFILE") {
        candidates.push(std::path::PathBuf::from(userprofile).join(r"AppData\Local\Microsoft\WindowsApps\wt.exe"));
    }

    for p in candidates {
        if p.exists() {
            let mut r = check("Windows Terminal", "windowsTerminal", true, false);
            r.paths = vec![p.to_string_lossy().to_string()];
            r.method = Some("known path".to_string());
            return r;
        }
    }

    let mut r = check("Windows Terminal", "windowsTerminal", false, false);
    r.status = "warning".to_string();
    r.fix_hint = Some("winget install Microsoft.WindowsTerminal".to_string());
    r
}

fn check_powershell_policy() -> SetupCheckResult {
    let out = run_powershell("Get-ExecutionPolicy -Scope CurrentUser");
    let policy = out.stdout.trim().to_lowercase();
    let ok = matches!(
        policy.as_str(),
        "remotesigned" | "bypass" | "unrestricted" | "allsigned"
    );

    let mut r = check("PowerShell 执行策略", "powershellPolicy", ok, true);
    r.version = Some(out.stdout.trim().to_string());
    r.message = Some(format!("CurrentUser 策略: {}", out.stdout.trim()));
    if !ok {
        r.fix_hint =
            Some("Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force"
                .to_string());
    }
    r
}

fn check_npm_registry() -> SetupCheckResult {
    let out = run_cmd_shell("npm config get registry");
    let registry = out.stdout.trim().to_string();
    let ok = out.success && !registry.is_empty();
    let using_npmmirror = registry.contains("npmmirror.com");

    let mut r = check("npm Registry", "npmRegistry", ok, false);
    r.version = Some(registry.clone());
    r.message = Some(if using_npmmirror {
        "已使用 npmmirror 镜像".to_string()
    } else {
        format!("当前 registry: {}", registry)
    });
    if !using_npmmirror {
        r.fix_hint = Some("npm config set registry https://registry.npmmirror.com".to_string());
    }
    r
}

fn check_path_env() -> SetupCheckResult {
    let node = run_cmd_shell("where.exe node");
    let npm = run_cmd_shell("where.exe npm");
    let claude_cmd = run_cmd_shell("where.exe claude.cmd");
    let claude = run_cmd_shell("where.exe claude");
    let wt = run_cmd_shell("where.exe wt");

    let node_ok = node.success && !node.stdout.trim().is_empty();
    let npm_ok = npm.success && !npm.stdout.trim().is_empty();
    let claude_ok = (claude_cmd.success && !claude_cmd.stdout.trim().is_empty())
        || (claude.success && !claude.stdout.trim().is_empty());

    let ok = node_ok && npm_ok;

    let mut r = check("PATH 环境", "pathEnv", ok, false);
    r.required = false;
    r.status = if ok { "ok".to_string() } else { "warning".to_string() };
    r.installed = ok;
    r.ok = ok;

    r.details = serde_json::json!({
        "node": node.stdout,
        "npm": npm.stdout,
        "claude": claude.stdout,
        "claudeCmd": claude_cmd.stdout,
        "wt": wt.stdout,
        "nodeOk": node_ok,
        "npmOk": npm_ok,
        "claudeOk": claude_ok
    });

    if !ok {
        r.fix_hint = Some("PATH 可疑：请检查 Node.js 和 npm 是否可通过 where.exe 找到。".to_string());
    }

    r
}

fn check_path_issues() -> SetupCheckResult {
    let userprofile = std::env::var("USERPROFILE").unwrap_or_default();
    let appdata = std::env::var("APPDATA").unwrap_or_default();
    let mut issues = Vec::new();

    if path_helper::has_chinese_in_path(&userprofile) {
        issues.push("USERPROFILE 包含中文字符，可能导致部分工具异常".to_string());
    }
    if path_helper::has_chinese_in_path(&appdata) {
        issues.push("APPDATA 包含中文字符".to_string());
    }
    if path_helper::check_path_for_spaces(&userprofile) {
        issues.push("USERPROFILE 包含空格".to_string());
    }

    let mut r = check("路径问题", "pathIssues", issues.is_empty(), false);
    r.details = serde_json::json!({
        "userProfile": userprofile,
        "appdata": appdata,
        "issues": issues,
    });
    r
}

fn check_workspace() -> SetupCheckResult {
    let home = path_helper::user_home();
    let ok = home.exists();
    let mut r = check("工作目录", "workspace", ok, true);
    r.paths = vec![home.to_string_lossy().to_string()];
    r
}

fn check_api_provider() -> SetupCheckResult {
    let settings_path = path_helper::claude_settings_path();
    if !settings_path.exists() {
        let mut r = check("API Provider", "apiProvider", false, false);
        r.message = Some("~/.claude/settings.json 不存在".to_string());
        r.fix_hint = Some("在 Setup Center → API 配置中配置 Provider".to_string());
        return r;
    }

    let content = match std::fs::read_to_string(&settings_path) {
        Ok(c) => c,
        Err(e) => {
            let mut r = check("API Provider", "apiProvider", false, false);
            r.error = Some(format!("读取失败: {}", e));
            return r;
        }
    };

    let parsed: serde_json::Value = match serde_json::from_str(&content) {
        Ok(v) => v,
        Err(e) => {
            let mut r = check("API Provider", "apiProvider", false, false);
            r.error = Some(format!("解析失败: {}", e));
            return r;
        }
    };

    let env = &parsed["env"];
    let base_url = env["ANTHROPIC_BASE_URL"].as_str().unwrap_or("");

    let provider = if base_url.contains("deepseek") {
        "DeepSeek"
    } else if base_url.contains("bigmodel") || base_url.contains("zhipu") {
        "智谱 GLM"
    } else if base_url.contains("minimax") {
        "MiniMax"
    } else if base_url.contains("mimo") {
        "小米 MiMo"
    } else if base_url.contains("dashscope") || base_url.contains("qwen") {
        "通义千问 Qwen"
    } else if base_url.is_empty() {
        "未配置"
    } else {
        "Custom"
    };

    let mut r = check("API Provider", "apiProvider", !base_url.is_empty(), false);
    r.version = Some(provider.to_string());
    r
}

pub fn detect_all_setup() -> SetupSnapshot {
    let mut checks: HashMap<String, SetupCheckResult> = HashMap::new();

    let items: Vec<SetupCheckResult> = vec![
        check_nodejs(),
        check_npm(),
        check_git(),
        check_git_bash(),
        check_claude_code(),
        check_claude_auth(),
        check_claude_config(),
        check_windows_terminal(),
        check_powershell_policy(),
        check_npm_registry(),
        check_path_env(),
        check_path_issues(),
        check_workspace(),
        check_api_provider(),
    ];

    for item in items {
        checks.insert(item.id.clone(), item);
    }

    let required_ok = checks
        .values()
        .filter(|c| c.required)
        .all(|c| c.ok);
    let any_error = checks.values().any(|c| !c.ok && c.required);

    let severity = if required_ok {
        "ok"
    } else if any_error {
        "error"
    } else {
        "warning"
    };

    let missing_required: Vec<&str> = checks
        .values()
        .filter(|c| c.required && !c.ok)
        .map(|c| c.label.as_str())
        .collect();

    let summary = if required_ok {
        "环境检测通过，所有必需组件已就绪。".to_string()
    } else {
        format!(
            "环境未完成：缺少 {} 个必需组件 ({})",
            missing_required.len(),
            missing_required.join(", ")
        )
    };

    let claude_commands =
        crate::runtime_v2::claude_command_resolver::discover_claude_commands();
    let chat_cmd = crate::runtime_v2::claude_command_resolver::select_for_chat().ok();
    let term_cmd = crate::runtime_v2::claude_command_resolver::select_for_terminal().ok();

    SetupSnapshot {
        generated_at: chrono::Utc::now().to_rfc3339(),
        ready: required_ok,
        severity: severity.to_string(),
        summary,
        checks,
        claude_commands,
        selected_chat_command_id: chat_cmd.map(|c| c.id),
        selected_terminal_command_id: term_cmd.map(|c| c.id),
    }
}
