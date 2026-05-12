# Ctrl-CC Stability-First Supreme Architecture 7.0  
## 项目记忆固化 + 商业级稳定性底座 + 100%/200%/500% 全链路升级执行方案

> **可直接发送给 Claude Code CLI 执行。**  
> 本文档是在 `Ctrl-CC Stability-First Supreme Architecture 6.0` 基础上，根据最近几轮实际修复结果进一步升级的最终执行方案。  
> 重点不是继续“临时修 bug”，而是把底层工程规范、软件架构原则、编程原则、调试原则、性能原则、Runtime 规则全部固化到项目记忆中，让 Claude Code 每次修改前都必须读取并遵守。

---

# 0. 当前真实进展与新判断

最近几轮修改已经证明：

```text
1. React #185 已经定位并阶段性解决。
   Workspace / Chat 页面现在可以进入。

2. 新建会话已能打开 Chat/Workspace tab。
   说明 Projects -> Workspace 的前端跳转链路已有进展。

3. 但后端 Runtime 仍然没有真实打通。
   当前仍然出现：
   - cmd.exe 0xc0000142
   - claude spawn failed: program not found
   - Session not found: ses-xxx
   - ErrorLog 显示 0，但顶部已有错误
   - Chat bubble 显示“你好”，但实际未成功写入后端 PTY

4. 因此，当前问题已经从“前端无法进入 Workspace”升级为：
   RuntimeBridge / RuntimeKernel / Shell Discovery / Session ID 合约 / ErrorEvent 统一 / Composer ready gate 没有完全工程化。
```

所以 7.0 不是重写 6.0，而是把 6.0 的稳定性理念落成 **可执行工程制度**：

```text
Architecture Principles -> Project Memory -> Preflight Checklist -> Code Rules -> Runtime Gates -> CI Gates -> E2E Gates
```

---

# 1. 7.0 的最高目标

Ctrl-CC 要达到：

```text
100%：真实 Claude Code CLI interactive PTY 能力
200%：statusLine / hooks / structured event / semantic cards 可视化增强
500%：Projects / Workspace / Chat / Console / AI Dock / Resources / Diagnostics 全系统联动治理
```

但必须先满足商业级稳定性底座：

```text
1. 不崩溃
2. 不未响应
3. 不假成功
4. 不隐藏错误
5. 不污染 UI 主线程
6. 不留下孤儿进程
7. 不让不同页面各自操作 Claude / PTY
8. 不让 Claude CLI 每次修代码时忘掉底层规范
```

---

# 2. 项目记忆固化：先让 Claude CLI 永远记住这些规则

## 2.1 必须新增的记忆与规范文件

请创建以下文件：

```text
CLAUDE.md

docs/engineering/
├── 00_READ_FIRST.md
├── 01_ARCHITECTURE_PRINCIPLES.md
├── 02_RUNTIME_BRIDGE_CONTRACT.md
├── 03_REACT_STABILITY_RULES.md
├── 04_TAURI_RUST_BACKEND_RULES.md
├── 05_PTY_AND_CLAUDE_CLI_RULES.md
├── 06_OBSERVABILITY_AND_DIAGNOSTICS.md
├── 07_PERFORMANCE_BUDGET.md
├── 08_UI_UX_AND_THEME_RULES.md
├── 09_TESTING_AND_ACCEPTANCE_GATES.md
├── 10_DEBUGGING_PROTOCOL.md
└── 11_AGENT_OPERATING_PROTOCOL.md

.claude/
├── commands/
│   ├── preflight.md
│   ├── runtime-audit.md
│   ├── react-audit.md
│   ├── pty-audit.md
│   ├── stability-check.md
│   └── release-gate.md
└── rules/
    ├── runtime-bridge.md
    ├── react-stability.md
    ├── tauri-rust.md
    ├── observability.md
    └── ui-theme.md
```

---

## 2.2 根目录 CLAUDE.md 内容

根目录 `CLAUDE.md` 必须是项目最高级工程记忆。  
写入以下内容：

