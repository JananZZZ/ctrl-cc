# Ctrl-CC Supreme RuntimeBridge 5.0：不妥协最终修复方案

> **直接发给 Claude Code CLI 执行。**
>
> 本方案不是“临时禁用”“将就绕过”“先凑合能跑”。  
> 本方案的目标是一次性建立 Ctrl-CC 的最终 Runtime 内核，使 GUI 内 Claude Code CLI 达到：
>
> ```text
> 100%：真实 Claude Code CLI interactive PTY 能力
> 200%：结构化解析、可视化、状态线、hooks、semantic cards
> 500%：Projects / Workspace / Chat / Console / AI Dock / Resources / Diagnostics 全系统联动
> ```
>
> 当前项目已经出现 React #185、cmd.exe 0xc0000142、点击新建会话后卡死、Workspace 不稳定跳转等问题。  
> 这些不是单点 bug，而是 Runtime 架构不统一、前端副作用失控、PTY 启动阻塞、日志流过载共同导致。
>
> 这次必须做 **RuntimeBridge 5.0 总重建**：删掉双轨 Runtime，建立单一 RuntimeKernel，所有页面只能通过 RuntimeBridge 操作 Claude Code CLI。

---

# 0. 最终原则

## 0.1 不再接受双轨 Runtime

当前代码中出现过：

```text
旧 PTY 通道：
pty_start_claude_session
pty_v2_write
pty_v2_resize
pty_send_ctrl_c
pty_v2_stop
pty://data
pty://status
pty://exit
pty://error

新 runtime 通道：
pty_start_claude
pty_write
pty_resize
pty_stop
structured_run
```

这会导致：

```text
Projects 调一套
Workspace 监听一套
Chat 写一套
Console 读一套
Dock 猜一套
```

必须统一成：

```text
RuntimeBridge 5.0
  -> RuntimeKernel
      -> InteractionAdapter
      -> StructuredAdapter
      -> TelemetryAdapter
      -> GovernanceAdapter
```

所有旧命令和新命令只允许被 Adapter 内部调用。  
Projects / Workspace / Chat / Console / Dock / Resources 不允许直接 invoke PTY command。

---

# 1. RuntimeBridge 5.0 总架构

```text
Frontend Surfaces
├── Projects
├── Workspace
├── Chat
├── Console
├── AI Dock
├── Resources
└── Diagnostics
        │
        ▼
RuntimeBridge API
        │
        ▼
RuntimeKernel
├── Interaction Plane
│   ├── CanonicalPtySession
│   ├── Terminal IO
│   ├── ChatComposer IO
│   ├── Ctrl+C / Ctrl+D / Resize / Stop
│   └── Windows Shell Strategy
├── Structured Plane
│   ├── claude -p
│   ├── stream-json
│   └── batch tasks
├── Telemetry Plane
│   ├── statusLine
│   ├── hooks
│   ├── transcript reader
│   ├── git watcher
│   └── file watcher
└── Governance Plane
    ├── permissions
    ├── risk
    ├── audit
    ├── process cleanup
    └── orphan guard
```

---

# 2. 100%：真实 Interactive Claude Code CLI

Claude Code CLI 的 interactive 命令是 `claude`，`claude "query"` 可带初始 prompt，`claude -p` 是 SDK/print 模式，`--continue` 和 `--resume` 用于继续/恢复 session。`--output-format stream-json` 属于 print mode，不能冒充 interactive 当前会话。

因此：

```text
Interactive Chat:
  必须走 PTY + claude

Structured Task:
  才能走 claude -p --output-format stream-json
```

ChatComposer 禁止：

```text
claude -p
隐藏启动新 session
等待 Claude response 后才更新 UI
```

ChatComposer 只能：

```text
writeToRuntimeSession(sessionId, userText + "\r")
```

---

# 3. 200%：语义增强不是从 PTY 原始输出硬猜

PTY raw output 只允许进入：

```text
xterm
raw log file
bounded tail buffer
```

