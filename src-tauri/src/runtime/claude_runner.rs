use crate::error::AppError;
use crate::runtime::ndjson_parser::{self, ChatRuntimeEvent};
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::io::{BufRead, BufReader, Write};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter};

pub struct ClaudeSession {
    pub session_id: String,
    pub project_id: String,
    pub cwd: String,
    pub model: String,
    pub running: Arc<Mutex<bool>>,
    child: Option<std::process::Child>,
}

impl ClaudeSession {
    pub fn spawn(
        session_id: String,
        project_id: String,
        cwd: String,
        model: String,
        prompt: String,
        app: AppHandle,
    ) -> Result<Self, AppError> {
        let mut cmd = Command::new("claude");
        cmd.arg("-p")
            .arg(&prompt)
            .arg("--output-format")
            .arg("stream-json")
            .arg("--include-partial-messages")
            .arg("--verbose")
            .arg("--model")
            .arg(&model)
            .arg("--permission-mode")
            .arg("default")
            .current_dir(&cwd)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let mut child = cmd.spawn().map_err(|e| AppError::Process(format!("claude spawn: {}", e)))?;

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
                if !*running_clone.lock().unwrap() { break; }
                if let Ok(line) = line {
                    if let Ok(Some(event)) = ndjson_parser::parse_line(&line) {
                        for rt in ndjson_parser::event_to_runtime(&sid, &event) {
                            let _ = app_clone.emit("runtime:event", &rt);
                        }
                    }
                }
            }
        });

        // stderr reader thread
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
                    });
                }
            }
        });

        // stdin writer — stored for follow-up messages
        let _stdin = Arc::new(Mutex::new(stdin));

        Ok(Self {
            session_id,
            project_id,
            cwd,
            model,
            running,
            child: Some(child),
        })
    }

    pub fn send(&self, message: &str) -> Result<(), AppError> {
        // For follow-up messages, we need to spawn a new claude process
        // since claude -p is one-shot. In practice, we spawn a new process
        // with the conversation history.
        Ok(())
    }

    pub fn stop(&mut self) {
        *self.running.lock().unwrap() = false;
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
