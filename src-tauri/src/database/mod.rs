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
        CREATE TABLE IF NOT EXISTS error_logs (
            id TEXT PRIMARY KEY,
            severity TEXT NOT NULL DEFAULT 'error',
            source TEXT NOT NULL DEFAULT 'unknown',
            title TEXT NOT NULL,
            detail TEXT,
            raw_error TEXT,
            timestamp TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL DEFAULT '未命名项目',
            path TEXT NOT NULL DEFAULT '.',
            git_branch TEXT,
            workspace_root_id TEXT DEFAULT '',
            is_favorite INTEGER DEFAULT 0,
            is_archived INTEGER DEFAULT 0,
            active_session_count INTEGER DEFAULT 0,
            total_session_count INTEGER DEFAULT 0,
            pending_permission_count INTEGER DEFAULT 0,
            risk_count INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
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

// ErrorLog CRUD
pub fn save_error_log(conn: &DbConn, entry: &serde_json::Value) -> Result<(), String> {
    let db = conn.lock().map_err(|e| e.to_string())?;
    db.execute(
        "INSERT OR REPLACE INTO error_logs (id, severity, source, title, detail, raw_error, timestamp)
         VALUES (?1,?2,?3,?4,?5,?6,?7)",
        rusqlite::params![
            entry["id"].as_str(), entry["severity"].as_str(), entry["source"].as_str(),
            entry["title"].as_str(), entry["detail"].as_str(), entry["rawError"].as_str(),
            entry["timestamp"].as_str(),
        ],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn load_error_logs(conn: &DbConn, limit: u32) -> Result<Vec<serde_json::Value>, String> {
    let db = conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = db.prepare("SELECT id, severity, source, title, detail, raw_error, timestamp FROM error_logs ORDER BY timestamp DESC LIMIT ?1").map_err(|e| e.to_string())?;
    let rows = stmt.query_map([limit], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_,String>(0)?, "severity": row.get::<_,String>(1)?,
            "source": row.get::<_,String>(2)?, "title": row.get::<_,String>(3)?,
            "detail": row.get::<_,Option<String>>(4)?, "rawError": row.get::<_,Option<String>>(5)?,
            "timestamp": row.get::<_,String>(6)?,
        }))
    }).map_err(|e| e.to_string())?;
    let mut logs = Vec::new();
    for row in rows { logs.push(row.map_err(|e| e.to_string())?); }
    Ok(logs)
}

// Project CRUD
pub fn save_project(conn: &DbConn, project: &serde_json::Value) -> Result<(), String> {
    let db = conn.lock().map_err(|e| e.to_string())?;
    db.execute(
        "INSERT OR REPLACE INTO projects (id, name, path, git_branch, workspace_root_id, is_favorite, is_archived, active_session_count, total_session_count, pending_permission_count, risk_count, created_at, updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13)",
        rusqlite::params![
            project["id"].as_str(), project["name"].as_str(), project["path"].as_str(),
            project["gitBranch"].as_str(), project["workspaceRootId"].as_str(),
            project["isFavorite"].as_bool().unwrap_or(false) as i32,
            project["isArchived"].as_bool().unwrap_or(false) as i32,
            project["activeSessionCount"].as_i64().unwrap_or(0),
            project["totalSessionCount"].as_i64().unwrap_or(0),
            project["pendingPermissionCount"].as_i64().unwrap_or(0),
            project["riskCount"].as_i64().unwrap_or(0),
            project["createdAt"].as_str(), project["updatedAt"].as_str(),
        ],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn load_projects(conn: &DbConn) -> Result<Vec<serde_json::Value>, String> {
    let db = conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = db.prepare("SELECT id, name, path, git_branch, workspace_root_id, is_favorite, is_archived, active_session_count, total_session_count, pending_permission_count, risk_count, created_at, updated_at FROM projects ORDER BY updated_at DESC LIMIT 100").map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_,String>(0)?, "name": row.get::<_,String>(1)?,
            "path": row.get::<_,String>(2)?, "gitBranch": row.get::<_,Option<String>>(3)?,
            "workspaceRootId": row.get::<_,String>(4)?,
            "isFavorite": row.get::<_,bool>(5)?, "isArchived": row.get::<_,bool>(6)?,
            "activeSessionCount": row.get::<_,i64>(7)?, "totalSessionCount": row.get::<_,i64>(8)?,
            "pendingPermissionCount": row.get::<_,i64>(9)?, "riskCount": row.get::<_,i64>(10)?,
            "createdAt": row.get::<_,String>(11)?, "updatedAt": row.get::<_,String>(12)?
        }))
    }).map_err(|e| e.to_string())?;
    let mut projects = Vec::new();
    for row in rows { projects.push(row.map_err(|e| e.to_string())?); }
    Ok(projects)
}

pub fn delete_project(conn: &DbConn, id: &str) -> Result<(), String> {
    let db = conn.lock().map_err(|e| e.to_string())?;
    db.execute("DELETE FROM projects WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
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

pub fn delete_session(conn: &DbConn, id: &str) -> Result<(), String> {
    let db = conn.lock().map_err(|e| e.to_string())?;
    db.execute("DELETE FROM sessions WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
