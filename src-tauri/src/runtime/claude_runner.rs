use crate::error::AppError;
use crate::runtime::ndjson_parser::{self, ChatRuntimeEvent};
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter};

#[allow(dead_code)]
pub struct ClaudeSession {
    pub session_id: String,
    pub project_id: String,
    pub cwd: String,
    pub model: String,
    pub running: Arc<Mutex<bool>>,
    pub claude_session_id: Option<String>,
    pub stdin: Arc<Mutex<std::process::ChildStdin>>,
    child: Option<std::process::Child>,
}

impl ClaudeSession {
    fn validate_cwd(cwd: &str) -> String {
        let path = std::path::Path::new(cwd);
        if path.exists() && path.is_dir() {
            return cwd.to_string();
        }
        // Fallback to current directory
        if let Ok(cur) = std::env::current_dir() {
            log::warn!("CWD '{}' does not exist, using {:?}", cwd, cur);
            return cur.to_string_lossy().to_string();
        }
        // Last resort: home directory
        if let Some(home) = dirs::home_dir() {
            log::warn!("Using home directory as CWD fallback");
            return home.to_string_lossy().to_string();
        }
        ".".to_string()
    }

    pub fn spawn(
        session_id: String,
        project_id: String,
        cwd: String,
        model: String,
        prompt: String,
        effort: Option<String>,
        permission_mode: Option<String>,
        resume_session: Option<String>,
        app: AppHandle,
    ) -> Result<Self, AppError> {
        let valid_cwd = Self::validate_cwd(&cwd);
        let mut cmd = Command::new("claude");
        cmd.arg("-p")
            .arg(&prompt)
            .arg("--output-format").arg("stream-json")
            .arg("--include-partial-messages")
            .arg("--verbose");
        if let Some(ref e) = effort {
            cmd.arg("--effort").arg(e);
        }
        cmd.arg("--model").arg(&model)
            .arg("--permission-mode").arg(permission_mode.as_deref().unwrap_or("default"))
            .current_dir(&valid_cwd)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        if let Some(ref resume_id) = resume_session {
            cmd.arg("--resume").arg(resume_id);
        }

        let mut child = cmd.spawn().map_err(|e| {
            let msg = format!("claude spawn failed: {} (cwd={}, model={})", e, valid_cwd, model);
            log::error!("{}", msg);
            AppError::Process(msg)
        })?;

        let stdout = child.stdout.take().ok_or_else(|| AppError::Process("no stdout".into()))?;
        let stderr = child.stderr.take().ok_or_else(|| AppError::Process("no stderr".into()))?;
        let stdin = child.stdin.take().ok_or_else(|| AppError::Process("no stdin".into()))?;

        let running = Arc::new(Mutex::new(true));
        let running_clone = running.clone();
        let sid = session_id.clone();
        let app_clone = app.clone();

        // stdout reader thread — parses NDJSON lines
        thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                if !*running_clone.lock().expect("mutex poisoned") { break; }
                if let Ok(line) = line {
                    if let Ok(Some(event)) = ndjson_parser::parse_line(&line) {
                        for rt in ndjson_parser::event_to_runtime(&sid, &event) {
                            let _ = app_clone.emit("runtime:event", &rt);
                        }
                    }
                }
            }
        });

        // stderr reader
        let app_stderr = app.clone();
        let sid_stderr = session_id.clone();
        thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                if let Ok(line) = line {
                    let _ = app_stderr.emit("runtime:event", &ChatRuntimeEvent {
                        session_id: sid_stderr.clone(), event_type: "raw_stderr".into(),
                        content: line, title: None, tool_name: None, tool_input: None,
                        tool_use_id: None, is_error: None, input_tokens: None, output_tokens: None,
                        total_cost_usd: None, duration_ms: None,
                        claude_session_id: None,
                    });
                }
            }
        });

        // Keep stdin for potential follow-up (though claude -p is one-shot)
        let stdin_handle = Arc::new(Mutex::new(stdin));

        Ok(Self {
            session_id,
            project_id,
            cwd: valid_cwd,
            model,
            running,
            claude_session_id: resume_session,
            stdin: stdin_handle,
            child: Some(child),
        })
    }

    pub fn send_input(&self, text: &str) -> Result<(), AppError> {
        use std::io::Write;
        let mut stdin = self.stdin.lock().map_err(|e| AppError::Process(e.to_string()))?;
        stdin.write_all(text.as_bytes()).map_err(|e| AppError::Process(e.to_string()))?;
        stdin.write_all(b"
").map_err(|e| AppError::Process(e.to_string()))?;
        stdin.flush().map_err(|e| AppError::Process(e.to_string()))?;
        Ok(())
    }

    pub fn stop(&mut self) {
        *self.running.lock().expect("mutex poisoned") = false;
        if let Some(mut child) = self.child.take() {
            let _ = child.kill();
        }
    }
}

impl Drop for ClaudeSession {
    fn drop(&mut self) {
        self.stop();
    }
}
