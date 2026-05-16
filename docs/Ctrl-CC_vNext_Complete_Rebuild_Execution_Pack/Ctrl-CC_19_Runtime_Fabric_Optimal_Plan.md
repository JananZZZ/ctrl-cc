# Ctrl-CC 19.0 最优商用级 Runtime Fabric 执行方案

适用仓库：

```text
https://github.com/JananZZZ/ctrl-cc/tree/master
```

建议分支：

```bash
git checkout master
git pull origin master
git checkout -b feat/runtime-fabric-commercial-19
```

本方案是最终架构方案，不再继续局部修补 `PTY / npx / stream-json / UI` 的单点问题。目标是把 Ctrl-CC 升级为：

```text
真实 Claude CLI 操作 + 结构化 GUI 增强 + 后台任务控制 + 全页面信息同步
```

最终产品形态：

```text
100%：Terminal 内一模一样操作真实 Claude CLI。
200%：Chat / Project / Console / Resource / Diagnostics 获得结构化增强。
500%：统一 Runtime Kernel、Event Ledger、独立 AI Dock、自动诊断、失败隔离、可恢复。
```

---

# 0. 架构原则

## 0.1 一个 Claude 进程不能同时满足所有需求

不要再试图让一个 PTY 同时承担：

```text
1. 完整 Claude CLI TUI 交互
2. 气泡聊天
3. 工具调用卡片
4. token / cost / file changes 结构化统计
5. 后台任务
6. AI Dock 状态同步
```

最终架构必须是：

```text
Ctrl-CC Session
├── Chat Channel         # claude -p --output-format stream-json，服务气泡聊天
├── Terminal Channel     # claude interactive PTY，服务完整 CLI
├── Background Channel   # claude --bg / logs / attach / stop，服务后台任务
└── Event Ledger         # 全页面唯一事实来源
```

## 0.2 真实 CLI 必须使用 native `claude.exe`

当前 `direct-node-npx-*` canary 能通过 `--version`，但进入 interactive PTY 后 `node.exe 0xc0000142` 或直接退出。  
因此：

```text
npx plan 禁止用于 interactive PTY。
cmd/powershell wrapper 禁止作为默认 PTY。
native claude.exe 是唯一推荐 interactive runtime。
```

如果本机没有 native `claude.exe`，Ctrl-CC 必须明确提示用户安装或修复，不得继续猜测。

---

# 1. Phase A：新增 Runtime Fabric 类型系统

## A1. 新建文件

```text
src/features/runtime-fabric/types/runtimeFabricTypes.ts
```

写入：

```ts
export type CtrlCcSessionId = string;
export type RuntimeChannelId = string;
export type EventLedgerId = string;
export type ClaudeSessionId = string;

export type RuntimeChannelKind = 'chat' | 'terminal' | 'background';

export type RuntimeChannelStatus =
  | 'idle'
  | 'starting'
  | 'ready'
  | 'running'
  | 'waiting-permission'
  | 'stopping'
  | 'stopped'
  | 'exited'
  | 'failed';

export interface CtrlCcSession {
  id: CtrlCcSessionId;
  projectId: string;
  projectName: string;
  cwd: string;
  title: string;

  activeView: 'chat' | 'terminal' | 'split' | 'background';
  claudeSessionId: ClaudeSessionId | null;

  chatChannelId: RuntimeChannelId | null;
  terminalChannelId: RuntimeChannelId | null;
  backgroundChannelId: RuntimeChannelId | null;
  ledgerId: EventLedgerId;

  status: RuntimeChannelStatus;
  error: string | null;

  createdAt: string;
  updatedAt: string;
}

export interface RuntimeChannel {
  id: RuntimeChannelId;
  sessionId: CtrlCcSessionId;
  kind: RuntimeChannelKind;
  status: RuntimeChannelStatus;

  cwd: string;
  pid: number | null;
  program: string | null;
  args: string[];
  error: string | null;

  startedAt: string | null;
  exitedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type LedgerEventLevel = 'debug' | 'info' | 'warning' | 'error';

export type LedgerEventType =
  | 'session.created'
  | 'session.view.changed'
  | 'chat.request'
  | 'chat.delta'
  | 'chat.message'
  | 'chat.tool'
  | 'chat.done'
  | 'chat.failed'
  | 'terminal.start.request'
  | 'terminal.ready'
  | 'terminal.data'
  | 'terminal.exit'
  | 'terminal.failed'
  | 'background.start'
  | 'background.logs'
  | 'background.attach'
  | 'background.stop'
  | 'permission.request'
  | 'permission.result'
  | 'file.changed'
  | 'git.status'
  | 'runtime.discovery'
  | 'runtime.diagnostics';

export interface LedgerEvent {
  id: string;
  ts: string;
  sessionId: CtrlCcSessionId;
  channelId: RuntimeChannelId | null;
  level: LedgerEventLevel;
  type: LedgerEventType;
  message: string;
  payload?: unknown;
}

export interface ClaudeNativeCandidate {
  path: string;
  source: string;
  exists: boolean;
  executable: boolean;
  versionOk: boolean;
  versionText: string | null;
  printOk: boolean;
  interactiveAllowed: boolean;
  error: string | null;
}
```

