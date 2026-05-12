# Ctrl-CC Projects × Workspace × Chat × Claude Code CLI 一体化执行方案

> **可直接发送给 Claude Code CLI 执行。**  
> 本方案修正当前 Projects Surface 设计中最严重的问题：项目管理界面不能只是“项目/会话的展示页”，它必须成为 **Claude Code Runtime 的入口、Workspace/Chat 的路由中枢、Session 生命周期管理中心、Resources/GitHub/Console 的上下文连接器**。  
> 本次任务不修改最左侧 AppRail 图标，不处理最右侧悬浮 AI Dock。  
> 本次必须把 **项目管理、Workspace、Chat、Claude Code CLI 真实 PTY Runtime** 全部打通。

---

## 0. 总体结论

当前 Projects Surface 最大的问题不是视觉，而是架构连接断裂：

```text
Projects 页面只显示项目和会话
Workspace 页面才运行 Claude
Chat 页面可能另起逻辑
Claude CLI Runtime 又是另一个孤立模块
```

这会导致：

```text
1. 项目页点击“新建会话”无法稳定启动真实 Claude CLI。
2. Chat 输入框可能不写入当前真实 PTY，而是变成假聊天。
3. Workspace 不知道这个会话属于哪个 Project。
4. SessionCard 不知道自己对应哪个 PTY 进程、哪个 Claude transcript、哪个 workspace tab。
5. Console / Resources / GitHub 无法围绕同一个 ProjectContext 联动。
```

本方案强制改为：

```text
ProjectContext 是全局上下文
ClaudeSession 是 Projects / Workspace / Chat / Monitor 共用实体
PTY Runtime 是 interactive Claude Code 的唯一事实来源
Chat Composer 在 PTY 模式下只写入当前 PTY stdin
Structured Runtime 单独使用 claude -p / stream-json，不与 PTY 会话混淆
Projects Surface 是所有运行时入口和管理中心
```

---

## 1. 固定单路径架构

不要再做多方案选择。本项目固定采用：

```text
Tauri 2
React + TypeScript
Rust backend
portable-pty
xterm.js
Zustand or existing store
CSS variables for four themes
```

Claude Code CLI 连接方式固定为两条 Runtime：

```text
A. Interactive PTY Runtime
   用途：真实 Claude Code 交互、Workspace Terminal、Chat Composer 写入 stdin、权限提示、slash command。
   命令：claude / claude --continue / claude --resume <session> / claude -n <name>

B. Structured Runtime
   用途：批处理、自动化检查、结构化输出、轻量问答、可视化卡片。
   命令：claude -p --output-format stream-json --include-partial-messages --include-hook-events
```

禁止：

```text
1. 禁止用普通 spawn stdout/stderr 承载 interactive Claude。
2. 禁止 Chat Composer 私自启动 claude -p 来冒充当前会话。
3. 禁止 Project 页面直接模拟 Claude Chat。
4. 禁止用假数据伪装 Claude / Git / Session 状态。
5. 禁止在 P0 未完成前做 Console / Dock / Theme 的大规模新功能。
```

---

## 2. 核心实体关系

### 2.1 全局关系

```text
Project
  └── ClaudeSession
        ├── PtySession          interactive runtime
        ├── WorkspaceTab        workspace UI tab
        ├── ChatTranscript      user-visible semantic mirror
        ├── RuntimeEvents       status / pty / process / file / git / hooks
        ├── AuditLog
        └── RiskItems
```

### 2.2 ProjectContext 必须贯穿所有界面

```ts
export interface ProjectContext {
  projectId: string;
  projectName: string;
  projectPath: string;
  git?: GitStatusSnapshot;
  claude?: ClaudeCapabilitySnapshot;
}
```

所有页面跳转必须带 ProjectContext：

```text
Projects -> Workspace:     projectId + sessionId
Projects -> Resources:     projectId + resourceScope
Projects -> GitHub:        projectId + repoUrl / branch / pr
Projects -> Console:       projectId + metricFilter
Workspace -> Projects:     projectId
Workspace -> Resources:    projectId + sessionId
```

---

## 3. Claude Code CLI 官方能力映射

Ctrl-CC 必须只调用官方 CLI 能力。

### 3.1 Interactive 会话命令

```text
claude
  启动当前 cwd 的交互式 Claude Code 会话。

claude "query"
  启动交互式会话，并带初始 prompt。

claude -n "session-name"
claude --name "session-name"
  启动并命名会话。

claude --continue
claude -c
  在当前项目目录继续最近会话。

claude --resume "<session-id-or-name>"
claude -r "<session-id-or-name>"
  按 session id 或 name 恢复会话。

claude --resume "<session-id-or-name>" --fork-session
  从已有会话分支出新会话。
```

### 3.2 Structured 命令

```text
claude -p "query" --output-format stream-json --include-partial-messages --include-hook-events
```

Structured Runtime 不属于 interactive Workspace Terminal。它只能创建 structured task session，不能假装是当前 PTY Chat。

### 3.3 Slash commands

在 PTY Runtime 中，slash command 必须通过 PTY stdin 输入，例如：

```text
/doctor
/cost
/resume
/permissions
/mcp
/init
/compact
/clear
/model
```

项目页可以提供按钮，但按钮本质必须是：

```text
打开 Workspace + 写入 PTY stdin
```

或：

```text
打开 Workspace + 预填 Chat Composer
```

---

## 4. 新的 Projects Surface 职责

Projects Surface 不再是静态项目列表，而是：

```text
1. 项目选择中心
2. Claude CLI Runtime 启动入口
3. 会话生命周期管理中心
4. Workspace 路由中心
5. Chat 真实会话入口
6. Resources / GitHub / Console 上下文连接器
7. 风险、Git、权限、审计摘要入口
```

页面仍然保持：

```text
优雅
美观
温和
友好
高度可视化
现代卡片化
信息瀑布流
四主题兼容
```

但每一个卡片和按钮必须连接真实功能。

---

## 5. 文件结构

请按以下结构重构或新增文件。如果项目已有同名功能，优先迁移而不是复制重复逻辑。

```text
src/
├── features/
│   ├── projects/
│   │   ├── pages/
│   │   │   └── ProjectsSurface.tsx
│   │   ├── components/
│   │   │   ├── ProjectNavigator.tsx
│   │   │   ├── ProjectCanvas.tsx
│   │   │   ├── ProjectHeroCard.tsx
│   │   │   ├── ProjectSignalDeck.tsx
│   │   │   ├── ProjectActionRibbon.tsx
│   │   │   ├── SessionWaterfall.tsx
│   │   │   ├── SessionCard.tsx
│   │   │   ├── IntegrationsWaterfall.tsx
│   │   │   ├── ProjectInspectorDrawer.tsx
│   │   │   └── ProjectEmptyState.tsx
│   │   ├── services/
│   │   │   ├── projectRuntimeActions.ts
│   │   │   └── projectNavigationActions.ts
│   │   ├── stores/
│   │   │   └── projectsStore.ts
│   │   ├── types/
│   │   │   └── projectTypes.ts
│   │   └── styles/
│   │       └── projects.css
│   ├── workspace/
│   │   ├── pages/
│   │   │   └── WorkspaceSurface.tsx
│   │   ├── components/
│   │   │   ├── WorkspaceTabs.tsx
│   │   │   ├── TerminalView.tsx
│   │   │   ├── ChatComposer.tsx
│   │   │   └── ChatSemanticMirror.tsx
│   │   ├── services/
│   │   │   └── workspaceRuntimeActions.ts
│   │   └── stores/
│   │       └── workspaceStore.ts
│   ├── runtime/
│   │   ├── services/
│   │   │   ├── claudeRuntimeService.ts
│   │   │   ├── runtimeEvents.ts
│   │   │   └── structuredRuntimeService.ts
│   │   ├── stores/
│   │   │   └── runtimeStore.ts
│   │   └── types/
│   │       └── runtimeTypes.ts
│   ├── resources/
│   │   └── services/
│   │       └── resourceNavigationActions.ts
│   └── github/
│       └── services/
│           └── githubNavigationActions.ts
└── src-tauri/
    ├── src/
    │   ├── commands/
    │   │   ├── claude_discovery.rs
    │   │   ├── pty_runtime.rs
    │   │   ├── git_snapshot.rs
    │   │   └── project_runtime.rs
    │   ├── runtime/
    │   │   ├── pty_manager.rs
    │   │   └── process_guard.rs
    │   └── main.rs
    └── Cargo.toml
```

---

