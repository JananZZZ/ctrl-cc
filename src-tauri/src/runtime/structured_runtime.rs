use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader};
use std::process::Stdio;

use crate::utils::hidden_command::hidden_command;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

use tauri::{AppHandle, Emitter};
use uuid::Uuid;

#[derive(Debug, Clone, Deserialize)]
pub struct StructuredRunRequest {
    pub cwd: String,
    pub prompt: String,
    pub max_turns: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
pub struct StructuredRunResponse {
    pub task_id: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct StructuredEventPayload {
    pub task_id: String,
    pub line: String,
}

pub fn start_structured_run(
    app: AppHandle,
    req: StructuredRunRequest,
) -> Result<StructuredRunResponse> {
    if req.prompt.trim().is_empty() {
        return Err(anyhow!("prompt is empty"));
    }

    let task_id = Uuid::new_v4().to_string();
    let task_id_for_thread = task_id.clone();

    std::thread::spawn(move || {
        let mut command = hidden_command("claude");
        command
            .current_dir(req.cwd)
            .arg("-p")
            .arg(req.prompt)
            .arg("--output-format")
            .arg("stream-json")
            .arg("--include-partial-messages")
            .arg("--include-hook-events")
            .arg("--verbose")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        if let Some(max_turns) = req.max_turns {
            command.arg("--max-turns").arg(max_turns.to_string());
        }

        match command.spawn() {
            Ok(mut child) => {
                // Emit success event so frontend knows task started
                let _ = app.emit(
                    "ctrlcc://structured-event",
                    StructuredEventPayload {
                        task_id: task_id_for_thread.clone(),
                        line: serde_json::json!({
                            "type": "ctrlcc_task_started",
                            "task_id": task_id_for_thread,
                        }).to_string(),
                    },
                );

                if let Some(stdout) = child.stdout.take() {
                    let reader = BufReader::new(stdout);
                    for line in reader.lines().flatten() {
                        let _ = app.emit(
                            "ctrlcc://structured-event",
                            StructuredEventPayload {
                                task_id: task_id_for_thread.clone(),
                                line,
                            },
                        );
                    }
                }

                let exit_status = child.wait();
                let _ = app.emit(
                    "ctrlcc://structured-event",
                    StructuredEventPayload {
                        task_id: task_id_for_thread.clone(),
                        line: serde_json::json!({
                            "type": "ctrlcc_task_completed",
                            "task_id": task_id_for_thread,
                            "exit_code": exit_status.ok().and_then(|s| s.code()),
                        }).to_string(),
                    },
                );
            }
            Err(e) => {
                let _ = app.emit(
                    "ctrlcc://structured-event",
                    StructuredEventPayload {
                        task_id: task_id_for_thread.clone(),
                        line: serde_json::json!({
                            "type": "ctrlcc_error",
                            "task_id": task_id_for_thread,
                            "message": format!("failed to spawn structured claude: {e}")
                        }).to_string(),
                    },
                );
            }
        }
    });

    Ok(StructuredRunResponse { task_id })
}
