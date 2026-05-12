//! Ctrl-CC PTY Session — Windows ConPTY 伪终端会话管理
//!
//! Architecture: PTY 三层修复 (针对 0xc0000142 / STATUS_DLL_INIT_FAILED)
//!   1. Slave 生命周期: PtyInner 持有 slave，防止 ClosePseudoConsole 过早调用
//!   2. 环境变量全量继承: build_child_env() 传递所有系统变量 + 关键变量 fallback
//!   3. ComSpec 绝对路径: resolve_windows_cmd() 不使用裸 "cmd.exe"
//!   4. cmd /d /s /c 直接执行: 不采用 shell-first + 命令注入（更可靠）
//!   5. spawn() 立即返回: 无阻塞 read/wait/sleep，监管线程异步读取

use crate::error::AppError;
use crate::pty::pty_types::*;
use chrono::Utc;
use portable_pty::{native_pty_system, MasterPty, PtySize};
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

use super::pty_log::PtyLogWriter;
use super::pty_parser::PtySemanticParser;

type PtyReader = Box<dyn Read + Send>;
type PtyWriter = Box<dyn Write + Send>;
type PtyMaster = Box<dyn MasterPty + Send>;

// ── 文件级 debug log（GUI 卡死时也能诊断）────────────────────────────
// Writes to %TEMP%/ctrl-cc-runtime-debug.log for post-mortem analysis

pub fn runtime_debug_log(line: &str) {
    let path = std::env::temp_dir().join("ctrl-cc-runtime-debug.log");
    if let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open(&path) {
        let _ = writeln!(file, "[{}] {}", chrono::Utc::now().to_rfc3339(), line);
    }
}

/// Structured trace log — writes to %TEMP%/ctrl-cc-runtime-trace.log
/// Each entry: [ts] [traceId] [uiSessionId] [ptySessionId] phase result error
pub fn runtime_trace_log(trace_id: &str, ui_session_id: &str, pty_session_id: &str, phase: &str, result: &str, error: &str) {
    let path = std::env::temp_dir().join("ctrl-cc-runtime-trace.log");
    if let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open(&path) {
        let ts = chrono::Utc::now().to_rfc3339();
        let err = if error.is_empty() { "-" } else { error };
        let _ = writeln!(file, "[{}] [{}] ui:{} pty:{} {} → {} ({})", ts, trace_id, ui_session_id, pty_session_id, phase, result, err);
    }
}

// ── PtyInner: 监管线程持有的资源 ──────────────────────────────────────
// CRITICAL: slave 必须与 child 同生共死。
// Windows 上 slave 的 Drop 会调用 ClosePseudoConsole，
// 如果 child 还在初始化 → 0xc0000142

struct PtyInner {
    reader: PtyReader,
    child: Box<dyn portable_pty::Child + Send + Sync>,
    #[allow(dead_code)]
    slave: Box<dyn portable_pty::SlavePty + Send>, // kept alive to prevent premature ConPTY close
}

// ── PtySessionHandle: 前端通过 PtyManager 持有的句柄 ──────────────────

pub struct PtySessionHandle {
    pub info: PtySessionInfo,
    pub status: Arc<Mutex<PtySessionStatus>>,
    master: Arc<Mutex<PtyMaster>>,
    writer: Arc<Mutex<PtyWriter>>,
    running: Arc<Mutex<bool>>,
    pub log_writer: PtyLogWriter,
}

impl PtySessionHandle {
    pub fn has_writer(&self) -> bool {
        // Try lock — if we can lock it, writer exists
        self.writer.try_lock().is_ok()
    }
}

// ── CWD 解析：逐级 fallback ───────────────────────────────────────────

fn resolve_cwd(cwd: &str) -> String {
    let path = std::path::Path::new(cwd);
    if path.exists() && path.is_dir() { return cwd.to_string(); }
    if let Ok(cur) = std::env::current_dir() {
        log::warn!("CWD '{}' does not exist, using {:?}", cwd, cur);
        return cur.to_string_lossy().to_string();
    }
    if let Some(home) = dirs::home_dir() {
        log::warn!("Using home directory as CWD fallback");
        return home.to_string_lossy().to_string();
    }
    ".".to_string()
}