## 6. TypeScript 类型

创建：

```text
src/features/projects/types/projectTypes.ts
```

代码：

```ts
export type ProjectStatus =
  | "ready"
  | "running"
  | "needs-attention"
  | "missing-path"
  | "archived"
  | "error";

export type SessionStatus =
  | "starting"
  | "ready"
  | "thinking"
  | "streaming"
  | "tool-running"
  | "waiting-permission"
  | "editing-files"
  | "running-tests"
  | "idle"
  | "stopped"
  | "failed"
  | "orphaned"
  | "archived";

export type ClaudeRuntimeMode = "pty" | "structured";

export interface Project {
  id: string;
  name: string;
  path: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
}

export interface ClaudeCapabilitySnapshot {
  executablePath?: string | null;
  version?: string | null;
  status: "ready" | "not-found" | "auth-required" | "pty-failed" | "unknown";
  lastCheckedAt?: string | null;
  errorMessage?: string | null;
}

export interface GitStatusSnapshot {
  isRepo: boolean;
  branch?: string;
  dirty: boolean;
  changedFiles: number;
  stagedFiles: number;
  untrackedFiles: number;
  ahead?: number;
  behind?: number;
  remoteUrl?: string | null;
  lastCheckedAt?: string | null;
  errorMessage?: string | null;
}

export interface ProjectRuntimeSnapshot {
  projectId: string;
  claude: ClaudeCapabilitySnapshot;
  git: GitStatusSnapshot;
  sessionSummary: SessionSummarySnapshot;
  riskSummary: RiskSummarySnapshot;
  lastScannedAt: string;
}

export interface SessionSummarySnapshot {
  total: number;
  active: number;
  waitingPermission: number;
  failed: number;
  archived: number;
}

export interface RiskSummarySnapshot {
  total: number;
  low: number;
  medium: number;
  high: number;
  critical: number;
}

export interface ClaudeSession {
  id: string;
  projectId: string;
  name: string;
  status: SessionStatus;
  runtimeMode: ClaudeRuntimeMode;
  cwd: string;
  command: string;
  args: string[];
  pid?: number | null;
  ptySessionId?: string | null;
  claudeSessionId?: string | null;
  claudeSessionName?: string | null;
  transcriptPath?: string | null;
  model?: string | null;
  startedAt: string;
  updatedAt: string;
  stoppedAt?: string | null;
  tokenInput?: number | null;
  tokenOutput?: number | null;
  estimatedCostUsd?: number | null;
  changedFiles: number;
  riskCount: number;
  waitingPermissionCount: number;
}

export type ProjectOpenTarget =
  | { type: "workspace"; projectId: string; sessionId: string }
  | { type: "resources"; projectId: string; resourceScope?: "claude-md" | "settings" | "mcp" | "agents" | "hooks" }
  | { type: "github"; projectId: string; target?: "repo" | "issues" | "prs" | "actions" }
  | { type: "console"; projectId: string; tab?: "overview" | "sessions" | "tokens" | "risks" }
  | { type: "diagnostics"; projectId: string };
```

---

## 7. Runtime 事件类型

创建：

```text
src/features/runtime/types/runtimeTypes.ts
```

代码：

```ts
export type RuntimeEvent =
  | PtyOutputEvent
  | PtyExitEvent
  | SessionStatusChangedEvent
  | GitSnapshotEvent
  | ClaudeDiscoveryEvent
  | WorkspaceRouteEvent
  | RuntimeErrorEvent;

export interface PtyOutputEvent {
  type: "pty.output";
  sessionId: string;
  projectId: string;
  chunk: string;
  ts: string;
}

export interface PtyExitEvent {
  type: "pty.exit";
  sessionId: string;
  projectId: string;
  code?: number | null;
  ts: string;
}

export interface SessionStatusChangedEvent {
  type: "session.status.changed";
  sessionId: string;
  projectId: string;
  status: string;
  ts: string;
}

export interface GitSnapshotEvent {
  type: "git.snapshot";
  projectId: string;
  snapshot: unknown;
  ts: string;
}

export interface ClaudeDiscoveryEvent {
  type: "claude.discovery";
  snapshot: unknown;
  ts: string;
}

export interface WorkspaceRouteEvent {
  type: "workspace.route";
  projectId: string;
  sessionId: string;
  ts: string;
}

export interface RuntimeErrorEvent {
  type: "runtime.error";
  projectId?: string;
  sessionId?: string;
  message: string;
  detail?: string;
  ts: string;
}
```

---

## 8. Rust 后端依赖

修改：

```text
src-tauri/Cargo.toml
```

加入：

```toml
[dependencies]
tauri = { version = "2", features = [] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
portable-pty = "0.8"
once_cell = "1.19"
uuid = { version = "1", features = ["v4", "serde"] }
which = "6"
parking_lot = "0.12"
chrono = { version = "0.4", features = ["serde"] }
```

如果当前项目已经有这些依赖，不要重复添加，保持版本兼容。

---

## 9. Rust：Claude CLI 发现

创建：

```text
src-tauri/src/commands/claude_discovery.rs
```

代码：

```rust
use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeCapabilitySnapshot {
    pub executable_path: Option<String>,
    pub version: Option<String>,
    pub status: String,
    pub last_checked_at: String,
    pub error_message: Option<String>,
}

fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339()
}

#[tauri::command]
pub fn discover_claude() -> ClaudeCapabilitySnapshot {
    let resolved = which::which("claude");

    match resolved {
        Ok(path) => {
            let version_output = Command::new(&path).arg("--version").output();

            match version_output {
                Ok(output) => {
                    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

                    if output.status.success() {
                        ClaudeCapabilitySnapshot {
                            executable_path: Some(path.to_string_lossy().to_string()),
                            version: if stdout.is_empty() { None } else { Some(stdout) },
                            status: "ready".to_string(),
                            last_checked_at: now_iso(),
                            error_message: None,
                        }
                    } else {
                        ClaudeCapabilitySnapshot {
                            executable_path: Some(path.to_string_lossy().to_string()),
                            version: None,
                            status: "auth-required".to_string(),
                            last_checked_at: now_iso(),
                            error_message: Some(if stderr.is_empty() { "claude --version failed".to_string() } else { stderr }),
                        }
                    }
                }
                Err(err) => ClaudeCapabilitySnapshot {
                    executable_path: Some(path.to_string_lossy().to_string()),
                    version: None,
                    status: "unknown".to_string(),
                    last_checked_at: now_iso(),
                    error_message: Some(err.to_string()),
                },
            }
        }
        Err(err) => ClaudeCapabilitySnapshot {
            executable_path: None,
            version: None,
            status: "not-found".to_string(),
            last_checked_at: now_iso(),
            error_message: Some(err.to_string()),
        },
    }
}
```

---

## 10. Rust：Git Snapshot

创建：

```text
src-tauri/src/commands/git_snapshot.rs
```

代码：

```rust
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitStatusSnapshot {
    pub is_repo: bool,
    pub branch: Option<String>,
    pub dirty: bool,
    pub changed_files: usize,
    pub staged_files: usize,
    pub untracked_files: usize,
    pub ahead: Option<i32>,
    pub behind: Option<i32>,
    pub remote_url: Option<String>,
    pub last_checked_at: String,
    pub error_message: Option<String>,
}

fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339()
}

fn run_git(cwd: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(cwd)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

#[tauri::command]
pub fn git_snapshot(cwd: String) -> GitStatusSnapshot {
    if !Path::new(&cwd).exists() {
        return GitStatusSnapshot {
            is_repo: false,
            branch: None,
            dirty: false,
            changed_files: 0,
            staged_files: 0,
            untracked_files: 0,
            ahead: None,
            behind: None,
            remote_url: None,
            last_checked_at: now_iso(),
            error_message: Some("Project path does not exist".to_string()),
        };
    }

    if run_git(&cwd, &["rev-parse", "--is-inside-work-tree"]).is_err() {
        return GitStatusSnapshot {
            is_repo: false,
            branch: None,
            dirty: false,
            changed_files: 0,
            staged_files: 0,
            untracked_files: 0,
            ahead: None,
            behind: None,
            remote_url: None,
            last_checked_at: now_iso(),
            error_message: Some("Not a git repository".to_string()),
        };
    }

    let branch = run_git(&cwd, &["branch", "--show-current"]).ok().filter(|s| !s.is_empty());
    let status = run_git(&cwd, &["status", "--porcelain=v1"]).unwrap_or_default();

    let mut changed_files = 0usize;
    let mut staged_files = 0usize;
    let mut untracked_files = 0usize;

    for line in status.lines() {
        if line.trim().is_empty() {
            continue;
        }
        changed_files += 1;
        if line.starts_with("??") {
            untracked_files += 1;
        } else if !line.chars().next().unwrap_or(' ').is_whitespace() {
            staged_files += 1;
        }
    }

    let remote_url = run_git(&cwd, &["remote", "get-url", "origin"]).ok();

    GitStatusSnapshot {
        is_repo: true,
        branch,
        dirty: changed_files > 0,
        changed_files,
        staged_files,
        untracked_files,
        ahead: None,
        behind: None,
        remote_url,
        last_checked_at: now_iso(),
        error_message: None,
    }
}
```

