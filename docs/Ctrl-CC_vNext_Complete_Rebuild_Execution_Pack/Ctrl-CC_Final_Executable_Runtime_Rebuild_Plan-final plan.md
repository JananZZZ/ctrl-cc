# Ctrl-CC Final Executable Runtime Rebuild Plan

> 版本：Final Lockdown Edition  
> 目标：让 Ctrl-CC 在 GUI 内稳定、真实、可审计地启动并控制系统已经安装的 Claude Code CLI。  
> 执行对象：Claude Code CLI / Claude CLI Coding Agent  
> 核心结论：本阶段只做一条成功路径，不做多方案并行，不做漂亮但不可用的 Chat 壳。

---

## 0. 本文档的强制结论

### 0.1 固定技术栈

本方案不再讨论替代技术栈，直接固定为：

```text
Desktop Shell: Tauri 2
Frontend: React + TypeScript
Terminal Renderer: @xterm/xterm
Terminal Addons: @xterm/addon-fit, @xterm/addon-search, @xterm/addon-web-links, @xterm/addon-serialize
Backend: Rust
PTY Runtime: portable-pty
CLI: 系统已安装的 claude / Claude Code CLI
IPC: Tauri invoke + Tauri events
State: Rust PtySessionManager + frontend session store
```

禁止使用：

```text
Electron
node-pty
普通 child_process.spawn(stdio: "pipe") 承载 interactive claude
WebView 输入框模拟 Claude Code 对话
ANSI 正则解析作为核心状态来源
向 PTY 盲目注入 y/n 自动通过权限
绕过 Claude Code 官方权限机制
```

### 0.2 固定产品职责

```text
Terminal View = 事实来源
Chat View = 输入增强层 + 语义增强层
Workspace = 当前会话工作台
Console = 全局入口和统计页
Session Monitor = 遥测、审计和风险仪表盘
```

Chat 不再伪装成 Claude Code 本体。  
Chat 输入框默认只做一件事：

```text
把用户输入写入当前 PTY 会话的 stdin，并追加 \r。
```

Structured Chat 另开独立 runtime：

```text
claude -p --output-format stream-json ...
```

它不能冒充 interactive Claude session。

---

## 1. 最终目标拆解

### 1.1 100%：GUI 内真实启动 Claude Code CLI

必须做到：

```text
[ ] 点击 “New Claude Session”。
[ ] Rust 后端用 portable-pty 创建真实 PTY。
[ ] PTY 中启动系统 PATH 里的 claude。
[ ] 前端 xterm.js 显示 Claude Code 原生界面。
[ ] 键盘输入、中文输入、回车、方向键、Tab、Ctrl+C、Ctrl+D 都可用。
[ ] Claude permission prompt 在 Terminal View 内正常显示和操作。
[ ] resize 后终端不乱码、不错位。
[ ] stop 后无 claude/cmd/powershell/bash/git 残留进程。
```

### 1.2 200%：语义增强，但不伪造事实

必须做到：

```text
[ ] PTY raw output 可保存为 raw log。
[ ] Chat Composer 可把输入发送到 PTY。
[ ] Split View 可同时显示 Terminal 和 Chat。
[ ] Structured Runtime 使用 claude -p + stream-json。
[ ] stream-json 事件转为 Chat Cards / Tool Cards / Usage Cards。
[ ] statusLine / hooks / file watcher / git watcher 后续作为语义来源。
[ ] 无法从官方或本地观测获得的数据，显示 Unavailable。
```

### 1.3 500%：治理增强放到后续阶段

必须做到：

```text
[ ] Risk Engine 不自动放行高风险。
[ ] AutoTrust 只允许低风险只读/安全操作。
[ ] Permission Center 不靠 PTY y/n 抢答。
[ ] Process Watchdog 防止进程爆炸。
[ ] 所有关键操作写 AuditLog。
```

---

## 2. 当前失败根因判定

以前反复失败的根因不是 UI 描述不够细，而是架构路径错误。

错误路径：

```text
GUI Chat 输入框
→ 普通进程 spawn claude
→ stdout/stderr pipe
→ 尝试解析输出
→ 尝试把输入写回进程
→ interactive CLI 状态错乱
```

正确路径：

```text
xterm.js
↔ Tauri invoke / event
↔ Rust PtySessionManager
↔ portable-pty / ConPTY
↔ shell wrapper
↔ 系统 claude interactive CLI
```

任何 interactive Claude Code session 必须使用 PTY。

---

## 3. 执行总顺序

Claude CLI 必须严格按以下顺序执行。  
不得跳过 P0。  
P0 未通过时，禁止继续做 Console、Dock、Theme、Monitor 的 UI 美化。

```text
P0. Repository Audit + Capability Probe
P1. RuntimeBridge 目录和类型建立
P2. Claude CLI Discovery
P3. PTY Session Manager
P4. xterm Terminal View
P5. Chat Composer 写入 PTY
P6. Workspace 接入真实会话
P7. Process Stop / Resize / Raw Log
P8. Structured Runtime 单独接入
P9. Telemetry / statusLine / hooks
P10. Console / Theme / Dock 融合
```

---

## 4. 需要 Claude CLI 先执行的审计命令

在项目根目录执行：

```bash
pwd
ls
find . -maxdepth 3 -type f | sed 's#^\./##' | sort | head -300

node -v
npm -v
pnpm -v || true
cargo --version || true
rustc --version || true

which claude || where claude || true
claude --version || true
claude auth status || true
claude --help || true
claude -p "Return exactly: pong" --output-format stream-json --include-partial-messages || true
```

Windows PowerShell 等价命令：

```powershell
Get-Location
Get-ChildItem -Recurse -File | Select-Object -First 300 FullName

node -v
npm -v
pnpm -v
cargo --version
rustc --version

where.exe claude
claude --version
claude auth status
claude --help
claude -p "Return exactly: pong" --output-format stream-json --include-partial-messages
```

输出文件：

```text
docs/runtime-audit.md
docs/claude-capability-probe.md
```

---

## 5. 目标文件树

如果项目中不存在对应目录，则创建。

```text
src-tauri/
  Cargo.toml
  src/
    lib.rs
    main.rs
    runtime/
      mod.rs
      claude_discovery.rs
      pty_session.rs
      structured_runtime.rs
      event_payloads.rs

src/
  runtime/
    tauriPtyClient.ts
    terminalThemes.ts
  components/
    workspace/
      ClaudeTerminalView.tsx
      PtyChatComposer.tsx
      WorkspaceSurface.tsx
  styles/
    terminal.css

docs/
  runtime-audit.md
  claude-capability-probe.md
  p0-pty-e2e-checklist.md
```