不允许进入：

```text
ChatBlockRenderer
全局 ErrorLog 大列表
React 全局状态无限累积
```

语义增强来源必须是：

```text
Level A：statusLine JSON / hooks / stream-json / transcript
Level B：git watcher / file watcher / process watcher
Level C：PTY title / OSC hints / bounded regex hints
Level D：Unavailable
```

Claude Code statusLine 会把 session_id、transcript_path、cwd、model、workspace、version、cost 等 JSON 通过 stdin 传给配置的命令。Hooks 通过 settings 配置，可接 PreToolUse、PostToolUse 等事件。  
这些才是 200% 可视化的可靠数据源。

---

# 4. 500%：所有页面只通过 RuntimeBridge

## Projects

```text
New Session
Continue Session
Resume Session
Fork Session
Stop Session
Open Workspace
```

全部调用 RuntimeBridge。

## Workspace / Chat

```text
TerminalPane
ChatComposer
ChatSemanticPane
SessionMonitorPane
```

全部绑定同一个 `runtimeSessionId`。

## Console

只显示 RuntimeStore 派生状态，不自己启动 Claude。

## AI Dock

只发 RuntimeAction，不自己操作 PTY。

## Resources

只通过 ResourceActivationBridge 把资源插入 ChatComposer 或应用到项目配置，不直接运行 Claude。

## Diagnostics

只通过 RuntimeDiagnostics 运行 smoke tests 和 health checks。

---

# 5. 不妥协的 P0 目标

P0 不是临时方案。P0 是最终内核最小闭环。

必须一次做到：

```text
[ ] App 启动不再 React #185。
[ ] 所有自动副作用可控，不会无限 setState。
[ ] 点击新建会话 1 秒内进入 Workspace。
[ ] Workspace 新 tab 立即出现 Terminal starting 状态。
[ ] PTY 启动在后台进行，不阻塞 UI。
[ ] Windows shell 启动策略自动选择可用 strategy。
[ ] cmd.exe 失败时可 fallback，不会弹窗卡死主流程。
[ ] Claude CLI discovery 独立于 Workspace。
[ ] Terminal 显示真实 Claude Code CLI。
[ ] ChatComposer 输入进入同一个 PTY。
[ ] Ctrl+C / Stop / Resize 生效。
[ ] Stop 后无残留 Ctrl-CC 管理的 child process。
[ ] ErrorLog 不吃 PTY raw output。
[ ] ChatBlockRenderer 不吃 PTY raw output。
```

---

# 6. 必须删除 / 冻结的危险路径

## 6.1 全局搜索

```bash
rg "pty_start_claude"
rg "pty_write"
rg "pty_resize"
rg "pty_stop"
rg "pty_start_claude_session"
rg "pty_v2_write"
rg "pty://data"
rg "startInteractiveClaudeSession"
rg "openSessionTab"
rg "navigateToWorkspace"
rg "ChatBlockRenderer"
rg "ErrorLog"
rg "useEffect"
```

## 6.2 外部页面禁止直接 invoke

任何 surface 里如果出现：

```ts
invoke("pty_start_claude")
invoke("pty_start_claude_session")
invoke("pty_v2_write")
invoke("pty_write")
```

全部删除，改为：

```ts
RuntimeBridge.startInteractiveSession(...)
RuntimeBridge.write(...)
RuntimeBridge.stop(...)
RuntimeBridge.ctrlC(...)
RuntimeBridge.resize(...)
```

只有 Adapter 内可以 invoke Tauri command。

---

# 7. React #185 根治要求

React #185 是 Maximum update depth exceeded，说明 setState/update 循环。必须根治，不是隐藏。

## 7.1 禁止 render 中副作用

禁止：

```tsx
if (selectedProject) {
  selectProject(selectedProject.id);
}

if (activeSession) {
  openSessionTab(activeSession);
}

navigateToWorkspace(sessionId);
```

## 7.2 所有 useEffect 必须可证明不会自触发