---

## 11. Rust：PTY Manager

创建：

```text
src-tauri/src/runtime/pty_manager.rs
```

代码：

```rust
use parking_lot::Mutex;
use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PtyStartRequest {
    pub session_id: String,
    pub project_id: String,
    pub cwd: String,
    pub command: String,
    pub args: Vec<String>,
    pub cols: u16,
    pub rows: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PtyOutputPayload {
    pub session_id: String,
    pub project_id: String,
    pub chunk: String,
    pub ts: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PtyExitPayload {
    pub session_id: String,
    pub project_id: String,
    pub code: Option<i32>,
    pub ts: String,
}

fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339()
}

pub struct PtySessionHandle {
    pub project_id: String,
    pub session_id: String,
    pub writer: Box<dyn Write + Send>,
    pub child: Box<dyn portable_pty::Child + Send + Sync>,
    pub master: Box<dyn portable_pty::MasterPty + Send>,
}

#[derive(Clone)]
pub struct PtyManager {
    sessions: Arc<Mutex<HashMap<String, PtySessionHandle>>>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn start(&self, app: AppHandle, req: PtyStartRequest) -> Result<(), String> {
        if self.sessions.lock().contains_key(&req.session_id) {
            return Err(format!("PTY session already exists: {}", req.session_id));
        }

        let pty_system = NativePtySystem::default();
        let pair = pty_system
            .openpty(PtySize {
                rows: req.rows,
                cols: req.cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())?;

        let mut cmd = CommandBuilder::new(&req.command);
        cmd.cwd(&req.cwd);
        for arg in &req.args {
            cmd.arg(arg);
        }

        let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
        drop(pair.slave);

        let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
        let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

        let session_id = req.session_id.clone();
        let project_id = req.project_id.clone();
        let app_for_thread = app.clone();

        std::thread::spawn(move || {
            let mut buf = [0u8; 8192];

            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        let chunk = String::from_utf8_lossy(&buf[..n]).to_string();
                        let payload = PtyOutputPayload {
                            session_id: session_id.clone(),
                            project_id: project_id.clone(),
                            chunk,
                            ts: now_iso(),
                        };
                        let _ = app_for_thread.emit("pty.output", payload);
                    }
                    Err(_) => break,
                }
            }

            let payload = PtyExitPayload {
                session_id,
                project_id,
                code: None,
                ts: now_iso(),
            };
            let _ = app_for_thread.emit("pty.exit", payload);
        });

        self.sessions.lock().insert(
            req.session_id.clone(),
            PtySessionHandle {
                project_id: req.project_id,
                session_id: req.session_id,
                writer,
                child,
                master: pair.master,
            },
        );

        Ok(())
    }

    pub fn write(&self, session_id: &str, data: &str) -> Result<(), String> {
        let mut sessions = self.sessions.lock();
        let handle = sessions
            .get_mut(session_id)
            .ok_or_else(|| format!("PTY session not found: {}", session_id))?;

        handle.writer.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
        handle.writer.flush().map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn resize(&self, session_id: &str, cols: u16, rows: u16) -> Result<(), String> {
        let mut sessions = self.sessions.lock();
        let handle = sessions
            .get_mut(session_id)
            .ok_or_else(|| format!("PTY session not found: {}", session_id))?;

        handle
            .master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())
    }

    pub fn kill(&self, session_id: &str) -> Result<(), String> {
        let mut sessions = self.sessions.lock();
        let mut handle = sessions
            .remove(session_id)
            .ok_or_else(|| format!("PTY session not found: {}", session_id))?;

        handle.child.kill().map_err(|e| e.to_string())?;
        Ok(())
    }
}
```

---

## 12. Rust：Tauri PTY Commands

创建：

```text
src-tauri/src/commands/pty_runtime.rs
```

代码：

```rust
use crate::runtime::pty_manager::{PtyManager, PtyStartRequest};
use tauri::{AppHandle, State};

#[tauri::command]
pub fn pty_start_claude(
    app: AppHandle,
    manager: State<PtyManager>,
    request: PtyStartRequest,
) -> Result<(), String> {
    manager.start(app, request)
}

#[tauri::command]
pub fn pty_write(
    manager: State<PtyManager>,
    session_id: String,
    data: String,
) -> Result<(), String> {
    manager.write(&session_id, &data)
}

#[tauri::command]
pub fn pty_resize(
    manager: State<PtyManager>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    manager.resize(&session_id, cols, rows)
}

#[tauri::command]
pub fn pty_kill(
    manager: State<PtyManager>,
    session_id: String,
) -> Result<(), String> {
    manager.kill(&session_id)
}
```

---

## 13. Rust：main.rs 注册

修改：

```text
src-tauri/src/main.rs
```

确保包含：

```rust
mod commands {
    pub mod claude_discovery;
    pub mod git_snapshot;
    pub mod pty_runtime;
}

mod runtime {
    pub mod pty_manager;
}

use commands::claude_discovery::discover_claude;
use commands::git_snapshot::git_snapshot;
use commands::pty_runtime::{pty_kill, pty_resize, pty_start_claude, pty_write};
use runtime::pty_manager::PtyManager;

fn main() {
    tauri::Builder::default()
        .manage(PtyManager::new())
        .invoke_handler(tauri::generate_handler![
            discover_claude,
            git_snapshot,
            pty_start_claude,
            pty_write,
            pty_resize,
            pty_kill
        ])
        .run(tauri::generate_context!())
        .expect("error while running Ctrl-CC");
}
```

如果当前 main.rs 已有 invoke_handler，合并进去，不要覆盖已有命令。

---

## 14. 前端 Runtime Service

创建：

```text
src/features/runtime/services/claudeRuntimeService.ts
```

代码：

```ts
import { invoke } from "@tauri-apps/api/core";
import { nanoid } from "nanoid";
import type { ClaudeSession, Project } from "../../projects/types/projectTypes";

export interface StartClaudeSessionOptions {
  project: Project;
  sessionName?: string;
  initialPrompt?: string;
  mode: "new" | "continue" | "resume" | "fork";
  resumeTarget?: string;
}

export async function discoverClaude() {
  return invoke("discover_claude");
}

export async function startInteractiveClaudeSession(
  options: StartClaudeSessionOptions
): Promise<ClaudeSession> {
  const sessionId = `session_${nanoid(12)}`;
  const ptySessionId = `pty_${nanoid(12)}`;

  const sessionName =
    options.sessionName?.trim() ||
    `${options.project.name}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}`;

  const args = buildClaudeInteractiveArgs(options, sessionName);

  const session: ClaudeSession = {
    id: sessionId,
    projectId: options.project.id,
    name: sessionName,
    status: "starting",
    runtimeMode: "pty",
    cwd: options.project.path,
    command: "claude",
    args,
    pid: null,
    ptySessionId,
    claudeSessionId: options.resumeTarget || null,
    claudeSessionName: sessionName,
    transcriptPath: null,
    model: null,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    stoppedAt: null,
    tokenInput: null,
    tokenOutput: null,
    estimatedCostUsd: null,
    changedFiles: 0,
    riskCount: 0,
    waitingPermissionCount: 0,
  };

  await invoke("pty_start_claude", {
    request: {
      sessionId: ptySessionId,
      projectId: options.project.id,
      cwd: options.project.path,
      command: "claude",
      args,
      cols: 120,
      rows: 32,
    },
  });

  if (options.initialPrompt?.trim()) {
    await invoke("pty_write", {
      sessionId: ptySessionId,
      data: `${options.initialPrompt.trim()}\r`,
    });
  }

  return {
    ...session,
    status: "ready",
    updatedAt: new Date().toISOString(),
  };
}

function buildClaudeInteractiveArgs(options: StartClaudeSessionOptions, sessionName: string): string[] {
  if (options.mode === "continue") {
    return ["--continue"];
  }

  if (options.mode === "resume") {
    if (!options.resumeTarget) {
      throw new Error("resumeTarget is required for resume mode");
    }
    return ["--resume", options.resumeTarget];
  }

  if (options.mode === "fork") {
    if (!options.resumeTarget) {
      throw new Error("resumeTarget is required for fork mode");
    }
    return ["--resume", options.resumeTarget, "--fork-session", "--name", sessionName];
  }

  return ["--name", sessionName];
}

export async function writeToPty(ptySessionId: string, data: string) {
  return invoke("pty_write", {
    sessionId: ptySessionId,
    data,
  });
}

export async function killPty(ptySessionId: string) {
  return invoke("pty_kill", {
    sessionId: ptySessionId,
  });
}

export async function resizePty(ptySessionId: string, cols: number, rows: number) {
  return invoke("pty_resize", {
    sessionId: ptySessionId,
    cols,
    rows,
  });
}
```

