use crate::error::AppError;
use std::fs;
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Clone)]
pub struct PtyLogWriter {
    session_dir: PathBuf,
    writer: std::sync::Arc<Mutex<()>>,
}

fn lock_writer(w: &std::sync::Arc<Mutex<()>>) {
    if w.lock().is_err() {
        log::warn!("PTY log writer mutex poisoned");
    }
}

impl PtyLogWriter {
    pub fn new(pty_session_id: &str) -> Result<Self, AppError> {
        let base = dirs::data_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("Ctrl-CC")
            .join("pty_logs")
            .join(pty_session_id);

        fs::create_dir_all(&base)
            .map_err(|e| AppError::Process(format!("Failed to create PTY log dir: {}", e)))?;

        Ok(Self {
            session_dir: base,
            writer: std::sync::Arc::new(Mutex::new(())),
        })
    }

    pub fn session_dir(&self) -> PathBuf {
        self.session_dir.clone()
    }

    pub fn write_command(&self, command: &[String]) -> Result<(), AppError> {
        lock_writer(&self.writer);
        let path = self.session_dir.join("pty_command.json");
        let json = serde_json::json!({
            "command": command,
            "timestamp": chrono::Utc::now().to_rfc3339(),
        });
        let json_str = serde_json::to_string_pretty(&json)
            .map_err(|e| AppError::Process(format!("JSON serialize: {}", e)))?;
        let mut f = fs::OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(true)
            .open(&path)
            .map_err(|e| AppError::Process(format!("Failed to write command log: {}", e)))?;
        f.write_all(json_str.as_bytes())
            .map_err(|e| AppError::Process(format!("Failed to write command log: {}", e)))?;
        Ok(())
    }

    pub fn write_raw(&self, data: &[u8]) {
        lock_writer(&self.writer);
        let path = self.session_dir.join("pty_raw.bin");
        match fs::OpenOptions::new().create(true).append(true).open(&path) {
            Ok(mut f) => { let _ = f.write_all(data); }
            Err(e) => log::warn!("Failed to write PTY raw log: {}", e),
        }
    }

    pub fn write_utf8(&self, text: &str) {
        lock_writer(&self.writer);
        let path = self.session_dir.join("pty_utf8.log");
        match fs::OpenOptions::new().create(true).append(true).open(&path) {
            Ok(mut f) => { let _ = f.write_all(text.as_bytes()); }
            Err(e) => log::warn!("Failed to write PTY utf8 log: {}", e),
        }
    }

    pub fn write_ansi(&self, text: &str) {
        lock_writer(&self.writer);
        let path = self.session_dir.join("pty_ansi.log");
        match fs::OpenOptions::new().create(true).append(true).open(&path) {
            Ok(mut f) => { let _ = f.write_all(text.as_bytes()); }
            Err(e) => log::warn!("Failed to write PTY ansi log: {}", e),
        }
    }

    pub fn write_size_event(&self, rows: u16, cols: u16) -> Result<(), AppError> {
        lock_writer(&self.writer);
        let path = self.session_dir.join("pty_size_events.jsonl");
        let line = serde_json::json!({
            "rows": rows,
            "cols": cols,
            "timestamp": chrono::Utc::now().to_rfc3339(),
        });
        let line_str = serde_json::to_string(&line)
            .map_err(|e| AppError::Process(format!("JSON serialize: {}", e)))?;
        let mut f = fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&path)
            .map_err(|e| AppError::Process(format!("Failed to write size event: {}", e)))?;
        writeln!(f, "{}", line_str)
            .map_err(|e| AppError::Process(format!("Failed to write size event: {}", e)))?;
        Ok(())
    }

    pub fn write_event(&self, event_jsonl: &str) {
        lock_writer(&self.writer);
        let path = self.session_dir.join("pty_events.jsonl");
        match fs::OpenOptions::new().create(true).append(true).open(&path) {
            Ok(mut f) => { let _ = writeln!(f, "{}", event_jsonl); }
            Err(e) => log::warn!("Failed to write PTY event log: {}", e),
        }
    }

    /// Read log content with file seeking to avoid loading entire file into memory.
    /// Uses a hard cap of 1MB per read to prevent OOM.
    pub fn read_log(&self, offset: u64, limit: u64) -> Result<String, AppError> {
        let path = self.session_dir.join("pty_utf8.log");
        if !path.exists() {
            return Ok(String::new());
        }
        let cap = limit.min(1_000_000); // 1MB hard cap
        let mut f = fs::File::open(&path)
            .map_err(|e| AppError::Process(format!("Failed to open log: {}", e)))?;

        let file_len = f.metadata().map(|m| m.len()).unwrap_or(0);
        if offset >= file_len {
            return Ok(String::new());
        }

        f.seek(SeekFrom::Start(offset))
            .map_err(|e| AppError::Process(format!("Failed to seek log: {}", e)))?;

        let mut buf = vec![0u8; cap as usize];
        let n = f.read(&mut buf)
            .map_err(|e| AppError::Process(format!("Failed to read log: {}", e)))?;

        String::from_utf8(buf[..n].to_vec())
            .map_err(|e| AppError::Process(format!("Invalid UTF-8 in log: {}", e)))
    }
}