// ── Claude CLI 路径解析：which → 已知路径 ─────────────────────────────

fn resolve_claude_path(requested: &str) -> String {
    if requested != "claude" && !requested.is_empty() { return requested.to_string(); }
    if let Ok(path) = which::which("claude") { return path.to_string_lossy().to_string(); }
    #[cfg(target_os = "windows")]
    {
        if let Ok(appdata) = std::env::var("APPDATA") {
            let cand = format!("{}\\npm\\claude.cmd", appdata);
            if std::path::Path::new(&cand).exists() { return cand; }
        }
    }
    requested.to_string()
}

// ── Windows: cmd.exe 绝对路径解析 ─────────────────────────────────────
// 不使用裸 "cmd.exe" — Tauri GUI 上下文可能没有 PATH

#[cfg(target_os = "windows")]
fn resolve_windows_cmd() -> String {
    if let Ok(comspec) = std::env::var("ComSpec") {
        let trimmed = comspec.trim();
        if !trimmed.is_empty() && std::path::Path::new(trimmed).exists() { return trimmed.to_string(); }
    }
    let system_root = std::env::var("SystemRoot")
        .or_else(|_| std::env::var("WINDIR"))
        .unwrap_or_else(|_| "C:\\Windows".to_string());
    let cand = std::path::PathBuf::from(&system_root).join("System32").join("cmd.exe");
    if cand.exists() { return cand.to_string_lossy().to_string(); }
    "cmd.exe".to_string()
}

// ── Windows: 子进程环境变量全量继承 + 关键变量 fallback ──────────────
// Tauri GUI (windows_subsystem = "windows") 没有控制台环境继承链
// ConPTY 使用 CREATE_UNICODE_ENVIRONMENT — 只传递显式设置的变量
// 缺少任何关键变量 → 0xc0000142

#[cfg(target_os = "windows")]
fn build_child_env() -> Vec<(String, String)> {
    let mut envs: Vec<(String, String)> = std::env::vars().collect();
    // 确保这些关键变量存在，缺失任何一个都会导致 DLL 初始化失败
    let must_have: &[(&str, fn() -> String)] = &[
        ("SystemRoot", || "C:\\Windows".to_string()),
        ("WINDIR", || std::env::var("SystemRoot").unwrap_or_else(|_| "C:\\Windows".to_string())),
        ("ComSpec", resolve_windows_cmd),
        ("PATHEXT", || ".COM;.EXE;.BAT;.CMD;.VBS;.VBE;.JS;.JSE;.WSF;.WSH;.MSC".to_string()),
        ("TEMP", || std::env::temp_dir().to_string_lossy().to_string()),
        ("TMP", || std::env::temp_dir().to_string_lossy().to_string()),
    ];
    for (key, fallback) in must_have {
        let ku = key.to_uppercase();
        if !envs.iter().any(|(k, _)| k.to_uppercase() == ku) { envs.push((key.to_string(), fallback())); }
    }
    envs
}

// ── Windows: PTY 启动命令 — 多策略 Shell (Section 1.1) ────────────────
// Strategy A: PowerShell (most reliable in ConPTY)
// Strategy B: cmd.exe (fallback)
// PowerShell handles .cmd files via cmd.exe internally and is more robust