安装依赖：

```bash
npm install nanoid
```

如果项目已有 uuid/nanoid 生成器，复用已有工具。

---

## 15. Runtime Event Bridge

创建：

```text
src/features/runtime/services/runtimeEvents.ts
```

代码：

```ts
import { listen } from "@tauri-apps/api/event";
import type { RuntimeEvent } from "../types/runtimeTypes";
import { useRuntimeStore } from "../stores/runtimeStore";
import { useProjectsStore } from "../../projects/stores/projectsStore";
import { useWorkspaceStore } from "../../workspace/stores/workspaceStore";

export async function installRuntimeEventBridge() {
  const unlistenOutput = await listen("pty.output", (event) => {
    const payload = event.payload as any;

    useRuntimeStore.getState().appendPtyOutput({
      type: "pty.output",
      sessionId: payload.sessionId,
      projectId: payload.projectId,
      chunk: payload.chunk,
      ts: payload.ts,
    } satisfies RuntimeEvent as any);

    useWorkspaceStore.getState().appendTerminalChunk(payload.sessionId, payload.chunk);
    useProjectsStore.getState().touchSessionByPtyId(payload.sessionId);
  });

  const unlistenExit = await listen("pty.exit", (event) => {
    const payload = event.payload as any;

    useRuntimeStore.getState().markPtyExited(payload.sessionId, payload.code ?? null);
    useWorkspaceStore.getState().markTerminalExited(payload.sessionId);
    useProjectsStore.getState().markSessionStoppedByPtyId(payload.sessionId);
  });

  return () => {
    unlistenOutput();
    unlistenExit();
  };
}
```

在 App 启动时安装：

```ts
useEffect(() => {
  let cleanup: undefined | (() => void);

  installRuntimeEventBridge().then((fn) => {
    cleanup = fn;
  });

  return () => cleanup?.();
}, []);
```

---

## 16. Projects Store

创建或修改：

```text
src/features/projects/stores/projectsStore.ts
```

核心代码：

```ts
import { create } from "zustand";
import type {
  ClaudeSession,
  Project,
  ProjectRuntimeSnapshot,
} from "../types/projectTypes";

interface ProjectsState {
  projects: Project[];
  selectedProjectId: string | null;
  sessions: ClaudeSession[];
  runtimeSnapshots: Record<string, ProjectRuntimeSnapshot>;

  selectProject: (projectId: string) => void;
  addSession: (session: ClaudeSession) => void;
  updateSession: (sessionId: string, patch: Partial<ClaudeSession>) => void;
  touchSessionByPtyId: (ptySessionId: string) => void;
  markSessionStoppedByPtyId: (ptySessionId: string) => void;
  setRuntimeSnapshot: (projectId: string, snapshot: ProjectRuntimeSnapshot) => void;
}

export const useProjectsStore = create<ProjectsState>((set, get) => ({
  projects: [],
  selectedProjectId: null,
  sessions: [],
  runtimeSnapshots: {},

  selectProject: (projectId) => set({ selectedProjectId: projectId }),

  addSession: (session) =>
    set((state) => ({
      sessions: [session, ...state.sessions],
    })),

  updateSession: (sessionId, patch) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId ? { ...s, ...patch, updatedAt: new Date().toISOString() } : s
      ),
    })),

  touchSessionByPtyId: (ptySessionId) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.ptySessionId === ptySessionId
          ? { ...s, status: s.status === "starting" ? "ready" : s.status, updatedAt: new Date().toISOString() }
          : s
      ),
    })),

  markSessionStoppedByPtyId: (ptySessionId) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.ptySessionId === ptySessionId
          ? { ...s, status: "stopped", stoppedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
          : s
      ),
    })),

  setRuntimeSnapshot: (projectId, snapshot) =>
    set((state) => ({
      runtimeSnapshots: {
        ...state.runtimeSnapshots,
        [projectId]: snapshot,
      },
    })),
}));
```

如果当前项目已有持久化数据库层，后续把 `addSession/updateSession` 接入数据库。P0 先保证运行态打通。

---

## 17. Workspace Store

创建或修改：

```text
src/features/workspace/stores/workspaceStore.ts
```

核心代码：

```ts
import { create } from "zustand";

export interface WorkspaceTab {
  id: string;
  projectId: string;
  sessionId: string;
  ptySessionId: string;
  title: string;
  active: boolean;
  terminalBuffer: string;
  exited: boolean;
}

interface WorkspaceState {
  tabs: WorkspaceTab[];
  activeSessionId: string | null;

  openSessionTab: (tab: Omit<WorkspaceTab, "active" | "terminalBuffer" | "exited">) => void;
  focusSession: (sessionId: string) => void;
  appendTerminalChunk: (ptySessionId: string, chunk: string) => void;
  markTerminalExited: (ptySessionId: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  tabs: [],
  activeSessionId: null,

  openSessionTab: (tab) =>
    set((state) => {
      const existing = state.tabs.find((t) => t.sessionId === tab.sessionId);
      const tabs = existing
        ? state.tabs.map((t) => ({ ...t, active: t.sessionId === tab.sessionId }))
        : [
            ...state.tabs.map((t) => ({ ...t, active: false })),
            {
              ...tab,
              active: true,
              terminalBuffer: "",
              exited: false,
            },
          ];

      return {
        tabs,
        activeSessionId: tab.sessionId,
      };
    }),

  focusSession: (sessionId) =>
    set((state) => ({
      tabs: state.tabs.map((t) => ({ ...t, active: t.sessionId === sessionId })),
      activeSessionId: sessionId,
    })),

  appendTerminalChunk: (ptySessionId, chunk) =>
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.ptySessionId === ptySessionId
          ? { ...t, terminalBuffer: t.terminalBuffer + chunk }
          : t
      ),
    })),

  markTerminalExited: (ptySessionId) =>
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.ptySessionId === ptySessionId ? { ...t, exited: true } : t
      ),
    })),
}));
```

---

## 18. Project Runtime Actions

创建：

```text
src/features/projects/services/projectRuntimeActions.ts
```

代码：