---

# 2. Phase B：新增 Runtime Fabric Store 与 Event Ledger

## B1. 新建文件

```text
src/features/runtime-fabric/stores/runtimeFabricStore.ts
```

写入：

```ts
import { create } from 'zustand';
import type {
  CtrlCcSession,
  CtrlCcSessionId,
  RuntimeChannel,
  RuntimeChannelId,
  LedgerEvent,
} from '../types/runtimeFabricTypes';

interface RuntimeFabricState {
  sessions: Record<CtrlCcSessionId, CtrlCcSession>;
  channels: Record<RuntimeChannelId, RuntimeChannel>;
  ledger: LedgerEvent[];

  addSession: (session: CtrlCcSession) => void;
  patchSession: (id: CtrlCcSessionId, patch: Partial<CtrlCcSession>) => void;

  addChannel: (channel: RuntimeChannel) => void;
  patchChannel: (id: RuntimeChannelId, patch: Partial<RuntimeChannel>) => void;

  appendEvent: (event: Omit<LedgerEvent, 'id' | 'ts'> & { id?: string; ts?: string }) => void;
  getSessionEvents: (sessionId: CtrlCcSessionId) => LedgerEvent[];
}

export const useRuntimeFabricStore = create<RuntimeFabricState>((set, get) => ({
  sessions: {},
  channels: {},
  ledger: [],

  addSession: (session) => {
    set((state) => ({ sessions: { ...state.sessions, [session.id]: session } }));
  },

  patchSession: (id, patch) => {
    set((state) => {
      const prev = state.sessions[id];
      if (!prev) return state;
      return {
        sessions: {
          ...state.sessions,
          [id]: { ...prev, ...patch, updatedAt: new Date().toISOString() },
        },
      };
    });
  },

  addChannel: (channel) => {
    set((state) => ({ channels: { ...state.channels, [channel.id]: channel } }));
  },

  patchChannel: (id, patch) => {
    set((state) => {
      const prev = state.channels[id];
      if (!prev) return state;
      return {
        channels: {
          ...state.channels,
          [id]: { ...prev, ...patch, updatedAt: new Date().toISOString() },
        },
      };
    });
  },

  appendEvent: (event) => {
    const full: LedgerEvent = {
      ...event,
      id: event.id ?? crypto.randomUUID(),
      ts: event.ts ?? new Date().toISOString(),
    };
    set((state) => ({ ledger: [full, ...state.ledger].slice(0, 2000) }));
  },

  getSessionEvents: (sessionId) => {
    return get().ledger.filter((e) => e.sessionId === sessionId);
  },
}));
```

---

# 3. Phase C：重构 Claude Discovery，禁止 npx 作为 PTY Runtime

## C1. Rust 后端新增 native discovery

新建文件：

```text
src-tauri/src/runtime_v2/native_claude_discovery.rs
```

写入：