#[cfg(target_os = "windows")]
fn build_windows_command(claude_path: &str, cwd: &str, extra_args: &[String]) -> portable_pty::CommandBuilder {
    let cmd_path = resolve_windows_cmd();
    // Build the full Claude CLI argument string including extra_args (--name, --resume, etc.)
    let mut claude_full_args = format!("--permission-mode default");
    for arg in extra_args {
        claude_full_args.push(' ');
        claude_full_args.push_str(&shell_words::quote(arg));
    }

    // Prefer PowerShell over cmd.exe — cmd.exe has 0xc0000142 issues in ConPTY on some Windows editions
    let ps_path = std::path::PathBuf::from(
        std::env::var("SystemRoot").unwrap_or_else(|_| "C:\\Windows".to_string())
    ).join("System32").join("WindowsPowerShell").join("v1.0").join("powershell.exe");

    if ps_path.exists() {
        runtime_debug_log(&format!("pty.strategy powershell claude={}", claude_path));
        let mut c = portable_pty::CommandBuilder::new(ps_path.to_string_lossy().as_ref());
        c.arg("-NoLogo"); c.arg("-NoProfile"); c.arg("-ExecutionPolicy"); c.arg("Bypass");
        c.arg("-Command");
        c.arg(format!("& '{}' {}", claude_path, claude_full_args));
        c.cwd(cwd);
        for (key, val) in build_child_env() { c.env(&key, &val); }
        c.env("TERM", "xterm-256color");
        c.env("COLORTERM", "truecolor");
        c.env("FORCE_COLOR", "1");
        c.env("CLICOLOR_FORCE", "1");
        c.env("CI", "false");
        return c;
    }

    // Strategy B: pwsh (PowerShell Core)
    if let Ok(pwsh) = which::which("pwsh") {
        runtime_debug_log(&format!("pty.strategy pwsh claude={}", claude_path));
        let mut c = portable_pty::CommandBuilder::new(pwsh.to_string_lossy().as_ref());
        c.arg("-NoLogo"); c.arg("-NoProfile"); c.arg("-Command");
        c.arg(format!("& '{}' {}", claude_path, claude_full_args));
        c.cwd(cwd);
        for (key, val) in build_child_env() { c.env(&key, &val); }
        c.env("TERM", "xterm-256color");
        c.env("COLORTERM", "truecolor");
        c.env("FORCE_COLOR", "1");
        c.env("CLICOLOR_FORCE", "1");
        c.env("CI", "false");
        return c;
    }

    // Fallback to cmd.exe /d /s /c
    runtime_debug_log(&format!("pty.strategy cmd.exe claude={}", claude_path));
    let mut c = portable_pty::CommandBuilder::new(&cmd_path);
    c.arg("/d"); c.arg("/s"); c.arg("/c");
    let cmd_line = format!("\"{} {}\"", claude_path, claude_full_args);
    c.arg(cmd_line);
    c.cwd(cwd);
    for (key, val) in build_child_env() { c.env(&key, &val); }
    c.env("TERM", "xterm-256color");
    c.env("COLORTERM", "truecolor");
    c.env("FORCE_COLOR", "1");
    c.env("CLICOLOR_FORCE", "1");
    c.env("CI", "false");
    c
}

// ── PtySessionHandle: PTY 会话生命周期 ────────────────────────────────

impl PtySessionHandle {
    /// 创建 PTY 会话。此函数立即返回（< 1 秒）。
    /// 不阻塞读取、不等待握手、不调用 child.wait()、无 sleep。
    /// 监管线程在后台异步读取 PTY 输出并通过 Tauri 事件推送到前端。
    pub fn spawn(options: PtyStartOptions, app: AppHandle) -> Result<Self, AppError> {
        // v9.0 ID contract: backend registry key = pty_session_id (pty-uuid)
        let id = options.pty_session_id.clone();
        let ui_session_id = options.ui_session_id.clone();
        let trace_id = options.trace_id.clone();
        runtime_trace_log(&trace_id, &ui_session_id, &id, "pty.spawn.start", "ok", "");
        runtime_debug_log(&format!("pty.start ui={} pty={}", ui_session_id, id));

        let log_uuid = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        let log_writer = PtyLogWriter::new(&log_uuid)?;
        let pty_system = native_pty_system();
        let valid_cwd = resolve_cwd(&options.cwd);
        let claude_path = resolve_claude_path(&options.cli_path);

        let _ = app.emit("ctrlcc://log", serde_json::json!({
            "step": "pty-create-start", "claudePath": claude_path,
            "cwd": valid_cwd, "uiSessionId": ui_session_id, "ptySessionId": id,
            "sessionId": ui_session_id, "ts": now
        }));

        let rows = 500u16; let cols = 200u16;
        runtime_debug_log("pty.openpty");
        let pty_pair = pty_system
            .openpty(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 })
            .map_err(|e| AppError::Process(format!("PTY openpty failed: {}", e)))?;

        // Phase 1: 构建并 spawn shell 命令
        #[cfg(target_os = "windows")]
        let cmd = build_windows_command(&claude_path, &valid_cwd, &options.extra_args);
        #[cfg(not(target_os = "windows"))]
        let cmd = {
            let mut c = portable_pty::CommandBuilder::new("bash");
            c.arg("-lc");
            c.arg(format!("exec {} --permission-mode default", shell_words::quote(&claude_path)));
            c.cwd(&valid_cwd); c.env("TERM", "xterm-256color"); c
        };