```md
# Ctrl-CC Project Memory

## Read-first rule

Before modifying any code, always read and follow:

- @docs/engineering/00_READ_FIRST.md
- @docs/engineering/01_ARCHITECTURE_PRINCIPLES.md
- @docs/engineering/02_RUNTIME_BRIDGE_CONTRACT.md
- @docs/engineering/03_REACT_STABILITY_RULES.md
- @docs/engineering/04_TAURI_RUST_BACKEND_RULES.md
- @docs/engineering/05_PTY_AND_CLAUDE_CLI_RULES.md
- @docs/engineering/06_OBSERVABILITY_AND_DIAGNOSTICS.md
- @docs/engineering/07_PERFORMANCE_BUDGET.md
- @docs/engineering/08_UI_UX_AND_THEME_RULES.md
- @docs/engineering/09_TESTING_AND_ACCEPTANCE_GATES.md
- @docs/engineering/10_DEBUGGING_PROTOCOL.md
- @docs/engineering/11_AGENT_OPERATING_PROTOCOL.md

## Non-negotiable architecture rules

1. All surfaces must use RuntimeBridge. No page may directly invoke PTY or Claude commands.
2. RuntimeKernel is the only owner of Claude discovery, shell strategy, PTY lifecycle, session registry, process registry, watchdog, and orphan cleanup.
3. Projects / Console / AI Dock / Resources / Diagnostics must not spawn Claude or PTY directly.
4. Workspace Terminal is the raw PTY view. ChatSemanticPane is semantic only.
5. ChatComposer writes to the same RuntimeSession through RuntimeBridge.write().
6. Interactive Claude Code must use PTY + `claude`.
7. `claude -p` is only for structured/batch tasks and must never impersonate the current interactive chat.
8. PTY raw output goes only to xterm, raw log, and bounded tail buffer.
9. ErrorLog must not render raw PTY output.
10. All runtime errors must enter RuntimeEventStore, ErrorLog, Session Timeline, and Diagnostic Bundle.
11. Store actions must be idempotent.
12. Components must not perform side effects during render.
13. useEffect must not update its own dependency loop.
14. Tauri event listeners must unlisten on cleanup.
15. Long-running work must not block UI rendering.
16. Every user action must produce feedback within 100 ms.
17. New Session must open Workspace within 1 second before backend Runtime is fully ready.
18. Failure must be visible, classified, recoverable, and copyable.
19. No silent failure. No fake success.
20. Before every change, run the preflight checklist.

## Required validation after code changes

Run:

```bash
npm run typecheck
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

If runtime code is changed, also run manual smoke tests:

1. App launch
2. React no #185
3. Runtime discovery
4. shell strategy test
5. claude --version
6. New Session -> Workspace within 1s
7. Terminal shows true Claude Code CLI or precise failure
8. ChatComposer sends through RuntimeBridge
9. Ctrl+C works
10. Stop kills child process and no orphan remains
```

---

# 3. docs/engineering/00_READ_FIRST.md

```md
# 00 Read First

This repository must be developed as a stability-first desktop runtime platform.

Every task must begin with:

1. Read CLAUDE.md.
2. Read all docs/engineering files imported by CLAUDE.md.
3. Identify which layer is touched:
   - App Shell
   - RuntimeBridge
   - RuntimeKernel
   - Interaction Plane
   - Structured Plane
   - Telemetry Plane
   - Governance Plane
   - Observability Plane
   - Performance Plane
   - Recovery Plane
4. State the allowed files to modify.
5. State the forbidden files to modify.
6. Check if the change violates RuntimeBridge isolation.
7. Check if it can create React update loops.
8. Check if it can block the UI thread.
9. Check if it can flood React state with raw PTY output.
10. Check if it can leave orphan processes.

Never start coding before completing this preflight.
```

---

# 4. docs/engineering/01_ARCHITECTURE_PRINCIPLES.md

```md
# 01 Architecture Principles

## Architecture

Ctrl-CC is a Stability-First Desktop Runtime Platform.

Layers:

1. App Shell Layer
   - Windows, layout, navigation, theme, global error boundaries.
   - Must not spawn PTY or Claude.

2. RuntimeBridge Layer
   - Only public API used by UI surfaces.
   - Owns stable frontend contract.

