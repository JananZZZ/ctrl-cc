use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct CredentialScanResult {
    pub found: bool,
    pub matches: Vec<String>,
    pub file_path: Option<String>,
}

const SECRET_PATTERNS: &[(&str, &str)] = &[
    ("sk-", "OpenAI/Anthropic API key prefix"),
    ("api_key", "API key variable"),
    ("secret", "Secret variable"),
    ("token", "Token variable"),
    ("password", "Password variable"),
    ("-----BEGIN RSA PRIVATE KEY-----", "RSA private key"),
    ("-----BEGIN OPENSSH PRIVATE KEY-----", "SSH private key"),
    ("ghp_", "GitHub personal access token"),
    ("gho_", "GitHub OAuth token"),
    ("github_pat_", "GitHub PAT"),
    ("AKIA", "AWS Access Key ID"),
    ("eyJhbGciOiJIUz", "JWT token header"),
];

#[tauri::command]
pub fn scan_for_secrets(content: String, file_path: Option<String>) -> CredentialScanResult {
    let mut matches = Vec::new();
    for (pattern, desc) in SECRET_PATTERNS {
        if content.to_lowercase().contains(&pattern.to_lowercase()) {
            matches.push(format!("{} ({})", pattern, desc));
        }
    }
    CredentialScanResult { found: !matches.is_empty(), matches, file_path }
}

#[tauri::command]
pub fn redact_secrets(content: String) -> String {
    let mut result = content;
    for (pattern, _) in SECRET_PATTERNS {
        let placeholder = format!("[REDACTED-{}]", &pattern[..pattern.len().min(8)]);
        result = result.replace(pattern, &placeholder);
    }
    result
}
