use crate::setup::subprocess_runner::{run_cmd_shell, run_powershell};
use crate::setup::task_manager::SetupTaskManager;
use tauri::AppHandle;

pub fn install_nodejs_lts(app: AppHandle, tasks: &SetupTaskManager) -> Result<String, String> {
    let task_id = tasks.new_task("install-nodejs-lts");

    tasks.emit(
        &app, &task_id, "install-nodejs-lts", "running",
        "安装 Node.js LTS", 0.1,
        "推荐使用 winget 安装 Node.js LTS。请在终端中运行以下命令或手动下载安装。",
        None,
    );

    tasks.emit(
        &app, &task_id, "install-nodejs-lts", "running",
        "Node.js LTS 安装指引", 0.5,
        "运行: winget install OpenJS.NodeJS.LTS",
        None,
    );

    let out = run_cmd_shell("winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements");
    if out.success {
        tasks.emit(
            &app, &task_id, "install-nodejs-lts", "complete",
            "完成", 1.0,
            "Node.js LTS 安装成功。请重启终端后运行 node --version 验证。",
            None,
        );
        return Ok("Node.js LTS 安装成功".to_string());
    }

    let err = format!(
        "Node.js 自动安装失败: {}\n\n手动安装: 访问 https://nodejs.org 下载 LTS 版本，或运行 winget install OpenJS.NodeJS.LTS",
        out.stderr
    );
    tasks.emit(&app, &task_id, "install-nodejs-lts", "error", "安装失败", 1.0, &err, Some(&err));
    Err(err)
}

pub fn install_git_for_windows(app: AppHandle, tasks: &SetupTaskManager) -> Result<String, String> {
    let task_id = tasks.new_task("install-git-for-windows");

    tasks.emit(
        &app, &task_id, "install-git-for-windows", "running",
        "安装 Git for Windows", 0.1,
        "推荐使用 winget 安装 Git for Windows（含 Git Bash）。",
        None,
    );

    tasks.emit(
        &app, &task_id, "install-git-for-windows", "running",
        "Git for Windows 安装指引", 0.5,
        "运行: winget install Git.Git",
        None,
    );

    let out = run_cmd_shell("winget install Git.Git --accept-package-agreements --accept-source-agreements");
    if out.success {
        tasks.emit(
            &app, &task_id, "install-git-for-windows", "complete",
            "完成", 1.0,
            "Git for Windows 安装成功。请重启终端后运行 git --version 验证。",
            None,
        );
        return Ok("Git for Windows 安装成功".to_string());
    }

    let err = format!(
        "Git 自动安装失败: {}\n\n手动安装: 访问 https://git-scm.com 下载，或运行 winget install Git.Git",
        out.stderr
    );
    tasks.emit(&app, &task_id, "install-git-for-windows", "error", "安装失败", 1.0, &err, Some(&err));
    Err(err)
}

pub fn fix_powershell_policy(
    app: AppHandle,
    tasks: &SetupTaskManager,
) -> Result<String, String> {
    let task_id = tasks.new_task("fix-powershell-policy");

    tasks.emit(
        &app,
        &task_id,
        "fix-powershell-policy",
        "running",
        "修复 PowerShell 执行策略",
        0.2,
        "正在设置 CurrentUser RemoteSigned...",
        None,
    );

    let out = run_powershell("Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force");
    if !out.success {
        let err = format!("PowerShell 执行策略修复失败: {}", out.stderr);
        tasks.emit(
            &app,
            &task_id,
            "fix-powershell-policy",
            "error",
            "修复失败",
            1.0,
            &err,
            Some(&err),
        );
        return Err(err);
    }

    tasks.emit(
        &app,
        &task_id,
        "fix-powershell-policy",
        "complete",
        "完成",
        1.0,
        "PowerShell 执行策略已设置为 RemoteSigned (CurrentUser)",
        None,
    );

    Ok("PowerShell 执行策略已修复".to_string())
}