```rust
use std::env;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeNativeCandidate {
    pub path: String,
    pub source: String,
    pub exists: bool,
    pub executable: bool,
    pub version_ok: bool,
    pub version_text: Option<String>,
    pub print_ok: bool,
    pub interactive_allowed: bool,
    pub error: Option<String>,
}

pub fn discover_native_claude_candidates() -> Vec<ClaudeNativeCandidate> {
    let mut paths: Vec<(PathBuf, String)> = Vec::new();

    if let Ok(p) = env::var("CTRL_CC_CLAUDE_BIN") {
        paths.push((PathBuf::from(p), "CTRL_CC_CLAUDE_BIN".to_string()));
    }

    if let Ok(user_profile) = env::var("USERPROFILE") {
        paths.push((
            PathBuf::from(user_profile).join(r".local\bin\claude.exe"),
            "native installer: %USERPROFILE%\.local\bin\claude.exe".to_string(),
        ));
    }

    if let Ok(appdata) = env::var("APPDATA") {
        let root = PathBuf::from(appdata).join("npm").join("node_modules");
        collect_native_claude_exes(&root, &mut paths);
    }

    if let Some(path_env) = env::var_os("PATH") {
        for dir in env::split_paths(&path_env) {
            for name in ["claude.exe", "claude"] {
                let p = dir.join(name);
                if p.exists() {
                    paths.push((p, "PATH".to_string()));
                }
            }
        }
    }

    dedupe(paths)
        .into_iter()
        .map(|(path, source)| inspect_candidate(&path, &source))
        .collect()
}

pub fn select_native_claude_for_interactive() -> Result<PathBuf, String> {
    let candidates = discover_native_claude_candidates();

    for c in &candidates {
        if c.exists && c.executable && c.version_ok && c.interactive_allowed {
            return Ok(PathBuf::from(&c.path));
        }
    }

    Err(format!(
        "No native Claude executable is available for interactive PTY. Install native Claude Code, or set CTRL_CC_CLAUDE_BIN to claude.exe. Candidates:\n{}",
        candidates
            .iter()
            .map(|c| format!(
                "- {} | exists={} versionOk={} interactiveAllowed={} error={}",
                c.path,
                c.exists,
                c.version_ok,
                c.interactive_allowed,
                c.error.clone().unwrap_or_default()
            ))
            .collect::<Vec<_>>()
            .join("\n")
    ))
}

pub fn select_claude_for_print_mode() -> Result<PathBuf, String> {
    select_native_claude_for_interactive()
}

fn collect_native_claude_exes(root: &Path, out: &mut Vec<(PathBuf, String)>) {
    if !root.exists() {
        return;
    }

    let mut stack = vec![root.to_path_buf()];
    let mut visited = 0usize;

    while let Some(dir) = stack.pop() {
        visited += 1;
        if visited > 5000 {
            break;
        }

        let entries = match std::fs::read_dir(&dir) {
            Ok(v) => v,
            Err(_) => continue,
        };

        for entry in entries.flatten() {
            let path = entry.path();
            let name = path.file_name().and_then(|v| v.to_str()).unwrap_or("").to_ascii_lowercase();

            if path.is_dir() {
                if name.contains("claude") || name.contains("anthropic") || name.starts_with("@") {
                    stack.push(path);
                }
                continue;
            }

            if name == "claude.exe" {
                out.push((path, "npm optional native dependency scan".to_string()));
            }
        }
    }
}

fn inspect_candidate(path: &Path, source: &str) -> ClaudeNativeCandidate {
    let exists = path.exists();
    let executable = exists && path.extension().and_then(|v| v.to_str()).map(|v| v.eq_ignore_ascii_case("exe")).unwrap_or(true);

    if !exists {
        return ClaudeNativeCandidate {
            path: path.to_string_lossy().to_string(),
            source: source.to_string(),
            exists,
            executable: false,
            version_ok: false,
            version_text: None,
            print_ok: false,
            interactive_allowed: false,
            error: Some("path does not exist".to_string()),
        };
    }

    if is_shell_or_node_wrapper(path) {
        return ClaudeNativeCandidate {
            path: path.to_string_lossy().to_string(),
            source: source.to_string(),
            exists,
            executable,
            version_ok: false,
            version_text: None,
            print_ok: false,
            interactive_allowed: false,
            error: Some("rejected: shell/node/npx wrapper is not allowed for native interactive runtime".to_string()),
        };
    }

    let version = Command::new(path)
        .arg("--version")
        .stdin(Stdio::null())
        .output();

    match version {
        Ok(output) if output.status.success() => ClaudeNativeCandidate {
            path: path.to_string_lossy().to_string(),
            source: source.to_string(),
            exists,
            executable,
            version_ok: true,
            version_text: Some(String::from_utf8_lossy(&output.stdout).trim().to_string()),
            print_ok: false,
            interactive_allowed: true,
            error: None,
        },
        Ok(output) => ClaudeNativeCandidate {
            path: path.to_string_lossy().to_string(),
            source: source.to_string(),
            exists,
            executable,
            version_ok: false,
            version_text: None,
            print_ok: false,
            interactive_allowed: false,
            error: Some(String::from_utf8_lossy(&output.stderr).trim().to_string()),
        },
        Err(e) => ClaudeNativeCandidate {
            path: path.to_string_lossy().to_string(),
            source: source.to_string(),
            exists,
            executable,
            version_ok: false,
            version_text: None,
            print_ok: false,
            interactive_allowed: false,
            error: Some(e.to_string()),
        },
    }
}

fn is_shell_or_node_wrapper(path: &Path) -> bool {
    let s = path.to_string_lossy().to_ascii_lowercase();
    s.ends_with(".cmd")
        || s.ends_with(".bat")
        || s.ends_with(".ps1")
        || s.ends_with("node.exe")
        || s.ends_with("npx.cmd")
        || s.ends_with("npx.exe")
}

fn dedupe(paths: Vec<(PathBuf, String)>) -> Vec<(PathBuf, String)> {
    let mut seen = std::collections::HashSet::new();
    let mut out = Vec::new();

    for (p, source) in paths {
        let key = p.to_string_lossy().to_ascii_lowercase();
        if seen.insert(key) {
            out.push((p, source));
        }
    }

    out
}
```