```ts
import type { Project, ClaudeSession } from "../types/projectTypes";
import { useProjectsStore } from "../stores/projectsStore";
import { useWorkspaceStore } from "../../workspace/stores/workspaceStore";
import {
  discoverClaude,
  startInteractiveClaudeSession,
  killPty,
} from "../../runtime/services/claudeRuntimeService";
import { navigateToWorkspaceSession } from "./projectNavigationActions";

export async function startNewClaudeSessionFromProject(project: Project, initialPrompt?: string) {
  const claude = await discoverClaude() as any;

  if (claude.status !== "ready") {
    throw new Error(`Claude Runtime is not ready: ${claude.status}${claude.errorMessage ? ` - ${claude.errorMessage}` : ""}`);
  }

  const session = await startInteractiveClaudeSession({
    project,
    mode: "new",
    initialPrompt,
  });

  registerSessionAndOpenWorkspace(project, session);
  return session;
}

export async function continueProjectClaudeSession(project: Project) {
  const claude = await discoverClaude() as any;

  if (claude.status !== "ready") {
    throw new Error(`Claude Runtime is not ready: ${claude.status}${claude.errorMessage ? ` - ${claude.errorMessage}` : ""}`);
  }

  const session = await startInteractiveClaudeSession({
    project,
    mode: "continue",
  });

  registerSessionAndOpenWorkspace(project, session);
  return session;
}

export async function resumeClaudeSessionFromProject(project: Project, resumeTarget: string) {
  const claude = await discoverClaude() as any;

  if (claude.status !== "ready") {
    throw new Error(`Claude Runtime is not ready: ${claude.status}${claude.errorMessage ? ` - ${claude.errorMessage}` : ""}`);
  }

  const session = await startInteractiveClaudeSession({
    project,
    mode: "resume",
    resumeTarget,
  });

  registerSessionAndOpenWorkspace(project, session);
  return session;
}

export async function forkClaudeSessionFromProject(project: Project, resumeTarget: string) {
  const claude = await discoverClaude() as any;

  if (claude.status !== "ready") {
    throw new Error(`Claude Runtime is not ready: ${claude.status}${claude.errorMessage ? ` - ${claude.errorMessage}` : ""}`);
  }

  const session = await startInteractiveClaudeSession({
    project,
    mode: "fork",
    resumeTarget,
  });

  registerSessionAndOpenWorkspace(project, session);
  return session;
}

export function openExistingSessionInWorkspace(session: ClaudeSession) {
  if (!session.ptySessionId) {
    throw new Error("This session has no active PTY. Use resume instead.");
  }

  useWorkspaceStore.getState().openSessionTab({
    id: `tab_${session.id}`,
    projectId: session.projectId,
    sessionId: session.id,
    ptySessionId: session.ptySessionId,
    title: session.name,
  });

  navigateToWorkspaceSession(session.projectId, session.id);
}

export async function stopClaudeSession(session: ClaudeSession) {
  if (!session.ptySessionId) {
    return;
  }

  await killPty(session.ptySessionId);
  useProjectsStore.getState().updateSession(session.id, {
    status: "stopped",
    stoppedAt: new Date().toISOString(),
  });
}

function registerSessionAndOpenWorkspace(project: Project, session: ClaudeSession) {
  useProjectsStore.getState().addSession(session);

  if (!session.ptySessionId) {
    throw new Error("Started session without PTY id");
  }

  useWorkspaceStore.getState().openSessionTab({
    id: `tab_${session.id}`,
    projectId: project.id,
    sessionId: session.id,
    ptySessionId: session.ptySessionId,
    title: session.name,
  });

  navigateToWorkspaceSession(project.id, session.id);
}
```

---

## 19. Navigation Actions

创建：

```text
src/features/projects/services/projectNavigationActions.ts
```

代码按你们当前路由库适配。下面给出标准实现。如果当前使用 react-router，直接使用 navigate；如果当前是自定义路由，把这些函数映射到现有导航 API。

```ts
export function navigateToWorkspaceSession(projectId: string, sessionId: string) {
  window.dispatchEvent(
    new CustomEvent("ctrlcc:navigate", {
      detail: {
        surface: "workspace",
        projectId,
        sessionId,
      },
    })
  );
}

export function navigateToProjectResources(projectId: string, scope?: string) {
  window.dispatchEvent(
    new CustomEvent("ctrlcc:navigate", {
      detail: {
        surface: "resources",
        projectId,
        scope,
      },
    })
  );
}

export function navigateToProjectGithub(projectId: string, target?: string) {
  window.dispatchEvent(
    new CustomEvent("ctrlcc:navigate", {
      detail: {
        surface: "github",
        projectId,
        target,
      },
    })
  );
}

export function navigateToProjectConsole(projectId: string, tab?: string) {
  window.dispatchEvent(
    new CustomEvent("ctrlcc:navigate", {
      detail: {
        surface: "console",
        projectId,
        tab,
      },
    })
  );
}

export function navigateToProjectDiagnostics(projectId: string) {
  window.dispatchEvent(
    new CustomEvent("ctrlcc:navigate", {
      detail: {
        surface: "diagnostics",
        projectId,
      },
    })
  );
}
```

在 App Shell 中监听：

```ts
useEffect(() => {
  const handler = (event: Event) => {
    const detail = (event as CustomEvent).detail;

    // Replace with your router.
    // Examples:
    // navigate(`/workspace?projectId=${detail.projectId}&sessionId=${detail.sessionId}`)
    // navigate(`/resources?projectId=${detail.projectId}&scope=${detail.scope}`)
  };

  window.addEventListener("ctrlcc:navigate", handler);
  return () => window.removeEventListener("ctrlcc:navigate", handler);
}, []);
```

---

## 20. Workspace TerminalView

创建或修改：

```text
src/features/workspace/components/TerminalView.tsx
```

代码：

```tsx
import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { resizePty, writeToPty } from "../../runtime/services/claudeRuntimeService";
import { useWorkspaceStore } from "../stores/workspaceStore";

interface TerminalViewProps {
  sessionId: string;
}

export function TerminalView({ sessionId }: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const lastBufferLengthRef = useRef(0);

  const tab = useWorkspaceStore((s) => s.tabs.find((t) => t.sessionId === sessionId));

  useEffect(() => {
    if (!containerRef.current || !tab?.ptySessionId) return;

    const terminal = new Terminal({
      cursorBlink: true,
      convertEol: true,
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
      fontSize: 13,
      rows: 32,
      cols: 120,
      scrollback: 10000,
      theme: {
        background: "transparent",
      },
    });

    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(containerRef.current);
    fit.fit();
    terminal.focus();

    terminal.onData((data) => {
      writeToPty(tab.ptySessionId, data);
    });

    const resizeObserver = new ResizeObserver(() => {
      fit.fit();
      resizePty(tab.ptySessionId, terminal.cols, terminal.rows);
    });

    resizeObserver.observe(containerRef.current);

    terminalRef.current = terminal;
    fitRef.current = fit;

    return () => {
      resizeObserver.disconnect();
      terminal.dispose();
      terminalRef.current = null;
      fitRef.current = null;
    };
  }, [tab?.ptySessionId]);

  useEffect(() => {
    if (!tab || !terminalRef.current) return;

    const next = tab.terminalBuffer.slice(lastBufferLengthRef.current);
    if (next) {
      terminalRef.current.write(next);
      lastBufferLengthRef.current = tab.terminalBuffer.length;
    }
  }, [tab?.terminalBuffer]);

  if (!tab) {
    return <div className="workspace-empty">No active session.</div>;
  }

  return <div ref={containerRef} className="terminal-view" />;
}
```

安装：

```bash
npm install @xterm/xterm @xterm/addon-fit
```

---

## 21. Workspace ChatComposer：必须写入 PTY

创建或修改：

```text
src/features/workspace/components/ChatComposer.tsx
```

代码：

```tsx
import { useState } from "react";
import { writeToPty } from "../../runtime/services/claudeRuntimeService";
import { useWorkspaceStore } from "../stores/workspaceStore";

interface ChatComposerProps {
  sessionId: string;
}

export function ChatComposer({ sessionId }: ChatComposerProps) {
  const [value, setValue] = useState("");
  const tab = useWorkspaceStore((s) => s.tabs.find((t) => t.sessionId === sessionId));

  async function submit() {
    const text = value.trim();
    if (!text || !tab?.ptySessionId) return;

    // Critical rule:
    // In PTY mode, ChatComposer sends text to the real Claude Code PTY stdin.
    // It must not start claude -p and must not create a fake chat session.
    await writeToPty(tab.ptySessionId, `${text}\r`);
    setValue("");
  }

  return (
    <div className="chat-composer">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="向当前真实 Claude Code 会话发送消息..."
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
      />
      <button onClick={submit} disabled={!value.trim() || !tab?.ptySessionId}>
        发送到 Claude PTY
      </button>
    </div>
  );
}
```

---

## 22. Workspace Surface

创建或修改：

```text
src/features/workspace/pages/WorkspaceSurface.tsx
```

代码骨架：

```tsx
import { useWorkspaceStore } from "../stores/workspaceStore";
import { TerminalView } from "../components/TerminalView";
import { ChatComposer } from "../components/ChatComposer";

export function WorkspaceSurface() {
  const tabs = useWorkspaceStore((s) => s.tabs);
  const activeSessionId = useWorkspaceStore((s) => s.activeSessionId);
  const focusSession = useWorkspaceStore((s) => s.focusSession);

  const activeTab = tabs.find((t) => t.sessionId === activeSessionId);

  if (!activeTab) {
    return (
      <div className="workspace-empty">
        <h2>暂无打开的 Claude 会话</h2>
        <p>请从项目管理页面启动或继续一个真实 Claude Code 会话。</p>
      </div>
    );
  }

  return (
    <div className="workspace-surface">
      <div className="workspace-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={tab.active ? "active" : ""}
            onClick={() => focusSession(tab.sessionId)}
          >
            {tab.title}
          </button>
        ))}
      </div>

      <div className="workspace-main">
        <div className="workspace-terminal-panel">
          <TerminalView sessionId={activeTab.sessionId} />
        </div>

        <div className="workspace-chat-panel">
          <ChatComposer sessionId={activeTab.sessionId} />
        </div>
      </div>
    </div>
  );
}
```

