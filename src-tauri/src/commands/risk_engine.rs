use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct RiskAssessment {
    pub level: String,
    #[serde(rename = "isSafe")]
    pub is_safe: bool,
    pub reason: String,
}

const DANGEROUS_PATTERNS: &[(&str, &str, &str)] = &[
    ("rm -rf", "critical", "Recursive force delete"),
    ("rm -r", "high", "Recursive delete"),
    ("git reset --hard", "critical", "Hard git reset - data loss risk"),
    ("git push --force", "critical", "Force push to remote"),
    ("git clean -fd", "high", "Remove untracked files"),
    ("DROP TABLE", "critical", "Database table deletion"),
    ("DELETE FROM", "high", "Database record deletion"),
    ("sudo ", "high", "Superuser command execution"),
    ("> /dev/", "medium", "Writing to device files"),
    ("chmod 777", "high", "Overly permissive file permissions"),
    (".env", "medium", "Environment file access"),
    ("token", "medium", "Token-related operation"),
    ("password", "medium", "Password-related operation"),
    ("secret", "medium", "Secret-related operation"),
];

#[tauri::command]
pub fn assess_risk(command: String, tool_name: Option<String>) -> RiskAssessment {
    let lower = command.to_lowercase();
    let tool = tool_name.unwrap_or_default().to_lowercase();

    // Check tool-level risks
    if tool.contains("bash") || tool.contains("execute") {
        for (pattern, level, reason) in DANGEROUS_PATTERNS {
            if lower.contains(&pattern.to_lowercase()) {
                return RiskAssessment {
                    level: level.to_string(),
                    is_safe: *level == "medium",
                    reason: format!("{}: '{}' detected in command", reason, pattern),
                };
            }
        }
    }

    // Read-only tools are safe
    let safe_tools = ["read", "glob", "grep", "list", "ls", "cat", "head", "tail", "git log", "git status", "git diff", "git branch"];
    for safe in &safe_tools {
        if tool.contains(safe) {
            return RiskAssessment {
                level: "low".to_string(),
                is_safe: true,
                reason: format!("Read-only tool: {}", tool),
            };
        }
    }

    // File write tools - medium risk unless dangerous pattern
    let write_tools = ["write", "edit", "save"];
    for wt in &write_tools {
        if tool.contains(wt) {
            return RiskAssessment {
                level: "medium".to_string(),
                is_safe: true,
                reason: "File write operation".to_string(),
            };
        }
    }

    RiskAssessment {
        level: "low".to_string(),
        is_safe: true,
        reason: "No risk patterns detected".to_string(),
    }
}
