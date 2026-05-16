# Ctrl-CC Recovery + Commercial Rebuild 11.0
## 彻底解决 PTY / Claude CLI / Runtime split-brain，并重新推动 Console、Projects、Workspace/Chat、Resources、AI Dock 商用级升级

> 仓库：`JananZZZ/ctrl-cc`  
> 分支：`master`  
> 当前结论：这不是 UI 小问题，也不是某一个 `Session not found` 的孤立问题。当前代码同时存在 **Shell 启动层错误、Runtime 契约错误、Diagnostics 假通过、Surface split-brain、页面升级未落地** 五类问题。  
> 本方案要求 Claude CLI **先修 Runtime 红线，再做页面升级**。否则任何 Console / Projects / Resources / Dock 美化都会继续建立在错误地基上。

---

# 0. 当前截图代表什么问题

## 0.1 `powershell.exe 0xc0000142`

截图中的弹窗：

```text
powershell.exe - 应用程序错误
应用程序无法正常启动(0xc0000142)
```

说明当前 PTY 启动策略选择了 `powershell.exe`，但在你的 Tauri / WebView2 / ConPTY GUI 上下文里，PowerShell 子进程初始化失败。之前 `cmd.exe` 也出现过同样的 `0xc0000142`，所以这不是单纯 “cmd 坏了”，而是 **Windows Shell shim 路线不可靠**。

当前后端 discovery 只判断：

```text
powershell.exe 文件存在
```

却没有判断：

```text
powershell.exe 能不能在当前 GUI/PTY 环境里成功启动
```

所以 Diagnostics 显示：

```text
found via claude using powershell
```

但真正启动 PTY 时直接弹 `powershell.exe 0xc0000142`。

## 0.2 `ALL CONTRACTS PASSED` 是假通过

你的 Diagnostics 显示：

```text
Session Mapping: No frontend sessions
PTY Registry (0): Empty
Trace Timeline (0)
Frontend RuntimeStore (0 sessions)
ALL CONTRACTS PASSED
```

这不是通过，而是 **没有测试对象**。

正确逻辑应该是：

```text
0 frontend sessions + 0 backend sessions = NOT TESTED
不是 PASSED
```

Contract Test 必须真实执行：

```text
create session
start backend PTY
list backend registry
verify ptySessionId exists
verify writer exists
write echo/probe
stop session
```

否则 Diagnostics 只是空表格，不是合同测试。

## 0.3 原问题仍没解决的直接原因

当前代码仍然有两套 Runtime：

```text
A. RuntimeBridge / RuntimeStore
B. WorkspaceSurface / ProjectsSurface / usePtyTerminal 直接调用 interactionAdapter / old PTY
```

所以你看到：

```text
Workspace 有 tab
右侧 Inspector 显示 starting
Diagnostics 却显示 Frontend RuntimeStore 0 sessions
PTY Registry 0
```

因为创建会话的 UI 走了旧 store，而 Diagnostics 读的是 RuntimeStore。

---

# 1. 当前 master 分支真实代码审计结论

## 1.1 RuntimeBridge 仍然没有真正使用 ptySessionId

`runtimeBridge.ts` 创建了 `id / ptySessionId / traceId`，但启动时仍传 `session.id`，写入时仍调用 `adapter.writePtyV2(uiSessionId, ...)`。

必须修成：

```ts
await runtimeStartInteractive({
  uiSessionId: session.id,
  ptySessionId: session.ptySessionId,
  traceId: session.traceId,
  ...
});

await runtimeWrite({
  uiSessionId,
  ptySessionId: session.ptySessionId,
  traceId: session.traceId,
  data,
});
```

禁止：

```ts
adapter.writePtyV2(uiSessionId, data)
adapter.startPtyV2ClaudeSession({ sessionId: session.id })
```

## 1.2 WorkspaceSurface 仍然直接调用旧 PTY

`WorkspaceSurface.tsx` 仍然 import：

```ts
startPtyV2ClaudeSession
stopPtyV2
runtimeWrite
```

并且 `startSessionWithProject()` 里仍然自己：

