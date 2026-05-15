use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderConfigRequest {
    pub provider: String,
    pub api_key: String,
    pub base_url: Option<String>,
    pub haiku_model: Option<String>,
    pub sonnet_model: Option<String>,
    pub opus_model: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderConfigSafe {
    pub configured: bool,
    pub provider: String,
    pub base_url: String,
    pub api_key_masked: String,
}

fn backup_settings() -> Result<(), String> {
    let settings_path = crate::setup::path_helper::claude_settings_path();
    if !settings_path.exists() {
        return Ok(());
    }
    let backup_path = settings_path.with_extension("json.bak");
    std::fs::copy(&settings_path, &backup_path)
        .map_err(|e| format!("备份 settings.json 失败: {}", e))?;
    Ok(())
}

fn mask_api_key(key: &str) -> String {
    if key.len() <= 8 {
        return "****".to_string();
    }
    format!("{}****{}", &key[..4], &key[key.len() - 4..])
}

pub fn write_provider_config(req: ProviderConfigRequest) -> Result<(), String> {
    backup_settings()?;

    let settings_path = crate::setup::path_helper::claude_settings_path();
    let claude_config_dir = crate::setup::path_helper::claude_config_dir();

    // Ensure directory exists
    if !claude_config_dir.exists() {
        std::fs::create_dir_all(&claude_config_dir)
            .map_err(|e| format!("创建 .claude 目录失败: {}", e))?;
    }

    // Read existing settings or create new
    let mut settings: serde_json::Value = if settings_path.exists() {
        let content = std::fs::read_to_string(&settings_path)
            .map_err(|e| format!("读取 settings.json 失败: {}", e))?;
        serde_json::from_str(&content).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    // Ensure env object exists
    if settings["env"].is_null() {
        settings["env"] = serde_json::json!({});
    }

    let env = &mut settings["env"];

    // Write token
    env["ANTHROPIC_AUTH_TOKEN"] = serde_json::Value::String(req.api_key.clone());

    // Write base URL if provided
    if let Some(url) = &req.base_url {
        if !url.is_empty() {
            env["ANTHROPIC_BASE_URL"] = serde_json::Value::String(url.clone());
        }
    }

    // Disable non-essential traffic
    env["CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC"] = serde_json::Value::String("1".to_string());

    // Write model defaults if provided
    if let Some(m) = &req.haiku_model {
        env["ANTHROPIC_DEFAULT_HAIKU_MODEL"] = serde_json::Value::String(m.clone());
    }
    if let Some(m) = &req.sonnet_model {
        env["ANTHROPIC_DEFAULT_SONNET_MODEL"] = serde_json::Value::String(m.clone());
    }
    if let Some(m) = &req.opus_model {
        env["ANTHROPIC_DEFAULT_OPUS_MODEL"] = serde_json::Value::String(m.clone());
    }

    // Write settings.json
    let content =
        serde_json::to_string_pretty(&settings).map_err(|e| format!("序列化失败: {}", e))?;
    std::fs::write(&settings_path, content)
        .map_err(|e| format!("写入 settings.json 失败: {}", e))?;

    // Mark onboarding completed
    mark_onboarding_completed()?;

    Ok(())
}

pub fn mark_onboarding_completed() -> Result<(), String> {
    let claude_json_path = crate::setup::path_helper::claude_json_path();

    let mut claude_json: serde_json::Value = if claude_json_path.exists() {
        let content = std::fs::read_to_string(&claude_json_path)
            .map_err(|e| format!("读取 .claude.json 失败: {}", e))?;
        serde_json::from_str(&content).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    claude_json["hasCompletedOnboarding"] = serde_json::Value::Bool(true);

    let content =
        serde_json::to_string_pretty(&claude_json).map_err(|e| format!("序列化失败: {}", e))?;
    std::fs::write(&claude_json_path, content)
        .map_err(|e| format!("写入 .claude.json 失败: {}", e))?;

    Ok(())
}

pub fn read_provider_config_safe() -> ProviderConfigSafe {
    let settings_path = crate::setup::path_helper::claude_settings_path();

    let default = ProviderConfigSafe {
        configured: false,
        provider: "未配置".to_string(),
        base_url: String::new(),
        api_key_masked: String::new(),
    };

    if !settings_path.exists() {
        return default;
    }

    let content = match std::fs::read_to_string(&settings_path) {
        Ok(c) => c,
        Err(_) => return default,
    };

    let parsed: serde_json::Value = match serde_json::from_str(&content) {
        Ok(v) => v,
        Err(_) => return default,
    };

    let env = &parsed["env"];
    let base_url = env["ANTHROPIC_BASE_URL"].as_str().unwrap_or("").to_string();
    let api_key = env["ANTHROPIC_AUTH_TOKEN"].as_str().unwrap_or("").to_string();
    let configured = !api_key.is_empty();

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

    ProviderConfigSafe {
        configured,
        provider: provider.to_string(),
        base_url,
        api_key_masked: if configured {
            mask_api_key(&api_key)
        } else {
            String::new()
        },
    }
}