---

## 23. Projects Surface 操作连接

### 23.1 ProjectActionRibbon

创建或修改：

```text
src/features/projects/components/ProjectActionRibbon.tsx
```

代码：

```tsx
import type { Project } from "../types/projectTypes";
import {
  continueProjectClaudeSession,
  startNewClaudeSessionFromProject,
} from "../services/projectRuntimeActions";
import {
  navigateToProjectDiagnostics,
  navigateToProjectGithub,
  navigateToProjectResources,
} from "../services/projectNavigationActions";

interface ProjectActionRibbonProps {
  project: Project;
  claudeStatus: "ready" | "not-found" | "auth-required" | "pty-failed" | "unknown";
  onError: (message: string) => void;
}

export function ProjectActionRibbon({ project, claudeStatus, onError }: ProjectActionRibbonProps) {
  async function onStartNew() {
    try {
      await startNewClaudeSessionFromProject(project);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  async function onContinue() {
    try {
      await continueProjectClaudeSession(project);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  const runtimeReady = claudeStatus === "ready";

  return (
    <div className="project-action-ribbon">
      <button
        className="primary"
        onClick={runtimeReady ? onStartNew : () => navigateToProjectDiagnostics(project.id)}
      >
        {runtimeReady ? "新建 Claude 会话" : "修复 Claude Runtime"}
      </button>

      <button onClick={onContinue} disabled={!runtimeReady}>
        继续最近会话
      </button>

      <button onClick={() => navigateToProjectResources(project.id, "claude-md")}>
        打开资源区
      </button>

      <button onClick={() => navigateToProjectGithub(project.id, "repo")}>
        GitHub
      </button>

      <button onClick={() => navigateToProjectDiagnostics(project.id)}>
        运行诊断
      </button>
    </div>
  );
}
```

### 23.2 SessionCard

创建或修改：

```text
src/features/projects/components/SessionCard.tsx
```

代码：

```tsx
import type { ClaudeSession, Project } from "../types/projectTypes";
import {
  openExistingSessionInWorkspace,
  resumeClaudeSessionFromProject,
  forkClaudeSessionFromProject,
  stopClaudeSession,
} from "../services/projectRuntimeActions";

interface SessionCardProps {
  project: Project;
  session: ClaudeSession;
  onError: (message: string) => void;
}

export function SessionCard({ project, session, onError }: SessionCardProps) {
  const isActive =
    session.status !== "stopped" &&
    session.status !== "failed" &&
    session.status !== "archived" &&
    !!session.ptySessionId;

  async function handleOpen() {
    try {
      if (isActive) {
        openExistingSessionInWorkspace(session);
      } else {
        const target = session.claudeSessionId || session.claudeSessionName || session.name;
        await resumeClaudeSessionFromProject(project, target);
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleFork() {
    try {
      const target = session.claudeSessionId || session.claudeSessionName || session.name;
      await forkClaudeSessionFromProject(project, target);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleStop() {
    const ok = window.confirm("确定要停止这个 Claude 会话吗？这会向该 PTY 进程发送停止信号。");
    if (!ok) return;

    try {
      await stopClaudeSession(session);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <article className={`session-card session-${session.status}`}>
      <header>
        <div>
          <h3>{session.name}</h3>
          <p>{session.cwd}</p>
        </div>
        <span className="session-status">{session.status}</span>
      </header>

      <div className="session-meta-grid">
        <span>模式：{session.runtimeMode}</span>
        <span>模型：{session.model ?? "Unavailable"}</span>
        <span>Token：{formatTokens(session.tokenInput, session.tokenOutput)}</span>
        <span>开销：{session.estimatedCostUsd == null ? "Unavailable" : `$${session.estimatedCostUsd.toFixed(4)}`}</span>
        <span>改动文件：{session.changedFiles}</span>
        <span>风险：{session.riskCount}</span>
      </div>

      <footer>
        <button onClick={handleOpen}>{isActive ? "打开 Workspace" : "恢复会话"}</button>
        <button onClick={handleFork}>分支会话</button>
        <button onClick={handleStop} disabled={!isActive}>
          停止
        </button>
      </footer>
    </article>
  );
}

function formatTokens(input?: number | null, output?: number | null) {
  if (input == null && output == null) return "Unavailable";
  return `${input ?? 0} / ${output ?? 0}`;
}
```

---

## 24. ProjectCanvas：视觉与功能融合

创建或修改：

```text
src/features/projects/components/ProjectCanvas.tsx
```

代码骨架：

```tsx
import { useState } from "react";
import type { Project, ProjectRuntimeSnapshot } from "../types/projectTypes";
import { ProjectHeroCard } from "./ProjectHeroCard";
import { ProjectSignalDeck } from "./ProjectSignalDeck";
import { ProjectActionRibbon } from "./ProjectActionRibbon";
import { SessionWaterfall } from "./SessionWaterfall";
import { IntegrationsWaterfall } from "./IntegrationsWaterfall";

interface ProjectCanvasProps {
  project: Project;
  snapshot?: ProjectRuntimeSnapshot;
}

export function ProjectCanvas({ project, snapshot }: ProjectCanvasProps) {
  const [error, setError] = useState<string | null>(null);

  const claudeStatus = snapshot?.claude.status ?? "unknown";

  return (
    <main className="project-canvas">
      {error && (
        <div className="project-error-card">
          <strong>操作失败</strong>
          <span>{error}</span>
          <button onClick={() => setError(null)}>关闭</button>
        </div>
      )}

      <ProjectHeroCard project={project} snapshot={snapshot} />

      <ProjectSignalDeck project={project} snapshot={snapshot} />

      <ProjectActionRibbon
        project={project}
        claudeStatus={claudeStatus}
        onError={setError}
      />

      <section className="project-waterfall">
        <SessionWaterfall project={project} onError={setError} />
        <IntegrationsWaterfall project={project} snapshot={snapshot} />
      </section>
    </main>
  );
}
```

---

## 25. SessionWaterfall

创建或修改：

```text
src/features/projects/components/SessionWaterfall.tsx
```

代码：

```tsx
import type { Project } from "../types/projectTypes";
import { useProjectsStore } from "../stores/projectsStore";
import { SessionCard } from "./SessionCard";

interface SessionWaterfallProps {
  project: Project;
  onError: (message: string) => void;
}

export function SessionWaterfall({ project, onError }: SessionWaterfallProps) {
  const sessions = useProjectsStore((s) =>
    s.sessions.filter((session) => session.projectId === project.id)
  );

  if (sessions.length === 0) {
    return (
      <section className="waterfall-card session-empty-card">
        <h2>还没有 Claude 会话</h2>
        <p>为这个项目启动第一个真实 PTY Claude Code 会话。会话创建后会自动进入 Workspace，并把 Chat Composer 连接到同一个 PTY。</p>
      </section>
    );
  }

  return (
    <section className="waterfall-card session-waterfall">
      <header className="waterfall-header">
        <div>
          <h2>Claude 会话</h2>
          <p>管理该项目下的真实 PTY 会话、恢复会话、分支会话与停止会话。</p>
        </div>
      </header>

      <div className="session-card-grid">
        {sessions.map((session) => (
          <SessionCard key={session.id} project={project} session={session} onError={onError} />
        ))}
      </div>
    </section>
  );
}
```

---

## 26. IntegrationsWaterfall：连接其他界面

创建或修改：

```text
src/features/projects/components/IntegrationsWaterfall.tsx
```

代码：