每个新增/修改的 `useEffect` 必须满足：

```text
1. dependency 稳定。
2. effect 内 setState 不会改变自身 dependency。
3. 有 cleanup。
4. interval/listener 只安装一次。
```

## 7.3 Store selector 不返回新对象

禁止：

```ts
const state = useStore((s) => ({ a: s.a, b: s.b }));
```

除非使用 `shallow`。

## 7.4 AppErrorBoundary 必须输出 componentStack

生产环境不能只显示 minified error。必须把真实 componentStack 保存到：

```text
localStorage["ctrlcc:last-react-error"]
```

并提供 Diagnostics 按钮复制。

---

# 8. Windows Shell Strategy：不再单押 cmd.exe

cmd.exe 0xc0000142 说明不能假设 cmd 永远可用。  
最终 RuntimeKernel 必须支持多策略：

```text
Strategy A：Direct executable
Strategy B：PowerShell + claude.ps1
Strategy C：cmd.exe + claude.cmd
Strategy D：pwsh
Strategy E：user configured shell/command override
Strategy F：manual diagnostic failure with exact reason
```

## 8.1 Claude Discovery

新增：

```rust
#[derive(Debug, Serialize)]
pub struct ClaudeDiscovery {
    pub candidates: Vec<ClaudeCandidate>,
    pub selected: Option<ClaudeCandidate>,
    pub shell_strategies: Vec<ShellStrategyResult>,
    pub errors: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct ClaudeCandidate {
    pub path: String,
    pub kind: String, // exe | cmd | ps1 | js | unknown
    pub runnable_by: Vec<String>, // direct | cmd | powershell | pwsh | node
}
```

Discovery 顺序：

```text
1. user configured override
2. where claude
3. where claude.cmd
4. where claude.ps1
5. npm prefix -g + known package paths
6. PATH scan
```

## 8.2 Shell smoke test

每种 shell strategy 必须先测试：

```text
echo CTRLCC_SHELL_OK
```

不能 echo 的 strategy 不能用于 interactive。

## 8.3 Claude version test

对每个 candidate + strategy 测试：

```text
claude --version
```

或等价 command。

## 8.4 Interactive PTY strategy

选出第一个满足：

```text
shell echo ok
claude version ok
PTY echo ok
```

的 strategy。

失败时必须显示完整诊断，不允许让主 UI 卡死。

---

# 9. Canonical RuntimeSession 数据模型

创建：

```text
src/features/runtime/types/runtimeTypes.ts
```

```ts
export type RuntimeMode = "interactive-pty" | "structured-print";

export type RuntimeSessionStatus =
  | "created"
  | "workspace-opened"
  | "discovering"
  | "shell-testing"
  | "pty-starting"
  | "pty-ready"
  | "claude-launching"
  | "claude-active"
  | "waiting-permission"
  | "idle"
  | "failed"
  | "exited"
  | "killed";

export interface RuntimeSession {
  id: string;
  projectId: string;
  projectName: string;
  cwd: string;
  name: string;
  mode: RuntimeMode;
  status: RuntimeSessionStatus;
  shellStrategy?: string | null;
  claudeCommand?: string | null;
  error?: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt?: string | null;
  exitedAt?: string | null;
}

export interface RuntimeEvent {
  id: string;
  ts: string;
  sessionId?: string;
  projectId?: string;
  type:
    | "session.created"
    | "workspace.opened"
    | "discovery.started"
    | "discovery.finished"
    | "pty.output"
    | "pty.status"
    | "pty.error"
    | "pty.exit"
    | "composer.submit"
    | "statusline.snapshot"
    | "hook.event"
    | "structured.event"
    | "risk.detected"
    | "audit.event";
  level: "debug" | "info" | "warning" | "error";
  message: string;
  payload?: unknown;
}
```

---

# 10. RuntimeStore：有界、轻量、不吃原始流

