use rusqlite::Connection;
use std::sync::{Arc, Mutex};
use std::path::PathBuf;

pub type DbConn = Arc<Mutex<Connection>>;

fn db_path() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("Ctrl-CC")
        .join("ctrlcc.db")
}

pub fn init_db() -> Result<DbConn, Box<dyn std::error::Error>> {
    let path = db_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let conn = Connection::open(&path)?;
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            project_id TEXT DEFAULT 'default',
            title TEXT DEFAULT '新会话',
            cwd TEXT DEFAULT '.',
            runtime_mode TEXT DEFAULT 'pty-interactive',
            status TEXT DEFAULT 'created',
            model TEXT DEFAULT 'sonnet',
            effort TEXT,
            permission_mode TEXT DEFAULT 'default',
            claude_session_id TEXT,
            summary TEXT,
            input_tokens INTEGER DEFAULT 0,
            output_tokens INTEGER DEFAULT 0,
            total_cost_usd REAL DEFAULT 0.0,
            file_change_count INTEGER DEFAULT 0,
            risk_count INTEGER DEFAULT 0,
            audit_count INTEGER DEFAULT 0,
            is_pinned INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            started_at TEXT,
            ended_at TEXT
        );
        CREATE TABLE IF NOT EXISTS runtime_events (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            project_id TEXT DEFAULT 'default',
            type TEXT NOT NULL,
            title TEXT,
            content TEXT DEFAULT '',
            tool_name TEXT,
            tool_input TEXT,
            is_error INTEGER DEFAULT 0,
            input_tokens INTEGER,
            output_tokens INTEGER,
            total_cost_usd REAL,
            duration_ms INTEGER,
            severity TEXT DEFAULT 'low',
            created_at TEXT NOT NULL,
            FOREIGN KEY (session_id) REFERENCES sessions(id)
        );"
    )?;
    Ok(Arc::new(Mutex::new(conn)))
}

// Session CRUD
pub fn save_session(conn: &DbConn, session: &serde_json::Value) -> Result<(), String> {
    let db = conn.lock().map_err(|e| e.to_string())?;
    db.execute(
        "INSERT OR REPLACE INTO sessions (id, project_id, title, cwd, runtime_mode, status, model, effort, permission_mode, claude_session_id, summary, input_tokens, output_tokens, total_cost_usd, file_change_count, risk_count, audit_count, is_pinned, created_at, updated_at, started_at, ended_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?22)",
        rusqlite::params![
            session["id"].as_str(), session["projectId"].as_str(), session["title"].as_str(),
            session["cwd"].as_str(), session["runtimeMode"].as_str(), session["status"].as_str(),
            session["model"].as_str(), session["effort"].as_str(), session["permissionMode"].as_str(),
            session["claudeSessionId"].as_str(), session["summary"].as_str(),
            session["inputTokens"].as_i64().unwrap_or(0), session["outputTokens"].as_i64().unwrap_or(0),
            session["totalCostUsd"].as_f64().unwrap_or(0.0), session["fileChangeCount"].as_i64().unwrap_or(0),
            session["riskCount"].as_i64().unwrap_or(0), session["auditCount"].as_i64().unwrap_or(0),
            session["isPinned"].as_bool().unwrap_or(false) as i32,
            session["createdAt"].as_str(), session["updatedAt"].as_str(),
            session["startedAt"].as_str(), session["endedAt"].as_str(),
        ],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn load_sessions(conn: &DbConn) -> Result<Vec<serde_json::Value>, String> {
    let db = conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = db.prepare("SELECT id, project_id, title, cwd, runtime_mode, status, model, effort, permission_mode, claude_session_id, summary, input_tokens, output_tokens, total_cost_usd, file_change_count, risk_count, audit_count, is_pinned, created_at, updated_at, started_at, ended_at FROM sessions ORDER BY updated_at DESC LIMIT 50").map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_,String>(0)?, "projectId": row.get::<_,String>(1)?,
            "title": row.get::<_,String>(2)?, "cwd": row.get::<_,String>(3)?,
            "runtimeMode": row.get::<_,String>(4)?, "status": row.get::<_,String>(5)?,
            "model": row.get::<_,String>(6)?, "effort": row.get::<_,Option<String>>(7)?,
            "permissionMode": row.get::<_,String>(8)?, "claudeSessionId": row.get::<_,Option<String>>(9)?,
            "summary": row.get::<_,Option<String>>(10)?, "inputTokens": row.get::<_,i64>(11)?,
            "outputTokens": row.get::<_,i64>(12)?, "totalCostUsd": row.get::<_,f64>(13)?,
            "fileChangeCount": row.get::<_,i64>(14)?, "riskCount": row.get::<_,i64>(15)?,
            "auditCount": row.get::<_,i64>(16)?, "isPinned": row.get::<_,bool>(17)?,
            "createdAt": row.get::<_,String>(18)?, "updatedAt": row.get::<_,String>(19)?,
            "startedAt": row.get::<_,Option<String>>(20)?, "endedAt": row.get::<_,Option<String>>(21)?
        }))
    }).map_err(|e| e.to_string())?;
    let mut sessions = Vec::new();
    for row in rows { sessions.push(row.map_err(|e| e.to_string())?); }
    Ok(sessions)
}