```tsx
import type { Project, ProjectRuntimeSnapshot } from "../types/projectTypes";
import {
  navigateToProjectConsole,
  navigateToProjectGithub,
  navigateToProjectResources,
  navigateToProjectDiagnostics,
} from "../services/projectNavigationActions";

interface IntegrationsWaterfallProps {
  project: Project;
  snapshot?: ProjectRuntimeSnapshot;
}

export function IntegrationsWaterfall({ project, snapshot }: IntegrationsWaterfallProps) {
  const git = snapshot?.git;
  const claude = snapshot?.claude;

  return (
    <section className="waterfall-card integrations-waterfall">
      <header>
        <h2>项目连接</h2>
        <p>从项目上下文直接进入 Workspace、资源区、GitHub、控制台和诊断。</p>
      </header>

      <div className="integration-card-list">
        <button onClick={() => navigateToProjectResources(project.id, "claude-md")}>
          <strong>资源区</strong>
          <span>CLAUDE.md / Settings / MCP / Agents / Hooks</span>
        </button>

        <button onClick={() => navigateToProjectGithub(project.id, "repo")}>
          <strong>GitHub</strong>
          <span>{git?.remoteUrl ?? "No remote configured"}</span>
        </button>

        <button onClick={() => navigateToProjectConsole(project.id, "sessions")}>
          <strong>控制台</strong>
          <span>查看该项目的会话、Token、风险与活动统计</span>
        </button>

        <button onClick={() => navigateToProjectDiagnostics(project.id)}>
          <strong>运行诊断</strong>
          <span>Claude: {claude?.status ?? "unknown"} · Git: {git?.isRepo ? "repo" : "unavailable"}</span>
        </button>
      </div>
    </section>
  );
}
```

---

## 27. ProjectsSurface

创建或修改：

```text
src/features/projects/pages/ProjectsSurface.tsx
```

代码骨架：

```tsx
import { useProjectsStore } from "../stores/projectsStore";
import { ProjectNavigator } from "../components/ProjectNavigator";
import { ProjectCanvas } from "../components/ProjectCanvas";
import "../styles/projects.css";

export function ProjectsSurface() {
  const projects = useProjectsStore((s) => s.projects);
  const selectedProjectId = useProjectsStore((s) => s.selectedProjectId);
  const runtimeSnapshots = useProjectsStore((s) => s.runtimeSnapshots);

  const selectedProject =
    projects.find((p) => p.id === selectedProjectId) ?? projects[0] ?? null;

  return (
    <div className="projects-surface">
      {/* Do not modify the left AppRail here. It remains controlled by the existing App shell. */}
      <ProjectNavigator />

      {selectedProject ? (
        <ProjectCanvas
          project={selectedProject}
          snapshot={runtimeSnapshots[selectedProject.id]}
        />
      ) : (
        <div className="project-canvas">
          <section className="project-empty-global">
            <h2>还没有项目</h2>
            <p>导入一个项目后，Ctrl-CC 会把项目、Claude 会话、Workspace、资源区和 GitHub 连接在一起。</p>
          </section>
        </div>
      )}
    </div>
  );
}
```

---

## 28. CSS：四主题兼容

创建或修改：

```text
src/features/projects/styles/projects.css
```

代码：

```css
.projects-surface {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  height: 100%;
  min-height: 0;
  background: var(--cc-bg);
  color: var(--cc-text);
}

.project-navigator {
  min-width: 0;
  border-right: 1px solid var(--cc-border-soft);
  background: color-mix(in srgb, var(--cc-surface) 88%, transparent);
  backdrop-filter: blur(18px);
}

.project-canvas {
  min-width: 0;
  min-height: 0;
  overflow: auto;
  padding: 24px;
}

.project-error-card {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding: 14px 16px;
  border-radius: 16px;
  border: 1px solid var(--cc-red);
  background: var(--cc-red-soft);
  color: var(--cc-text);
}

.project-hero-card,
.signal-card,
.waterfall-card,
.session-card {
  border: 1px solid var(--cc-border-soft);
  background: var(--cc-surface);
  border-radius: 20px;
  box-shadow: var(--cc-shadow-card);
}

.project-hero-card {
  padding: 22px;
  margin-bottom: 16px;
}

.project-signal-deck {
  display: grid;
  grid-template-columns: repeat(6, minmax(130px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.signal-card {
  padding: 16px;
}

.signal-card strong {
  display: block;
  font-size: 22px;
  line-height: 1.1;
  font-weight: 700;
}

.signal-card span {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  color: var(--cc-text-muted);
}

.project-action-ribbon {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 16px;
  padding: 12px;
  border-radius: 18px;
  border: 1px solid var(--cc-border-soft);
  background: color-mix(in srgb, var(--cc-surface) 92%, transparent);
}

.project-action-ribbon button,
.session-card button,
.integration-card-list button {
  border: 1px solid var(--cc-border-soft);
  background: var(--cc-surface-solid);
  color: var(--cc-text);
  border-radius: 12px;
  padding: 9px 12px;
  font-size: 13px;
  cursor: pointer;
  transition: transform var(--cc-duration-fast) var(--cc-ease-standard),
    border-color var(--cc-duration-fast) var(--cc-ease-standard),
    background var(--cc-duration-fast) var(--cc-ease-standard);
}

.project-action-ribbon button:hover,
.session-card button:hover,
.integration-card-list button:hover {
  transform: translateY(-1px);
  border-color: var(--cc-brand);
  background: var(--cc-surface-hover);
}

.project-action-ribbon button.primary {
  background: var(--cc-brand);
  border-color: var(--cc-brand-strong);
  color: var(--cc-text-inverse);
  font-weight: 650;
}

.project-waterfall {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(320px, 0.65fr);
  gap: 16px;
  align-items: start;
}

.waterfall-card {
  padding: 18px;
}

.waterfall-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}

.waterfall-header h2,
.integrations-waterfall h2 {
  margin: 0;
  font-size: 17px;
  font-weight: 680;
}

.waterfall-header p,
.integrations-waterfall p,
.session-empty-card p {
  margin: 6px 0 0;
  color: var(--cc-text-muted);
  font-size: 13px;
  line-height: 1.6;
}

.session-card-grid {
  display: grid;
  gap: 12px;
}

.session-card {
  padding: 16px;
}

.session-card header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}

.session-card h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 680;
}

.session-card p {
  margin: 5px 0 0;
  font-size: 12px;
  color: var(--cc-text-muted);
}

.session-status {
  height: 24px;
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--cc-brand-soft);
  color: var(--cc-brand-strong);
  font-size: 12px;
}

.session-meta-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin: 14px 0;
}

.session-meta-grid span {
  padding: 8px 10px;
  border-radius: 12px;
  background: var(--cc-surface-muted);
  color: var(--cc-text-muted);
  font-size: 12px;
}

.session-card footer {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.integration-card-list {
  display: grid;
  gap: 10px;
  margin-top: 12px;
}

.integration-card-list button {
  text-align: left;
  padding: 14px;
}

.integration-card-list strong {
  display: block;
  font-size: 14px;
}

.integration-card-list span {
  display: block;
  margin-top: 5px;
  color: var(--cc-text-muted);
  font-size: 12px;
  line-height: 1.5;
}

.terminal-view {
  width: 100%;
  height: 100%;
  min-height: 420px;
  padding: 8px;
  border-radius: 18px;
  border: 1px solid var(--cc-border-soft);
  background: color-mix(in srgb, var(--cc-bg-elevated) 82%, transparent);
}

.chat-composer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  padding: 12px;
  border-top: 1px solid var(--cc-border-soft);
  background: var(--cc-surface);
}

.chat-composer textarea {
  min-height: 56px;
  resize: vertical;
  border-radius: 14px;
  border: 1px solid var(--cc-border-soft);
  background: var(--cc-surface-solid);
  color: var(--cc-text);
  padding: 10px 12px;
}

@media (max-width: 1200px) {
  .project-waterfall {
    grid-template-columns: 1fr;
  }

  .project-signal-deck {
    grid-template-columns: repeat(3, minmax(130px, 1fr));
  }
}

@media (max-width: 900px) {
  .projects-surface {
    grid-template-columns: 1fr;
  }

  .project-navigator {
    display: none;
  }

  .project-signal-deck {
    grid-template-columns: repeat(2, minmax(130px, 1fr));
  }
}
```

---

## 29. 功能流程：从 Projects 到 Workspace/Chat

### 29.1 新建 Claude 会话

```text
用户点击 Projects -> 新建 Claude 会话

1. discover_claude()
2. claude ready:
   2.1 create ClaudeSession record
   2.2 pty_start_claude(command="claude", args=["--name", sessionName], cwd=project.path)
   2.3 addSession()
   2.4 openSessionTab()
   2.5 navigateToWorkspaceSession()
   2.6 TerminalView 自动连接 PTY
   2.7 ChatComposer 写入同一个 PTY stdin
3. claude not ready:
   3.1 ProjectActionRibbon 主按钮变为“修复 Claude Runtime”
   3.2 点击进入 Diagnostics
```

### 29.2 继续最近会话

```text
用户点击 Projects -> 继续最近会话

1. discover_claude()
2. pty_start_claude(command="claude", args=["--continue"], cwd=project.path)
3. 注册 session
4. 跳转 Workspace
```