---

## 6. 后端依赖：src-tauri/Cargo.toml

在 `src-tauri/Cargo.toml` 中确保存在以下依赖。  
如已有依赖，不要重复添加；版本冲突时以此处为准，并运行 `cargo check` 验证。

```toml
[dependencies]
tauri = { version = "2", features = [] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
anyhow = "1"
thiserror = "2"
uuid = { version = "1", features = ["v4", "serde"] }
portable-pty = "0.9"
parking_lot = "0.12"
which = "7"
shell-words = "1"
chrono = { version = "0.4", features = ["serde"] }
```

如果项目已经使用 `tokio`，补充：

```toml
tokio = { version = "1", features = ["process", "io-util", "macros", "rt-multi-thread"] }
```

---

## 7. Rust 事件类型：src-tauri/src/runtime/event_payloads.rs

创建文件：

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize)]
pub struct PtyOutputPayload {
    pub session_id: String,
    pub data: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct PtyExitPayload {
    pub session_id: String,
    pub code: Option<i32>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct PtyErrorPayload {
    pub session_id: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ClaudeCapabilityPayload {
    pub claude_path: Option<String>,
    pub version: Option<String>,
    pub auth_ok: bool,
    pub auth_status_raw: String,
    pub stream_json_ok: bool,
    pub stream_json_raw: String,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct StartClaudePtyRequest {
    pub cwd: String,
    pub cols: u16,
    pub rows: u16,
    pub session_name: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct StartClaudePtyResponse {
    pub session_id: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct PtyWriteRequest {
    pub session_id: String,
    pub data: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct PtyResizeRequest {
    pub session_id: String,
    pub cols: u16,
    pub rows: u16,
    pub pixel_width: Option<u16>,
    pub pixel_height: Option<u16>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct PtyStopRequest {
    pub session_id: String,
}
```

---

## 8. Claude CLI Discovery：src-tauri/src/runtime/claude_discovery.rs

创建文件：

```rust
use crate::runtime::event_payloads::ClaudeCapabilityPayload;
use std::process::Command;

pub fn discover_claude_path() -> Option<String> {
    if let Ok(path) = which::which("claude") {
        return Some(path.to_string_lossy().to_string());
    }
    None
}

fn run_shell_command(command_line: &str) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    let output = Command::new(std::env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".to_string()))
        .args(["/d", "/s", "/c", command_line])
        .output()
        .map_err(|e| format!("failed to spawn command: {e}"))?;

    #[cfg(not(target_os = "windows"))]
    let output = Command::new("bash")
        .args(["-lc", command_line])
        .output()
        .map_err(|e| format!("failed to spawn command: {e}"))?;

    let mut text = String::new();
    text.push_str(&String::from_utf8_lossy(&output.stdout));
    text.push_str(&String::from_utf8_lossy(&output.stderr));

    if output.status.success() {
        Ok(text)
    } else {
        Err(text)
    }
}

pub fn probe_claude_capability() -> ClaudeCapabilityPayload {
    let mut errors = Vec::new();

    let claude_path = discover_claude_path();
    if claude_path.is_none() {
        errors.push("claude not found in PATH".to_string());
    }

    let version = match run_shell_command("claude --version") {
        Ok(v) => Some(v.trim().to_string()),
        Err(e) => {
            errors.push(format!("claude --version failed: {e}"));
            None
        }
    };

    let auth_status_raw = match run_shell_command("claude auth status") {
        Ok(v) => v,
        Err(e) => {
            errors.push(format!("claude auth status failed: {e}"));
            e
        }
    };
    let auth_ok = auth_status_raw.to_lowercase().contains("logged")
        || auth_status_raw.to_lowercase().contains("authenticated")
        || auth_status_raw.contains("\"status\"");

    let stream_json_raw = match run_shell_command(
        "claude -p \"Return exactly: pong\" --output-format stream-json --include-partial-messages",
    ) {
        Ok(v) => v,
        Err(e) => {
            errors.push(format!("claude stream-json probe failed: {e}"));
            e
        }
    };

    let stream_json_ok = stream_json_raw.contains("pong")
        || stream_json_raw.contains("\"type\"")
        || stream_json_raw.contains("\"result\"");

    ClaudeCapabilityPayload {
        claude_path,
        version,
        auth_ok,
        auth_status_raw,
        stream_json_ok,
        stream_json_raw,
        errors,
    }
}

pub fn shell_quote_path(path: &str) -> String {
    #[cfg(target_os = "windows")]
    {
        format!("\"{}\"", path.replace('"', "\\\""))
    }

    #[cfg(not(target_os = "windows"))]
    {
        shell_words::quote(path).to_string()
    }
}
```

---

## 9. PTY Runtime：src-tauri/src/runtime/pty_session.rs

创建文件：

```rust
use crate::runtime::claude_discovery::{discover_claude_path, shell_quote_path};
use crate::runtime::event_payloads::{
    PtyErrorPayload, PtyExitPayload, PtyOutputPayload, PtyResizeRequest, PtyStopRequest,
    PtyWriteRequest, StartClaudePtyRequest, StartClaudePtyResponse,
};
use anyhow::{anyhow, Context, Result};
use parking_lot::Mutex;
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize, PtySystem};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

pub struct PtySession {
    pub writer: Arc<Mutex<Box<dyn Write + Send>>>,
    pub master: Box<dyn MasterPty + Send>,
    pub child: Box<dyn portable_pty::Child + Send + Sync>,
}

#[derive(Default)]
pub struct PtySessionManager {
    sessions: Mutex<HashMap<String, PtySession>>,
}

impl PtySessionManager {
    pub fn start_claude(
        &self,
        app: AppHandle,
        req: StartClaudePtyRequest,
    ) -> Result<StartClaudePtyResponse> {
        let cwd = PathBuf::from(&req.cwd);
        if !cwd.exists() || !cwd.is_dir() {
            return Err(anyhow!("cwd does not exist or is not a directory: {}", req.cwd));
        }

        let claude_path = discover_claude_path()
            .ok_or_else(|| anyhow!("claude not found in PATH. Install Claude Code CLI first."))?;

        let session_id = Uuid::new_v4().to_string();

        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows: req.rows.max(10),
                cols: req.cols.max(40),
                pixel_width: 0,
                pixel_height: 0,
            })
            .context("failed to open PTY")?;

        let mut cmd = build_claude_command(&claude_path, req.session_name.as_deref());
        cmd.cwd(cwd);

        cmd.env("TERM", "xterm-256color");
        cmd.env("COLORTERM", "truecolor");
        cmd.env("FORCE_COLOR", "1");
        cmd.env("CLICOLOR_FORCE", "1");

        let child = pair
            .slave
            .spawn_command(cmd)
            .context("failed to spawn claude in PTY")?;

        let mut reader = pair
            .master
            .try_clone_reader()
            .context("failed to clone PTY reader")?;

        let writer = pair
            .master
            .take_writer()
            .context("failed to take PTY writer")?;

        let writer = Arc::new(Mutex::new(writer));

        let reader_session_id = session_id.clone();
        let reader_app = app.clone();

        std::thread::spawn(move || {
            let mut buf = [0u8; 8192];

            loop {
                match reader.read(&mut buf) {
                    Ok(0) => {
                        let _ = reader_app.emit(
                            "ctrlcc://pty-exit",
                            PtyExitPayload {
                                session_id: reader_session_id.clone(),
                                code: None,
                                message: "PTY reader reached EOF".to_string(),
                            },
                        );
                        break;
                    }
                    Ok(n) => {
                        let data = String::from_utf8_lossy(&buf[..n]).to_string();
                        let _ = reader_app.emit(
                            "ctrlcc://pty-output",
                            PtyOutputPayload {
                                session_id: reader_session_id.clone(),
                                data,
                            },
                        );
                    }
                    Err(e) => {
                        let _ = reader_app.emit(
                            "ctrlcc://pty-error",
                            PtyErrorPayload {
                                session_id: Some(reader_session_id.clone()),
                                message: format!("PTY read error: {e}"),
                            },
                        );
                        break;
                    }
                }
            }
        });

        let session = PtySession {
            writer,
            master: pair.master,
            child,
        };

        self.sessions.lock().insert(session_id.clone(), session);

        Ok(StartClaudePtyResponse { session_id })
    }

    pub fn write(&self, req: PtyWriteRequest) -> Result<()> {
        let sessions = self.sessions.lock();
        let session = sessions
            .get(&req.session_id)
            .ok_or_else(|| anyhow!("PTY session not found: {}", req.session_id))?;

        let mut writer = session.writer.lock();
        writer
            .write_all(req.data.as_bytes())
            .context("failed to write to PTY")?;
        writer.flush().ok();

        Ok(())
    }

    pub fn resize(&self, req: PtyResizeRequest) -> Result<()> {
        let sessions = self.sessions.lock();
        let session = sessions
            .get(&req.session_id)
            .ok_or_else(|| anyhow!("PTY session not found: {}", req.session_id))?;

        session
            .master
            .resize(PtySize {
                rows: req.rows.max(10),
                cols: req.cols.max(40),
                pixel_width: req.pixel_width.unwrap_or(0),
                pixel_height: req.pixel_height.unwrap_or(0),
            })
            .context("failed to resize PTY")?;

        Ok(())
    }

    pub fn stop(&self, req: PtyStopRequest) -> Result<()> {
        let mut sessions = self.sessions.lock();
        let mut session = sessions
            .remove(&req.session_id)
            .ok_or_else(|| anyhow!("PTY session not found: {}", req.session_id))?;

        // Graceful interrupt first.
        {
            let mut writer = session.writer.lock();
            let _ = writer.write_all(b"\x03");
            let _ = writer.flush();
        }

        std::thread::sleep(std::time::Duration::from_millis(600));

        // Force kill as final cleanup.
        let _ = session.child.kill();

        Ok(())
    }
}

fn build_claude_command(claude_path: &str, session_name: Option<&str>) -> CommandBuilder {
    let mut claude_args = vec!["--permission-mode".to_string(), "default".to_string()];

    if let Some(name) = session_name {
        if !name.trim().is_empty() {
            claude_args.push("--name".to_string());
            claude_args.push(name.to_string());
        }
    }

    #[cfg(target_os = "windows")]
    {
        let shell = std::env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".to_string());
        let mut cmd = CommandBuilder::new(shell);

        let mut command_line = shell_quote_path(claude_path);
        for arg in claude_args {
            command_line.push(' ');
            command_line.push_str(&shell_quote_path(&arg));
        }

        cmd.args(["/d", "/s", "/c", &command_line]);
        cmd
    }

    #[cfg(not(target_os = "windows"))]
    {
        let mut cmd = CommandBuilder::new("bash");

        let mut command_line = "exec ".to_string();
        command_line.push_str(&shell_quote_path(claude_path));
        for arg in claude_args {
            command_line.push(' ');
            command_line.push_str(&shell_words::quote(&arg));
        }

        cmd.args(["-lc", &command_line]);
        cmd
    }
}
```

如果 `Box<dyn portable_pty::Child + Send + Sync>` 因 trait bound 报错，则改成：

```rust
pub child: Box<dyn portable_pty::Child + Send>,
```

并保持 `PtySession` 只放在 `Mutex<HashMap<...>>` 内，不跨线程直接共享 child。

---

## 10. Structured Runtime：src-tauri/src/runtime/structured_runtime.rs

创建文件。  
注意：这个 runtime 只用于非交互任务，不能替代 PTY。

```rust
use anyhow::{anyhow, Context, Result};
use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
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
        let mut command = Command::new("claude");
        command
            .current_dir(req.cwd)
            .arg("-p")
            .arg(req.prompt)
            .arg("--output-format")
            .arg("stream-json")
            .arg("--include-partial-messages")
            .arg("--include-hook-events")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        if let Some(max_turns) = req.max_turns {
            command.arg("--max-turns").arg(max_turns.to_string());
        }

        match command.spawn() {
            Ok(mut child) => {
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

                let _ = child.wait();
            }
            Err(e) => {
                let _ = app.emit(
                    "ctrlcc://structured-event",
                    StructuredEventPayload {
                        task_id: task_id_for_thread.clone(),
                        line: serde_json::json!({
                            "type": "ctrlcc_error",
                            "message": format!("failed to spawn structured claude: {e}")
                        })
                        .to_string(),
                    },
                );
            }
        }
    });

    Ok(StructuredRunResponse { task_id })
}
```

---

## 11. Runtime module：src-tauri/src/runtime/mod.rs

创建文件：

```rust
pub mod claude_discovery;
pub mod event_payloads;
pub mod pty_session;
pub mod structured_runtime;
```

---

## 12. Tauri 命令注册：src-tauri/src/lib.rs

如果当前项目已有 `lib.rs`，只合并以下内容，不删除原有 setup/plugin/window 配置。  
如果没有，则创建：

```rust
mod runtime;

use runtime::claude_discovery::probe_claude_capability;
use runtime::event_payloads::{
    ClaudeCapabilityPayload, PtyResizeRequest, PtyStopRequest, PtyWriteRequest,
    StartClaudePtyRequest, StartClaudePtyResponse,
};
use runtime::pty_session::PtySessionManager;
use runtime::structured_runtime::{
    start_structured_run, StructuredRunRequest, StructuredRunResponse,
};
use tauri::{AppHandle, State};

#[tauri::command]
fn claude_probe_capabilities() -> ClaudeCapabilityPayload {
    probe_claude_capability()
}

#[tauri::command]
fn pty_start_claude(
    app: AppHandle,
    manager: State<'_, PtySessionManager>,
    req: StartClaudePtyRequest,
) -> Result<StartClaudePtyResponse, String> {
    manager.start_claude(app, req).map_err(|e| e.to_string())
}

#[tauri::command]
fn pty_write(
    manager: State<'_, PtySessionManager>,
    req: PtyWriteRequest,
) -> Result<(), String> {
    manager.write(req).map_err(|e| e.to_string())
}

#[tauri::command]
fn pty_resize(
    manager: State<'_, PtySessionManager>,
    req: PtyResizeRequest,
) -> Result<(), String> {
    manager.resize(req).map_err(|e| e.to_string())
}

#[tauri::command]
fn pty_stop(
    manager: State<'_, PtySessionManager>,
    req: PtyStopRequest,
) -> Result<(), String> {
    manager.stop(req).map_err(|e| e.to_string())
}

#[tauri::command]
fn structured_run(
    app: AppHandle,
    req: StructuredRunRequest,
) -> Result<StructuredRunResponse, String> {
    start_structured_run(app, req).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(PtySessionManager::default())
        .invoke_handler(tauri::generate_handler![
            claude_probe_capabilities,
            pty_start_claude,
            pty_write,
            pty_resize,
            pty_stop,
            structured_run
        ])
        .run(tauri::generate_context!())
        .expect("error while running Ctrl-CC");
}
```

---

## 13. Tauri main：src-tauri/src/main.rs

确保 `main.rs` 为：

```rust
fn main() {
    ctrl_cc_lib::run();
}
```

如果 crate 名不是 `ctrl_cc_lib`，按 `Cargo.toml [lib] name` 的实际名称修改。  
这不是架构选择，是 Rust crate 名称适配。

---

## 14. 前端依赖

执行：

```bash
npm install @xterm/xterm @xterm/addon-fit @xterm/addon-search @xterm/addon-web-links @xterm/addon-serialize @tauri-apps/api
```

或 pnpm：

```bash
pnpm add @xterm/xterm @xterm/addon-fit @xterm/addon-search @xterm/addon-web-links @xterm/addon-serialize @tauri-apps/api
```

---

## 15. 前端 PTY client：src/runtime/tauriPtyClient.ts

创建文件：

```ts
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export type PtyOutputPayload = {
  session_id: string;
  data: string;
};

export type PtyExitPayload = {
  session_id: string;
  code?: number | null;
  message: string;
};

export type PtyErrorPayload = {
  session_id?: string | null;
  message: string;
};

export type StartClaudePtyRequest = {
  cwd: string;
  cols: number;
  rows: number;
  sessionName?: string;
};

export type StartClaudePtyResponse = {
  session_id: string;
};

export type ClaudeCapabilityPayload = {
  claude_path?: string | null;
  version?: string | null;
  auth_ok: boolean;
  auth_status_raw: string;
  stream_json_ok: boolean;
  stream_json_raw: string;
  errors: string[];
};

export async function probeClaudeCapabilities(): Promise<ClaudeCapabilityPayload> {
  return invoke<ClaudeCapabilityPayload>("claude_probe_capabilities");
}

export async function startClaudePty(
  req: StartClaudePtyRequest,
): Promise<StartClaudePtyResponse> {
  return invoke<StartClaudePtyResponse>("pty_start_claude", {
    req: {
      cwd: req.cwd,
      cols: req.cols,
      rows: req.rows,
      session_name: req.sessionName ?? null,
    },
  });
}

export async function writePty(sessionId: string, data: string): Promise<void> {
  return invoke<void>("pty_write", {
    req: {
      session_id: sessionId,
      data,
    },
  });
}

export async function resizePty(
  sessionId: string,
  cols: number,
  rows: number,
  pixelWidth?: number,
  pixelHeight?: number,
): Promise<void> {
  return invoke<void>("pty_resize", {
    req: {
      session_id: sessionId,
      cols,
      rows,
      pixel_width: pixelWidth ?? null,
      pixel_height: pixelHeight ?? null,
    },
  });
}

export async function stopPty(sessionId: string): Promise<void> {
  return invoke<void>("pty_stop", {
    req: {
      session_id: sessionId,
    },
  });
}

export async function onPtyOutput(
  handler: (payload: PtyOutputPayload) => void,
): Promise<UnlistenFn> {
  return listen<PtyOutputPayload>("ctrlcc://pty-output", (event) => {
    handler(event.payload);
  });
}

export async function onPtyExit(
  handler: (payload: PtyExitPayload) => void,
): Promise<UnlistenFn> {
  return listen<PtyExitPayload>("ctrlcc://pty-exit", (event) => {
    handler(event.payload);
  });
}

export async function onPtyError(
  handler: (payload: PtyErrorPayload) => void,
): Promise<UnlistenFn> {
  return listen<PtyErrorPayload>("ctrlcc://pty-error", (event) => {
    handler(event.payload);
  });
}
```

---

## 16. Terminal 主题：src/runtime/terminalThemes.ts

创建文件：

```ts
import type { ITheme } from "@xterm/xterm";

export type CtrlCcTheme = "light" | "dark" | "pale-blue" | "warm-sand";

export const XTERM_THEMES: Record<CtrlCcTheme, ITheme> = {
  light: {
    background: "#fbfcfe",
    foreground: "#243044",
    cursor: "#d6b98c",
    selectionBackground: "#f4ead9",
  },
  dark: {
    background: "#1f2329",
    foreground: "#edf0f5",
    cursor: "#d8c29b",
    selectionBackground: "#3c424c",
  },
  "pale-blue": {
    background: "#f5f9fd",
    foreground: "#22364c",
    cursor: "#5f93c0",
    selectionBackground: "#dcecf8",
  },
  "warm-sand": {
    background: "#fffdf8",
    foreground: "#243044",
    cursor: "#b99862",
    selectionBackground: "#f1e7d2",
  },
};
```

---

## 17. Terminal CSS：src/styles/terminal.css

创建文件：

```css
.ctrlcc-terminal-shell {
  width: 100%;
  height: 100%;
  min-height: 420px;
  overflow: hidden;
  border-radius: var(--cc-radius-lg, 20px);
  border: 1px solid var(--cc-border-soft, rgba(232, 222, 209, 0.68));
  background: var(--cc-bg-elevated, #fffdf8);
}

.ctrlcc-terminal-container {
  width: 100%;
  height: 100%;
  min-height: 420px;
  padding: 8px;
  box-sizing: border-box;
}

.ctrlcc-terminal-container .xterm {
  height: 100%;
}

.ctrlcc-terminal-toolbar {
  height: 42px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  border-bottom: 1px solid var(--cc-border-soft, rgba(232, 222, 209, 0.68));
  background: var(--cc-surface-muted, #f4ecdc);
}

.ctrlcc-terminal-toolbar button {
  border: 1px solid var(--cc-border-soft, rgba(232, 222, 209, 0.68));
  border-radius: 10px;
  padding: 6px 10px;
  background: var(--cc-surface-solid, #ffffff);
  color: var(--cc-text, #243044);
  cursor: pointer;
}

.ctrlcc-terminal-toolbar button:hover {
  background: var(--cc-surface-hover, #fffaf2);
}

.ctrlcc-terminal-status {
  margin-left: auto;
  color: var(--cc-text-muted, #7b6f62);
  font-size: 12px;
}
```

---

## 18. Terminal View：src/components/workspace/ClaudeTerminalView.tsx

创建文件：

```tsx
import "@xterm/xterm/css/xterm.css";
import "../../styles/terminal.css";

import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { SearchAddon } from "@xterm/addon-search";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { SerializeAddon } from "@xterm/addon-serialize";
import { useEffect, useRef, useState } from "react";

import {
  onPtyError,
  onPtyExit,
  onPtyOutput,
  resizePty,
  startClaudePty,
  stopPty,
  writePty,
} from "../../runtime/tauriPtyClient";
import { XTERM_THEMES, type CtrlCcTheme } from "../../runtime/terminalThemes";

type ClaudeTerminalViewProps = {
  cwd: string;
  theme?: CtrlCcTheme;
  sessionName?: string;
  onSessionStarted?: (sessionId: string) => void;
  externalSessionId?: string | null;
};

export function ClaudeTerminalView({
  cwd,
  theme = "warm-sand",
  sessionName,
  onSessionStarted,
  externalSessionId,
}: ClaudeTerminalViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const serializeAddonRef = useRef<SerializeAddon | null>(null);
  const sessionIdRef = useRef<string | null>(externalSessionId ?? null);

  const [status, setStatus] = useState<"idle" | "starting" | "running" | "stopped" | "error">(
    "idle",
  );
  const [sessionId, setSessionId] = useState<string | null>(externalSessionId ?? null);

  useEffect(() => {
    sessionIdRef.current = externalSessionId ?? sessionIdRef.current;
    setSessionId(sessionIdRef.current);
  }, [externalSessionId]);

  useEffect(() => {
    if (!containerRef.current || terminalRef.current) return;

    const terminal = new Terminal({
      convertEol: false,
      cursorBlink: true,
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
      fontSize: 13,
      lineHeight: 1.18,
      scrollback: 10000,
      allowProposedApi: false,
      theme: XTERM_THEMES[theme],
    });

    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    const webLinksAddon = new WebLinksAddon();
    const serializeAddon = new SerializeAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(searchAddon);
    terminal.loadAddon(webLinksAddon);
    terminal.loadAddon(serializeAddon);

    terminal.open(containerRef.current);
    fitAddon.fit();
    terminal.focus();

    terminal.onData((data) => {
      const activeSessionId = sessionIdRef.current;
      if (!activeSessionId) return;
      void writePty(activeSessionId, data);
    });

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    serializeAddonRef.current = serializeAddon;

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      const activeSessionId = sessionIdRef.current;
      if (!activeSessionId) return;

      void resizePty(
        activeSessionId,
        terminal.cols,
        terminal.rows,
        containerRef.current?.clientWidth ?? 0,
        containerRef.current?.clientHeight ?? 0,
      );
    });

    resizeObserver.observe(containerRef.current);

    let unlistenOutput: (() => void) | undefined;
    let unlistenExit: (() => void) | undefined;
    let unlistenError: (() => void) | undefined;

    void onPtyOutput((payload) => {
      if (payload.session_id !== sessionIdRef.current) return;
      terminal.write(payload.data);
    }).then((fn) => {
      unlistenOutput = fn;
    });

    void onPtyExit((payload) => {
      if (payload.session_id !== sessionIdRef.current) return;
      setStatus("stopped");
      terminal.writeln("");
      terminal.writeln(`[Ctrl-CC] PTY exited: ${payload.message}`);
    }).then((fn) => {
      unlistenExit = fn;
    });

    void onPtyError((payload) => {
      if (payload.session_id && payload.session_id !== sessionIdRef.current) return;
      setStatus("error");
      terminal.writeln("");
      terminal.writeln(`[Ctrl-CC] PTY error: ${payload.message}`);
    }).then((fn) => {
      unlistenError = fn;
    });

    return () => {
      resizeObserver.disconnect();
      unlistenOutput?.();
      unlistenExit?.();
      unlistenError?.();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      serializeAddonRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.options.theme = XTERM_THEMES[theme];
    }
  }, [theme]);

  async function handleStart() {
    if (!terminalRef.current || !fitAddonRef.current) return;

    setStatus("starting");
    terminalRef.current.writeln("[Ctrl-CC] Starting Claude Code CLI inside real PTY...");
    terminalRef.current.writeln(`[Ctrl-CC] cwd = ${cwd}`);

    fitAddonRef.current.fit();

    try {
      const res = await startClaudePty({
        cwd,
        cols: terminalRef.current.cols,
        rows: terminalRef.current.rows,
        sessionName,
      });

      sessionIdRef.current = res.session_id;
      setSessionId(res.session_id);
      setStatus("running");
      onSessionStarted?.(res.session_id);

      terminalRef.current.writeln(`[Ctrl-CC] PTY session started: ${res.session_id}`);
    } catch (error) {
      setStatus("error");
      terminalRef.current.writeln(`[Ctrl-CC] Failed to start Claude PTY: ${String(error)}`);
    }
  }

  async function handleStop() {
    const activeSessionId = sessionIdRef.current;
    if (!activeSessionId) return;

    await stopPty(activeSessionId);
    setStatus("stopped");
  }

  async function sendCtrlC() {
    const activeSessionId = sessionIdRef.current;
    if (!activeSessionId) return;
    await writePty(activeSessionId, "\x03");
  }

  async function sendCtrlD() {
    const activeSessionId = sessionIdRef.current;
    if (!activeSessionId) return;
    await writePty(activeSessionId, "\x04");
  }

  function exportTerminalText() {
    const text = serializeAddonRef.current?.serialize() ?? "";
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ctrlcc-terminal-${sessionIdRef.current ?? "no-session"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="ctrlcc-terminal-shell">
      <div className="ctrlcc-terminal-toolbar">
        <button onClick={handleStart} disabled={status === "starting" || status === "running"}>
          Start Claude
        </button>
        <button onClick={sendCtrlC} disabled={!sessionId}>
          Ctrl+C
        </button>
        <button onClick={sendCtrlD} disabled={!sessionId}>
          Ctrl+D
        </button>
        <button onClick={handleStop} disabled={!sessionId || status === "stopped"}>
          Stop
        </button>
        <button onClick={exportTerminalText}>Export Text</button>
        <span className="ctrlcc-terminal-status">
          {status} {sessionId ? `· ${sessionId.slice(0, 8)}` : ""}
        </span>
      </div>
      <div ref={containerRef} className="ctrlcc-terminal-container" />
    </section>
  );
}
```

---

## 19. Chat Composer：src/components/workspace/PtyChatComposer.tsx

创建文件：

```tsx
import { useState } from "react";
import { writePty } from "../../runtime/tauriPtyClient";

type PtyChatComposerProps = {
  sessionId: string | null;
  disabled?: boolean;
};

export function PtyChatComposer({ sessionId, disabled }: PtyChatComposerProps) {
  const [value, setValue] = useState("");

  async function send() {
    const text = value.trimEnd();
    if (!sessionId || !text) return;

    // interactive Claude Code expects Enter as carriage return.
    await writePty(sessionId, `${text}\r`);
    setValue("");
  }

  async function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      await send();
    }
  }

  return (
    <div
      style={{
        border: "1px solid var(--cc-border-soft)",
        borderRadius: 16,
        padding: 10,
        background: "var(--cc-surface-solid)",
      }}
    >
      <textarea
        value={value}
        disabled={disabled || !sessionId}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={
          sessionId
            ? "输入内容，Ctrl/⌘ + Enter 发送到当前真实 Claude PTY 会话"
            : "请先启动 Claude PTY 会话"
        }
        style={{
          width: "100%",
          minHeight: 88,
          resize: "vertical",
          border: "1px solid var(--cc-border-soft)",
          borderRadius: 12,
          padding: 10,
          outline: "none",
          color: "var(--cc-text)",
          background: "var(--cc-bg-elevated)",
        }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
        <span style={{ color: "var(--cc-text-muted)", fontSize: 12 }}>
          默认发送到 PTY stdin，不创建假 Chat 会话。
        </span>
        <button
          onClick={send}
          disabled={disabled || !sessionId || !value.trim()}
          style={{
            border: "1px solid var(--cc-brand-strong)",
            borderRadius: 12,
            padding: "8px 14px",
            background: "var(--cc-brand)",
            color: "var(--cc-text)",
            cursor: "pointer",
          }}
        >
          Send to Claude PTY
        </button>
      </div>
    </div>
  );
}
```

---

## 20. Workspace Surface：src/components/workspace/WorkspaceSurface.tsx

创建文件或合并到现有 Workspace 页面：

```tsx
import { useEffect, useState } from "react";
import { ClaudeTerminalView } from "./ClaudeTerminalView";
import { PtyChatComposer } from "./PtyChatComposer";
import { probeClaudeCapabilities, type ClaudeCapabilityPayload } from "../../runtime/tauriPtyClient";

type WorkspaceSurfaceProps = {
  cwd: string;
};

export function WorkspaceSurface({ cwd }: WorkspaceSurfaceProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [capability, setCapability] = useState<ClaudeCapabilityPayload | null>(null);

  useEffect(() => {
    void probeClaudeCapabilities().then(setCapability).catch((error) => {
      setCapability({
        claude_path: null,
        version: null,
        auth_ok: false,
        auth_status_raw: "",
        stream_json_ok: false,
        stream_json_raw: "",
        errors: [String(error)],
      });
    });
  }, []);

  return (
    <main
      style={{
        height: "100%",
        display: "grid",
        gridTemplateColumns: "minmax(560px, 1.35fr) minmax(360px, 0.65fr)",
        gap: 16,
        padding: 16,
        background: "var(--cc-bg)",
      }}
    >
      <section style={{ minHeight: 0 }}>
        <ClaudeTerminalView
          cwd={cwd}
          theme="warm-sand"
          sessionName="ctrl-cc-workspace"
          onSessionStarted={setSessionId}
        />
      </section>

      <aside style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
        <div
          style={{
            border: "1px solid var(--cc-border-soft)",
            borderRadius: 16,
            padding: 12,
            background: "var(--cc-surface-solid)",
          }}
        >
          <h3 style={{ margin: 0, color: "var(--cc-text)" }}>Claude Runtime</h3>
          <p style={{ margin: "8px 0", color: "var(--cc-text-muted)" }}>
            {capability?.claude_path ? `Path: ${capability.claude_path}` : "Claude CLI: Unavailable"}
          </p>
          <p style={{ margin: "8px 0", color: "var(--cc-text-muted)" }}>
            {capability?.version ? `Version: ${capability.version}` : "Version: Unavailable"}
          </p>
          {capability?.errors?.length ? (
            <pre
              style={{
                whiteSpace: "pre-wrap",
                color: "var(--cc-red)",
                background: "var(--cc-red-soft)",
                padding: 8,
                borderRadius: 10,
              }}
            >
              {capability.errors.join("\n")}
            </pre>
          ) : null}
        </div>

        <PtyChatComposer sessionId={sessionId} />

        <div
          style={{
            border: "1px solid var(--cc-border-soft)",
            borderRadius: 16,
            padding: 12,
            background: "var(--cc-surface-solid)",
            color: "var(--cc-text-muted)",
          }}
        >
          <strong style={{ color: "var(--cc-text)" }}>Rule</strong>
          <p>
            Terminal View 是事实来源。Chat Composer 只把文本发送到当前 PTY，不解析、不伪造 Claude
            内部状态。
          </p>
        </div>
      </aside>
    </main>
  );
}
```

---

## 21. 接入路由

把现有 Workspace 页面里的旧 Claude Chat 面板替换为：

```tsx
<WorkspaceSurface cwd={currentProjectPath} />
```

如果当前没有 `currentProjectPath`，用项目根目录或用户选择的 workspace path。  
禁止用空字符串启动。  
cwd 必须是实际存在的目录。

---

## 22. P0 验收测试

创建 `docs/p0-pty-e2e-checklist.md`：

```md
# P0 PTY E2E Checklist

## Environment

- OS:
- Shell:
- Claude path:
- Claude version:
- Auth status:

## Test 1: Capability Probe

- [ ] claude path found
- [ ] claude --version ok
- [ ] claude auth status ok
- [ ] claude -p stream-json ok

## Test 2: Start Interactive Claude

- [ ] Click Start Claude
- [ ] Terminal shows Claude Code interface
- [ ] No blank screen
- [ ] No immediate process exit
- [ ] cwd is correct

## Test 3: Input

- [ ] Type normal English
- [ ] Type Chinese
- [ ] Press Enter
- [ ] Press arrow keys
- [ ] Press Tab
- [ ] Use slash command if available

## Test 4: Chat Composer

- [ ] Type message in Chat Composer
- [ ] Ctrl/⌘ + Enter sends to PTY
- [ ] Message appears in terminal session
- [ ] No second fake session is created

## Test 5: Control

- [ ] Ctrl+C works
- [ ] Ctrl+D works
- [ ] Stop kills session
- [ ] Restart works

## Test 6: Resize

- [ ] Resize Workspace panel
- [ ] Terminal redraws
- [ ] No repeated text explosion
- [ ] No layout corruption

## Test 7: Process Cleanup

Windows:
- [ ] Task Manager has no orphan claude/cmd/powershell after Stop

Unix:
- [ ] ps shows no orphan claude/bash after Stop

## Gate

P0 is passed only if every item above passes.
```

---

## 23. Process cleanup 强化要求

P0 之后必须补 Windows Job Object。  
当前 `portable-pty child.kill()` 是基础止血，不是最终进程树治理。

创建后续任务：

```text
P7.1 Windows Job Object:
  - 启动 claude 时将进程加入 Job Object
  - stop 时 TerminateJobObject
  - app exit 时清理全部 job

P7.2 Unix process group:
  - bash -lc exec claude
  - 设置独立进程组
  - stop 时 SIGTERM group
  - timeout 后 SIGKILL group
```

如果 Claude CLI 本轮只能完成 P0，则先提交 P0，不要拖到大而全。

---

## 24. statusLine probe 后续接入

P0 通过后，创建：

```text
.ctrlcc/claude/statusline_ctrlcc.py
```

内容：

```python
#!/usr/bin/env python3
import json
import os
import sys
from pathlib import Path
from datetime import datetime, timezone

def main():
    raw = sys.stdin.read()
    if not raw.strip():
        print("Ctrl-CC")
        return

    data = json.loads(raw)

    project_dir = (
        data.get("workspace", {}).get("project_dir")
        or data.get("cwd")
        or os.getcwd()
    )

    ctrlcc_dir = Path(project_dir) / ".ctrlcc" / "runtime"
    ctrlcc_dir.mkdir(parents=True, exist_ok=True)

    snapshot = {
        "captured_at": datetime.now(timezone.utc).isoformat(),
        "session_id": data.get("session_id"),
        "cwd": data.get("cwd"),
        "workspace": data.get("workspace"),
        "model": data.get("model"),
        "version": data.get("version"),
        "cost": data.get("cost"),
        "context_window": data.get("context_window"),
        "permission_mode": data.get("permission_mode"),
        "output_style": data.get("output_style"),
        "raw": data,
    }

    latest = ctrlcc_dir / "statusline.latest.json"
    history = ctrlcc_dir / "statusline.snapshots.jsonl"

    latest.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2), encoding="utf-8")
    with history.open("a", encoding="utf-8") as f:
        f.write(json.dumps(snapshot, ensure_ascii=False) + "\n")

    model = data.get("model", {}).get("display_name") or data.get("model", {}).get("id") or "Claude"
    cost = data.get("cost", {}).get("total_cost_usd")
    cost_text = f"${cost:.4f}" if isinstance(cost, (int, float)) else "cost n/a"

    print(f"Ctrl-CC · {model} · {cost_text}")

if __name__ == "__main__":
    main()
```

对应 `.claude/settings.local.json` 最小配置：

```json
{
  "statusLine": {
    "type": "command",
    "command": "python .ctrlcc/claude/statusline_ctrlcc.py",
    "padding": 0
  }
}
```

规则：

```text
不得静默覆盖用户已有 statusLine。
如已存在 statusLine，先备份到 .ctrlcc/backups/settings.local.json.bak。
```

---

## 25. hooks 后续接入

P0 通过后，创建：

```text
.ctrlcc/claude/hooks/pre_tool_use.py
```

内容：

```python
#!/usr/bin/env python3
import json
import re
import sys

DANGEROUS = [
    r"\brm\s+-rf\b",
    r"\bdel\s+/s\b",
    r"\brmdir\b",
    r"\bgit\s+reset\s+--hard\b",
    r"\bgit\s+clean\s+-fd\b",
    r"\bgit\s+push\s+--force\b",
    r"\bclaude\s+project\s+purge\b",
]

def main():
    payload = json.loads(sys.stdin.read())
    tool_name = payload.get("tool_name")
    tool_input = payload.get("tool_input") or {}

    if tool_name == "Bash":
        command = tool_input.get("command", "")
        for pattern in DANGEROUS:
            if re.search(pattern, command, re.IGNORECASE):
                print(json.dumps({
                    "hookSpecificOutput": {
                        "hookEventName": "PreToolUse",
                        "permissionDecision": "deny",
                        "permissionDecisionReason": f"Ctrl-CC blocked dangerous command: {pattern}"
                    }
                }))
                return

    # No output means Claude Code continues normal permission flow.
    return

if __name__ == "__main__":
    main()
```

对应 `.claude/settings.local.json` 合并：

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "python .ctrlcc/claude/hooks/pre_tool_use.py"
          }
        ]
      }
    ]
  }
}
```

规则：

```text
高风险默认 deny。
中风险 ask。
低风险暂不自动 allow，等 P5 Risk Engine 完成后再做 AutoTrust。
```

---

## 26. Structured Runtime 前端接入原则

创建单独 UI：

```text
Structured Task Panel
```

不要放在 interactive Chat Composer 里混用。

Structured Task 发送：

```text
claude -p "<prompt>" --output-format stream-json --include-partial-messages --include-hook-events
```

它输出语义卡片：

```text
AssistantTextCard
ToolUseCard
UsageCard
HookEventCard
ErrorCard
RawJsonCollapse
```

但是必须标注：

```text
Structured Task is not the active Terminal PTY session.
```

---

## 27. Console 和主题的融合顺序

在 P0/P1 未通过前，不做 Console 美化。  
通过后再恢复：

```text
Daily Console:
  - 新建 Claude 会话按钮 → 调用 WorkspaceSurface + pty_start_claude
  - 运行环境诊断 → claude_probe_capabilities
  - Claude CLI Ready → 来自真实 probe
  - PTY Ready → 来自 PtySessionManager

Pro Console:
  - 时间筛选只影响 ProAnalyticsSnapshot
  - 不影响实时 PTY 状态
  - 缺失数据显示 Unavailable

Theme:
  - 默认 warm-sand
  - Terminal theme 跟随 app theme
  - 切换 theme 不重启 PTY
```

---

## 28. 最终 Claude CLI 执行 Prompt

把下面这段完整发给 Claude CLI：

```text
你现在要执行 Ctrl-CC Final Executable Runtime Rebuild Plan。

最高优先级：
让 Ctrl-CC 在 GUI 内通过真实 PTY 成功启动系统已经安装的 Claude Code CLI，并可以真实交互。

硬性架构：
1. Desktop 固定使用 Tauri 2 + React + TypeScript + Rust。
2. Terminal 固定使用 @xterm/xterm。
3. 后端 PTY 固定使用 Rust portable-pty。
4. interactive Claude Code CLI 必须运行在真实 PTY 中。
5. 禁止用普通 stdio pipe/spawn 模拟 interactive claude。
6. Terminal View 是事实来源。
7. Chat Composer 只能写入当前 PTY stdin，不得创建假 Chat 会话。
8. Structured Runtime 必须单独使用 claude -p + stream-json，不得冒充 interactive session。
9. 所有 unsupported/unknown 数据显示 Unavailable，不得伪造。
10. P0 未通过前，不许继续做 Console、Dock、Theme、Monitor 美化。

请按以下阶段执行：

P0. 审计当前项目：
- 检查 Tauri/React/Rust 结构。
- 检查是否已有 src-tauri。
- 检查是否已有 xterm/pty 实现。
- 检查旧 Chat 是否在模拟 Claude。
- 输出 docs/runtime-audit.md。

P1. 执行 Claude capability probe：
- which/where claude
- claude --version
- claude auth status
- claude --help
- claude -p "Return exactly: pong" --output-format stream-json --include-partial-messages
- 输出 docs/claude-capability-probe.md。

P2. 添加 Rust runtime：
- src-tauri/src/runtime/event_payloads.rs
- src-tauri/src/runtime/claude_discovery.rs
- src-tauri/src/runtime/pty_session.rs
- src-tauri/src/runtime/structured_runtime.rs
- src-tauri/src/runtime/mod.rs
- 在 src-tauri/src/lib.rs 注册：
  - claude_probe_capabilities
  - pty_start_claude
  - pty_write
  - pty_resize
  - pty_stop
  - structured_run

P3. 添加前端 runtime client：
- src/runtime/tauriPtyClient.ts
- src/runtime/terminalThemes.ts

P4. 添加 Workspace 组件：
- src/components/workspace/ClaudeTerminalView.tsx
- src/components/workspace/PtyChatComposer.tsx
- src/components/workspace/WorkspaceSurface.tsx
- src/styles/terminal.css

P5. 替换旧 Workspace Claude Chat 入口：
- Workspace 默认显示 Terminal View + Chat Composer。
- Chat Composer 输入必须写入当前 PTY。
- Start Claude 按钮必须调用 pty_start_claude。
- Stop 必须调用 pty_stop。
- Resize 必须调用 pty_resize。
- xterm onData 必须调用 pty_write。

P6. 运行构建检查：
- npm run typecheck
- npm run build
- cargo check --manifest-path src-tauri/Cargo.toml
- 如果项目使用 pnpm，则用 pnpm typecheck / pnpm build。

P7. 运行 P0 E2E：
- GUI 内点击 Start Claude。
- Terminal 显示 Claude Code CLI。
- 输入中文和英文。
- Chat Composer Ctrl/⌘+Enter 发送到 Terminal。
- Ctrl+C 可用。
- Stop 后无残留进程。
- Resize 不乱码。

必须输出：
1. 修改文件列表。
2. docs/runtime-audit.md。
3. docs/claude-capability-probe.md。
4. docs/p0-pty-e2e-checklist.md。
5. 构建结果。
6. P0 E2E 结果。
7. 如果失败，必须指出失败在：
   - claude discovery
   - auth
   - PTY spawn
   - xterm rendering
   - IPC event
   - PTY input
   - resize
   - process cleanup
   中的哪一层。

不要做：
- 不要重构 Console。
- 不要重构四主题。
- 不要重构 AI Dock。
- 不要先做漂亮 UI。
- 不要引入 Electron。
- 不要引入 node-pty。
- 不要用 stdout pipe 启动 interactive claude。
- 不要伪造 Claude session 状态。
- 不要自动通过高风险权限。
```

---

## 29. 唯一需要用户确认的选项

当前方案已经做了默认强选择。  
只有下面两项如果你有强偏好，才需要改。

### 选项 A：是否允许默认启动时自动进入 Claude 会话

默认选择：

```text
不自动启动。
用户点击 Start Claude 后启动。
```

原因：

```text
避免 App 打开即产生 Claude 会话、认证弹窗、成本或权限风险。
```

### 选项 B：默认 permission mode

默认选择：

```text
--permission-mode default
```

原因：

```text
不绕过 Claude Code 官方权限机制，最安全，也最适合先跑通 P0。
```

暂不使用：

```text
--permission-mode auto
--permission-mode bypassPermissions
```

---

## 30. 最终验收门槛

只有满足以下条件，才算本轮真正成功：

```text
[ ] Claude Code CLI 在 GUI Terminal View 内真实启动。
[ ] Terminal 可正常交互。
[ ] Chat Composer 输入进入同一个 PTY session。
[ ] 没有第二个假会话。
[ ] Stop 后无残留进程。
[ ] Resize 不错乱。
[ ] Capability Probe 可显示真实 claude path/version/auth/stream-json 状态。
[ ] 不支持能力显示 Unavailable。
[ ] npm/pnpm build 通过。
[ ] cargo check 通过。
```

如果这十项未全部通过，禁止宣称完成 100%。
```