3. RuntimeKernel Layer
   - Owns Claude discovery, shell strategy, PTY lifecycle, process registry, watchdog.

4. Interaction Plane
   - Real PTY and terminal interaction.
   - Claude interactive sessions run here.

5. Structured Plane
   - claude -p, stream-json, batch tasks.
   - Must not impersonate interactive chat.

6. Telemetry Plane
   - statusLine, hooks, transcript, git/file/process watcher.

7. Governance Plane
   - permissions, risk, audit, session replay, resource activation.

8. Observability Plane
   - events, traces, logs, diagnostics, health center.

9. Performance Plane
   - throttling, debouncing, virtualization, bounded stores.

10. Recovery Plane
   - error boundaries, safe mode, circuit breakers, watchdog, orphan cleanup.

## Rule

No feature may bypass RuntimeBridge or write directly to PTY/Claude from UI surfaces.
```

---

# 5. docs/engineering/02_RUNTIME_BRIDGE_CONTRACT.md

```md
# 02 RuntimeBridge Contract

## Public frontend API

Only RuntimeBridge exposes runtime actions:

```ts
RuntimeBridge.startInteractiveSession(input)
RuntimeBridge.write(uiSessionId, data)
RuntimeBridge.ctrlC(uiSessionId)
RuntimeBridge.ctrlD(uiSessionId)
RuntimeBridge.resize(uiSessionId, rows, cols)
RuntimeBridge.stop(uiSessionId)
RuntimeBridge.restart(uiSessionId)
RuntimeBridge.runStructuredTask(input)
RuntimeBridge.openWorkspace(uiSessionId)
RuntimeBridge.getSession(uiSessionId)
RuntimeBridge.getDiagnostics()
```

## Forbidden from UI surfaces

Never call these from Projects / Workspace / Chat / Console / Dock / Resources:

```ts
invoke("pty_start_claude")
invoke("pty_write")
invoke("pty_resize")
invoke("pty_stop")
invoke("pty_start_claude_session")
invoke("pty_v2_write")
invoke("pty_v2_resize")
invoke("pty_send_ctrl_c")
invoke("pty_v2_stop")
invoke("structured_run")
```

Only RuntimeBridge adapters may call backend commands.

## ID contract

Use three different IDs:

```ts
type UiSessionId = string;      // ses-xxx
type PtySessionId = string;     // pty-xxx
type ClaudeSessionId = string;  // Claude Code session id
```

RuntimeSession:

```ts
interface RuntimeSession {
  id: UiSessionId;
  ptySessionId: PtySessionId | null;
  claudeSessionId?: ClaudeSessionId | null;
}
```

ChatComposer must call:

```ts
RuntimeBridge.write(uiSessionId, text + "\r")
```

RuntimeBridge must map UiSessionId -> PtySessionId internally.

## New Session rule

New Session flow:

```text
create RuntimeSession
open Workspace tab
navigate Workspace
start RuntimeKernel background task
discover shell/claude
start PTY
register writer
launch Claude
enable Composer
```

Never wait for Claude readiness before opening Workspace.
```

---

# 6. docs/engineering/03_REACT_STABILITY_RULES.md

```md
# 03 React Stability Rules

## Forbidden

1. No store writes during render.
2. No navigation during render.
3. No Runtime start during render.
4. No useEffect without stable dependencies.
5. No useEffect that updates its own dependencies.
6. No selector returning a new object unless using shallow.
7. No unbounded event list in React state.
8. No raw PTY chunk list in React state.

## Required

1. All store actions must be idempotent.
2. All intervals must cleanup.
3. All Tauri listeners must unlisten.
4. All expensive derived data must use useMemo.
5. All callbacks passed to memoized children should use useCallback where meaningful.
6. ErrorBoundary must exist at:
   - App
   - Surface
   - Panel
   - Widget

## Idempotent store action template

```ts
setMode: (next) =>
  set((state) => {
    if (state.mode === next) return state;
    return { mode: next };
  });
```

## Selector rule

Bad:

```ts
const data = useStore((s) => ({ a: s.a, b: s.b }));
```

Good:

```ts
const a = useStore((s) => s.a);
const b = useStore((s) => s.b);
```