```ts
interface RuntimeState {
  sessions: Record<string, RuntimeSession>;
  activeSessionId: string | null;

  events: RuntimeEvent[];          // max 200
  ptyTail: Record<string, string>; // max 32KB per session
  diagnostics: RuntimeDiagnostics | null;

  addSession(session: RuntimeSession): void;
  patchSession(id: string, patch: Partial<RuntimeSession>): void;
  appendEvent(event: Omit<RuntimeEvent, "id" | "ts">): void;
  appendPtyTail(sessionId: string, chunk: string): void;
}
```

Hard rule：

```text
events 最多 200 条
ptyTail 每 session 最多 32KB
原始 PTY 全量写文件，不进 React state
```

---

# 11. Workspace 一定先打开

`RuntimeBridge.startInteractiveSession` 必须这样：

```ts
export async function startInteractiveSession(input: StartInteractiveInput) {
  const session = createRuntimeSession(input);

  runtimeStore.addSession(session);
  workspaceStore.openTab(session);
  navigateToWorkspace(session.id);

  // 后台启动，不阻塞 UI
  queueMicrotask(() => {
    void RuntimeKernel.startInteractiveInBackground(session.id, input);
  });

  return session;
}
```

禁止：

```ts
await RuntimeKernel.start(...)
navigateToWorkspace(...)
```

---

# 12. RuntimeKernel 后台启动流程

```text
startInteractiveInBackground(sessionId)
├── patch status: discovering
├── discoverClaudeAndShellStrategies()
├── patch status: shell-testing
├── runShellSmokeTests()
├── runClaudeVersionTests()
├── patch status: pty-starting
├── startPtyWithSelectedStrategy()
├── patch status: pty-ready
├── write claude command
├── patch status: claude-launching
├── detect first Claude output or timeout warning
└── patch status: claude-active / failed
```

所有步骤都要：

```text
try/catch
timeout
appendEvent
write debug file
never block UI
```

---

# 13. Tauri 后端：RuntimeKernel Commands

统一新增后端 command，旧命令内部可复用，但外部只用这些：

```rust
runtime_discover
runtime_start_pty
runtime_write
runtime_resize
runtime_ctrl_c
runtime_ctrl_d
runtime_stop
runtime_kill_orphans
runtime_smoke_test
runtime_get_debug_log_path
```

旧命令可以保留，但前端不许直接调用。

---

# 14. RuntimeDiagnostics 页面

必须有一个独立页面/面板：

```text
Diagnostics -> Runtime
```

包含：

```text
1. React last error
2. Runtime discovery
3. Shell strategy matrix
4. Claude candidate matrix
5. PTY smoke test
6. Claude version test
7. Interactive launch test
8. Orphan process list
9. Debug log path
10. Copy full diagnostic bundle
```

这样以后再出问题，不再靠截图猜。

---

# 15. Chat 全功能架构

```text
WorkspaceSurface
├── WorkspaceTabs
├── ChatPane
│   ├── ChatSemanticPane
│   ├── ActiveResourcesBar
│   └── ChatComposer
├── TerminalPane
│   └── xterm
└── SessionMonitorPane
    ├── Runtime status
    ├── Claude discovery
    ├── shell strategy
    ├── statusLine
    ├── hooks
    ├── cost/token/context
    ├── risks
    └── audit
```

## 15.1 ChatComposer

```ts
RuntimeBridge.write(sessionId, prompt + "\r")
```

## 15.2 ChatSemanticPane

只渲染：

```text
composer.submit
statusline.snapshot
hook.event
structured.event
file.diff
permission.requested
risk.detected
summary
```

不渲染 PTY raw chunk。

## 15.3 TerminalPane

只负责：

```text
PTY raw output
keyboard input
resize
ctrl+c
clear/search/replay
```

---

# 16. Resources 连接

ResourceActivationBridge：

```text
Skill / Template / Memory
  -> append ChatComposer draft
  -> active resource chip

Hook / MCP / Rule / CLAUDE.md
  -> apply to project config
  -> diagnostic
  -> requires new/continued session

Pack
  -> batch apply
```

