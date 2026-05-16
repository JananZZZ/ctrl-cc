# Ctrl-CC Final 100%+200%+500% Runtime Architecture Rebuild Plan

版本：Final Persistent Runtime Kernel  
目标分支：`master`  
目标仓库：`https://github.com/JananZZZ/ctrl-cc`

---

## 0. 这次的最终结论

当前 Ctrl-CC 的核心问题不是某一个 bug，而是 **运行时架构方向错误**：

```text
错误路线：
Chat 每次发送 -> 启动一次 claude -p / stream-json -> 进程退出 -> 下一条消息再启动新进程

正确路线：
一个 GUI Session -> 一个长期存活 Claude CLI Runtime -> Chat/Terminal/Inspector 都 attach 到这个 Runtime
```

因此，本次最终改造不再继续围绕 `runtime_start_chat_stream` 修补，而是直接建立新的 **Persistent Runtime Kernel**：

```text
RuntimeKernel
  ├── Persistent Claude PTY Process
  ├── Raw Terminal Stream
  ├── Chat Semantic Projection
  ├── Transcript Watcher
  ├── Diagnostics Snapshot
  ├── Setup Probe
  └── UI Store Bridge
```

### 不再妥协的硬规则

```text
1. Workspace 主 Chat 严禁调用 runtime_start_chat_stream。
2. Workspace 主 Chat 严禁每条消息 spawn 新 Claude 进程。
3. 一个 GUI session 必须绑定一个长期存活的 Claude process。
4. Chat 和 Terminal 必须绑定同一个 process、同一个 cwd、同一个 session state。
5. 切换 Chat/Terminal/Split 只切换视图，不启动新进程。
6. 关闭 tab 默认 detach，不自动 kill 后台 Claude。
7. 只有用户明确点击“终止 Claude”才 kill process。
8. Headless stream-json 仅保留给后台任务、一次性诊断、结构化自动化，不作为 Workspace Chat 主链路。
9. 所有后台子进程必须静默运行，不允许弹出 cmd/powershell/node/claude 黑窗口。
10. Diagnostics 读取 RuntimeKernel 状态，不再读取多套旧 store。
```

---

## 1. 当前代码明确存在的问题

### 1.1 `WorkspaceSurface.tsx` 仍在调用错误的 Chat 主链路

当前：

```ts
await RuntimeFabricBridge.sendChatMessage(activeTabId, text, ...)
```

这是错误的。它最终会进入 `runtime_start_chat_stream`，每轮消息启动一个新进程。

必须改成：

```ts
await RuntimeKernelBridge.submitUserMessage(activeTabId, text, ...)
```

---

### 1.2 当前 `runtime_v2::chat_stream` 只能保留为 secondary path

当前后端注册：

```rust
runtime_v2::runtime_commands::runtime_start_chat_stream
```

保留它，但它只能用于：

```text
1. Quick Ask
2. Background Task
3. Diagnostics
4. 一次性结构化命令
```

严禁用于 Workspace 主 Chat。

---

### 1.3 当前 Terminal 和 Chat 使用不同 Store

当前：

```text
Chat -> useRuntimeFabricStore
Terminal -> useRuntimeStore + RuntimeBridge.write
```

这会导致：

```text
session not found
PTY not writable
状态不同步
Chat/Terminal 切换时重新启动/断开
```

必须统一为：

```text
runtimeKernelStore
```

---

### 1.4 当前 `RuntimeManager` 已有 portable-pty 能力，但不是最终内核

现有 `runtime_v2/runtime_manager.rs` 已经具备：

```text
portable_pty openpty
spawn interactive command
reader thread emit pty://data
writer retained in HashMap
```

但是它的问题是：

```text
1. 仍属于 runtime_v2，状态不是全局唯一真相源。
2. 前端 Terminal 没有可靠 attach 到它。
3. Chat 没有写入它，而是走 stream-json one-shot。
4. Session close / detach / stop 语义不清楚。
5. 没有 transcript watcher / semantic projection。
```

本次直接新增 `runtime_kernel`，不要继续在 v2 上小修小补。

---

## 2. 总体执行顺序

一次性完成全部内容，但必须按文件顺序执行：

```text
A. 新增后端 runtime_kernel 模块
B. main.rs 注册 RuntimeKernel
C. 新增前端 runtime-kernel 模块
D. 替换 WorkspaceSurface 主逻辑
E. 替换 TerminalView / usePtyTerminal
F. 改造 ChatView 输出来源
G. 废弃 RuntimeFabricBridge 主链路
H. 接入 Setup / Diagnostics / Console 状态
I. 清理旧入口和测试
J. 验收
```

---

# A. 新增后端 RuntimeKernel

## A1. 新建 `src-tauri/src/runtime_kernel/mod.rs`

```rust
pub mod types;
pub mod manager;
pub mod commands;
```

---