        runtime_debug_log("pty.spawn.start");
        let child = pty_pair.slave.spawn_command(cmd)
            .map_err(|e| AppError::Process(format!("PTY spawn failed: {}", e)))?;
        runtime_debug_log(&format!("pty.spawn.ok pid={:?}", child.process_id()));

        let pid = child.process_id();
        runtime_trace_log(&trace_id, &ui_session_id, &id, "pty.spawn.shell.ok", "ok", "");
        let _ = app.emit("ctrlcc://log", serde_json::json!({
            "step": "pty-process-created", "uiSessionId": ui_session_id, "ptySessionId": id,
            "sessionId": ui_session_id, "ptyId": id, "pid": pid, "cwd": valid_cwd,
            "ts": chrono::Utc::now().to_rfc3339()
        }));

        // Phase 2: 获取 reader/writer
        let reader = pty_pair.master.try_clone_reader()
            .map_err(|e| AppError::Process(format!("PTY clone reader failed: {}", e)))?;
        let writer = pty_pair.master.take_writer()
            .map_err(|e| AppError::Process(format!("PTY take writer failed: {}", e)))?;
        let master: PtyMaster = pty_pair.master;

        // 构建命令记录
        let command = {
            let mut v = vec![claude_path, "--permission-mode".into(), "default".into()];
            v.extend(options.extra_args.clone()); v
        };
        log_writer.write_command(&command)?;

        let info = PtySessionInfo {
            id: id.clone(),
            pty_session_id: id.clone(),
            ui_session_id: ui_session_id.clone(),
            project_id: options.project_id.clone(), cwd: valid_cwd.clone(),
            command, rows, cols, status: PtySessionStatus::Starting, pid, created_at: now,
            session_id: Some(ui_session_id.clone()), // backward compat
        };

        let status = Arc::new(Mutex::new(PtySessionStatus::Starting));
        let master_arc = Arc::new(Mutex::new(master));
        let writer_arc = Arc::new(Mutex::new(writer));
        let running = Arc::new(Mutex::new(true));

        // Phase 3: 启动监管线程 — 异步读取 PTY 输出
        let inner = PtyInner { reader, child, slave: pty_pair.slave };
        let ui_sid_sv = ui_session_id.clone();
        let pty_sid_sv = id.clone();

        #[cfg(feature = "tokio-pty")]
        { supervise_pty_output_async(inner, app.clone(), ui_sid_sv, pty_sid_sv, running.clone(), log_writer.clone(), status.clone()); }
        #[cfg(not(feature = "tokio-pty"))]
        { std::thread::spawn(move || { supervise_pty_output(inner, app.clone(), ui_sid_sv, pty_sid_sv, running.clone(), log_writer.clone(), status.clone()); }); }

        let _ = app.emit("pty://status", serde_json::json!({
            "uiSessionId": ui_session_id, "ptySessionId": id,
            "session_id": ui_session_id, "pty_id": id, "status": "starting"
        }));

        runtime_debug_log(&format!("pty.return ui={} pty={}", ui_session_id, id));
        Ok(Self { info, status, master: master_arc, writer: writer_arc, running, log_writer })
    }

    pub fn write(&self, data: &str) -> Result<(), AppError> {
        let mut w = self.writer.lock().map_err(|e| AppError::Process(format!("PTY writer lock: {}", e)))?;
        w.write_all(data.as_bytes()).map_err(|e| AppError::Process(format!("PTY write: {}", e)))
    }

    pub fn resize(&self, rows: u16, cols: u16) -> Result<(), AppError> {
        let master = self.master.lock().map_err(|e| AppError::Process(format!("PTY master lock: {}", e)))?;
        master.resize(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 })
            .map_err(|e| AppError::Process(format!("PTY resize: {}", e)))?;
        self.log_writer.write_size_event(rows, cols)?; Ok(())
    }

    pub fn send_ctrl_c(&self) -> Result<(), AppError> { self.write("\x03") }
    pub fn send_ctrl_d(&self) -> Result<(), AppError> { self.write("\x04") }

    pub fn stop(&self) {
        if let Ok(mut r) = self.running.lock() { *r = false; }
        if let Ok(mut s) = self.status.lock() { *s = PtySessionStatus::Killed; }
    }

    pub fn log_path(&self) -> PathBuf { self.log_writer.session_dir() }
}

