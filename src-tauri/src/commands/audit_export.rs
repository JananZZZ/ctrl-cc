use serde::Serialize;
use std::fs;

#[derive(Debug, Serialize)]
pub struct AuditBundle {
    pub version: String,
    #[serde(rename = "exportedAt")]
    pub exported_at: String,
    pub sessions: Vec<serde_json::Value>,
    #[serde(rename = "fileCount")]
    pub file_count: u32,
    #[serde(rename = "totalCost")]
    pub total_cost: f64,
    #[serde(rename = "totalTokens")]
    pub total_tokens: u64,
}

#[tauri::command]
pub fn export_audit_bundle(
    db: tauri::State<'_, crate::database::DbConn>,
    output_path: Option<String>,
) -> Result<String, String> {
    let sessions = crate::database::load_sessions(&db)?;
    let mut total_cost = 0f64;
    let mut total_tokens = 0u64;

    for s in &sessions {
        total_cost += s.get("totalCostUsd").and_then(|v| v.as_f64()).unwrap_or(0.0);
        total_tokens += s.get("inputTokens").and_then(|v| v.as_u64()).unwrap_or(0);
        total_tokens += s.get("outputTokens").and_then(|v| v.as_u64()).unwrap_or(0);
    }

    let bundle = AuditBundle {
        version: "1.0".into(),
        exported_at: chrono::Utc::now().to_rfc3339(),
        file_count: sessions.len() as u32,
        total_cost,
        total_tokens,
        sessions,
    };

    let json = serde_json::to_string_pretty(&bundle).map_err(|e| e.to_string())?;
    let path = output_path.unwrap_or_else(|| {
        let tmp = std::env::temp_dir().join("ctrl-cc-audit-bundle.json");
        tmp.to_string_lossy().to_string()
    });

    fs::write(&path, &json).map_err(|e| e.to_string())?;
    Ok(path)
}
