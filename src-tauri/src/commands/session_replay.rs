use serde::Serialize;
use std::fs;

#[derive(Debug, Serialize)]
pub struct ReplayFrame {
    pub index: u32,
    pub timestamp: String,
    #[serde(rename = "eventType")]
    pub event_type: String,
    pub content: String,
}

#[tauri::command]
pub fn export_session_replay(
    db: tauri::State<'_, crate::database::DbConn>,
    session_id: String,
    output_path: Option<String>,
) -> Result<String, String> {
    let db_conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db_conn.prepare(
        "SELECT type, content, created_at FROM runtime_events WHERE session_id = ?1 ORDER BY created_at ASC"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map(rusqlite::params![session_id], |row| {
        Ok(ReplayFrame {
            index: 0,
            timestamp: row.get(2)?,
            event_type: row.get(0)?,
            content: row.get::<_, String>(1).unwrap_or_default(),
        })
    }).map_err(|e| e.to_string())?;

    let mut frames: Vec<ReplayFrame> = rows.filter_map(|r| r.ok()).collect();
    for (i, f) in frames.iter_mut().enumerate() {
        f.index = i as u32;
    }

    let json = serde_json::to_string_pretty(&frames).map_err(|e| e.to_string())?;
    let path = output_path.unwrap_or_else(|| {
        std::env::temp_dir().join(format!("ctrl-cc-replay-{}.json", &session_id[..8.min(session_id.len())]))
            .to_string_lossy().to_string()
    });

    fs::write(&path, &json).map_err(|e| e.to_string())?;
    Ok(path)
}

#[tauri::command]
pub fn get_session_events(
    db: tauri::State<'_, crate::database::DbConn>,
    session_id: String,
    limit: Option<u32>,
) -> Result<Vec<ReplayFrame>, String> {
    let db_conn = db.lock().map_err(|e| e.to_string())?;
    let n = limit.unwrap_or(100);
    let mut stmt = db_conn.prepare(
        "SELECT type, content, created_at FROM runtime_events WHERE session_id = ?1 ORDER BY created_at DESC LIMIT ?2"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map(rusqlite::params![session_id, n], |row| {
        Ok(ReplayFrame {
            index: 0,
            timestamp: row.get(2)?,
            event_type: row.get(0)?,
            content: row.get::<_, String>(1).unwrap_or_default(),
        })
    }).map_err(|e| e.to_string())?;

    let frames: Vec<ReplayFrame> = rows.filter_map(|r| r.ok()).collect();
    Ok(frames)
}