```text
生成 ses-xxx
addSession legacy
openSession legacy
startPtyV2ClaudeSession
```

必须删除这些直接调用。Workspace 只能：

```ts
RuntimeBridge.startInteractiveSession(...)
RuntimeBridge.stop(...)
RuntimeBridge.write(...)
RuntimeBridge.sendCtrlC(...)
```

## 1.3 ProjectsSurface 仍然直接调用旧 PTY

`ProjectsSurface.tsx` 仍然 import：

```ts
startPtyV2ClaudeSession
```

并且 `handleCreateSession()` 仍然自己创建 legacy session，再直接启动 PTY。

必须删除该 import。Projects 只能调用：

```ts
RuntimeBridge.startInteractiveSession(...)
RuntimeBridge.resumeSession(...)
RuntimeBridge.forkSession(...)
RuntimeBridge.stop(...)
```

## 1.4 usePtyTerminal 仍然绕过 RuntimeBridge

`usePtyTerminal.ts` 仍然 import：

```ts
writePtyV2
resizePtyV2
sendCtrlCPtyV2
sendCtrlDPtyV2
```

这会导致 Terminal 输入绕过 RuntimeBridge。最终必须改为：

```ts
RuntimeBridge.write(uiSessionId, data)
RuntimeBridge.resize(uiSessionId, cols, rows)
RuntimeBridge.sendCtrlC(uiSessionId)
RuntimeBridge.sendCtrlD(uiSessionId)
```

同时 Terminal 监听事件时应按 `uiSessionId` 过滤，而不是猜测 old `session_id`。

## 1.5 后端仍是 old PTY data plane

`pty_session.rs` 里仍然写：

```rust
let id = options.session_id.clone();
```

`pty_manager.rs` 仍然说：

```rust
session_id IS the HashMap key
```

这与前端 `ptySessionId = pty-uuid` 的工业级契约冲突。

必须迁移到：

```rust
registry key = pty_session_id
event includes ui_session_id + pty_session_id + trace_id
```

## 1.6 Discovery Matrix 当前是“路径发现”，不是“可运行发现”

`discovery.rs` 当前逻辑是：

```rust
if ps_path.exists() { selected_strategy = powershell }
```

这是错误的。必须变成：

```text
shell exists
shell version can run
shell can spawn inside GUI context
shell can spawn inside ConPTY context
candidate can run through selected launch plan
```

并且应优先选择：

```text
node.exe + Claude CLI JS
```

绕开 `powershell.exe` 和 `cmd.exe`。

---

# 2. 总体修复路线

本次不要直接重构 UI。必须分四个硬阶段。

```text
Phase 1：Runtime 红线修复
Phase 2：Diagnostics 真实化
Phase 3：Surface 全部接 RuntimeBridge
Phase 4：Console / Projects / Resources / AI Dock 商用级升级
```

没有 Phase 1 和 Phase 2，Phase 4 不能开始。

---

# 3. Phase 1：Runtime 红线修复

## 3.1 新建后端 runtime_v2 模块

创建：

```text
src-tauri/src/runtime_v2/
├── mod.rs
├── runtime_types.rs
├── runtime_commands.rs
├── runtime_manager.rs
├── claude_launch_plan.rs
├── claude_discovery.rs
└── process_canary.rs
```

`mod.rs`：

```rust
pub mod runtime_types;
pub mod runtime_commands;
pub mod runtime_manager;
pub mod claude_launch_plan;
pub mod claude_discovery;
pub mod process_canary;
```

并在 `main.rs` 增加：

```rust
mod runtime_v2;
```

## 3.2 Runtime 类型

