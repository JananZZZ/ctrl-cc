use std::io::{BufRead, BufReader};

use crate::utils::hidden_command::hidden_command;

use tauri::{AppHandle, Emitter};

use super::claude_command_resolver::{build_invocation, select_for_chat};
use super::runtime_types::{ChatStreamRequest, ChatStreamStarted};

pub fn start_chat_stream(app: AppHandle, req: ChatStreamRequest) -> Result<ChatStreamStarted, String> {
    if req.prompt.trim().is_empty() {
        return Err("prompt is empty".to_string());
    }

    let spec = select_for_chat()?;
    let mut claude_args = vec![
        "-p".to_string(),
        req.prompt.clone(),
        "--output-format".to_string(),
        "stream-json".to_string(),
        "--include-partial-messages".to_string(),
        "--verbose".to_string(),
    ];

    if let Some(id) = &req.claude_session_id {
        if !id.trim().is_empty() {
            claude_args.push("--session-id".to_string());
            claude_args.push(id.clone());
        }
    }

    if let Some(model) = &req.model {
        if !model.trim().is_empty() && model != "default" {
            claude_args.push("--model".to_string());
            claude_args.push(model.clone());
        }
    }

    if let Some(permission) = &req.permission_mode {
        if !permission.trim().is_empty() && permission != "default" {
            claude_args.push("--permission-mode".to_string());
            claude_args.push(permission.clone());
        }
    }

    if let Some(max_turns) = req.max_turns {
        claude_args.push("--max-turns".to_string());
        claude_args.push(max_turns.to_string());
    }

    let invocation = build_invocation(&spec, &claude_args);

    let mut cmd = hidden_command(&invocation.program);
    cmd.args(&invocation.args)
        .current_dir(&req.cwd);
    let mut child = cmd
        .spawn()
        .map_err(|e| format!("failed to spawn claude print stream: {}", e))?;

    let pid = child.id();

    let stdout = child.stdout.take().ok_or("stdout missing")?;
    let stderr = child.stderr.take().ok_or("stderr missing")?;

    let app_stdout = app.clone();
    let req_stdout = req.clone();
    std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines().flatten() {
            let _ = app_stdout.emit(
                "runtime://chat-stream",
                serde_json::json!({
                    "traceId": req_stdout.trace_id,
                    "sessionId": req_stdout.session_id,
                    "channelId": req_stdout.channel_id,
                    "line": line,
                }),
            );
        }
    });

    let app_stderr = app.clone();
    let req_stderr = req.clone();
    std::thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines().flatten() {
            let _ = app_stderr.emit(
                "runtime://chat-stderr",
                serde_json::json!({
                    "traceId": req_stderr.trace_id,
                    "sessionId": req_stderr.session_id,
                    "channelId": req_stderr.channel_id,
                    "line": line,
                }),
            );
        }
    });

    let app_exit = app.clone();
    let req_exit = req.clone();
    std::thread::spawn(move || {
        let status = child.wait();
        let _ = app_exit.emit(
            "runtime://chat-exit",
            serde_json::json!({
                "traceId": req_exit.trace_id,
                "sessionId": req_exit.session_id,
                "channelId": req_exit.channel_id,
                "code": status.ok().and_then(|s| s.code()),
            }),
        );
    });

    Ok(ChatStreamStarted {
        trace_id: req.trace_id,
        session_id: req.session_id,
        channel_id: req.channel_id,
        pid: Some(pid),
    })
}
