use rusqlite::Connection;
use std::sync::{Arc, Mutex};

pub type DbConn = Arc<Mutex<Connection>>;

pub fn init_db() -> Result<DbConn, Box<dyn std::error::Error>> {
    let conn = Connection::open_in_memory()?;
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            project_id TEXT,
            title TEXT,
            status TEXT DEFAULT 'created',
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS runtime_events (
            id TEXT PRIMARY KEY,
            session_id TEXT,
            project_id TEXT,
            type TEXT,
            content TEXT,
            created_at TEXT NOT NULL
        );"
    )?;
    Ok(Arc::new(Mutex::new(conn)))
}