pub fn set_npm_mirror(app: AppHandle, tasks: &SetupTaskManager) -> Result<String, String> {
    let task_id = tasks.new_task("set-npm-mirror");

    tasks.emit(
        &app,
        &task_id,
        "set-npm-mirror",
        "running",
        "设置 npm 镜像源",
        0.3,
        "正在设置 npm registry 为 npmmirror.com...",
        None,
    );

    let out = run_cmd_shell("npm config set registry https://registry.npmmirror.com");
    if !out.success {
        let err = format!("npm registry 设置失败: {}", out.stderr);
        tasks.emit(
            &app,
            &task_id,
            "set-npm-mirror",
            "error",
            "设置失败",
            1.0,
            &err,
            Some(&err),
        );
        return Err(err);
    }

    tasks.emit(
        &app,
        &task_id,
        "set-npm-mirror",
        "complete",
        "完成",
        1.0,
        "npm registry 已设置为 https://registry.npmmirror.com",
        None,
    );

    Ok("npm 镜像已设置".to_string())
}

pub fn install_claude_code_cli(
    app: AppHandle,
    tasks: &SetupTaskManager,
) -> Result<String, String> {
    let task_id = tasks.new_task("install-claude-code-cli");

    // Step 1: preflight
    tasks.emit(
        &app,
        &task_id,
        "install-claude-code-cli",
        "running",
        "预检环境",
        0.1,
        "检查 Node.js 和 npm...",
        None,
    );

    let node_check = run_cmd_shell("node --version");
    if !node_check.success {
        let err = "Node.js 未安装或不可用，请先安装 Node.js".to_string();
        tasks.emit(&app, &task_id, "install-claude-code-cli", "error", "预检失败", 0.1, &err, Some(&err));
        return Err(err);
    }

    let npm_check = run_cmd_shell("npm --version");
    if !npm_check.success {
        let err = "npm 未安装或不可用".to_string();
        tasks.emit(&app, &task_id, "install-claude-code-cli", "error", "预检失败", 0.1, &err, Some(&err));
        return Err(err);
    }

    // Step 2: set npm mirror
    tasks.emit(
        &app,
        &task_id,
        "install-claude-code-cli",
        "running",
        "设置 npm 镜像",
        0.2,
        "正在设置 npm registry...",
        None,
    );
    let _ = run_cmd_shell("npm config set registry https://registry.npmmirror.com");

    // Step 3: install
    tasks.emit(
        &app,
        &task_id,
        "install-claude-code-cli",
        "running",
        "安装 Claude Code CLI",
        0.3,
        "正在执行 npm install -g @anthropic-ai/claude-code@latest...",
        None,
    );

    let install_out =
        run_cmd_shell("npm install -g @anthropic-ai/claude-code@latest");

    if !install_out.success {
        let err = format!(
            "Claude Code CLI 安装失败: {}\n\n建议手动运行: npm install -g @anthropic-ai/claude-code@latest",
            install_out.stderr
        );
        tasks.emit(&app, &task_id, "install-claude-code-cli", "error", "安装失败", 0.8, &err, Some(&err));
        return Err(err);
    }

    // Step 4: verify
    tasks.emit(
        &app,
        &task_id,
        "install-claude-code-cli",
        "running",
        "验证安装",
        0.9,
        "正在运行 claude --version...",
        None,
    );

    let verify = run_cmd_shell("claude --version");
    if !verify.success {
        let warn = format!(
            "安装完成但 claude 命令不可用。请重启 Ctrl-CC 或手动将 npm global bin 目录添加到 PATH。\n\n错误详情: {}",
            verify.stderr
        );
        tasks.emit(&app, &task_id, "install-claude-code-cli", "complete", "完成（需重启）", 1.0, &warn, Some(&warn));
        return Ok(warn);
    }

    // Step 5: mark onboarding
    tasks.emit(
        &app,
        &task_id,
        "install-claude-code-cli",
        "running",
        "完成配置",
        0.95,
        "正在写入 .claude.json...",
        None,
    );

    if let Err(e) = crate::setup::config_writer::mark_onboarding_completed() {
        tasks.emit(&app, &task_id, "install-claude-code-cli", "running", "配置写入失败", 0.95, &format!(".claude.json 写入失败: {}", e), Some(&e.to_string()));
    }

    tasks.emit(
        &app,
        &task_id,
        "install-claude-code-cli",
        "complete",
        "完成",
        1.0,
        &format!("Claude Code CLI 安装成功: {}", verify.stdout.trim()),
        None,
    );

    Ok(format!(
        "Claude Code CLI 安装成功: {}",
        verify.stdout.trim()
    ))
}