Resources 不运行 Claude。  
Resources 只调用 RuntimeBridge 或 WorkspaceStore。

---

# 17. Console 连接

Console 不启动 Claude。  
Console 只显示 RuntimeStore 派生状态：

```text
running sessions
waiting permissions
failed sessions
token/cost if statusLine available
resource health
diagnostics
```

按钮：

```text
New Session -> RuntimeBridge.startInteractiveSession
Open Session -> RuntimeBridge.openWorkspace
Stop -> RuntimeBridge.stop
Ctrl+C -> RuntimeBridge.ctrlC
```

---

# 18. AI Dock 连接

Dock 是 Runtime 遥控器：

```text
Quick Prompt -> RuntimeBridge.write
Open Workspace -> RuntimeBridge.openWorkspace
Ctrl+C -> RuntimeBridge.ctrlC
Stop -> RuntimeBridge.stop
```

Dock Snapshot 来自 RuntimeStore / ResourceStore / DiagnosticsStore。  
Dock 不直接 invoke PTY。

---

# 19. ErrorLog 重建

ErrorLog 不再显示所有 `pty.output`。  
它只显示：

```text
runtime.error
pty.error
discovery.failed
smoke.failed
react.error
audit.warning
risk.detected
```

限制：

```text
max 200
payload collapsed
no raw PTY chunks
```

---

# 20. 不妥协执行顺序

## Stage 1：止血但不是妥协

```text
1. 修 React #185。
2. 删除/停用所有 render-time side effects。
3. 加 ErrorBoundary componentStack。
4. ErrorLog 限流。
5. 禁止所有 surface 直接 invoke PTY。
```

这是最终架构的地基，不是临时妥协。

## Stage 2：建立 RuntimeKernel

```text
1. runtimeTypes
2. runtimeStore
3. RuntimeBridge
4. RuntimeKernel
5. InteractionAdapter
6. Diagnostics
```

## Stage 3：Workspace/Chat 接入

```text
1. WorkspaceStore
2. WorkspaceSurface
3. TerminalPane
4. ChatComposer
5. ChatSemanticPane
6. SessionMonitorPane
```

## Stage 4：Projects/Console/Dock/Resources 接入

全部改为 RuntimeBridge。

## Stage 5：200% Telemetry

```text
statusLine
hooks
structured_run
transcript reader
git/file watcher
```

## Stage 6：500% Governance

```text
risk
permission
audit
orphan guard
diagnostic bundle
session replay
resource packs
```

---

# 21. 给 Claude CLI 的最终执行 Prompt