## C2. 修改 `src-tauri/src/runtime_v2/mod.rs`

增加：

```rust
pub mod native_claude_discovery;
```

## C3. 修改 `runtime_commands.rs`

增加：

```rust
use super::native_claude_discovery::{discover_native_claude_candidates, ClaudeNativeCandidate};

#[tauri::command]
pub fn runtime_discover_native_claude() -> Vec<ClaudeNativeCandidate> {
    discover_native_claude_candidates()
}
```

## C4. 修改 `main.rs`

注册：

```rust
runtime_v2::runtime_commands::runtime_discover_native_claude,
```

---

# 4. Phase D：Terminal Channel 只使用 native claude.exe

## D1. 修改 `src-tauri/src/runtime_v2/runtime_manager.rs`

找到当前选择 launch plan 的逻辑。不要再使用：

```rust
select_launch_plan()
```

改为：

```rust
use super::native_claude_discovery::select_native_claude_for_interactive;
```

在 `start_interactive()` 中：

```rust
let claude_bin = select_native_claude_for_interactive()?;
let program = claude_bin.to_string_lossy().to_string();
let args = build_interactive_args(&req);
```

新增：

```rust
fn build_interactive_args(req: &RuntimeStartInteractiveRequest) -> Vec<String> {
    let mut args = Vec::new();

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

    if req.mode == "resume" {
        args.push("--resume".into());
        if let Some(target) = &req.resume_target {
            args.push(target.clone());
        }
    }

    if req.mode == "continue" {
        args.push("--continue".into());
    }

    if let Some(initial) = &req.initial_prompt {
        if !initial.trim().is_empty() {
            args.push(initial.clone());
        }
    }

    args
}
```

删除或停用旧 `build_claude_args()` 对 npx / model alias 的处理。

---

# 5. Phase E：新增 Chat Channel，使用 stream-json

## E1. 新增 Rust 类型

修改：

```text
src-tauri/src/runtime_v2/runtime_types.rs
```

新增：

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatStreamRequest {
    pub trace_id: String,
    pub session_id: String,
    pub channel_id: String,
    pub cwd: String,
    pub prompt: String,
    pub claude_session_id: Option<String>,
    pub model: Option<String>,
    pub permission_mode: Option<String>,
    pub max_turns: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatStreamStarted {
    pub trace_id: String,
    pub session_id: String,
    pub channel_id: String,
    pub pid: Option<u32>,
}
```

## E2. 新建 Rust 文件

```text
src-tauri/src/runtime_v2/chat_stream.rs
```

写入：

```rust
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};

use tauri::{AppHandle, Emitter};

use super::native_claude_discovery::select_claude_for_print_mode;
use super::runtime_types::{ChatStreamRequest, ChatStreamStarted};

