/// Maps common error patterns to Chinese explanations and fix suggestions.
pub fn resolve_error(error_text: &str) -> (String, String) {
    let lower = error_text.to_lowercase();

    if lower.contains("enoent") || lower.contains("not found") {
        return (
            "命令或程序未找到".to_string(),
            "请确认该工具已安装并添加到 PATH 环境变量中。可以打开 PowerShell 运行 where.exe <命令名> 确认。".to_string(),
        );
    }

    if lower.contains("eaccess") || lower.contains("permission denied") {
        return (
            "权限不足".to_string(),
            "请尝试以管理员身份运行 Ctrl-CC，或检查文件权限设置。".to_string(),
        );
    }

    if lower.contains("executionpolicy") || lower.contains("running scripts is disabled") {
        return (
            "PowerShell 执行策略阻止了脚本运行".to_string(),
            "在 Setup Center 中点击「修复 PowerShell 策略」，或手动在管理员 PowerShell 中运行: Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force".to_string(),
        );
    }

    if lower.contains("npm err") && lower.contains("e404") {
        return (
            "npm 包未找到".to_string(),
            "可能是 npm registry 连接问题。请尝试设置镜像源: npm config set registry https://registry.npmmirror.com".to_string(),
        );
    }

    if lower.contains("npm err") && lower.contains("eacces") {
        return (
            "npm 权限错误".to_string(),
            "可能是 npm 全局目录权限问题。请确认 npm 全局目录存在且可写入。".to_string(),
        );
    }

    if lower.contains("timeout") || lower.contains("timed out") {
        return (
            "操作超时".to_string(),
            "网络连接较慢或不稳定。请检查网络连接，或稍后重试。".to_string(),
        );
    }

    if lower.contains("certificate") || lower.contains("ssl") || lower.contains("tls") {
        return (
            "SSL/TLS 证书错误".to_string(),
            "可能是代理或防火墙阻止了连接。请检查网络设置。".to_string(),
        );
    }

    if lower.contains("chinese") || lower.contains("中文") {
        return (
            "路径包含中文字符".to_string(),
            "您的用户名或路径包含中文字符，可能导致某些工具运行异常。建议创建不含中文的 Windows 用户账户。".to_string(),
        );
    }

    (
        "未知错误".to_string(),
        format!("错误详情: {}\n\n请复制此信息并在 Setup Center 中查看详细日志。", error_text),
    )
}