`runtime_types.rs`：

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeStartInteractiveRequest {
    pub trace_id: String,
    pub ui_session_id: String,
    pub pty_session_id: String,
    pub project_id: String,
    pub cwd: String,
    pub model: Option<String>,
    pub permission_mode: Option<String>,
    pub mode: String,
    pub session_name: Option<String>,
    pub resume_target: Option<String>,
    pub initial_prompt: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeStartInteractiveResponse {
    pub trace_id: String,
    pub ui_session_id: String,
    pub pty_session_id: String,
    pub pid: Option<u32>,
    pub cwd: String,
    pub status: String,
    pub launch_plan_id: String,
    pub program: String,
    pub args: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeWriteRequest {
    pub trace_id: String,
    pub ui_session_id: String,
    pub pty_session_id: String,
    pub data: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeStopRequest {
    pub trace_id: String,
    pub ui_session_id: String,
    pub pty_session_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimePtySessionDebugInfo {
    pub ui_session_id: String,
    pub pty_session_id: String,
    pub project_id: String,
    pub cwd: String,
    pub pid: Option<u32>,
    pub status: String,
    pub has_writer: bool,
    pub reader_alive: bool,
    pub created_at: String,
    pub last_error: Option<String>,
}
```

## 3.3 LaunchPlan：不要再选 shell + candidate，而是选最终可执行命令

`claude_launch_plan.rs`：

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeLaunchPlan {
    pub id: String,
    pub label: String,
    pub program: String,
    pub args_prefix: Vec<String>,
    pub cwd_mode: String,
    pub reason: String,
}

impl ClaudeLaunchPlan {
    pub fn command_parts(&self, claude_args: &[String]) -> (String, Vec<String>) {
        let mut args = self.args_prefix.clone();
        args.extend_from_slice(claude_args);
        (self.program.clone(), args)
    }
}
```

## 3.4 Discovery 必须优先 direct-node

`claude_discovery.rs` 必须按以下顺序生成 LaunchPlan：

```text
1. CTRL_CC_CLAUDE_COMMAND override
2. node.exe + Claude CLI JS
3. native claude.exe
4. pwsh + claude.ps1
5. powershell + claude.ps1
6. cmd + claude.cmd
```

关键：如果 `powershell.exe` 或 `cmd.exe` canary 失败，不能选它。

伪代码：

```rust
pub fn discover_launch_plan() -> Result<ClaudeLaunchPlan, String> {
    let candidates = collect_candidates();

    for c in candidates {
        if canary_program(&c.program, &c.canary_args).is_ok() {
            if probe_claude_version(&c).is_ok() {
                return Ok(c.to_launch_plan());
            }
        }
    }

    Err("No runnable Claude Code launch plan found. Try installing Node.js and Claude Code CLI, or set CTRL_CC_CLAUDE_COMMAND.".into())
}
```

## 3.5 Node direct launch 搜索路径

必须搜索：

```text
where node
%ProgramFiles%\nodejs\node.exe
%LOCALAPPDATA%\Programs\nodejs\node.exe
%APPDATA%\npm\node_modules\@anthropic-ai\claude-code\cli.js
%APPDATA%\npm\node_modules\@anthropic-ai\claude-code\bin\claude.js
npm root -g
npm prefix -g
```

如果找到：

```text
node.exe
claude-code js entry
```

选择：

```text
program = node.exe
args_prefix = [claude_cli_js_path]
```

这样启动时最终是：

```text
node.exe <claude-js> --permission-mode default ...
```

不再经过 `powershell.exe` / `cmd.exe`。

## 3.6 process_canary

`process_canary.rs`：

```rust
use std::process::{Command, Stdio};

pub fn canary_program(program: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new(program)
        .args(args)
        .stdin(Stdio::null())
        .output()
        .map_err(|e| format!("spawn failed: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "exit={:?}, stderr={}",
            output.status.code(),
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}
```

PowerShell canary：

```text
powershell.exe -NoLogo -NoProfile -Command "$PSVersionTable.PSVersion.ToString()"
```

cmd canary：

```text
cmd.exe /d /s /c echo CMD_OK
```

node canary：

```text
node.exe --version
```

## 3.7 RuntimeManager registry key 必须是 ptySessionId

`runtime_manager.rs` 内部：

```rust
pub struct RuntimeManager {
    sessions: Arc<Mutex<HashMap<String, RuntimePtyHandle>>>,
}
```

所有 `sessions.insert` / `sessions.get` 使用：

```rust
pty_session_id
```

不是：

```rust
ui_session_id
session_id
```

## 3.8 runtime_start_interactive

`runtime_commands.rs`：

```rust
#[tauri::command]
pub fn runtime_start_interactive(
    app: tauri::AppHandle,
    manager: tauri::State<'_, RuntimeManager>,
    req: RuntimeStartInteractiveRequest,
) -> Result<RuntimeStartInteractiveResponse, String> {
    manager.start_interactive(app, req)
}
```

启动流程：

```text
trace start
resolve cwd
discover_launch_plan
build claude args
openpty
spawn command
take reader/writer
insert registry by ptySessionId
emit runtime://session-status { uiSessionId, ptySessionId, status: "pty-ready" }
reader thread emits pty://data { uiSessionId, ptySessionId, data }
return response
```

## 3.9 runtime_write

```rust
#[tauri::command]
pub fn runtime_write(
    manager: tauri::State<'_, RuntimeManager>,
    req: RuntimeWriteRequest,
) -> Result<(), String> {
    manager.write(req)
}
```

错误必须是：

```text
PTY session not found: pty-xxx (uiSessionId=ses-xxx)
```

不能再出现：

```text
Session not found: ses-xxx
```

---

# 4. Phase 2：Diagnostics 真实化

## 4.1 立即修正假通过

`RuntimeDiagnosticsPanel` 当前逻辑：

```ts
probe && probe.mismatches.length === 0 ? "ALL CONTRACTS PASSED" : ...
```

必须改成：

```ts
function getContractStatus(probe: RuntimeContractProbeResult | null) {
  if (!probe) return { label: "NOT RUN", color: "muted" };
  if (probe.frontendSessions.length === 0 && probe.backendPtySessions.length === 0) {
    return { label: "NOT TESTED — NO SESSIONS", color: "amber" };
  }
  if (probe.mismatches.length > 0) {
    return { label: `${probe.mismatches.length} MISMATCHES`, color: "red" };
  }
  return { label: "CONTRACTS PASSED", color: "green" };
}
```

## 4.2 Contract Test 必须真实创建测试 session

新增按钮：

```text
Run Active Runtime Contract Test
```

执行：

```ts
const session = await RuntimeBridge.startInteractiveSession({
  projectId: "diagnostic",
  projectName: "Runtime Diagnostic",
  cwd: await invoke("get_current_dir"),
  mode: "new",
  sessionName: "runtime-contract-test",
});

await waitForStatus(session.id, ["pty-ready", "claude-active"], 8000);
const probe = await probeRuntimeContract();

assert backend registry contains session.ptySessionId;
assert hasWriter === true;
await RuntimeBridge.write(session.id, "\r");
await RuntimeBridge.stop(session.id);
```

如果 PowerShell 弹 `0xc0000142`，Contract Test 应显示：

```text
FAILED AT: launchPlan.spawn
program: C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe
error: STATUS_DLL_INIT_FAILED / 0xc0000142
suggestion: use direct node launch plan
```

## 4.3 Discovery Matrix 必须显示 LaunchPlan

替换旧 Discovery Matrix：

```text
Shell Strategies
Claude Candidates
```

为：

```text
Launch Plan Matrix
```

列：

```text
Priority
Plan ID
Program
Args Prefix
Canary
Claude Version
ConPTY Compatible
Selected
Error
```

其中 PowerShell 现在应该显示：

```text
powershell-ps1 | canary failed | not selected
```

---

# 5. Phase 3：前端 RuntimeBridge 重写

## 5.1 RuntimeBridge public API

统一导出对象：

```ts
export const RuntimeBridge = {
  startInteractiveSession,
  write,
  resize,
  sendCtrlC,
  sendCtrlD,
  stop,
  listBackendSessions,
  probeContract,
  runContractTest,
};
```

## 5.2 createPendingSession

```ts
function createPendingSession(input: StartInteractiveInput): RuntimeSession {
  const now = new Date().toISOString();
  const uiSessionId = `ses-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const ptySessionId = `pty-${crypto.randomUUID()}`;
  const traceId = `trace-${crypto.randomUUID()}`;

  return {
    id: uiSessionId,
    ptySessionId,
    claudeSessionId: null,
    traceId,
    projectId: input.projectId,
    projectName: input.projectName,
    cwd: input.cwd,
    name: input.sessionName ?? `${input.projectName}-${now.slice(0, 16).replace(/[:T]/g, "-")}`,
    mode: "interactive-pty",
    status: "workspace-opened",
    shellStrategy: null,
    claudeCommand: null,
    error: null,
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    exitedAt: null,
  };
}
```

## 5.3 startInteractiveSession

必须同时写：

```text
RuntimeStore
legacy SessionStore
OpenSessionStore
WorkspaceStore
SurfaceStore
```

直到旧 UI 彻底迁移完成。

```ts
export async function startInteractiveSession(input: StartInteractiveInput): Promise<RuntimeSession> {
  const session = createPendingSession(input);

  useRuntimeStore.getState().addSession(session);
  syncLegacySessionStore(session, "starting");
  openWorkspaceTab(session);
  useSurfaceStore.getState().navigateTo("workspace");

  queueMicrotask(() => {
    void startInteractiveInBackground(session, input);
  });

  return session;
}
```

## 5.4 startInteractiveInBackground

```ts
async function startInteractiveInBackground(session: RuntimeSession, input: StartInteractiveInput) {
  try {
    patch(session.id, { status: "discovering" });

    const response = await invoke<RuntimeStartInteractiveResponse>("runtime_start_interactive", {
      req: {
        traceId: session.traceId,
        uiSessionId: session.id,
        ptySessionId: session.ptySessionId,
        projectId: session.projectId,
        cwd: session.cwd,
        model: input.model ?? null,
        permissionMode: input.permissionMode ?? "default",
        mode: input.mode,
        sessionName: input.sessionName ?? null,
        resumeTarget: input.resumeTarget ?? null,
        initialPrompt: input.initialPrompt ?? null,
      },
    });

    patch(session.id, {
      status: "claude-active",
      startedAt: new Date().toISOString(),
      shellStrategy: response.launchPlanId,
      claudeCommand: response.program,
    });

    syncLegacySessionStore(session, "running");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    patch(session.id, { status: "failed", error: msg });
    syncLegacySessionStore(session, "failed");
    recordRuntimeError(...);
  }
}
```

## 5.5 write

```ts
export async function write(uiSessionId: string, data: string): Promise<void> {
  const session = useRuntimeStore.getState().sessions[uiSessionId];
  if (!session) throw new Error(`UI session not found: ${uiSessionId}`);
  if (!session.ptySessionId) throw new Error(`PTY session not attached: ${uiSessionId}`);
  if (!isRuntimeWritable(session.status)) throw new Error(`Runtime not ready: ${session.status}`);

  await invoke("runtime_write", {
    req: {
      traceId: session.traceId,
      uiSessionId: session.id,
      ptySessionId: session.ptySessionId,
      data,
    },
  });
}
```

---

# 6. Phase 4：删除 Surface split-brain

## 6.1 WorkspaceSurface

必须删除：

```ts
import { startPtyV2ClaudeSession, stopPtyV2 } from '../../features/runtime/services/interactionAdapter';
```

替换：

```ts
import { RuntimeBridge } from '../../features/runtime/services/runtimeBridge';
```

`startSessionWithProject()` 改成：

```ts
await RuntimeBridge.startInteractiveSession({
  projectId,
  projectName: proj?.name ?? "Project",
  cwd,
  mode: "new",
});
```

`handleCloseTab()` 改成：

```ts
RuntimeBridge.stop(sessionId).catch(...);
closeTab(sessionId);
```

`handleSend()` 只调用：

```ts
RuntimeBridge.write(activeTabId, text + "\r");
```

## 6.2 ProjectsSurface

必须删除：

```ts
import { startPtyV2ClaudeSession } from '../../features/runtime/services/interactionAdapter';
```

`handleCreateSession(projectId)` 改成：

```ts
const proj = useProjectStore.getState().projects.find((p) => p.id === projectId);
await RuntimeBridge.startInteractiveSession({
  projectId,
  projectName: proj?.name ?? "Project",
  cwd: proj?.path ?? ".",
  mode: "new",
});
```

`handleResumeSession(sessionId)` 改成：

```ts
await RuntimeBridge.startInteractiveSession({
  projectId: ses.projectId,
  projectName: projectName,
  cwd: ses.cwd,
  mode: "resume",
  resumeTarget: ses.claudeSessionId ?? ses.title,
});
```

## 6.3 usePtyTerminal

必须删除：

```ts
import { writePtyV2, resizePtyV2, sendCtrlCPtyV2, sendCtrlDPtyV2 } from '../runtime/services/interactionAdapter';
```

改成：

```ts
import { RuntimeBridge } from '../runtime/services/runtimeBridge';
```

并让 hook 参数明确为 `uiSessionId`：

```ts
export function usePtyTerminal(uiSessionId: string | null, container: HTMLDivElement | null)
```

监听事件：

```ts
listen<PtyDataPayload>("pty://data", (e) => {
  if (e.payload.uiSessionId !== uiSessionId) return;
  term.write(e.payload.data);
});
```

发送：

```ts
term.onData((data) => {
  RuntimeBridge.write(uiSessionId, data).catch(...);
});
```

---

# 7. Phase 5：页面升级为什么之前没有变化

你说新设计的 Console / Project / Chat / Resource 页面“好像没什么变化”。原因很明确：

当前仓库文件仍然是旧位置和旧结构：

```text
src/surfaces/console/ConsoleSurface.tsx
src/surfaces/projects/ProjectsSurface.tsx
src/surfaces/resources/ResourcesSurface.tsx
src/components/dock/AIDock.tsx
```

而不是新方案要求的：

```text
src/features/console/pages/ConsoleSurface.tsx
src/features/projects/pages/ProjectsSurface.tsx
src/features/resources/pages/ResourcesSurface.tsx
src/features/dock/pages/AIDockSurface.tsx
```

说明 Claude CLI 没有真正执行 UI 重构，或者只做了局部 runtime debug，没有切换 SurfaceHost 到新页面。

## 7.1 SurfaceHost 必须改成 feature pages

```ts
import { ConsoleSurface } from '../features/console/pages/ConsoleSurface';
import { ProjectsSurface } from '../features/projects/pages/ProjectsSurface';
import { WorkspaceSurface } from '../features/workspace/pages/WorkspaceSurface';
import { ResourcesSurface } from '../features/resources/pages/ResourcesSurface';
```

旧 `src/surfaces/*` 可以暂时保留，但不再由 SurfaceHost 引用。

---

# 8. Phase 6：Console / Projects / Resources / AI Dock 商用级升级执行重点

## 8.1 Console 11.0

必须实现：

```text
ConsoleTopCommandBar
WelcomeMissionHero
RuntimeHealthStrip
QuickStartDeck
ActiveWorkBoard
NeedAttentionQueue
TodayPulseWaterfall
RecentActivityTimeline
ProAnalyticsTabs
ConsoleInspectorDrawer
```

所有 Runtime 操作：

```ts
RuntimeBridge.startInteractiveSession
RuntimeBridge.stop
RuntimeBridge.sendCtrlC
NavigationBus.openWorkspace
```

禁止：

```ts
navigateTo('workspace') without session
legacy openSession only
```

## 8.2 Projects 11.0

必须实现：

```text
ProjectNav
ProjectOperationsCanvas
ProjectHero
ProjectSignalDeck
RuntimeActionRibbon
SessionWaterfall
SessionRuntimeCard
ProjectInspector
IntegrationCards
```

所有启动/恢复/分支/停止会话：

```ts
RuntimeBridge.startInteractiveSession
RuntimeBridge.resumeSession
RuntimeBridge.forkSession
RuntimeBridge.stop
```

## 8.3 Resources 11.0

从文件浏览器升级为：

```text
Capability & Context Center
```

必须实现：

```text
ResourcesTopCommandBar
ResourceNav
ResourceGridView
ResourceListView
ResourceSplitView
ResourceInspector
ResourceActivationPanel
ResourceDiagnosticsPanel
ResourceCreateWizard
ResourceBulkActionBar
```

新增：

```ts
ResourceActivationBridge.insertIntoChat(resourceId, uiSessionId)
ResourceActivationBridge.attachToSession(resourceId, uiSessionId)
ResourceActivationBridge.sendToCurrentPty(resourceId, uiSessionId)
ResourceActivationBridge.applyToProject(resourceId, projectId)
```

Resources 不直接运行 Claude，只能：

```text
写 ChatComposer draft
写 SessionContextStack
写 ProjectOverlay
或通过 RuntimeBridge.write 发送已确认内容
```

## 8.4 AI Dock 11.0

当前 `components/dock/AIDock.tsx` 降级为：

```text
DockLauncher / DockFallbackBadge
```

新增独立 window：

```text
src/features/dock/pages/AIDockSurface.tsx
src/features/dock/services/dockSnapshotPublisher.ts
src/features/dock/services/dockActionBridge.ts
src-tauri/src/commands/dock_window.rs
```

Dock 只通过事件和主窗口通信：

```text
main -> emitTo("ai-dock", "dock.snapshot")
dock -> emitTo("main", "dock.action")
main -> DockActionBridge -> RuntimeBridge
```

---

# 9. Claude CLI 直接执行 Prompt

```text
执行 Ctrl-CC Recovery + Commercial Rebuild 11.0。当前 master 分支仍然失败：PowerShell 0xc0000142、Diagnostics 假通过、RuntimeStore 0 sessions、PTY Registry 0、Console/Projects/Resources/Dock UI 重构未落地。

不要继续小修小补。必须按以下顺序执行：

A. 修 Runtime 红线
1. 新增 src-tauri/src/runtime_v2。
2. 实现 RuntimeStartInteractiveRequest / RuntimeWriteRequest / RuntimeStopRequest。
3. 实现 RuntimeManager，backend registry key 必须是 ptySessionId。
4. 实现 runtime_start_interactive / runtime_write / runtime_stop / runtime_list_sessions_v2。
5. 所有事件必须包含 uiSessionId、ptySessionId、traceId。
6. 不允许再用 session_id 当 registry key。

B. 修 Claude Discovery
1. 废弃 “powershell exists 就 selected” 的逻辑。
2. 新增 LaunchPlan Matrix。
3. 优先 node.exe + Claude CLI JS。
4. 只有 canary 通过的 powershell/cmd 才能被选择。
5. 当前 powershell.exe 0xc0000142 必须显示为 failed，不得 selected。
6. Discovery 失败必须给出明确建议：install Node/Claude CLI 或 set CTRL_CC_CLAUDE_COMMAND。

C. 修 Diagnostics
1. 0 frontend sessions + 0 backend sessions 不得显示 ALL CONTRACTS PASSED。
2. 改为 NOT TESTED — NO SESSIONS。
3. Runtime Contract Test 必须真实创建 session、启动 PTY、检查 registry、检查 writer、写入测试、停止。
4. 显示失败阶段：discovery / launchPlan / openpty / spawn / registry / write / stop。

D. 重写 RuntimeBridge
1. RuntimeBridge 是唯一入口。
2. startInteractiveSession 生成 uiSessionId、ptySessionId、traceId。
3. 调用 runtime_start_interactive，传 uiSessionId 和 ptySessionId。
4. write 根据 uiSessionId 查 ptySessionId，再调用 runtime_write。
5. stop/resize/ctrlC/ctrlD 都走 runtime_v2。
6. 同步 legacy SessionStore/OpenSessionStore，直到旧 UI 完成迁移。

E. 删除 Surface split-brain
1. WorkspaceSurface 删除 startPtyV2ClaudeSession / stopPtyV2 import。
2. ProjectsSurface 删除 startPtyV2ClaudeSession import。
3. usePtyTerminal 删除 writePtyV2 / resizePtyV2 / sendCtrlC imports。
4. 全部改用 RuntimeBridge。
5. 全仓库搜索不得再出现 surface 直接 import interactionAdapter。

F. 落地新页面结构
1. 创建 src/features/console/pages/ConsoleSurface.tsx。
2. 创建 src/features/projects/pages/ProjectsSurface.tsx。
3. 创建 src/features/resources/pages/ResourcesSurface.tsx。
4. 创建 src/features/dock/pages/AIDockSurface.tsx。
5. 修改 SurfaceHost 引用 feature pages，而不是旧 src/surfaces。
6. 旧 pages 可保留但不再挂载。

G. Console 11.0
实现 Mission Control：
- ConsoleTopCommandBar
- WelcomeMissionHero
- RuntimeHealthStrip
- QuickStartDeck
- ActiveWorkBoard
- NeedAttentionQueue
- TodayPulseWaterfall
- RecentActivityTimeline
- ProAnalyticsTabs
所有 Runtime 操作只走 RuntimeBridge。

H. Projects 11.0
实现 Project Operations Center：
- ProjectNav
- ProjectOperationsCanvas
- ProjectHero
- RuntimeActionRibbon
- SessionWaterfall
- SessionRuntimeCard
- ProjectInspector
所有 New/Continue/Resume/Fork/Stop 只走 RuntimeBridge。

I. Resources 11.0
实现 Capability & Context Center：
- ResourcesTopCommandBar
- ResourceNav
- ResourceGrid/List/Split
- ResourceInspector
- ResourceActivationPanel
- ResourceDiagnosticsPanel
- ResourceCreateWizard
- ResourceBulkActionBar
新增 ResourceActivationBridge。
Skill/Template/Memory 可插入 ChatComposer。
Hook/MCP/Rule/CLAUDE.md 可应用到 Project。

J. AI Dock 11.0
1. 当前 components/dock/AIDock.tsx 降级为 launcher。
2. 新增独立 Tauri window ai-dock。
3. 新增 DockSnapshotPublisher。
4. 新增 DockActionBridge。
5. Dock Quick Prompt -> RuntimeBridge.write(active uiSessionId)。
6. Dock Ctrl+C/Stop -> RuntimeBridge。

K. 验收命令
- npm run typecheck
- npm run build
- cargo check --manifest-path src-tauri/Cargo.toml

L. E2E 验收
1. Diagnostics 空状态显示 NOT TESTED，不是假通过。
2. Discovery 不再选择会 0xc0000142 的 powershell。
3. Console -> New Session -> Workspace -> Terminal 显示真实 Claude。
4. ChatComposer -> RuntimeBridge.write -> runtime_write -> 同一 PTY。
5. Projects -> New Session 不再直接调用 interactionAdapter。
6. Resources -> Insert Skill -> ChatComposer -> Send。
7. Dock -> Quick Prompt -> active PTY。
8. ErrorLog 和 Diagnostics 能解释任何失败。
```

---

# 10. 最终验收清单

## Runtime

```text
[ ] `powershell.exe 0xc0000142` 不再被 selected launch plan。
[ ] direct node launch plan 可用，或给出明确不可用原因。
[ ] Runtime registry key = ptySessionId。
[ ] RuntimeBridge.write 传 ptySessionId，不传 uiSessionId。
[ ] Workspace / Projects / Terminal 不再直接调用 interactionAdapter。
[ ] `Session not found: ses-xxx` 永久消失。
```

## Diagnostics

```text
[ ] 空状态不显示 ALL CONTRACTS PASSED。
[ ] Contract Test 会真实创建 session。
[ ] Failure 显示具体阶段。
[ ] 可以复制 Diagnostic Bundle。
```

## UI / Product

```text
[ ] Console 不再是旧统计页，而是 Mission Control。
[ ] Projects 不再是旧双栏管理页，而是 Project Operations Center。
[ ] Resources 不再是文件浏览器，而是 Capability & Context Center。
[ ] AI Dock 不再是主窗口 fixed div，而是独立 Runtime Controller。
[ ] SurfaceHost 引用新的 feature pages。
```

## 商用级

```text
[ ] 四主题兼容。
[ ] 所有按钮有 loading/success/error 状态。
[ ] 无假数据。
[ ] 无 silent catch。
[ ] 无无界 raw output。
[ ] Safe Mode 可进入。
[ ] Runtime failure 可恢复。
```