// ── 监管线程：异步读取 PTY 输出 ───────────────────────────────────────
// 运行在独立线程中，通过 Tauri 事件推送到前端 xterm.js
// PTY raw output → pty://data → usePtyTerminal → term.write()

fn supervise_pty_output(
    inner: PtyInner, app: AppHandle, ui_session_id: String, pty_session_id: String,
    running: Arc<Mutex<bool>>, log_writer: PtyLogWriter, status: Arc<Mutex<PtySessionStatus>>,
) {
    runtime_debug_log(&format!("pty.reader.start ui={} pty={}", ui_session_id, pty_session_id));
    let PtyInner { mut reader, child: mut pty_child, slave: _slave } = inner;
    let mut buf = [0u8; 4096];
    let mut parser = PtySemanticParser::new();
    parser.set_session_id(&ui_session_id);

    if let Ok(mut s) = status.lock() { *s = PtySessionStatus::Running; }
    let _ = app.emit("pty://status", serde_json::json!({
        "uiSessionId": ui_session_id, "ptySessionId": pty_session_id,
        "session_id": ui_session_id, "pty_id": pty_session_id, "status": "running"
    }));

    let mut first_byte = true;
    loop {
        if !running.lock().map(|r| *r).unwrap_or(false) { break; }
        match reader.read(&mut buf) {
            Ok(0) => {
                runtime_debug_log(&format!("pty.eof ui={}", ui_session_id));
                break;
            }
            Ok(n) => {
                if first_byte {
                    first_byte = false;
                    runtime_debug_log(&format!("pty.first-byte ui={} len={}", ui_session_id, n));
                }
                let raw = buf[..n].to_vec();
                log_writer.write_raw(&raw);
                let text = String::from_utf8_lossy(&raw).to_string();
                log_writer.write_utf8(&text);
                let _ = app.emit("pty://data", serde_json::json!({
                    "uiSessionId": ui_session_id, "ptySessionId": pty_session_id,
                    "session_id": ui_session_id, "pty_id": pty_session_id, "data": text
                }));
                if let Some(event) = parser.feed(&text) {
                    let _ = app.emit("pty://semantic-event", serde_json::json!({
                        "uiSessionId": ui_session_id, "ptySessionId": pty_session_id,
                        "session_id": ui_session_id, "pty_id": pty_session_id, "event": event
                    }));
                }
            }
            Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                std::thread::sleep(std::time::Duration::from_millis(10));
            }
            Err(e) => {
                runtime_debug_log(&format!("pty.error ui={} {}", ui_session_id, e));
                let _ = app.emit("pty://error", serde_json::json!({
                    "uiSessionId": ui_session_id, "ptySessionId": pty_session_id,
                    "session_id": ui_session_id, "pty_id": pty_session_id, "message": format!("PTY read error: {}", e)
                }));
                break;
            }
        }
    }

    let exit_code = pty_child.wait().ok().map(|s| if s.success() { 0 } else { 1 });
    runtime_debug_log(&format!("pty.exit ui={} code={:?}", ui_session_id, exit_code));
    if let Ok(mut s) = status.lock() { *s = PtySessionStatus::Exited { code: exit_code.unwrap_or(0) }; }
    let _ = app.emit("pty://exit", serde_json::json!({
        "uiSessionId": ui_session_id, "ptySessionId": pty_session_id,
        "session_id": ui_session_id, "pty_id": pty_session_id, "exit_code": exit_code
    }));
}

#[cfg(feature = "tokio-pty")]
fn supervise_pty_output_async(
    inner: PtyInner, app: AppHandle, ui_session_id: String, pty_session_id: String,
    running: Arc<Mutex<bool>>, log_writer: PtyLogWriter, status: Arc<Mutex<PtySessionStatus>>,
) {
    tokio::task::spawn_blocking(move || {
        supervise_pty_output(inner, app, ui_session_id, pty_session_id, running, log_writer, status);
    });
}