or use shallow explicitly.
```

---

# 7. docs/engineering/04_TAURI_RUST_BACKEND_RULES.md

```md
# 04 Tauri Rust Backend Rules

## Command rules

Tauri commands must return quickly.

Forbidden inside Tauri commands:

1. child.wait()
2. blocking reader loop
3. long filesystem scan
4. synchronous diagnostic bundle generation
5. waiting for Claude ready
6. waiting for PTY output
7. holding Mutex while reading/waiting/emitting

Long tasks must run in background thread/task.

## PTY rules

Backend PTY session is valid only after:

1. openpty success
2. spawn selected shell success
3. writer acquired
4. reader thread started
5. session handle inserted into registry

Only then may backend emit pty-ready.

Spawn failure must return Err and emit RuntimeEvent error. Do not emit fake process-created.

## Registry

PTY registry key must be PtySessionId.

## Mutex rules

Lock only for short mutation/read. Never hold lock during:

1. read loop
2. wait
3. emit
4. filesystem scan
5. process kill wait
```

---

# 8. docs/engineering/05_PTY_AND_CLAUDE_CLI_RULES.md

```md
# 05 PTY and Claude CLI Rules

## Interactive vs structured

Interactive Chat uses:

```text
PTY + claude
```

Structured tasks use:

```text
claude -p
stream-json
```

Do not use claude -p to impersonate current interactive Chat.

## Windows shell strategy

Never assume cmd.exe works.

Shell strategy matrix:

1. user override
2. PowerShell + claude.ps1 / Get-Command claude
3. pwsh
4. cmd + claude.cmd
5. direct executable
6. node package entry

Every strategy must pass:

1. shell echo
2. claude --version
3. PTY echo

## Discovery

Check:

```text
where claude
where claude.cmd
where claude.ps1
powershell Get-Command claude
npm prefix -g
%APPDATA%\npm
```

## Composer ready gate

Disable ChatComposer until session.status is one of:

```text
pty-ready
claude-launching
claude-active
idle
waiting-permission
```

Do not append user bubbles before successful send unless status is sending and can be marked failed.

## Message status

Use:

```ts
type ChatMessageStatus = "sending" | "sent" | "failed";
```
```

---

# 9. docs/engineering/06_OBSERVABILITY_AND_DIAGNOSTICS.md

```md
# 06 Observability and Diagnostics

## Event schema

```ts
interface RuntimeEvent {
  id: string;
  traceId: string;
  ts: string;
  source: "ui" | "runtime" | "pty" | "diagnostics" | "resources" | "dock";
  type: string;
  level: "debug" | "info" | "warning" | "error";
  sessionId?: string;
  projectId?: string;
  message: string;
  payload?: unknown;
}
```

## Error unification

All errors must enter:

1. RuntimeEventStore
2. ErrorLog
3. Session Timeline
4. Diagnostic Bundle

No top-only error. No hidden error.

## Bounded logs

```text
RuntimeEvent max 200
ErrorLog max 200
PTY tail max 32 KB/session
Raw PTY full log -> file only
```

## Diagnostic Bundle

Must include:

1. app version
2. OS
3. WebView2 version if available
4. route
5. React last error
6. render loop guard result
7. runtime sessions
8. shell strategy matrix
9. claude discovery
10. last 200 RuntimeEvents
11. last 32KB PTY tail
12. raw log path
13. orphan processes
14. settings snapshot
```

---

# 10. docs/engineering/07_PERFORMANCE_BUDGET.md

```md
# 07 Performance Budget

## UX budget

```text
Button feedback < 100 ms
Navigation visible response < 100 ms
Workspace tab open < 1 second
App initial interactive < 2 seconds
ErrorLog render typical < 16 ms
```

## Store budget

```text
RuntimeEvent max 200
ErrorLog max 200
PTY tail max 32 KB/session
No list > 500 DOM rows without virtualization
No raw PTY stream in React list
```

## Event budget

```text
Resize debounce >= 100 ms
Search debounce >= 150 ms
Snapshot interval >= 1000 ms
PTY tail coalesce interval >= 100 ms
```

## Lazy-load

Lazy load:

1. xterm
2. graph views
3. diagnostics bundle viewer
4. resource scanner
5. replay viewer
```

---

# 11. docs/engineering/08_UI_UX_AND_THEME_RULES.md

```md
# 08 UI UX and Theme Rules

## Visual system

Use Neo Calm Industrial with four themes:

1. light
2. dark
3. pale-blue
4. warm-sand

Use design tokens only. No hard-coded colors.

## Required theme variables

Use existing tokens:

```text
--cc-bg
--cc-surface
--cc-border-soft
--cc-text
--cc-text-muted
--cc-brand
--cc-red
--cc-amber
--cc-green
--cc-blue
--cc-shadow
--cc-radius
```

## UX error rule

Never show only "创建失败".

Show:

1. What failed
2. Which layer failed
3. Why it failed
4. What was attempted
5. What user can do
6. Copy diagnostics button

## Loading rule

Every async action must show:

1. immediate feedback
2. current phase
3. timeout
4. cancel/stop when possible
5. failure reason
```

---

# 12. docs/engineering/09_TESTING_AND_ACCEPTANCE_GATES.md

```md
# 09 Testing and Acceptance Gates

## Required commands

After code changes:

```bash
npm run typecheck
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

## Runtime smoke tests

1. App launch
2. React no #185
3. Runtime diagnostics opens
4. shell strategy matrix generated
5. claude discovery finds candidate or explains failure
6. claude --version succeeds or reports exact failure
7. New Session opens Workspace within 1s
8. Backend ptySessionId registered
9. ChatComposer disabled until ready
10. Send "你好" succeeds or marks message failed with retry
11. Ctrl+C works
12. Stop kills child process
13. no orphan remains
14. ErrorLog contains runtime errors
15. Diagnostic Bundle copy works

## Completion rule

If any acceptance gate fails, do not claim success.
```

---

# 13. docs/engineering/10_DEBUGGING_PROTOCOL.md

```md
# 10 Debugging Protocol

## Debug order

Never debug everything at once.

Order:

1. React stability
2. Runtime discovery
3. shell strategy
4. claude --version
5. PTY shell echo
6. backend session registry
7. Claude interactive launch
8. ChatComposer write
9. ErrorLog/Diagnostic bundle
10. Stop/orphan cleanup

## Required before making fixes

State:

1. observed symptom
2. failing layer
3. suspected root cause
4. files to inspect
5. exact search commands
6. expected invariant
7. proposed fix
8. validation plan

## Runtime issue classification

Use categories:

```text
react-loop
route-loop
event-flood
pty-spawn-failed
shell-strategy-failed
claude-not-found
session-id-mismatch
writer-not-registered
composer-not-ready
error-not-recorded
orphan-process
```
```

---

# 14. docs/engineering/11_AGENT_OPERATING_PROTOCOL.md

```md
# 11 Agent Operating Protocol

## Before every task

Claude Code must:

1. Read CLAUDE.md.
2. Read docs/engineering/00_READ_FIRST.md.
3. Read the relevant engineering docs for the touched layer.
4. Run rg to inspect existing implementation before coding.
5. State the current architecture as found.
6. State the intended minimal modification path.
7. Avoid creating duplicate systems if an existing system exists.

## During implementation

1. Prefer small coherent patches.
2. Do not create a second RuntimeBridge.
3. Do not create a second PTY manager unless explicitly requested.
4. Do not bypass stores/contracts.
5. Do not add unbounded event arrays.
6. Do not add render-time side effects.
7. Do not swallow errors.
8. Do not fake successful state.

## After implementation

Must output:

1. modified files
2. contracts changed
3. invariants preserved
4. tests run
5. failed checks
6. manual testing steps
7. unresolved risks
```

---

# 15. .claude/commands/preflight.md

```md
# /preflight

Before editing code:

1. Read CLAUDE.md.
2. Read docs/engineering/00_READ_FIRST.md.
3. Identify touched layer:
   - App Shell
   - RuntimeBridge
   - RuntimeKernel
   - Interaction
   - Structured
   - Telemetry
   - Governance
   - Observability
   - Performance
   - Recovery
4. Run targeted rg searches.
5. Report:
   - existing implementation
   - duplicate systems
   - direct PTY invokes
   - unsafe useEffect
   - unbounded stores
   - missing error events
6. Only then modify code.
```