```text
执行 Ctrl-CC Supreme RuntimeBridge 5.0，不要再做临时补丁。

当前问题：
- React #185 无限更新。
- cmd.exe 0xc0000142。
- 点击新建会话后卡死。
- Workspace 不稳定跳转。
- src/features/runtime 和 workspace 不完整。
- 旧 PTY 和新 PTY 双轨冲突。
- ChatBlockRenderer 可能被误用来承载 PTY raw output。

目标：
一次性建立最终 RuntimeBridge 5.0：
100% 真实 Claude Code CLI PTY；
200% statusLine/hooks/structured event 语义可视化；
500% Projects/Workspace/Chat/Console/Dock/Resources/Diagnostics 全系统联动。

硬性架构：
1. 所有页面禁止直接 invoke PTY command。
2. 所有页面只调用 RuntimeBridge。
3. RuntimeBridge 内部调用 RuntimeKernel。
4. RuntimeKernel 内部调用 Adapter。
5. Interactive Claude 只走 PTY。
6. Structured task 才走 claude -p。
7. ChatComposer 只写当前 runtime session 的 PTY。
8. PTY raw output 只进 xterm/raw log/bounded tail。
9. ChatBlockRenderer 只吃 semantic events。
10. New Session 必须 1 秒内打开 Workspace，然后后台启动 PTY。

必须实现：
- src/features/runtime/types/runtimeTypes.ts
- src/features/runtime/stores/runtimeStore.ts
- src/features/runtime/services/runtimeBridge.ts
- src/features/runtime/services/runtimeKernel.ts
- src/features/runtime/services/interactionAdapter.ts
- src/features/runtime/services/structuredAdapter.ts
- src/features/runtime/services/telemetryNormalizer.ts
- src/features/runtime/services/runtimeDiagnostics.ts
- src/features/workspace/stores/workspaceStore.ts
- src/features/workspace/pages/WorkspaceSurface.tsx
- src/features/workspace/components/TerminalPane.tsx
- src/features/workspace/components/ChatComposer.tsx
- src/features/workspace/components/ChatSemanticPane.tsx
- src/features/workspace/components/SessionMonitorPane.tsx

必须修：
1. React #185：查 useEffect/setState/navigate/openSessionTab loop。
2. ErrorBoundary：保存 componentStack。
3. ErrorLog：max 200，禁止 raw PTY。
4. usePtyTerminal：关闭 WebGL，resize debounce。
5. Projects：新建会话改为 RuntimeBridge.startInteractiveSession。
6. Console/Dock/Resources：全部改为 RuntimeBridge 或 ResourceActivationBridge。
7. main.rs：旧 PTY / 新 PTY 不删也可以，但前端不许直接调用，只能 Adapter 调。
8. Windows Shell Strategy：cmd/powershell/pwsh/user override 多策略 discovery + smoke test。
9. Diagnostics Runtime 面板：shell matrix、claude candidate matrix、PTY smoke、version、interactive launch、debug log path。

验收：
- App 启动不出现 React #185。
- Runtime Diagnostics 可以输出完整 JSON bundle。
- cmd/powershell strategy 至少一个 shell echo 成功，否则给出精确错误。
- claude --version 成功或给出精确 PATH/auth 错误。
- 点击 New Session 1 秒内进入 Workspace。
- Workspace tab 不等 Claude ready。
- Terminal 显示真实 Claude Code CLI。
- ChatComposer 输入进入同一个 PTY。
- Ctrl+C 生效。
- Stop 生效且无残留子进程。
- ChatBlockRenderer 不渲染 PTY raw output。
- npm run typecheck 通过。
- npm run build 通过。
- cargo check --manifest-path src-tauri/Cargo.toml 通过。

交付：
1. 修改文件清单。
2. 新 RuntimeBridge 调用链图。
3. 所有被禁止直接 invoke PTY 的 rg 结果。
4. React #185 修复点。
5. Windows shell strategy 诊断结果。
6. Manual E2E 测试结果。
```

---

# 22. 不接受的完成状态

以下任何一种都不算完成：

```text
1. 只是禁用 PTY，不恢复新建会话。
2. 只是绕开 cmd，不解决 React #185。
3. 只是让 claude --version 通过，但 interactive 不通。
4. Projects 仍然等待 Claude ready 后才跳 Workspace。
5. ChatComposer 仍然调用 claude -p。
6. Terminal 和 Chat 不是同一个 sessionId。
7. Console/Dock/Resources 仍然直接 invoke PTY。
8. ErrorLog 仍然记录所有 PTY 输出。
9. Stop 后残留 cmd/conhost/claude。
```

---

# 23. 最终目标状态

成功后，Ctrl-CC 的核心链路必须变成：

```text
Project New Session
  -> RuntimeBridge.startInteractiveSession
  -> RuntimeSession created
  -> Workspace tab opened immediately
  -> RuntimeKernel discovers shell/claude strategy
  -> PTY starts in background
  -> Claude interactive launches
  -> Terminal renders raw output
  -> ChatComposer writes same PTY
  -> Telemetry creates semantic events
  -> ChatBlockRenderer renders semantic cards
  -> Console/Dock/Resources read same RuntimeStore
```

这才是：

```text
100% 原生能力
200% 可视化增强
500% 系统级管理效率
```