## A2. 新建 `src-tauri/src/runtime_kernel/types.rs`

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeKernelStartRequest {
    pub trace_id: String,
    pub gui_session_id: String,
    pub project_id: String,
    pub cwd: String,
    pub model: Option<String>,
    pub permission_mode: Option<String>,
    pub session_name: Option<String>,
    pub resume_target: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeKernelSubmitRequest {
    pub trace_id: String,
    pub gui_session_id: String,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeKernelWriteRequest {
    pub trace_id: String,
    pub gui_session_id: String,
    pub data: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeKernelResizeRequest {
    pub trace_id: String,
    pub gui_session_id: String,
    pub cols: u16,
    pub rows: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeKernelStopRequest {
    pub trace_id: String,
    pub gui_session_id: String,
    pub force: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeKernelDetachRequest {
    pub trace_id: String,
    pub gui_session_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeKernelSessionSnapshot {
    pub trace_id: String,
    pub gui_session_id: String,
    pub runtime_process_id: String,
    pub project_id: String,
    pub cwd: String,
    pub pid: Option<u32>,
    pub status: String,
    pub has_writer: bool,
    pub reader_alive: bool,
    pub claude_session_id: Option<String>,
    pub transcript_path: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeKernelAck {
    pub trace_id: String,
    pub gui_session_id: String,
    pub ok: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeKernelEvent {
    pub trace_id: String,
    pub gui_session_id: String,
    pub runtime_process_id: String,
    pub event_type: String,
    pub status: Option<String>,
    pub data: Option<String>,
    pub message: Option<String>,
    pub pid: Option<u32>,
    pub cwd: Option<String>,
    pub created_at: String,
}
```

---

## A3. 新建 `src-tauri/src/runtime_kernel/manager.rs`

```rust
use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use chrono::Utc;
use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use tauri::{AppHandle, Emitter};

use crate::runtime_v2::claude_command_resolver::{build_invocation, select_for_terminal};

use super::types::{
    RuntimeKernelAck, RuntimeKernelDetachRequest, RuntimeKernelEvent, RuntimeKernelResizeRequest,
    RuntimeKernelSessionSnapshot, RuntimeKernelStartRequest, RuntimeKernelStopRequest,
    RuntimeKernelSubmitRequest, RuntimeKernelWriteRequest,
};

pub struct RuntimeKernel {
    sessions: Arc<Mutex<HashMap<String, RuntimeKernelHandle>>>,
}

pub struct RuntimeKernelHandle {
    pub trace_id: String,
    pub gui_session_id: String,
    pub runtime_process_id: String,
    pub project_id: String,
    pub cwd: String,
    pub pid: Option<u32>,
    pub status: String,
    pub has_writer: bool,
    pub reader_alive: bool,
    pub claude_session_id: Option<String>,
    pub transcript_path: Option<PathBuf>,
    pub created_at: String,
    pub updated_at: String,
    pub last_error: Option<String>,
    pub writer: Box<dyn Write + Send>,
    pub child: Box<dyn portable_pty::Child + Send + Sync>,
}

impl Default for RuntimeKernel {
    fn default() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

impl RuntimeKernel {
    pub fn start_session(
        &self,
        app: AppHandle,
        req: RuntimeKernelStartRequest,
    ) -> Result<RuntimeKernelSessionSnapshot, String> {
        let cwd_path = PathBuf::from(&req.cwd);
        if req.cwd.trim().is_empty() {
            return Err("cwd is empty".into());
        }
        if !cwd_path.exists() {
            return Err(format!("cwd not found: {}", req.cwd));
        }
        if !cwd_path.is_dir() {
            return Err(format!("cwd is not a directory: {}", req.cwd));
        }

        {
            let sessions = self.sessions.lock().map_err(|e| e.to_string())?;
            if let Some(existing) = sessions.get(&req.gui_session_id) {
                return Ok(snapshot_from_handle(existing));
            }
        }

        let spec = select_for_terminal()?;
        let cli_args = build_interactive_args(&req);
        let invocation = build_invocation(&spec, &cli_args);

        let pty_system = NativePtySystem::default();
        let pair = pty_system
            .openpty(PtySize {
                rows: 32,
                cols: 120,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("openpty failed: {}", e))?;

        let mut cmd = CommandBuilder::new(invocation.program.clone());
        for arg in &invocation.args {
            cmd.arg(arg);
        }
        cmd.cwd(&req.cwd);

        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("pty spawn failed: {}", e))?;

        drop(pair.slave);

        let mut reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| format!("clone reader failed: {}", e))?;

        let writer = pair
            .master
            .take_writer()
            .map_err(|e| format!("take writer failed: {}", e))?;

        let now = Utc::now().to_rfc3339();
        let pid = child.process_id();
        let runtime_process_id = format!("rt-{}-{}", req.gui_session_id, Utc::now().timestamp_millis());

        let handle = RuntimeKernelHandle {
            trace_id: req.trace_id.clone(),
            gui_session_id: req.gui_session_id.clone(),
            runtime_process_id: runtime_process_id.clone(),
            project_id: req.project_id.clone(),
            cwd: req.cwd.clone(),
            pid,
            status: "ready".into(),
            has_writer: true,
            reader_alive: true,
            claude_session_id: req.resume_target.clone(),
            transcript_path: None,
            created_at: now.clone(),
            updated_at: now.clone(),
            last_error: None,
            writer,
            child,
        };

        {
            let mut sessions = self.sessions.lock().map_err(|e| e.to_string())?;
            sessions.insert(req.gui_session_id.clone(), handle);
        }

        emit_kernel_event(
            &app,
            RuntimeKernelEvent {
                trace_id: req.trace_id.clone(),
                gui_session_id: req.gui_session_id.clone(),
                runtime_process_id: runtime_process_id.clone(),
                event_type: "session.ready".into(),
                status: Some("ready".into()),
                data: None,
                message: Some("Claude runtime started".into()),
                pid,
                cwd: Some(req.cwd.clone()),
                created_at: Utc::now().to_rfc3339(),
            },
        );

        let app_for_reader = app.clone();
        let sessions_ref = self.sessions.clone();
        let trace_id = req.trace_id.clone();
        let gui_session_id = req.gui_session_id.clone();
        let runtime_process_id_for_thread = runtime_process_id.clone();
        let cwd = req.cwd.clone();

        std::thread::spawn(move || {
            emit_kernel_event(
                &app_for_reader,
                RuntimeKernelEvent {
                    trace_id: trace_id.clone(),
                    gui_session_id: gui_session_id.clone(),
                    runtime_process_id: runtime_process_id_for_thread.clone(),
                    event_type: "reader.started".into(),
                    status: Some("ready".into()),
                    data: None,
                    message: Some("PTY reader started".into()),
                    pid,
                    cwd: Some(cwd.clone()),
                    created_at: Utc::now().to_rfc3339(),
                },
            );

            let mut buf = [0u8; 8192];

            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        let data = String::from_utf8_lossy(&buf[..n]).to_string();

                        emit_kernel_event(
                            &app_for_reader,
                            RuntimeKernelEvent {
                                trace_id: trace_id.clone(),
                                gui_session_id: gui_session_id.clone(),
                                runtime_process_id: runtime_process_id_for_thread.clone(),
                                event_type: "pty.data".into(),
                                status: None,
                                data: Some(data),
                                message: None,
                                pid,
                                cwd: Some(cwd.clone()),
                                created_at: Utc::now().to_rfc3339(),
                            },
                        );
                    }
                    Err(err) => {
                        emit_kernel_event(
                            &app_for_reader,
                            RuntimeKernelEvent {
                                trace_id: trace_id.clone(),
                                gui_session_id: gui_session_id.clone(),
                                runtime_process_id: runtime_process_id_for_thread.clone(),
                                event_type: "reader.error".into(),
                                status: Some("failed".into()),
                                data: None,
                                message: Some(err.to_string()),
                                pid,
                                cwd: Some(cwd.clone()),
                                created_at: Utc::now().to_rfc3339(),
                            },
                        );
                        break;
                    }
                }
            }

            if let Ok(mut sessions) = sessions_ref.lock() {
                if let Some(handle) = sessions.get_mut(&gui_session_id) {
                    handle.reader_alive = false;
                    handle.has_writer = false;
                    handle.status = "exited".into();
                    handle.updated_at = Utc::now().to_rfc3339();
                    handle.last_error = Some("PTY reader exited; writer is no longer valid".into());
                }
            }

            emit_kernel_event(
                &app_for_reader,
                RuntimeKernelEvent {
                    trace_id,
                    gui_session_id,
                    runtime_process_id: runtime_process_id_for_thread,
                    event_type: "session.exited".into(),
                    status: Some("exited".into()),
                    data: None,
                    message: Some("Claude runtime exited".into()),
                    pid,
                    cwd: Some(cwd),
                    created_at: Utc::now().to_rfc3339(),
                },
            );
        });

        let sessions = self.sessions.lock().map_err(|e| e.to_string())?;
        let created = sessions
            .get(&req.gui_session_id)
            .ok_or_else(|| "session disappeared after start".to_string())?;

        Ok(snapshot_from_handle(created))
    }

    pub fn submit_user_message(
        &self,
        req: RuntimeKernelSubmitRequest,
    ) -> Result<RuntimeKernelAck, String> {
        let mut sessions = self.sessions.lock().map_err(|e| e.to_string())?;
        let handle = get_writable_handle(&mut sessions, &req.gui_session_id)?;

        let mut input = req.text;
        input.push('\r');

        handle.writer.write_all(input.as_bytes()).map_err(|e| {
            handle.has_writer = false;
            handle.last_error = Some(e.to_string());
            format!("runtime submit failed: {}", e)
        })?;

        handle.writer.flush().map_err(|e| format!("runtime flush failed: {}", e))?;
        handle.updated_at = Utc::now().to_rfc3339();
        handle.status = "streaming".into();

        Ok(RuntimeKernelAck {
            trace_id: req.trace_id,
            gui_session_id: req.gui_session_id,
            ok: true,
        })
    }

    pub fn write_terminal(&self, req: RuntimeKernelWriteRequest) -> Result<RuntimeKernelAck, String> {
        let mut sessions = self.sessions.lock().map_err(|e| e.to_string())?;
        let handle = get_writable_handle(&mut sessions, &req.gui_session_id)?;

        handle.writer.write_all(req.data.as_bytes()).map_err(|e| {
            handle.has_writer = false;
            handle.last_error = Some(e.to_string());
            format!("runtime terminal write failed: {}", e)
        })?;

        handle.writer.flush().map_err(|e| format!("runtime flush failed: {}", e))?;
        handle.updated_at = Utc::now().to_rfc3339();

        Ok(RuntimeKernelAck {
            trace_id: req.trace_id,
            gui_session_id: req.gui_session_id,
            ok: true,
        })
    }

    pub fn resize(&self, req: RuntimeKernelResizeRequest) -> Result<RuntimeKernelAck, String> {
        // portable-pty resize can be added here when master handle is retained.
        // Current v26 preserves functional correctness first.
        Ok(RuntimeKernelAck {
            trace_id: req.trace_id,
            gui_session_id: req.gui_session_id,
            ok: true,
        })
    }

    pub fn detach_session(&self, req: RuntimeKernelDetachRequest) -> Result<RuntimeKernelAck, String> {
        // Detach means UI tab closes but process stays alive.
        // Do not remove session and do not kill child.
        Ok(RuntimeKernelAck {
            trace_id: req.trace_id,
            gui_session_id: req.gui_session_id,
            ok: true,
        })
    }

    pub fn stop_session(&self, req: RuntimeKernelStopRequest) -> Result<RuntimeKernelAck, String> {
        let mut sessions = self.sessions.lock().map_err(|e| e.to_string())?;

        let mut handle = sessions
            .remove(&req.gui_session_id)
            .ok_or_else(|| format!("runtime session not found: {}", req.gui_session_id))?;

        handle.child.kill().map_err(|e| format!("kill failed: {}", e))?;

        Ok(RuntimeKernelAck {
            trace_id: req.trace_id,
            gui_session_id: req.gui_session_id,
            ok: true,
        })
    }

    pub fn list_sessions(&self) -> Result<Vec<RuntimeKernelSessionSnapshot>, String> {
        let sessions = self.sessions.lock().map_err(|e| e.to_string())?;
        Ok(sessions.values().map(snapshot_from_handle).collect())
    }

    pub fn get_session(&self, gui_session_id: String) -> Result<RuntimeKernelSessionSnapshot, String> {
        let sessions = self.sessions.lock().map_err(|e| e.to_string())?;
        let handle = sessions
            .get(&gui_session_id)
            .ok_or_else(|| format!("runtime session not found: {}", gui_session_id))?;
        Ok(snapshot_from_handle(handle))
    }
}

fn get_writable_handle<'a>(
    sessions: &'a mut HashMap<String, RuntimeKernelHandle>,
    gui_session_id: &str,
) -> Result<&'a mut RuntimeKernelHandle, String> {
    let handle = sessions
        .get_mut(gui_session_id)
        .ok_or_else(|| format!("runtime session not found: {}", gui_session_id))?;

    if handle.status == "exited"
        || handle.status == "failed"
        || handle.status == "stopped"
        || !handle.reader_alive
        || !handle.has_writer
    {
        return Err(format!(
            "runtime session is not writable: {} status={} readerAlive={} hasWriter={}",
            gui_session_id, handle.status, handle.reader_alive, handle.has_writer
        ));
    }

    Ok(handle)
}

fn snapshot_from_handle(h: &RuntimeKernelHandle) -> RuntimeKernelSessionSnapshot {
    RuntimeKernelSessionSnapshot {
        trace_id: h.trace_id.clone(),
        gui_session_id: h.gui_session_id.clone(),
        runtime_process_id: h.runtime_process_id.clone(),
        project_id: h.project_id.clone(),
        cwd: h.cwd.clone(),
        pid: h.pid,
        status: h.status.clone(),
        has_writer: h.has_writer,
        reader_alive: h.reader_alive,
        claude_session_id: h.claude_session_id.clone(),
        transcript_path: h
            .transcript_path
            .as_ref()
            .map(|p| p.to_string_lossy().to_string()),
        created_at: h.created_at.clone(),
        updated_at: h.updated_at.clone(),
        last_error: h.last_error.clone(),
    }
}

fn emit_kernel_event(app: &AppHandle, event: RuntimeKernelEvent) {
    let _ = app.emit("runtime-kernel://event", event);
}

fn build_interactive_args(req: &RuntimeKernelStartRequest) -> Vec<String> {
    let mut args = Vec::new();

    if let Some(model) = &req.model {
        if !model.trim().is_empty() && model != "default" {
            args.push("--model".into());
            args.push(model.clone());
        }
    }

    if let Some(permission) = &req.permission_mode {
        if !permission.trim().is_empty() && permission != "default" {
            args.push("--permission-mode".into());
            args.push(permission.clone());
        }
    }

    if let Some(name) = &req.session_name {
        if !name.trim().is_empty() {
            args.push("--name".into());
            args.push(name.clone());
        }
    }

    if let Some(target) = &req.resume_target {
        if !target.trim().is_empty() {
            args.push("--resume".into());
            args.push(target.clone());
        }
    }

    args
}
```

---

## A4. 新建 `src-tauri/src/runtime_kernel/commands.rs`

```rust
use tauri::State;

use super::manager::RuntimeKernel;
use super::types::{
    RuntimeKernelAck, RuntimeKernelDetachRequest, RuntimeKernelResizeRequest,
    RuntimeKernelSessionSnapshot, RuntimeKernelStartRequest, RuntimeKernelStopRequest,
    RuntimeKernelSubmitRequest, RuntimeKernelWriteRequest,
};

#[tauri::command]
pub fn runtime_kernel_start_session(
    app: tauri::AppHandle,
    kernel: State<'_, RuntimeKernel>,
    req: RuntimeKernelStartRequest,
) -> Result<RuntimeKernelSessionSnapshot, String> {
    kernel.start_session(app, req)
}

#[tauri::command]
pub fn runtime_kernel_submit_user_message(
    kernel: State<'_, RuntimeKernel>,
    req: RuntimeKernelSubmitRequest,
) -> Result<RuntimeKernelAck, String> {
    kernel.submit_user_message(req)
}

#[tauri::command]
pub fn runtime_kernel_write_terminal(
    kernel: State<'_, RuntimeKernel>,
    req: RuntimeKernelWriteRequest,
) -> Result<RuntimeKernelAck, String> {
    kernel.write_terminal(req)
}

#[tauri::command]
pub fn runtime_kernel_resize(
    kernel: State<'_, RuntimeKernel>,
    req: RuntimeKernelResizeRequest,
) -> Result<RuntimeKernelAck, String> {
    kernel.resize(req)
}

#[tauri::command]
pub fn runtime_kernel_detach_session(
    kernel: State<'_, RuntimeKernel>,
    req: RuntimeKernelDetachRequest,
) -> Result<RuntimeKernelAck, String> {
    kernel.detach_session(req)
}

#[tauri::command]
pub fn runtime_kernel_stop_session(
    kernel: State<'_, RuntimeKernel>,
    req: RuntimeKernelStopRequest,
) -> Result<RuntimeKernelAck, String> {
    kernel.stop_session(req)
}

#[tauri::command]
pub fn runtime_kernel_list_sessions(
    kernel: State<'_, RuntimeKernel>,
) -> Result<Vec<RuntimeKernelSessionSnapshot>, String> {
    kernel.list_sessions()
}

#[tauri::command]
pub fn runtime_kernel_get_session(
    kernel: State<'_, RuntimeKernel>,
    gui_session_id: String,
) -> Result<RuntimeKernelSessionSnapshot, String> {
    kernel.get_session(gui_session_id)
}
```

---

# B. 修改 `src-tauri/src/main.rs`

## B1. 在模块声明区加入

找到：

```rust
mod runtime_v2;
mod setup;
```

替换为：

```rust
mod runtime_v2;
mod runtime_kernel;
mod setup;
```

## B2. 在 manager 初始化处加入

找到：

```rust
let pty_session_manager = PtySessionManager::default();
```

其后加入：

```rust
let runtime_kernel = runtime_kernel::manager::RuntimeKernel::default();
```

## B3. 在 `.manage(...)` 区加入

找到：

```rust
.manage(runtime_v2::runtime_manager::RuntimeManager::default())
```

其后加入：

```rust
.manage(runtime_kernel)
```

## B4. 在 `invoke_handler` 里加入新命令

在 `runtime_v2::runtime_commands::runtime_start_chat_stream,` 后面加入：

```rust
runtime_kernel::commands::runtime_kernel_start_session,
runtime_kernel::commands::runtime_kernel_submit_user_message,
runtime_kernel::commands::runtime_kernel_write_terminal,
runtime_kernel::commands::runtime_kernel_resize,
runtime_kernel::commands::runtime_kernel_detach_session,
runtime_kernel::commands::runtime_kernel_stop_session,
runtime_kernel::commands::runtime_kernel_list_sessions,
runtime_kernel::commands::runtime_kernel_get_session,
```

---

# C. 新增前端 Runtime Kernel 模块

## C1. 新建 `src/runtime-kernel/types.ts`

```ts
export type RuntimeKernelStatus =
  | 'created'
  | 'starting'
  | 'ready'
  | 'thinking'
  | 'waiting_permission'
  | 'streaming'
  | 'idle'
  | 'stopping'
  | 'stopped'
  | 'exited'
  | 'failed';

export interface RuntimeKernelSessionSnapshot {
  traceId: string;
  guiSessionId: string;
  runtimeProcessId: string;
  projectId: string;
  cwd: string;
  pid: number | null;
  status: RuntimeKernelStatus | string;
  hasWriter: boolean;
  readerAlive: boolean;
  claudeSessionId: string | null;
  transcriptPath: string | null;
  createdAt: string;
  updatedAt: string;
  lastError: string | null;
}

export interface RuntimeKernelEvent {
  traceId: string;
  guiSessionId: string;
  runtimeProcessId: string;
  eventType: string;
  status?: string | null;
  data?: string | null;
  message?: string | null;
  pid?: number | null;
  cwd?: string | null;
  createdAt: string;
}

export interface RuntimeChatEvent {
  id: string;
  sessionId: string;
  type: 'user_message' | 'assistant_message' | 'system' | 'tool_use' | 'tool_result' | 'thinking' | 'raw';
  content: string;
  createdAt: string;
  severity: 'low' | 'medium' | 'high';
}

export interface StartRuntimeSessionInput {
  guiSessionId: string;
  projectId: string;
  cwd: string;
  model?: string;
  permissionMode?: string;
  sessionName?: string;
  resumeTarget?: string | null;
}

export interface SubmitUserMessageInput {
  guiSessionId: string;
  text: string;
}

export interface WriteTerminalInput {
  guiSessionId: string;
  data: string;
}
```

---

## C2. 新建 `src/runtime-kernel/runtimeKernelStore.ts`

```ts
import { create } from 'zustand';
import type { RuntimeChatEvent, RuntimeKernelEvent, RuntimeKernelSessionSnapshot } from './types';

interface RuntimeKernelState {
  sessions: Record<string, RuntimeKernelSessionSnapshot>;
  rawOutput: Record<string, string>;
  chatEvents: Record<string, RuntimeChatEvent[]>;
  lastEventBySession: Record<string, RuntimeKernelEvent>;

  upsertSession: (session: RuntimeKernelSessionSnapshot) => void;
  patchSession: (sessionId: string, patch: Partial<RuntimeKernelSessionSnapshot>) => void;
  appendKernelEvent: (event: RuntimeKernelEvent) => void;
  appendChatEvent: (sessionId: string, event: RuntimeChatEvent) => void;
  clearSession: (sessionId: string) => void;
}

export const useRuntimeKernelStore = create<RuntimeKernelState>((set, get) => ({
  sessions: {},
  rawOutput: {},
  chatEvents: {},
  lastEventBySession: {},

  upsertSession: (session) => {
    set((state) => ({
      sessions: {
        ...state.sessions,
        [session.guiSessionId]: session,
      },
    }));
  },

  patchSession: (sessionId, patch) => {
    set((state) => {
      const old = state.sessions[sessionId];
      if (!old) return state;
      return {
        sessions: {
          ...state.sessions,
          [sessionId]: {
            ...old,
            ...patch,
          },
        },
      };
    });
  },

  appendKernelEvent: (event) => {
    set((state) => {
      const sessionId = event.guiSessionId;
      const oldRaw = state.rawOutput[sessionId] ?? '';
      const nextRaw = event.eventType === 'pty.data' && event.data
        ? `${oldRaw}${event.data}`.slice(-200_000)
        : oldRaw;

      const oldSession = state.sessions[sessionId];
      const nextSession = oldSession && event.status
        ? {
            ...oldSession,
            status: event.status,
            pid: event.pid ?? oldSession.pid,
            cwd: event.cwd ?? oldSession.cwd,
            updatedAt: event.createdAt,
            lastError: event.eventType.includes('error') ? event.message ?? oldSession.lastError : oldSession.lastError,
          }
        : oldSession;

      return {
        rawOutput: {
          ...state.rawOutput,
          [sessionId]: nextRaw,
        },
        sessions: nextSession
          ? {
              ...state.sessions,
              [sessionId]: nextSession,
            }
          : state.sessions,
        lastEventBySession: {
          ...state.lastEventBySession,
          [sessionId]: event,
        },
      };
    });
  },

  appendChatEvent: (sessionId, event) => {
    set((state) => {
      const old = state.chatEvents[sessionId] ?? [];
      if (old.some((x) => x.id === event.id)) return state;
      return {
        chatEvents: {
          ...state.chatEvents,
          [sessionId]: [...old, event].slice(-1000),
        },
      };
    });
  },

  clearSession: (sessionId) => {
    set((state) => {
      const sessions = { ...state.sessions };
      const rawOutput = { ...state.rawOutput };
      const chatEvents = { ...state.chatEvents };
      const lastEventBySession = { ...state.lastEventBySession };
      delete sessions[sessionId];
      delete rawOutput[sessionId];
      delete chatEvents[sessionId];
      delete lastEventBySession[sessionId];
      return { sessions, rawOutput, chatEvents, lastEventBySession };
    });
  },
}));
```

---

## C3. 新建 `src/runtime-kernel/runtimeEventParser.ts`

```ts
import type { RuntimeChatEvent, RuntimeKernelEvent } from './types';

let lastAssistantBySession: Record<string, string> = {};

export function runtimeKernelEventToChatEvents(event: RuntimeKernelEvent): RuntimeChatEvent[] {
  const now = event.createdAt || new Date().toISOString();

  if (event.eventType === 'pty.data' && event.data) {
    const text = stripAnsi(event.data);

    if (!text.trim()) return [];

    // 简单状态识别。完整语义化以后通过 transcript watcher 接管。
    if (/thinking|cogitat|思考|正在/i.test(text)) {
      return [{
        id: `think-${event.guiSessionId}-${hash(text)}-${Date.now()}`,
        sessionId: event.guiSessionId,
        type: 'thinking',
        content: text,
        createdAt: now,
        severity: 'low',
      }];
    }

    const prev = lastAssistantBySession[event.guiSessionId] ?? '';
    if (text === prev) return [];
    lastAssistantBySession[event.guiSessionId] = text;

    return [{
      id: `pty-text-${event.guiSessionId}-${hash(text)}-${Date.now()}`,
      sessionId: event.guiSessionId,
      type: 'assistant_message',
      content: text,
      createdAt: now,
      severity: 'low',
    }];
  }

  if (event.eventType.includes('error')) {
    return [{
      id: `err-${event.guiSessionId}-${Date.now()}`,
      sessionId: event.guiSessionId,
      type: 'system',
      content: event.message ?? 'Runtime error',
      createdAt: now,
      severity: 'medium',
    }];
  }

  if (event.message) {
    return [{
      id: `sys-${event.guiSessionId}-${event.eventType}-${Date.now()}`,
      sessionId: event.guiSessionId,
      type: 'system',
      content: event.message,
      createdAt: now,
      severity: 'low',
    }];
  }

  return [];
}

export function stripAnsi(input: string): string {
  return input
    .replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '')
    .replace(/\r/g, '\n');
}

function hash(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = Math.imul(31, h) + input.charCodeAt(i) | 0;
  }
  return Math.abs(h).toString(36);
}
```

---

## C4. 新建 `src/runtime-kernel/runtimeKernelBridge.ts`

```ts
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { invokeCommand } from '../services/invokeCommand';
import { useRuntimeKernelStore } from './runtimeKernelStore';
import { runtimeKernelEventToChatEvents } from './runtimeEventParser';
import type {
  RuntimeKernelEvent,
  RuntimeKernelSessionSnapshot,
  StartRuntimeSessionInput,
  SubmitUserMessageInput,
  WriteTerminalInput,
} from './types';

function traceId(prefix = 'trace') {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export const RuntimeKernelBridge = {
  async installEventBridge(): Promise<() => void> {
    const unlisten: UnlistenFn = await listen<RuntimeKernelEvent>('runtime-kernel://event', (event) => {
      const payload = event.payload;
      const store = useRuntimeKernelStore.getState();

      store.appendKernelEvent(payload);

      for (const chatEvent of runtimeKernelEventToChatEvents(payload)) {
        store.appendChatEvent(payload.guiSessionId, chatEvent);
      }
    });

    return () => unlisten();
  },

  async startSession(input: StartRuntimeSessionInput): Promise<RuntimeKernelSessionSnapshot> {
    const snapshot = await invokeCommand<RuntimeKernelSessionSnapshot>('runtime_kernel_start_session', {
      req: {
        traceId: traceId('runtime-start'),
        guiSessionId: input.guiSessionId,
        projectId: input.projectId,
        cwd: input.cwd,
        model: input.model ?? null,
        permissionMode: input.permissionMode ?? null,
        sessionName: input.sessionName ?? null,
        resumeTarget: input.resumeTarget ?? null,
      },
    });

    useRuntimeKernelStore.getState().upsertSession(snapshot);
    return snapshot;
  },

  async submitUserMessage(input: SubmitUserMessageInput): Promise<void> {
    useRuntimeKernelStore.getState().appendChatEvent(input.guiSessionId, {
      id: `usr-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      sessionId: input.guiSessionId,
      type: 'user_message',
      content: input.text,
      createdAt: new Date().toISOString(),
      severity: 'low',
    });

    await invokeCommand('runtime_kernel_submit_user_message', {
      req: {
        traceId: traceId('runtime-submit'),
        guiSessionId: input.guiSessionId,
        text: input.text,
      },
    });
  },

  async writeTerminal(input: WriteTerminalInput): Promise<void> {
    await invokeCommand('runtime_kernel_write_terminal', {
      req: {
        traceId: traceId('runtime-write'),
        guiSessionId: input.guiSessionId,
        data: input.data,
      },
    });
  },

  async resize(guiSessionId: string, cols: number, rows: number): Promise<void> {
    await invokeCommand('runtime_kernel_resize', {
      req: {
        traceId: traceId('runtime-resize'),
        guiSessionId,
        cols,
        rows,
      },
    });
  },

  async detachSession(guiSessionId: string): Promise<void> {
    await invokeCommand('runtime_kernel_detach_session', {
      req: {
        traceId: traceId('runtime-detach'),
        guiSessionId,
      },
    });
  },

  async stopSession(guiSessionId: string, force = false): Promise<void> {
    await invokeCommand('runtime_kernel_stop_session', {
      req: {
        traceId: traceId('runtime-stop'),
        guiSessionId,
        force,
      },
    });
    useRuntimeKernelStore.getState().clearSession(guiSessionId);
  },

  async listSessions(): Promise<RuntimeKernelSessionSnapshot[]> {
    const sessions = await invokeCommand<RuntimeKernelSessionSnapshot[]>('runtime_kernel_list_sessions');
    for (const s of sessions) useRuntimeKernelStore.getState().upsertSession(s);
    return sessions;
  },
};
```

---

## C5. 在 App 启动时安装 RuntimeKernelBridge

修改 `src/app/App.tsx`。

找到顶层 `useEffect` 初始化区域，加入：

```ts
import { RuntimeKernelBridge } from '../runtime-kernel/runtimeKernelBridge';
```

在 `App` 组件里加入：

```ts
useEffect(() => {
  let cleanup: (() => void) | null = null;

  RuntimeKernelBridge.installEventBridge()
    .then((fn) => { cleanup = fn; })
    .catch((err) => {
      console.error('[Ctrl-CC] Failed to install RuntimeKernelBridge', err);
    });

  RuntimeKernelBridge.listSessions().catch(() => {});

  return () => {
    cleanup?.();
  };
}, []);
```

如果当前 `App.tsx` 已有多个 event bridge installer，不要删除它们，但 RuntimeKernelBridge 必须只安装一次。

---

# D. 替换 Workspace 主逻辑

## D1. 修改 `src/surfaces/workspace/WorkspaceSurface.tsx`

### D1.1 删除/停止使用以下 import

```ts
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { RuntimeFabricBridge } from '../../features/runtime-fabric/services/runtimeFabricBridge';
import { useRuntimeFabricStore } from '../../features/runtime-fabric/stores/runtimeFabricStore';
import { useSetupStore } from '../../features/setup/stores/setupStore';
```

保留 `RuntimeFabricBridge` 只会让主链路继续出错。Workspace 主链路必须完全切到 RuntimeKernel。

### D1.2 新增 import

```ts
import { RuntimeKernelBridge } from '../../runtime-kernel/runtimeKernelBridge';
import { useRuntimeKernelStore } from '../../runtime-kernel/runtimeKernelStore';
```

### D1.3 删除本地 rawEvents 状态

删除：

```ts
const [rawEvents, setRawEvents] = useState<RuntimeEvent[]>([]);
const activeTabIdRef = useRef<string | null>(null);
useEffect(() => { activeTabIdRef.current = activeTabId; }, [activeTabId]);
useEffect(() => { listen<RuntimeEvent>('runtime:event', ...); }, []);
```

### D1.4 用 RuntimeKernelStore 作为唯一事件源

加入：

```ts
const kernelChatEvents = useRuntimeKernelStore(
  useCallback(
    (s) => (activeTabId ? (s.chatEvents[activeTabId] ?? []) : []),
    [activeTabId]
  )
);

const runtimeSnapshot = useRuntimeKernelStore(
  useCallback(
    (s) => (activeTabId ? s.sessions[activeTabId] ?? null : null),
    [activeTabId]
  )
);

const events = kernelChatEvents as unknown as RuntimeEvent[];
```

### D1.5 替换 Composer enable 逻辑

替换 `isComposerEnabled` 为：

```ts
const isComposerEnabled = useCallback((sessionId: string | null): boolean => {
  if (!sessionId) return false;
  const snapshot = useRuntimeKernelStore.getState().sessions[sessionId];
  if (!snapshot) return false;
  return !['failed', 'stopped', 'exited'].includes(String(snapshot.status));
}, []);
```

删除 `isSetupIncomplete()`，Workspace 不应该每次发送时再依赖 setup.ready。环境问题应该在 start_session 时暴露。

### D1.6 替换 `handleSend`

把整个 `handleSend` 函数替换为：

```ts
const handleSend = useCallback(async (
  text: string,
  config: { model: string; effort: string; permissionMode: string; runtimeMode: string }
): Promise<SendResult> => {
  if (!activeTabId) return { ok: false, error: 'No active session' };

  try {
    const existing = useRuntimeKernelStore.getState().sessions[activeTabId];

    if (!existing) {
      await RuntimeKernelBridge.startSession({
        guiSessionId: activeTabId,
        projectId: activeSession?.projectId ?? '',
        cwd: activeSession?.cwd ?? '.',
        model: config.model,
        permissionMode: config.permissionMode,
        sessionName: activeSession?.name ?? activeSession?.title ?? activeTabId,
      });
    }

    await RuntimeKernelBridge.submitUserMessage({
      guiSessionId: activeTabId,
      text,
    });

    return { ok: true };
  } catch (err) {
    const msg = String(err);
    setError(`${t('workspace.sendFailed')}: ${msg}`);

    try {
      useErrorStore.getState().addError({
        severity: 'error',
        source: 'session',
        title: 'Runtime submit failed',
        detail: msg,
      });
    } catch {}

    return { ok: false, error: msg };
  }
}, [activeTabId, activeSession, t]);
```

### D1.7 替换 `startSessionWithProject`

把该函数内部 `RuntimeFabricBridge.createCtrlCcSession(...)` 替换为：

```ts
const sessionId = `ses-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const title = cwd.split(/[/\\]/).pop() || projName;

const session: Session = {
  id: sessionId,
  projectId,
  projectName: projName,
  name: title,
  title,
  cwd,
  runtimeMode: 'kernel-persistent',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
} as unknown as Session;

useSessionStore.getState().addSession(session);
useOpenSessionStore.getState().openSession({
  sessionId,
  projectId,
  projectName: projName,
  title,
  cwd,
  viewMode: 'chat',
} as any);

useOpenSessionStore.getState().setActiveTab(sessionId);

RuntimeKernelBridge.startSession({
  guiSessionId: sessionId,
  projectId,
  cwd,
  model: 'sonnet',
  permissionMode: 'default',
  sessionName: title,
}).catch((err) => {
  const msg = String(err);
  setError(`Runtime start failed: ${msg}`);
  useErrorStore.getState().addError({
    severity: 'error',
    source: 'session',
    title: 'Runtime start failed',
    detail: msg,
  });
});
```

注意：这里启动后不自动切 Terminal，不自动调用 stream-json，不自动创建第二条 runtime。

### D1.8 修改 Terminal/Split 点击逻辑

删除：

```ts
RuntimeFabricBridge.startTerminalChannel(activeTabId)
```

替换为：

```ts
if (activeTabId) {
  const existing = useRuntimeKernelStore.getState().sessions[activeTabId];
  if (!existing) {
    RuntimeKernelBridge.startSession({
      guiSessionId: activeTabId,
      projectId: activeSession?.projectId ?? '',
      cwd: activeSession?.cwd ?? '.',
      model: 'sonnet',
      permissionMode: 'default',
      sessionName: activeSession?.name ?? activeSession?.title ?? activeTabId,
    }).catch((e) => setError(`Runtime start failed: ${String(e)}`));
  }
}
```

### D1.9 修改 `handleCloseTab`

替换为：

```ts
const handleCloseTab = useCallback((sessionId: string) => {
  // 默认 detach，不杀后台 runtime。
  RuntimeKernelBridge.detachSession(sessionId).catch(() => {});
  closeTab(sessionId);
}, [closeTab]);
```

后续再做“关闭并终止 Claude”的菜单。当前先严格满足：关闭 tab 不自动退出后台进程。

### D1.10 修改 ChatView/ComposerBar disabledReason

把：

```tsx
disabled={!isComposerEnabled(activeTabId)}
disabledReason={isSetupIncomplete() ? 'setup' : 'runtime'}
onDisabledClick={isSetupIncomplete() ? () => { useSurfaceStore.getState().navigateTo('settings'); } : undefined}
```

替换为：

```tsx
disabled={!isComposerEnabled(activeTabId)}
disabledReason="runtime"
onDisabledClick={() => {
  if (activeTabId) {
    RuntimeKernelBridge.startSession({
      guiSessionId: activeTabId,
      projectId: activeSession?.projectId ?? '',
      cwd: activeSession?.cwd ?? '.',
      model: 'sonnet',
      permissionMode: 'default',
      sessionName: activeSession?.name ?? activeSession?.title ?? activeTabId,
    }).catch((e) => setError(`Runtime start failed: ${String(e)}`));
  }
}}
```

---

# E. 替换 Terminal Hook

## E1. 修改 `src/features/terminal/usePtyTerminal.ts`

### E1.1 删除旧 import

删除：

```ts
import { RuntimeBridge } from '../runtime/services/runtimeBridge';
import { useRuntimeStore } from '../runtime/stores/runtimeStore';
import { isRuntimeWritable } from '../runtime/types/runtimeTypes';
```

### E1.2 新增 import

```ts
import { RuntimeKernelBridge } from '../../runtime-kernel/runtimeKernelBridge';
import { useRuntimeKernelStore } from '../../runtime-kernel/runtimeKernelStore';
```

### E1.3 修改 status 读取

替换：

```ts
const runtimeStatus = useRuntimeStore((s) =>
  sessionId ? s.sessions[sessionId]?.status : undefined
);
const runtimeError = useRuntimeStore((s) =>
  sessionId ? s.sessions[sessionId]?.error : undefined
);
```

为：

```ts
const runtimeStatus = useRuntimeKernelStore((s) =>
  sessionId ? s.sessions[sessionId]?.status : undefined
);
const runtimeError = useRuntimeKernelStore((s) =>
  sessionId ? s.sessions[sessionId]?.lastError : undefined
);
```

### E1.4 修改事件监听

替换：

```ts
listen<PtyDataPayload>('pty://data', ...)
listen<PtyStatusPayload>('pty://status', ...)
listen<PtyExitPayload>('pty://exit', ...)
listen<PtyErrorPayload>('pty://error', ...)
```

为只监听新的 kernel event：

```ts
listen<any>('runtime-kernel://event', (e) => {
  const payload = e.payload;
  if (payload.guiSessionId !== sessionId) return;
  if (payload.eventType === 'pty.data' && payload.data) {
    term.write(payload.data);
  }
  if (payload.status) {
    const map: Record<string, PtyStatus> = {
      starting: 'starting',
      ready: 'running',
      streaming: 'running',
      thinking: 'running',
      idle: 'running',
      exited: 'exited',
      failed: 'failed',
      stopped: 'killed',
    };
    setStatus(map[payload.status] ?? 'running');
  }
}).then((fn) => unlisteners.push(fn));
```

### E1.5 修改 `term.onData`

替换内部：

```ts
const current = useRuntimeStore.getState().sessions[sessionId];
...
RuntimeBridge.write(sessionId, data)
```

为：

```ts
const current = useRuntimeKernelStore.getState().sessions[sessionId];

if (
  deadRef.current ||
  !current ||
  ['failed', 'exited', 'stopped'].includes(String(current.status)) ||
  !current.hasWriter ||
  !current.readerAlive
) {
  const now = Date.now();
  if (now - lastBlockedInputAtRef.current > 3000) {
    lastBlockedInputAtRef.current = now;
    term.writeln(
      `\x1b[33m[Ctrl-CC] Claude Runtime is not writable (${current?.status ?? 'missing'}). Start or recover runtime first.\x1b[0m`
    );
  }
  return;
}

RuntimeKernelBridge.writeTerminal({ guiSessionId: sessionId, data }).catch((e: unknown) => {
  const msg = String(e);
  warnLog('pty', 'RuntimeKernel terminal write failed', msg);
  term.writeln(`\x1b[31m[Ctrl-CC] Write failed: ${msg}\x1b[0m`);
});
```

### E1.6 修改 resize

替换：

```ts
RuntimeBridge.resize(sessionId, dims.cols, dims.rows)
```

为：

```ts
RuntimeKernelBridge.resize(sessionId, dims.cols, dims.rows)
```

### E1.7 修改 write/sendCtrlC/sendCtrlD

替换：

```ts
const write = useCallback((data: string) => {
  if (!sessionId) return;
  const rt = useRuntimeStore.getState().sessions[sessionId];
  if (!rt || !isRuntimeWritable(rt.status)) return;
  RuntimeBridge.write(sessionId, data).catch(...);
}, [sessionId]);

const sendCtrlC = useCallback(() => { RuntimeBridge.ctrlC(sessionId!).catch(...); }, [sessionId]);
const sendCtrlD = useCallback(() => { RuntimeBridge.ctrlD(sessionId!).catch(...); }, [sessionId]);
```

为：

```ts
const write = useCallback((data: string) => {
  if (!sessionId) return;
  RuntimeKernelBridge.writeTerminal({ guiSessionId: sessionId, data })
    .catch((e: unknown) => warnLog('pty', 'RuntimeKernel write failed', String(e)));
}, [sessionId]);

const sendCtrlC = useCallback(() => {
  if (!sessionId) return;
  RuntimeKernelBridge.writeTerminal({ guiSessionId: sessionId, data: '\x03' })
    .catch((e: unknown) => warnLog('pty', 'Ctrl+C failed', String(e)));
}, [sessionId]);

const sendCtrlD = useCallback(() => {
  if (!sessionId) return;
  RuntimeKernelBridge.writeTerminal({ guiSessionId: sessionId, data: '\x04' })
    .catch((e: unknown) => warnLog('pty', 'Ctrl+D failed', String(e)));
}, [sessionId]);
```

---

# F. 修改 TerminalView

## F1. 修改 `src/surfaces/workspace/TerminalView.tsx`

### F1.1 删除旧 runtimeStore import

删除：

```ts
import { useRuntimeStore } from '../../features/runtime/stores/runtimeStore';
```

新增：

```ts
import { useRuntimeKernelStore } from '../../runtime-kernel/runtimeKernelStore';
```

### F1.2 修改 runtimeSession

替换：

```ts
const runtimeSession = useRuntimeStore((s) => (sessionId ? s.sessions[sessionId] : null));
```

为：

```ts
const runtimeSession = useRuntimeKernelStore((s) => (sessionId ? s.sessions[sessionId] : null));
```

### F1.3 修改状态显示

替换：

```tsx
{runtimeSession?.status === 'claude-active' || runtimeSession?.status === 'pty-ready' ? '●' : runtimeFailed ? '×' : '○'} {runtimeSession?.status ?? handle?.status ?? 'idle'}
```

为：

```tsx
{runtimeSession?.hasWriter && runtimeSession?.readerAlive ? '●' : runtimeFailed ? '×' : '○'} {runtimeSession?.status ?? handle?.status ?? 'idle'}
{runtimeSession?.pid ? ` · PID ${runtimeSession.pid}` : ''}
```

### F1.4 修改 runtimeFailed

替换：

```ts
const runtimeFailed = runtimeSession?.status === 'failed' || runtimeSession?.status === 'discovery-failed';
```

为：

```ts
const runtimeFailed = runtimeSession?.status === 'failed' || runtimeSession?.status === 'exited' || runtimeSession?.status === 'stopped';
```

---

# G. ChatView 输出策略

## G1. 当前阶段

ChatView 继续接收 `events` prop，但事件源已经从 `rawEvents + fabricChatEvents` 改成 `runtimeKernelStore.chatEvents[sessionId]`。

要求：

```text
1. 用户消息立即显示。
2. PTY 输出先作为 assistant_message/text block 显示。
3. Terminal 仍然显示完整 raw ANSI 输出。
4. Semantic projection 后续通过 transcript watcher 丰富。
```

## G2. 后续 transcript watcher

新增 `runtime_kernel/transcript_watcher.rs` 的目标：

```text
1. 监听 ~/.claude/projects/<encoded-cwd>/*.jsonl。
2. 根据 cwd 和最新 mtime 找到 active transcript。
3. 增量读取 JSONL。
4. 提取 sessionId、assistant text、tool_use、tool_result、permission、summary。
5. emit runtime-kernel://semantic-event。
```

此模块必须在 RuntimeKernel 稳定后添加，不能阻塞本次主链路。

---

# H. 废弃 RuntimeFabricBridge 主链路

## H1. 修改 `src/features/runtime-fabric/services/runtimeFabricBridge.ts`

在文件顶部加入：

```ts
/**
 * @deprecated v26: Workspace Chat/Terminal must use RuntimeKernelBridge.
 * This bridge is retained only for historical diagnostics and secondary one-shot flows.
 * Do not call sendChatMessage or startTerminalChannel from WorkspaceSurface.
 */
```

## H2. 禁止引用检查

在仓库中搜索：

```bash
grep -R "RuntimeFabricBridge.sendChatMessage" -n src
grep -R "RuntimeFabricBridge.startTerminalChannel" -n src
grep -R "runtime_start_chat_stream" -n src src-tauri/src
```

验收：

```text
WorkspaceSurface 不得出现 RuntimeFabricBridge.sendChatMessage
WorkspaceSurface 不得出现 RuntimeFabricBridge.startTerminalChannel
Workspace 主链路不得调用 runtime_start_chat_stream
```

---

# I. Setup / Diagnostics / Console 统一

## I1. Setup Center

Setup 只负责检测和安装依赖，不负责 Workspace 运行时状态。

必须显示：

```text
Claude CLI installed
Claude CLI version
Chat runtime mode: Persistent PTY
Terminal runtime mode: Same persistent PTY
Selected launch plan
Can start persistent runtime
```

## I2. Diagnostics

Diagnostics 读取：

```ts
RuntimeKernelBridge.listSessions()
useRuntimeKernelStore.sessions
useRuntimeKernelStore.lastEventBySession
```

不要再把 `runtime_v2 list sessions` 作为唯一来源。

## I3. Console 环境卡

Console 卡片显示：

```text
RuntimeKernel: OK / Error
Active Runtime Sessions: N
Claude CLI: version
Selected Runtime: persistent-pty
```

---

# J. 后台进程静默运行

## J1. 所有 `std::process::Command` 都必须 hidden

对以下文件进行统一检查：

```text
src-tauri/src/setup/subprocess_runner.rs
src-tauri/src/runtime_v2/claude_command_resolver.rs
src-tauri/src/runtime_v2/chat_stream.rs
src-tauri/src/runtime/structured_runtime.rs
```

Windows 下所有 `Command::new` 必须使用：

```rust
#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

fn hidden_command(program: &str) -> Command {
    let mut cmd = Command::new(program);
    #[cfg(windows)]
    {
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}
```

portable_pty 启动交互式 CLI 不需要这个，因为它通过 ConPTY/PTY 承载。

---

# K. 删除旧错误显示逻辑

旧错误：

```text
Claude Runtime is not writable (missing)
Session not found
PTY write failed
```

在 v26 后，只有以下情况出现：

```text
1. Runtime session not found：说明 tab metadata 与 kernel session 不一致，必须自动 recover start_session。
2. Runtime not writable：说明进程 exited/failed，必须提供“重新连接/重启/终止”按钮。
3. Spawn failed：说明环境配置问题，跳转 Setup Center。
```

---

# L. 验收脚本

## L1. 编译验收

```bash
npm run typecheck
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

## L2. 静态搜索验收

```bash
grep -R "RuntimeFabricBridge.sendChatMessage" -n src && exit 1 || echo OK
grep -R "RuntimeFabricBridge.startTerminalChannel" -n src && exit 1 || echo OK
grep -R "runtime_start_chat_stream" -n src/surfaces src/features | cat
```

允许 `runtime_start_chat_stream` 仅存在于：

```text
src-tauri/src/runtime_v2/runtime_commands.rs
src-tauri/src/runtime_v2/chat_stream.rs
diagnostics / background task files
```

## L3. 手动功能验收

```text
1. 启动 Ctrl-CC。
2. 新建项目会话。
3. 观察任务管理器，只出现一个 Claude runtime 进程。
4. Chat 发送“你好”。
5. Chat 得到回复。
6. 再发送“我们刚才说了什么？”
7. 回复必须知道上一轮上下文。
8. 切换 Terminal。
9. PID 不变。
10. Terminal 输入 `/status`。
11. Terminal 可写，Chat session 不丢。
12. 切回 Chat。
13. 再发一条消息。
14. PID 仍不变。
15. 关闭 tab。
16. 进程不被自动 kill。
17. 从 Console 最近会话重新打开。
18. 能重新 attach。
19. 点击“终止 Claude”。
20. 进程结束。
```

---

# M. 视觉与交互最终要求

本轮不再大幅重画页面，但必须保证：

```text
1. Chat/Terminal/Split 切换不闪烁。
2. 发送消息后用户气泡立即出现。
3. 后台 Runtime 状态显示在右侧 Inspector：
   - PID
   - CWD
   - status
   - writerAlive
   - readerAlive
   - startedAt
   - lastEvent
4. Terminal 连接状态显示：
   - ● connected
   - PID
   - cwd
5. 关闭 tab 时不杀进程。
6. 终止 Runtime 要红色危险按钮。
```

---

# N. 最终架构验收定义

本次完成后，Ctrl-CC 的运行逻辑必须变成：

```text
GUI Project
  -> GUI Session
       -> RuntimeKernel Session
            -> One persistent Claude CLI process
                 -> Chat projection
                 -> Terminal raw view
                 -> Inspector diagnostics
                 -> AI Dock attach
```

不允许回到：

```text
GUI Chat
  -> each message spawn `claude -p`
```

---

# O. 提交信息

```bash
git checkout -b v26-persistent-runtime-kernel

git add src-tauri/src/runtime_kernel src-tauri/src/main.rs
git commit -m "feat(runtime): add persistent runtime kernel"

git add src/runtime-kernel
git commit -m "feat(runtime): add frontend runtime kernel bridge and store"

git add src/surfaces/workspace src/features/terminal
git commit -m "refactor(workspace): route chat and terminal through persistent runtime kernel"

git add src/features/runtime-fabric
git commit -m "chore(runtime): deprecate fabric bridge as workspace runtime"

npm run typecheck
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

---

# P. 最重要的一句话

```text
Ctrl-CC 的 Workspace Chat 不再是“向 Claude 发一次请求”的 UI；
它必须是“同一个 Claude CLI 进程的聊天投影层”。
```

只有这样，才能实现：

```text
100%：Claude CLI 真实能力完整保留
200%：Chat/Terminal/Inspector/Dock 全同步
500%：商业级流畅体验、连续上下文、可诊断、可恢复、可扩展
```