---

# 16. .claude/commands/runtime-audit.md

```md
# /runtime-audit

Run:

```bash
rg "invoke\\(\"pty_|invoke\\('pty_|pty_v2_|pty_start_|RuntimeBridge|RuntimeKernel|structured_run" src src-tauri
rg "Session not found|program not found|spawn failed|pty-process-created|pty-ready" src src-tauri
```

Report:

1. all direct PTY invokes outside adapters
2. all duplicate runtime paths
3. UI session id vs PTY session id mapping
4. backend session registry key
5. write path
6. stop path
7. error event path
```

---

# 17. .claude/commands/react-audit.md

```md
# /react-audit

Run:

```bash
rg "useEffect\\(" src
rg "set[A-Z][A-Za-z]+\\(" src
rg "navigate|openSessionTab|focusSession|selectProject|patchSession|updateSession" src
rg "subscribe\\(" src
```

Report:

1. render-time side effects
2. effects that update their own dependencies
3. unstable selectors
4. non-idempotent store actions
5. missing cleanup
6. unbounded state arrays
```

---

# 18. .claude/commands/pty-audit.md

```md
# /pty-audit

Audit backend PTY lifecycle.

Check:

1. openpty
2. spawn selected shell
3. writer acquisition
4. reader thread start
5. registry insert
6. pty-ready emit
7. write
8. resize
9. ctrl-c
10. stop
11. orphan cleanup

No pty-ready before writer is registered.
No fake process-created after spawn failure.
```

---

# 19. .claude/commands/stability-check.md

```md
# /stability-check

Run:

```bash
npm run typecheck
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

Then manually verify:

1. App launches
2. No React #185
3. New Session opens Workspace within 1s
4. ChatComposer disabled until runtime ready
5. Runtime discovery result visible
6. ErrorLog records runtime errors
7. Stop kills child process
```

---

# 20. 阶段化升级路线

## Stage 0：记忆固化与规范落地

目标：

```text
Claude CLI 每次改代码前必须读取工程规范。
```

任务：

```text
1. 创建 CLAUDE.md。
2. 创建 docs/engineering/*。
3. 创建 .claude/commands/*。
4. 创建 .claude/rules/*。
5. 在 README 或 docs/CONTRIBUTING.md 中加入“开发前必须运行 /preflight”。
```

验收：

```text
[ ] CLAUDE.md imports docs/engineering files.
[ ] /memory 能看到 CLAUDE.md。
[ ] Claude CLI 输出时能复述核心工程约束。
```

---

## Stage 1：RuntimeBridge 单入口清理

任务：

```text
1. 搜索所有直接 invoke PTY / structured_run 的前端调用。
2. 移入 RuntimeBridge adapter。
3. 建立 RuntimeBridge public API。
4. Projects / Workspace / Console / Dock / Resources 只调用 RuntimeBridge。
```

验收：

```text
[ ] 前端 surface 内没有 invoke("pty_*")。
[ ] ChatComposer 不直接调用 pty_v2_write。
[ ] Console/Dock/Resources 不直接操作 PTY。
```

---

## Stage 2：ID 合约与 Session Registry

任务：

```text
1. 定义 UiSessionId / PtySessionId / ClaudeSessionId。
2. RuntimeSession 包含 ptySessionId。
3. RuntimeBridge.write 做 id 映射。
4. Backend registry key 统一为 ptySessionId。
5. Session not found 必须进入 RuntimeEventStore。
```

验收：

```text
[ ] 不再出现 Session not found: ses-xxx。
[ ] 发送失败能标记 message failed。
[ ] ErrorLog 能记录 session-id-mismatch。
```

---

## Stage 3：Claude Discovery + Shell Strategy Matrix

任务：

```text
1. 新增 runtime_discover_claude。
2. 实现 cmd / powershell / pwsh / user override strategy。
3. 检测 claude.cmd / claude.ps1 / Get-Command / npm prefix。
4. 每个 strategy 做 shell echo / claude --version / PTY echo。
```

验收：

```text
[ ] 不再单押 cmd.exe。
[ ] cmd 0xc0000142 不拖垮主流程。
[ ] 找不到 Claude 时显示明确诊断。
[ ] 找到 Claude 时显示 selected strategy。
```

---

## Stage 4：PTY 生命周期严格化

任务：

```text
1. openpty/spawn/writer/reader/registry 全成功后才 pty-ready。
2. spawn 失败 return Err + RuntimeEvent。
3. reader loop 后台化。
4. Mutex 不跨 read/wait/emit。
5. Stop 执行 kill + wait + registry cleanup。
```

验收：

```text
[ ] pty-ready 之前 writer 一定存在。
[ ] Stop 后 no orphan。
[ ] pty-process-created 不再伪成功。
```

---

## Stage 5：Workspace / Chat 可靠发送

任务：

```text
1. ChatComposer 根据 session.status gate。
2. message status = sending/sent/failed。
3. failed message 支持 Retry。
4. “你好”只有实际 write 成功后才 sent。
```

验收：

```text
[ ] Runtime 未 ready 时不能发送。
[ ] 发送失败不伪装成功。
[ ] 成功发送进入同一个 PTY。
```

---

## Stage 6：ErrorLog / Diagnostics / Health Center

任务：

```text
1. RuntimeEventStore 统一错误。
2. ErrorLog 读取 RuntimeEventStore。
3. Diagnostic Bundle 一键复制。
4. Health Center 显示 React / Runtime / Shell / Claude / PTY / WebView2。
```

验收：

```text
[ ] 顶部错误一定在 ErrorLog 中出现。
[ ] ErrorLog 不显示 raw PTY。
[ ] Diagnostic Bundle 可复制。
```

---

## Stage 7：React 稳定性与性能预算

任务：

```text
1. App/Surface/Panel/Widget ErrorBoundary。
2. RenderLoopGuard。
3. store action 幂等。
4. useEffect 审计。
5. Event limit / debounce / throttle / virtualization。
```

验收：

```text
[ ] 不再出现 React #185。
[ ] ErrorLog max 200。
[ ] ptyTail max 32 KB。
[ ] Workspace tab < 1s。
```

---

## Stage 8：200% Telemetry

任务：

```text
1. statusLine collector。
2. hooks collector。
3. structured_run adapter。
4. transcript reader。
5. TelemetryNormalizer。
6. ChatBlockRenderer 只吃 semantic events。
```

验收：

```text
[ ] token/cost/model 来自 statusLine 或显示 Unavailable。
[ ] hooks 事件可进入 SessionTimeline。
[ ] ChatBlockRenderer 不吃 raw PTY。
```

---

## Stage 9：500% Governance

任务：

```text
1. Risk engine。
2. Permission center。
3. AuditLog。
4. Session replay。
5. ResourceActivationBridge。
6. AI Dock Runtime action。
7. Console health dashboard。
```

验收：

```text
[ ] 高风险操作二次确认。
[ ] 所有危险操作写 AuditLog。
[ ] Dock 不直接 invoke PTY。
[ ] Resources 不运行 Claude，只插入 Chat 或写项目配置。
```

---

# 21. 直接发给 Claude CLI 的总执行 Prompt

```text
执行 Ctrl-CC Stability-First Supreme Architecture 7.0。

这是在 6.0 基础上的全面升级。目标不是继续临时修 bug，而是把底层工程规范、架构原则、编程原则、调试原则和稳定性原则全部固化到项目记忆中，并按阶段完整升级 Ctrl-CC。

第一优先级：
创建和更新项目记忆：
- CLAUDE.md
- docs/engineering/00_READ_FIRST.md
- docs/engineering/01_ARCHITECTURE_PRINCIPLES.md
- docs/engineering/02_RUNTIME_BRIDGE_CONTRACT.md
- docs/engineering/03_REACT_STABILITY_RULES.md
- docs/engineering/04_TAURI_RUST_BACKEND_RULES.md
- docs/engineering/05_PTY_AND_CLAUDE_CLI_RULES.md
- docs/engineering/06_OBSERVABILITY_AND_DIAGNOSTICS.md
- docs/engineering/07_PERFORMANCE_BUDGET.md
- docs/engineering/08_UI_UX_AND_THEME_RULES.md
- docs/engineering/09_TESTING_AND_ACCEPTANCE_GATES.md
- docs/engineering/10_DEBUGGING_PROTOCOL.md
- docs/engineering/11_AGENT_OPERATING_PROTOCOL.md
- .claude/commands/preflight.md
- .claude/commands/runtime-audit.md
- .claude/commands/react-audit.md
- .claude/commands/pty-audit.md
- .claude/commands/stability-check.md

从现在开始，每次修改代码前必须读取 CLAUDE.md 和 docs/engineering/00_READ_FIRST.md，并按照相关工程规范执行。不要跳过 preflight。

第二优先级：
按阶段升级：

Stage 1 RuntimeBridge 单入口清理：
- 所有页面禁止直接 invoke PTY。
- 只能调用 RuntimeBridge。

Stage 2 ID 合约：
- RuntimeSession.id = UiSessionId。
- RuntimeSession.ptySessionId = backend PTY registry id。
- RuntimeBridge.write 负责映射。

Stage 3 Claude Discovery / Shell Strategy：
- 不要单押 cmd.exe。
- 实现 powershell / pwsh / cmd / user override。
- 查 claude.cmd / claude.ps1 / Get-Command / npm prefix。

Stage 4 PTY 生命周期：
- writer registered 后才 pty-ready。
- spawn 失败必须 RuntimeEvent error。
- no fake process-created。

Stage 5 ChatComposer：
- session 未 ready 禁止发送。
- message 状态 sending/sent/failed。
- send failed 可 Retry。

Stage 6 ErrorLog / Diagnostics：
- 所有错误进入 RuntimeEventStore。
- ErrorLog 不再显示 0。
- Diagnostic Bundle 一键复制。

Stage 7 React / Performance：
- ErrorBoundary 分层。
- RenderLoopGuard。
- idempotent store action。
- useEffect 审计。
- bounded event store。
- debounce/throttle/virtualization。

Stage 8 Telemetry：
- statusLine / hooks / structured events。
- ChatBlockRenderer 只渲染 semantic events。

Stage 9 Governance：
- risk / permission / audit / replay / resources / dock / console 全系统联动。

硬性要求：
1. 不创建第二套 RuntimeBridge。
2. 不创建第二套 PTY manager，除非先审计并解释为什么必须替换。
3. 不让 ChatComposer 直接调用 pty_v2_write。
4. 不让 ErrorLog 渲染 raw PTY。
5. 不让 Projects 等 Claude ready 后再跳 Workspace。
6. 不吞掉错误。
7. 不伪造成功状态。
8. 不留下 orphan process。
9. 不破坏四主题视觉系统。
10. 每次修改后运行 typecheck/build/cargo check。

交付：
1. 创建/修改文件清单。
2. CLAUDE.md 与 docs/engineering 文件内容摘要。
3. preflight 命令说明。
4. RuntimeBridge 清理结果。
5. ID 合约说明。
6. Discovery matrix 结果。
7. ErrorLog 接入结果。
8. E2E 测试结果。
9. 未完成项和下一阶段计划。
```

---

# 22. 7.0 验收标准

```text
[ ] CLAUDE.md 存在并导入所有 docs/engineering 文件。
[ ] Claude CLI 每次任务前能复述 Read-first rule。
[ ] 所有工程规范文件存在。
[ ] .claude/commands/preflight.md 存在。
[ ] 前端 surface 不直接 invoke PTY。
[ ] RuntimeBridge.write 负责 UiSessionId -> PtySessionId 映射。
[ ] Runtime 未 ready 时 ChatComposer disabled。
[ ] Send failed message 标记 failed，不伪装成功。
[ ] ErrorLog 能显示 spawn/session/send errors。
[ ] Diagnostic Bundle 可复制。
[ ] 不再出现 React #185。
[ ] New Session 1 秒内打开 Workspace。
[ ] cmd 0xc0000142 不拖垮主流程。
[ ] Claude discovery 能显示候选和失败原因。
[ ] Stop 后无 orphan process。
[ ] typecheck/build/cargo check 全通过。
```