### 29.3 恢复某个 SessionCard

```text
用户点击 SessionCard -> 恢复会话

1. 如果 session 仍有 active ptySessionId:
   openExistingSessionInWorkspace()
2. 如果 session 已停止:
   pty_start_claude(command="claude", args=["--resume", target], cwd=project.path)
3. 注册新 active session 或更新原 session runtime
4. 跳转 Workspace
```

### 29.4 Chat Composer 发送消息

```text
用户在 Workspace ChatComposer 输入内容

1. 找到 active tab
2. 找到 ptySessionId
3. writeToPty(ptySessionId, text + "\r")
4. TerminalView 显示真实 Claude 输出
5. SemanticMirror 可后续从 transcript/statusline/hooks 构建，不作为 P0 必需
```

---

## 30. 项目页按钮必须连接真实功能

### Project-level actions

```text
新建 Claude 会话
  -> startNewClaudeSessionFromProject(project)

继续最近会话
  -> continueProjectClaudeSession(project)

打开资源区
  -> navigateToProjectResources(project.id)

GitHub
  -> navigateToProjectGithub(project.id)

控制台统计
  -> navigateToProjectConsole(project.id)

运行诊断
  -> navigateToProjectDiagnostics(project.id)
```

### Session-level actions

```text
打开 Workspace
  -> openExistingSessionInWorkspace(session)

恢复会话
  -> resumeClaudeSessionFromProject(project, target)

分支会话
  -> forkClaudeSessionFromProject(project, target)

停止会话
  -> stopClaudeSession(session)

归档会话
  -> 只允许 stopped / failed / archived 状态，不允许 active pty session
```

---

## 31. Resources 连接规则

项目页的 Resources 卡片必须进入项目作用域，不是进入全局资源空页。

传入：

```ts
{
  projectId,
  projectPath,
  scope: "claude-md" | "settings" | "mcp" | "agents" | "hooks"
}
```

Resources 页面进入后必须扫描：

```text
projectPath/CLAUDE.md
projectPath/.claude/CLAUDE.md
projectPath/.claude/settings.json
projectPath/.claude/settings.local.json
projectPath/.mcp.json
projectPath/.claude/agents/*
projectPath/.claude/hooks/*
```

如果文件不存在：

```text
Not configured
```

不要显示假配置。

---

## 32. GitHub 连接规则

项目页 GitHub 卡片必须基于 Git remote：

```text
git remote get-url origin
```

如果没有 remote：

```text
No remote configured
```

如果有 GitHub remote：

```text
打开仓库
打开 Issues
打开 Pull Requests
打开 Actions
```

后续 GitHub 深度集成可以接 GitHub API，但 P0 只做基于 remote URL 的跳转。

---

## 33. Console 连接规则

项目页跳转 Console 时必须带 projectId。Console 的 Pro 模式中应能显示：

```text
仅当前项目的会话
仅当前项目的 token
仅当前项目的成本
仅当前项目的风险
仅当前项目的活动
```

Daily Console 不受 projectId 全局筛选影响，但可以显示“来自项目页的跳转上下文”。

---

## 34. Diagnostics 连接规则

Diagnostics 必须接收 projectId，并显示：

```text
Project path exists
Claude executable discovery
Claude version
Git availability
Git repo status
PTY spawn smoke test
Workspace route test
Chat composer PTY write test
```

必须有一个按钮：

```text
运行 P0 连接测试
```

测试内容：

```text
1. discover_claude()
2. git_snapshot(project.path)
3. pty_start_claude(command="claude", args=["--version"], cwd=project.path) 不用于 interactive，或普通 process 运行 --version
4. 创建临时 PTY session 运行 shell echo smoke test
5. 返回结果
```

---

## 35. P0 验收标准

本轮最重要的是功能连接，不是继续做漂亮 UI。

必须满足：

```text
[ ] Projects 页面点击“新建 Claude 会话”后，真实 Claude Code CLI 在 Workspace Terminal 中启动。
[ ] Workspace Terminal 使用真实 PTY，不是普通 spawn 输出。
[ ] Workspace ChatComposer 输入的内容写入当前 PTY stdin。
[ ] ChatComposer 不会启动 claude -p 冒充当前会话。
[ ] Projects SessionCard 可以打开当前 active Workspace 会话。
[ ] Projects SessionCard 可以通过 claude --resume 恢复 stopped 会话。
[ ] Projects “继续最近会话”调用 claude --continue。
[ ] Projects “分支会话”调用 claude --resume <target> --fork-session。
[ ] Claude CLI 不可用时，项目页显示 not-found/auth-required/unknown，并引导 Diagnostics。
[ ] Git 不可用时显示 Not a git repository / Unavailable，不显示假状态。
[ ] Resources / GitHub / Console 跳转都带 projectId。
[ ] 不修改最左侧 AppRail 图标。
[ ] 不处理最右侧悬浮 AI Dock。
[ ] 四主题变量不被破坏。
```

---

## 36. 分阶段执行顺序

### P0：Runtime 打通

```text
1. 添加 Rust discover_claude
2. 添加 Rust pty_manager
3. 添加 Rust pty_start/write/resize/kill
4. 添加 Frontend claudeRuntimeService
5. 添加 runtime event bridge
6. 添加 Workspace TerminalView
7. 添加 Workspace ChatComposer 写入 PTY
8. 从 Projects 新建会话并自动跳 Workspace
```

P0 完成前不要做高级 Session Monitor。

### P1：Projects 可视化升级并接真实 Runtime

```text
1. 重构 ProjectCanvas
2. 增加 ProjectActionRibbon
3. 增加 SessionWaterfall
4. SessionCard 操作全部接 Runtime
5. IntegrationsWaterfall 接 Resources/GitHub/Console/Diagnostics
```

### P2：状态采集

```text
1. git_snapshot 接入 ProjectSignalDeck
2. discover_claude 接入 ProjectSignalDeck
3. pty.output / pty.exit 更新 session 状态
4. stopped / failed / active 状态可视化
```

### P3：Telemetry 增强

```text
1. 增加 statusLine opt-in 配置入口
2. 增加 hooks collector opt-in 配置入口
3. 解析 transcript_path / cost / model / context
4. SessionCard 显示 token/cost/model
```

### P4：跨界面深连接

```text
1. Resources 进入项目作用域
2. GitHub 进入项目 remote 作用域
3. Console 支持 projectId 过滤
4. Diagnostics 支持项目 P0 连接测试
```

---

## 37. 关键禁令

```text
不要再把 Project 页面做成纯展示页。
不要再让 Chat 和 Workspace/PTY 脱钩。
不要在 Project 页面里做假 Chat。
不要把 claude -p 当成 interactive session。
不要让 Project 会话卡片只改变 UI 状态而不连接 Runtime。
不要显示无法验证的 token/cost/model。
不要静默改写用户 Claude settings。
不要一次性处理右侧 AI Dock。
不要改最左侧 AppRail 图标。
```

---

## 38. 最终交付物

Claude CLI 执行后，应交付：

```text
1. Projects 页面视觉升级，但重点是功能连接。
2. 新建会话 -> Workspace Terminal 真实启动 Claude。
3. Chat Composer -> 当前 PTY stdin。
4. SessionCard -> 打开/恢复/分支/停止真实会话。
5. Resources/GitHub/Console/Diagnostics -> projectId 深连接。
6. Claude/Git/Session 状态真实展示，缺失显示 Unavailable。
7. 四主题兼容。
```

---

## 39. 最后检查清单

执行完成后运行：

```bash
npm run build
npm run tauri dev
```

手动验证：

```text
1. 打开 Projects。
2. 选择默认项目。
3. 点击“新建 Claude 会话”。
4. 应自动跳转 Workspace。
5. Terminal 中应出现真实 Claude Code。
6. 在 Chat Composer 输入“请解释这个项目结构”，按 Ctrl+Enter。
7. 内容必须进入 Terminal 中的同一个 Claude 会话。
8. 返回 Projects。
9. SessionCard 应显示该会话。
10. 点击 SessionCard 的“打开 Workspace”应回到同一会话。
11. 点击“停止”应确认并停止 PTY。
12. 点击“继续最近会话”应调用 claude --continue。
13. Resources/GitHub/Console 按钮应带 projectId 跳转。
```

本方案完成后，Ctrl-CC 的项目管理才真正成为 Claude Code CLI Runtime 的控制中枢，而不是一个孤立的项目列表页。