pub fn start_chat_stream(app: AppHandle, req: ChatStreamRequest) -> Result<ChatStreamStarted, String> {
    if req.prompt.trim().is_empty() {
        return Err("prompt is empty".to_string());
    }

    let claude = select_claude_for_print_mode()?;

    let mut args = vec![
        "-p".to_string(),
        req.prompt.clone(),
        "--output-format".to_string(),
        "stream-json".to_string(),
        "--include-partial-messages".to_string(),
        "--verbose".to_string(),
    ];

    if let Some(id) = &req.claude_session_id {
        if !id.trim().is_empty() {
            args.push("--session-id".to_string());
            args.push(id.clone());
        }
    }

    if let Some(model) = &req.model {
        if !model.trim().is_empty() && model != "default" {
            args.push("--model".to_string());
            args.push(model.clone());
        }
    }

    if let Some(permission) = &req.permission_mode {
        if !permission.trim().is_empty() && permission != "default" {
            args.push("--permission-mode".to_string());
            args.push(permission.clone());
        }
    }

    if let Some(max_turns) = req.max_turns {
        args.push("--max-turns".to_string());
        args.push(max_turns.to_string());
    }

    let mut child = Command::new(&claude)
        .args(&args)
        .current_dir(&req.cwd)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
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
```

## E3. 修改 mod.rs

```rust
pub mod chat_stream;
```

## E4. 修改 runtime_commands.rs

增加：

```rust
use super::chat_stream::start_chat_stream;
use super::runtime_types::{ChatStreamRequest, ChatStreamStarted};

#[tauri::command]
pub fn runtime_start_chat_stream(
    app: tauri::AppHandle,
    req: ChatStreamRequest,
) -> Result<ChatStreamStarted, String> {
    start_chat_stream(app, req)
}
```

## E5. 修改 main.rs

注册：

```rust
runtime_v2::runtime_commands::runtime_start_chat_stream,
```

---

# 6. Phase F：前端 Runtime Fabric Bridge

## F1. 新建文件

```text
src/features/runtime-fabric/services/runtimeFabricBridge.ts
```

写入：

```ts
import { invokeCommand } from '../../../services/invokeCommand';
import { useRuntimeFabricStore } from '../stores/runtimeFabricStore';
import type { CtrlCcSession, RuntimeChannel } from '../types/runtimeFabricTypes';
import { useOpenSessionStore } from '../../../stores/openSessionStore';
import { useSurfaceStore } from '../../../stores/surfaceStore';
import { useSessionStore } from '../../../stores/sessionStore';

function now() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export interface CreateSessionInput {
  projectId: string;
  projectName: string;
  cwd: string;
  title?: string;
}

export function createCtrlCcSession(input: CreateSessionInput): CtrlCcSession {
  const ts = now();
  const session: CtrlCcSession = {
    id: id('ses'),
    projectId: input.projectId,
    projectName: input.projectName,
    cwd: input.cwd,
    title: input.title ?? `${input.projectName}-${ts.slice(0, 16).replace(/[:T]/g, '-')}`,
    activeView: 'chat',
    claudeSessionId: crypto.randomUUID(),
    chatChannelId: null,
    terminalChannelId: null,
    backgroundChannelId: null,
    ledgerId: id('ledger'),
    status: 'idle',
    error: null,
    createdAt: ts,
    updatedAt: ts,
  };

  useRuntimeFabricStore.getState().addSession(session);
  useRuntimeFabricStore.getState().appendEvent({
    sessionId: session.id,
    channelId: null,
    level: 'info',
    type: 'session.created',
    message: 'Ctrl-CC session created',
    payload: { cwd: session.cwd, projectId: session.projectId },
  });

  useSessionStore.getState().addSession({
    id: session.id,
    projectId: session.projectId,
    title: session.title,
    runtimeMode: 'fabric',
    status: 'starting',
    model: 'sonnet',
    permissionMode: 'default' as const,
    cwd: session.cwd,
    inputTokens: 0,
    outputTokens: 0,
    totalCostUsd: 0,
    fileChangeCount: 0,
    riskCount: 0,
    auditCount: 0,
    isPinned: false,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    startedAt: session.createdAt,
  } as any);

  useOpenSessionStore.getState().openSession({
    sessionId: session.id,
    projectId: session.projectId,
    projectName: session.projectName,
    title: session.title,
    status: 'starting',
    viewMode: 'chat',
    pendingConfirms: 0,
    riskCount: 0,
    isPinned: false,
  });

  useSurfaceStore.getState().navigateTo('workspace');
  return session;
}

export async function sendChatMessage(sessionId: string, prompt: string) {
  const state = useRuntimeFabricStore.getState();
  const session = state.sessions[sessionId];
  if (!session) throw new Error(`session not found: ${sessionId}`);

  const channel: RuntimeChannel = {
    id: id('chat'),
    sessionId,
    kind: 'chat',
    status: 'starting',
    cwd: session.cwd,
    pid: null,
    program: null,
    args: [],
    error: null,
    startedAt: now(),
    exitedAt: null,
    createdAt: now(),
    updatedAt: now(),
  };

  state.addChannel(channel);
  state.patchSession(sessionId, { chatChannelId: channel.id, status: 'running', activeView: 'chat' });
  state.appendEvent({
    sessionId,
    channelId: channel.id,
    level: 'info',
    type: 'chat.request',
    message: prompt,
  });

  const started = await invokeCommand<{ pid?: number }>('runtime_start_chat_stream', {
    req: {
      traceId: id('trace'),
      sessionId,
      channelId: channel.id,
      cwd: session.cwd,
      prompt,
      claudeSessionId: session.claudeSessionId,
      model: 'sonnet',
      permissionMode: 'default',
      maxTurns: null,
    },
  });

  useRuntimeFabricStore.getState().patchChannel(channel.id, {
    status: 'running',
    pid: started.pid ?? null,
  });
}

export async function startTerminalChannel(sessionId: string) {
  const session = useRuntimeFabricStore.getState().sessions[sessionId];
  if (!session) throw new Error(`session not found: ${sessionId}`);

  const channel: RuntimeChannel = {
    id: id('pty'),
    sessionId,
    kind: 'terminal',
    status: 'starting',
    cwd: session.cwd,
    pid: null,
    program: null,
    args: [],
    error: null,
    startedAt: now(),
    exitedAt: null,
    createdAt: now(),
    updatedAt: now(),
  };

  useRuntimeFabricStore.getState().addChannel(channel);
  useRuntimeFabricStore.getState().patchSession(sessionId, {
    terminalChannelId: channel.id,
    activeView: 'terminal',
  });

  await invokeCommand('runtime_start_interactive_v2', {
    req: {
      traceId: id('trace'),
      uiSessionId: sessionId,
      ptySessionId: channel.id,
      projectId: session.projectId,
      cwd: session.cwd,
      model: null,
      permissionMode: 'default',
      mode: 'new',
      sessionName: session.title,
      resumeTarget: null,
      initialPrompt: null,
    },
  });

  useRuntimeFabricStore.getState().patchChannel(channel.id, { status: 'ready' });
}

export const RuntimeFabricBridge = {
  createCtrlCcSession,
  sendChatMessage,
  startTerminalChannel,
};
```

---

# 7. Phase G：Workspace 绑定 Runtime Fabric

## G1. 修改新建会话入口

所有项目区 / Console / Workspace 的 “新建 Claude 会话” 都必须调用：

```ts
RuntimeFabricBridge.createCtrlCcSession({
  projectId,
  projectName,
  cwd,
});
```

不要再调用：

```ts
RuntimeBridge.startInteractiveSession
RuntimeBridge.startInteractiveClaudeSession
```

保留 `RuntimeBridge` 只给 legacy terminal 使用，直到迁移完成。

## G2. Chat 输入调用

Chat send handler 改为：

```ts
await RuntimeFabricBridge.sendChatMessage(activeSessionId, text);
```

不要调用：

```ts
RuntimeBridge.write(activeSessionId, text)
```

## G3. Terminal tab 懒启动

用户点击 Terminal tab 时：

```ts
const fabric = useRuntimeFabricStore.getState().sessions[sessionId];
if (!fabric?.terminalChannelId) {
  await RuntimeFabricBridge.startTerminalChannel(sessionId);
}
```

Terminal 失败只显示 Terminal 面板错误，不允许影响 Chat Channel。

---

# 8. Phase H：安装 Runtime Fabric 事件监听器

## H1. 新建文件

```text
src/features/runtime-fabric/services/runtimeFabricEventBridge.ts
```

写入：

```ts
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { useRuntimeFabricStore } from '../stores/runtimeFabricStore';

interface ChatStreamPayload {
  traceId: string;
  sessionId: string;
  channelId: string;
  line: string;
}

interface ChatExitPayload {
  traceId: string;
  sessionId: string;
  channelId: string;
  code: number | null;
}

export async function installRuntimeFabricEventBridge(): Promise<() => void> {
  const unlisten: UnlistenFn[] = [];

  unlisten.push(await listen<ChatStreamPayload>('runtime://chat-stream', (event) => {
    const p = event.payload;

    let parsed: unknown = null;
    try {
      parsed = JSON.parse(p.line);
    } catch {
      parsed = { raw: p.line };
    }

    useRuntimeFabricStore.getState().appendEvent({
      sessionId: p.sessionId,
      channelId: p.channelId,
      level: 'info',
      type: 'chat.delta',
      message: p.line,
      payload: parsed,
    });
  }));

  unlisten.push(await listen<ChatStreamPayload>('runtime://chat-stderr', (event) => {
    const p = event.payload;
    useRuntimeFabricStore.getState().appendEvent({
      sessionId: p.sessionId,
      channelId: p.channelId,
      level: 'warning',
      type: 'chat.failed',
      message: p.line,
    });
  }));

  unlisten.push(await listen<ChatExitPayload>('runtime://chat-exit', (event) => {
    const p = event.payload;
    useRuntimeFabricStore.getState().patchChannel(p.channelId, {
      status: p.code === 0 ? 'stopped' : 'failed',
      exitedAt: new Date().toISOString(),
    });
    useRuntimeFabricStore.getState().patchSession(p.sessionId, {
      status: p.code === 0 ? 'idle' : 'failed',
      error: p.code === 0 ? null : `chat exited with code ${p.code}`,
    });
    useRuntimeFabricStore.getState().appendEvent({
      sessionId: p.sessionId,
      channelId: p.channelId,
      level: p.code === 0 ? 'info' : 'error',
      type: p.code === 0 ? 'chat.done' : 'chat.failed',
      message: `chat exited with code ${p.code}`,
    });
  }));

  return () => unlisten.forEach((fn) => fn());
}
```

## H2. 修改 App.tsx

导入：

```ts
import { installRuntimeFabricEventBridge } from '../features/runtime-fabric/services/runtimeFabricEventBridge';
```

在 App 初始化 effect 中安装：

```ts
useEffect(() => {
  let cleanup: undefined | (() => void);
  installRuntimeFabricEventBridge()
    .then((fn) => { cleanup = fn; })
    .catch((err) => console.error('[Ctrl-CC] RuntimeFabricEventBridge failed', err));
  return () => cleanup?.();
}, []);
```

---

# 9. Phase I：Diagnostics 重构

## I1. Diagnostics 不再只看 PTY

新增 Diagnostics 分区：

```text
Runtime Fabric
- Ctrl-CC Sessions
- Channels by kind
- Native Claude Candidates
- Legacy PTY Registry
- Event Ledger
```

## I2. 当前 Launch Plan Matrix 改名

把旧标题：

```text
Launch Plan Matrix
```

改为：

```text
Legacy Launch Plan Matrix
```

新增：

```text
Native Claude Executable Candidates
```

显示 `runtime_discover_native_claude` 的结果。

## I3. Contract status 判定

新规则：

```text
如果 Chat Channel 正常：Chat OK
如果 Terminal Channel 未启动：Terminal Not Started，不算失败
如果 Terminal Channel failed：Terminal Failed，不影响 Chat
如果无 native claude.exe：Runtime Setup Required
```

不要再把 `PTY exited` 直接等同于整个 session 失败。

---

# 10. Phase J：UI 重整原则

## J1. Console

Console 显示：

```text
Runtime Health
- Chat Channel
- Terminal Channel
- Background Channel
- Native Claude
- Permissions
```

不要再把 `Claude CLI authenticated` 与 `PTY ready` 混在一起。

## J2. Projects

项目区 `New Claude Session`：

```text
默认创建 CtrlCcSession
默认打开 Workspace / Chat
不自动启动 PTY
```

## J3. Workspace

Workspace 三个视图：

```text
Chat      # default
Terminal  # click to start exact Claude CLI
Split     # Chat left + Terminal/Event monitor right
```

顶部 status 应显示：

```text
Chat: ready/running/failed
Terminal: not started/ready/exited
Native Claude: ok/missing
```

## J4. Resources

Resources 不直接调用 runtime。只能通过：

```text
Insert into Chat
Attach to Session Context
Add to Project Rules
```

## J5. AI Dock

AI Dock 读取 Runtime Fabric Store，不直接操作 PTY。

---

# 11. Phase K：强制删除错误交互

全仓库搜索：

```bash
rg "RuntimeBridge.write|startInteractiveClaudeSession|startInteractiveSession" src
```

除 legacy terminal adapter 外，普通 Chat / Projects / Console 不得调用这些 API。

必须改为：

```ts
RuntimeFabricBridge.createCtrlCcSession
RuntimeFabricBridge.sendChatMessage
RuntimeFabricBridge.startTerminalChannel
```

---

# 12. 验收流程

## 12.1 安装层验收

Windows PowerShell 执行：

```powershell
where.exe claude
claude --version
claude doctor
```

如果没有 native `claude.exe`，安装：

```powershell
winget install Anthropic.ClaudeCode
```

或：

```powershell
irm https://claude.ai/install.ps1 | iex
```

然后确认：

```powershell
Test-Path "$env:USERPROFILE\.localin\claude.exe"
```

必要时：

```powershell
setx CTRL_CC_CLAUDE_BIN "$env:USERPROFILE\.localin\claude.exe"
```

重启 Ctrl-CC。

## 12.2 功能验收

```text
[ ] New Claude Session 不启动 PTY，不弹 node.exe / powershell.exe / cmd.exe 错误。
[ ] Workspace 默认进入 Chat。
[ ] Chat 发送消息后调用 runtime_start_chat_stream。
[ ] Chat 能收到 runtime://chat-stream 事件。
[ ] 点击 Terminal 后才启动 runtime_start_interactive_v2。
[ ] Terminal 使用 native claude.exe，不使用 npx/cmd/powershell。
[ ] Terminal 失败不影响 Chat。
[ ] Diagnostics 能看到 Native Claude Candidates。
[ ] Runtime Fabric Ledger 能看到 chat.request/chat.delta/chat.done。
[ ] Project / Console / Workspace / Dock 读同一 Runtime Fabric Store。
```

## 12.3 构建验收

```bash
npm run typecheck
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

---

# 13. 回滚策略

如果 `Runtime Fabric` 接入过程中出问题：

```text
1. 保留旧 RuntimeBridge 文件。
2. Surface 层先切到 RuntimeFabricBridge。
3. Terminal Legacy 使用旧 runtime_start_interactive_v2。
4. Chat 必须用 runtime_start_chat_stream，不回退到 PTY write。
```

禁止回滚到：

```text
新建会话自动启动 PTY
Chat 输入写 PTY stdin
npx 作为 interactive PTY plan
powershell/cmd wrapper 默认 selected
```

---

# 14. 给 Claude CLI / Codex 的严格执行 Prompt

```text
执行 Ctrl-CC 19.0 Runtime Fabric 商用级重构。严格按 plan.md 顺序执行，不允许自由重构，不允许继续把 Chat 建在 PTY 上。

最高优先级原则：
- Ctrl-CC 不再使用单一 Claude Runtime。
- Chat、Terminal、Background 是三个 Runtime Channel。
- 所有 Channel 绑定同一个 CtrlCcSession。
- 所有状态写入 Event Ledger。
- 所有页面只读 Runtime Fabric Store。
- 新建 Claude 会话默认 Chat，不自动启动 PTY。
- Terminal 才启动真实 interactive Claude CLI。
- npx/cmd/powershell 不允许作为 interactive PTY runtime。
- interactive PTY 必须使用 native claude.exe。
- Chat 使用 claude -p --output-format stream-json。

必须完成：
1. 新增 runtime-fabric 类型、store、bridge、event bridge。
2. Rust 后端新增 native_claude_discovery.rs。
3. runtime_manager.rs 改为只用 native claude.exe 启动 Terminal PTY。
4. Rust 后端新增 chat_stream.rs，提供 runtime_start_chat_stream。
5. main.rs 注册 runtime_discover_native_claude 和 runtime_start_chat_stream。
6. Workspace / Projects / Console 的 New Session 全部改 RuntimeFabricBridge.createCtrlCcSession。
7. Chat send handler 改 RuntimeFabricBridge.sendChatMessage。
8. Terminal tab 点击时懒启动 RuntimeFabricBridge.startTerminalChannel。
9. Diagnostics 增加 Native Claude Candidates 和 Runtime Fabric Ledger。
10. 删除普通 Chat 对 RuntimeBridge.write 的依赖。
11. UI 状态区明确分离 Chat / Terminal / Background。
12. 运行 npm run typecheck、npm run build、cargo check。

验收：
- New Session 不再弹 node.exe 0xc0000142。
- New Session 不自动启动 PTY。
- Chat 可以独立运行。
- Terminal 可以一模一样操作 Claude CLI。
- Terminal 失败不影响 Chat。
- 所有页面读同一 Runtime Fabric Store。
```
