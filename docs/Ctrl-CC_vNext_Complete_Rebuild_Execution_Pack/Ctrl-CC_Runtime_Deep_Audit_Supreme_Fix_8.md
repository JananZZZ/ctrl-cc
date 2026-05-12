# Ctrl-CC Runtime Deep Audit & Supreme Fix Plan 8.0
## Evidence-First Debugging + Contract Tests + Claude CLI / PTY 全链路打通方案

> **可直接发送给 Claude Code CLI 执行。**
> 当前状态不是“还差一个小修补”，而是必须切换到 **证据优先、契约优先、测试先行** 的工程修复模式。
> 目标：彻底打通 GUI 内真实 Claude Code CLI interactive PTY，并让之后任何问题都能被定位、分类、复现、自动验证。

---

# 0. 当前问题最新判断

当前已经跨过最初的 React #185 和 Workspace 入口问题：

```text
已解决/有进展：
1. App 不再立即 React #185。
2. Workspace / Chat 页面可以进入。
3. ErrorLog 已经可以显示 Send failed。
4. New Session 可以产生 UI session 和 tab。
```

但核心 Runtime 仍未打通：

```text
仍然失败：
1. 不能成功创建真实后端 PTY session。
2. 不能成功启动 Claude Code CLI interactive。
3. ChatComposer 发送仍可能写向不存在的 session。
4. 前端 UI session、后端 PTY session、Claude session 之间的 ID 合约仍不可靠。
5. 发现错误后，仍然无法从界面直接看到“到底卡在哪一层”。
```

现在必须停止“凭感觉继续改”，转为：

```text
Contract-first Runtime
+ Evidence-first Debugging
+ Trace-first Observability
+ Test-first Acceptance Gates
```

---

# 1. 当前必须接受的核心结论

## 1.1 现在失败不是 Chat UI 问题

Chat UI 已经能打开。真正失败点在：

```text
RuntimeBridge.write
RuntimeSession -> PtySession 映射
后端 PTY registry
Claude discovery
Windows shell strategy
PTY writer registration
backend event / error propagation
```

## 1.2 现在不能继续只看 toast

必须能在 Diagnostics 中看到：

```text
UI Session ID
PTY Session ID
Backend registry exists?
Writer registered?
Shell strategy selected?
Claude candidate selected?
PTY process PID?
Reader thread alive?
Last backend error?
Last write target?
```

没有这些，就不可能稳定 debug。

## 1.3 现在必须建立自动化契约测试

每次 Claude CLI 修改后必须能跑：

```text
Runtime Contract Test
Session Mapping Test
Discovery Test
PTY Start Test
Write Path Test
Stop/Orphan Test
```

---

# 2. 官方边界与工程事实

## 2.1 Claude Code CLI 边界

Interactive Chat 必须走：

```text
claude
claude "initial prompt"
claude --continue
claude --resume <session>
```

`claude -p` 是 print / SDK 风格的非交互任务，执行后退出，不能冒充当前 interactive Chat。

所以架构必须分成：

```text
Interaction Plane:
  PTY + claude interactive

Structured Plane:
  claude -p + stream-json
```

## 2.2 PTY 边界

PTY/ConPTY 本质上是异步读写通道：

```text
Terminal client writes input to PTY
child process writes output back
read/write 必须异步
UI 不能等待子进程 ready
```

因此 GUI 中任何 PTY reader loop、child.wait、handshake wait 都不能阻塞 UI 或 Tauri command 热路径。

## 2.3 Tauri 事件边界

Tauri 前端 listen 会返回 unlisten 函数。任何 React component 中注册的 listener，在组件卸载时必须 unlisten，否则事件监听器堆积会造成重复处理、卡顿和伪随机错误。

---

# 3. 8.0 的核心策略

本轮不再直接“大改功能”。先建立 4 个底层工具：

```text
1. RuntimeTrace
2. RuntimeContractProbe
3. RuntimeDiagnosticsPanel
4. RuntimeContractTests
```

然后再修：

```text
ID mapping
backend registry
discovery
PTY lifecycle
write path
Composer ready gate
ErrorLog unification
```

---

# 4. 必须新增 RuntimeTrace

## 4.1 目标

每个 New Session 和每次 Send 都必须有 traceId。错误时必须能看到完整链路：

```text
ui.click.newSession
runtime.session.created
workspace.tab.opened
discovery.started
discovery.finished
pty.start.request
pty.backend.registered
claude.launch.written
composer.submit
runtime.write.resolve
backend.write.ok / backend.write.failed
```

## 4.2 类型

创建：

```text
src/features/runtime/types/runtimeTraceTypes.ts
```

```ts
export type RuntimeTraceLevel = "debug" | "info" | "warning" | "error";

export interface RuntimeTraceEvent {
  id: string;
  traceId: string;
  ts: string;
  level: RuntimeTraceLevel;
  source:
    | "ui"
    | "runtime-bridge"
    | "runtime-kernel"
    | "interaction-adapter"
    | "tauri"
    | "pty"
    | "claude"
    | "composer"
    | "diagnostics";
  type: string;
  message: string;
  uiSessionId?: string | null;
  ptySessionId?: string | null;
  claudeSessionId?: string | null;
  projectId?: string | null;
  payload?: unknown;
}
```

## 4.3 RuntimeTrace Store

创建：

```text
src/features/runtime/stores/runtimeTraceStore.ts
```

```ts
import { create } from "zustand";
import type { RuntimeTraceEvent } from "../types/runtimeTraceTypes";

interface RuntimeTraceState {
  events: RuntimeTraceEvent[];
  append: (event: Omit<RuntimeTraceEvent, "id" | "ts">) => void;
  byTraceId: (traceId: string) => RuntimeTraceEvent[];
  clear: () => void;
}

export const useRuntimeTraceStore = create<RuntimeTraceState>((set, get) => ({
  events: [],

  append: (event) =>
    set((state) => ({
      events: [
        {
          id: crypto.randomUUID(),
          ts: new Date().toISOString(),
          ...event,
        },
        ...state.events,
      ].slice(0, 500),
    })),

  byTraceId: (traceId) => get().events.filter((e) => e.traceId === traceId),

  clear: () => set({ events: [] }),
}));
```

## 4.4 后端 Trace

Rust 后端也必须写文件日志：

```text
%TEMP%/ctrl-cc-runtime-trace.log
```

每个 backend command 都写：

```text
traceId
uiSessionId
ptySessionId
command
phase
result
error
```

---

# 5. 必须新增 RuntimeContractProbe

## 5.1 目标

任何时候都能一键查询：

```text
前端 RuntimeStore 中有哪些 UI session？
每个 UI session 的 ptySessionId 是什么？
后端 PTY registry 中有哪些 session？
writer 是否存在？
reader 是否运行？
pid 是多少？
Claude discovery 结果是什么？
```

## 5.2 前端 Probe

创建：

```text
src/features/runtime/services/runtimeContractProbe.ts
```

```ts
import { invoke } from "@tauri-apps/api/core";
import { useRuntimeStore } from "../stores/runtimeStore";

export interface RuntimeContractProbeResult {
  frontendSessions: Array<{
    uiSessionId: string;
    ptySessionId: string | null;
    status: string;
    cwd: string;
    projectId: string;
    error?: string | null;
  }>;
  backendPtySessions: Array<{
    ptySessionId: string;
    uiSessionId?: string | null;
    cwd: string;
    pid?: number | null;
    status: string;
    hasWriter: boolean;
    readerAlive?: boolean;
    createdAt?: string;
  }>;
  mismatches: Array<{
    uiSessionId: string;
    ptySessionId: string | null;
    reason: string;
  }>;
}

export async function probeRuntimeContract(): Promise<RuntimeContractProbeResult> {
  const frontendSessions = Object.values(useRuntimeStore.getState().sessions).map((s) => ({
    uiSessionId: s.id,
    ptySessionId: s.ptySessionId ?? null,
    status: s.status,
    cwd: s.cwd,
    projectId: s.projectId,
    error: s.error ?? null,
  }));

  const backendPtySessions = await invoke<Array<{
    ptySessionId: string;
    uiSessionId?: string | null;
    cwd: string;
    pid?: number | null;
    status: string;
    hasWriter: boolean;
    readerAlive?: boolean;
    createdAt?: string;
  }>>("runtime_list_pty_sessions");

  const backendIds = new Set(backendPtySessions.map((s) => s.ptySessionId));

  const mismatches = frontendSessions.flatMap((s) => {
    if (!s.ptySessionId) {
      return [{ uiSessionId: s.uiSessionId, ptySessionId: null, reason: "frontend session has no ptySessionId" }];
    }

    if (!backendIds.has(s.ptySessionId)) {
      return [{ uiSessionId: s.uiSessionId, ptySessionId: s.ptySessionId, reason: "backend registry missing ptySessionId" }];
    }

    return [];
  });

  return { frontendSessions, backendPtySessions, mismatches };
}
```

## 5.3 Rust 后端 registry command

新增：

```rust
#[tauri::command]
pub fn runtime_list_pty_sessions(
    manager: tauri::State<RuntimePtyManager>,
) -> Result<Vec<PtySessionDebugInfo>, String> {
    manager.list_debug_sessions()
}
```

返回必须包含：

```rust
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PtySessionDebugInfo {
    pub pty_session_id: String,
    pub ui_session_id: Option<String>,
    pub project_id: Option<String>,
    pub cwd: String,
    pub pid: Option<u32>,
    pub status: String,
    pub has_writer: bool,
    pub reader_alive: bool,
    pub created_at: String,
    pub last_error: Option<String>,
}
```

---

# 6. 必须新增 Runtime Diagnostics 面板

## 6.1 页面结构

```text
Diagnostics -> Runtime
├── Contract Probe
├── Discovery Matrix
├── Shell Strategy Matrix
├── Session Mapping
├── Trace Timeline
├── Last Errors
├── PTY Registry
├── Orphan Processes
└── Copy Diagnostic Bundle
```

## 6.2 Session Mapping 表格

必须展示：

```text
UI Session ID
PTY Session ID
Frontend Status
Backend Exists
Backend Status
Has Writer
Reader Alive
PID
CWD
Last Error
```

当前错误 `Session not found: ses-xxx` 必须能在这里一眼看出：

```text
ses-xxx -> pty-xxx -> backend missing
```

或者：

```text
ses-xxx -> null -> no pty attached
```

---

# 7. 必须重新定义 Runtime Session 契约

## 7.1 类型

```ts
export type UiSessionId = string;
export type PtySessionId = string;
export type ClaudeSessionId = string;

export type RuntimeSessionStatus =
  | "created"
  | "workspace-opened"
  | "discovering"
  | "discovery-failed"
  | "pty-starting"
  | "pty-ready"
  | "claude-launching"
  | "claude-active"
  | "idle"
  | "waiting-permission"
  | "failed"
  | "exited"
  | "killed"
  | "disconnected";

export interface RuntimeSession {
  id: UiSessionId;
  ptySessionId: PtySessionId | null;
  claudeSessionId?: ClaudeSessionId | null;
  projectId: string;
  projectName: string;
  cwd: string;
  name: string;
  status: RuntimeSessionStatus;
  traceId: string;
  error?: string | null;
  createdAt: string;
  updatedAt: string;
}
```

## 7.2 New Session 必须创建两个 ID

```ts
const uiSessionId = `ses-${Date.now()}`;
const ptySessionId = `pty-${crypto.randomUUID()}`;
const traceId = `trace-${crypto.randomUUID()}`;
```

创建 RuntimeSession：

```ts
{
  id: uiSessionId,
  ptySessionId,
  traceId,
  status: "workspace-opened",
}
```

启动后端必须传：

```ts
{
  traceId,
  uiSessionId,
  ptySessionId,
  projectId,
  cwd,
}
```

---

# 8. 必须重写 RuntimeBridge.write

```ts
export async function write(uiSessionId: string, data: string): Promise<void> {
  const state = useRuntimeStore.getState();
  const session = state.sessions[uiSessionId];

  if (!session) {
    recordRuntimeError("runtime.write.ui_session_missing", uiSessionId, null, "UI session not found");
    throw new Error(`UI session not found: ${uiSessionId}`);
  }

  if (!session.ptySessionId) {
    recordRuntimeError("runtime.write.pty_session_missing", uiSessionId, null, "PTY session not attached");
    throw new Error(`PTY session not attached: ${uiSessionId}`);
  }

  if (!isRuntimeWritable(session.status)) {
    recordRuntimeWarning("runtime.write.not_ready", uiSessionId, session.ptySessionId, `Runtime not ready: ${session.status}`);
    throw new Error(`Runtime not ready: ${session.status}`);
  }

  useRuntimeTraceStore.getState().append({
    traceId: session.traceId,
    source: "runtime-bridge",
    level: "info",
    type: "runtime.write.resolve",
    message: "Resolved UI session to PTY session",
    uiSessionId,
    ptySessionId: session.ptySessionId,
    payload: { status: session.status },
  });

  try {
    await invoke("runtime_write", {
      request: {
        traceId: session.traceId,
        uiSessionId,
        ptySessionId: session.ptySessionId,
        data,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    useRuntimeTraceStore.getState().append({
      traceId: session.traceId,
      source: "runtime-bridge",
      level: "error",
      type: "runtime.write.backend_failed",
      message,
      uiSessionId,
      ptySessionId: session.ptySessionId,
      payload: { status: session.status },
    });

    throw error;
  }
}

function isRuntimeWritable(status: RuntimeSessionStatus): boolean {
  return [
    "pty-ready",
    "claude-launching",
    "claude-active",
    "idle",
    "waiting-permission",
  ].includes(status);
}
```

---

# 9. 必须重写 backend runtime_write

后端 `runtime_write` 只接受 ptySessionId：

```rust
#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeWriteRequest {
    pub trace_id: String,
    pub ui_session_id: String,
    pub pty_session_id: String,
    pub data: String,
}

#[tauri::command]
pub fn runtime_write(
    manager: tauri::State<RuntimePtyManager>,
    request: RuntimeWriteRequest,
) -> Result<(), String> {
    manager.write(&request)
}
```

Manager：

```rust
pub fn write(&self, req: &RuntimeWriteRequest) -> Result<(), String> {
    self.trace(&req.trace_id, &req.ui_session_id, &req.pty_session_id, "runtime.write.start", "");

    let mut sessions = self.sessions.lock().map_err(|e| e.to_string())?;

    let handle = sessions.get_mut(&req.pty_session_id).ok_or_else(|| {
        format!(
            "PTY session not found: {} (uiSessionId={})",
            req.pty_session_id, req.ui_session_id
        )
    })?;

    if !handle.has_writer {
        return Err(format!("PTY writer missing: {}", req.pty_session_id));
    }

    handle.writer
        .write_all(req.data.as_bytes())
        .map_err(|e| format!("PTY write failed: {}", e))?;

    handle.writer
        .flush()
        .map_err(|e| format!("PTY flush failed: {}", e))?;

    self.trace(&req.trace_id, &req.ui_session_id, &req.pty_session_id, "runtime.write.ok", "");

    Ok(())
}
```

如果错误里仍出现：

```text
Session not found: ses-xxx
```

说明仍然有前端绕过 RuntimeBridge 或后端 registry key 错误。

---

# 10. 必须新增 Runtime Contract Test

## 10.1 前端测试命令

新增一个 diagnostics 按钮：

```text
Run Runtime Contract Test
```

执行：

```ts
export async function runRuntimeContractTest(project: Project) {
  const session = await RuntimeBridge.startInteractiveSession({
    projectId: project.id,
    projectName: project.name,
    cwd: project.path,
    mode: "new",
    sessionName: "contract-test",
  });

  const probe1 = await probeRuntimeContract();

  if (!session.ptySessionId) {
    throw new Error("Contract failed: session has no ptySessionId");
  }

  if (probe1.mismatches.length > 0) {
    throw new Error(`Contract failed: ${JSON.stringify(probe1.mismatches, null, 2)}`);
  }

  return {
    session,
    probe: probe1,
  };
}
```

## 10.2 Acceptance

测试失败必须说明具体是：

```text
frontend ptySessionId missing
backend registry missing ptySessionId
writer missing
session status not ready
```

---

# 11. 必须新增 Discovery Matrix

不要再盲试启动 Claude。

后端新增：

```rust
runtime_discover_claude
```

返回：

```text
shellStrategies:
  powershell
  pwsh
  cmd
  user override

claudeCandidates:
  claude
  claude.cmd
  claude.ps1
  npm prefix fallback
```

每个 candidate 记录：

```text
found
versionOk
versionText
error
runnableBy
```

UI 上明确显示：

```text
Claude not found
or
Claude found via PowerShell strategy
or
cmd.exe failed 0xc0000142, fallback PowerShell ok
```

---

# 12. 必须加入 Composer Ready Gate

ChatComposer：

```ts
const session = useRuntimeStore((s) => s.sessions[sessionId]);
const canSend = Boolean(session?.ptySessionId) && isRuntimeWritable(session.status);
```

禁用时：

```tsx
<textarea disabled={!canSend} />
<button disabled={!canSend || !draft.trim()} />
```

submit：

```ts
if (!canSend) {
  addRuntimeWarning("composer.blocked.not_ready", ...);
  return;
}
```

禁止再出现：

```text
Runtime 未 ready 仍显示用户 bubble
```

---

# 13. 必须修 ErrorLog

ErrorLog 数据源必须是 RuntimeEventStore / RuntimeTraceStore。不能每个模块各自 toast。

错误入口：

```ts
recordRuntimeError({
  type,
  message,
  traceId,
  uiSessionId,
  ptySessionId,
  payload,
});
```

ErrorLog 展示：

```text
type
message
traceId
uiSessionId
ptySessionId
payload collapsed
copy diagnostics
```

---

# 14. 必须处理 stale session

App 启动时：

```ts
for each persisted RuntimeSession:
  if status not in terminal states:
    patch status = disconnected
    ptySessionId = null
    error = "Frontend restored session, but backend registry is empty after app restart."
```

Composer disabled。不要向旧 session 写。

---

# 15. 必须修 cmd.exe 0xc0000142，但放在 Contract Probe 之后

顺序：

```text
1. 修 ID / registry / write contract
2. 能看到 backend session 是否存在
3. 再修 shell strategy
```

不要再同时修所有东西。

Shell strategy 规则：

```text
优先 user override
再 powershell
再 pwsh
最后 cmd
```

如果 cmd 弹 0xc0000142，但 PowerShell 能跑，就不要阻塞整个 runtime。

---

# 16. 给 Claude CLI 的最终执行 Prompt

```text
执行 Ctrl-CC Runtime Deep Audit & Supreme Fix 8.0。

现在不要继续凭感觉修。当前 Workspace/Chat 能打开，但无法真正创建后端 PTY/Claude 会话，发送时报 Session not found。必须建立证据优先的 Runtime 契约调试体系。

目标：
1. 建立 RuntimeTrace。
2. 建立 RuntimeContractProbe。
3. 建立 Diagnostics Runtime Session Mapping。
4. 建立 Runtime Contract Test。
5. 修 RuntimeSession.id / ptySessionId 合约。
6. 修 RuntimeBridge.write。
7. 修后端 runtime_write。
8. 修 ChatComposer ready gate。
9. 修 ErrorLog 统一。
10. 再做 Claude discovery / Shell strategy。

必须执行：

一、Trace
- 新增 RuntimeTraceEvent 类型和 RuntimeTraceStore。
- New Session / Backend Start / Write / Error 都必须记录 traceId、uiSessionId、ptySessionId。

二、Contract Probe
- 新增 runtime_list_pty_sessions 后端命令。
- 新增 probeRuntimeContract 前端服务。
- Diagnostics 显示 frontendSessions、backendPtySessions、mismatches。

三、ID 合约
- RuntimeSession.id = ses-xxx。
- RuntimeSession.ptySessionId = pty-xxx。
- Backend registry key = ptySessionId。
- Backend event 同时带 uiSessionId 和 ptySessionId。

四、New Session
- 每次 New Session 同时生成 uiSessionId、ptySessionId、traceId。
- 先打开 Workspace。
- 后台调用 runtime_start_pty，传三个 ID。
- 后端 writer registry insert 成功后才 pty-ready。

五、Write
- ChatComposer 只能调用 RuntimeBridge.write(uiSessionId, data)。
- RuntimeBridge.write 查 ptySessionId。
- status 未 ready 直接阻止。
- 后端 runtime_write 只收 ptySessionId。
- 如果后端不存在，错误必须是 PTY session not found: pty-xxx，而不是 Session not found: ses-xxx。

六、Composer
- Runtime 未 ready 输入框禁用。
- 未 ready 不创建 bubble。
- 发送失败标记 failed + retry。

七、ErrorLog
- 所有错误进入 RuntimeEventStore/RuntimeTraceStore。
- ErrorLog 显示 traceId、uiSessionId、ptySessionId、payload。
- 不允许顶部有错误但 ErrorLog 看不到。

八、Diagnostics
- 新增 Runtime -> Session Mapping。
- 新增 Run Runtime Contract Test。
- 可以一键复制 diagnostic bundle。

九、Discovery
- 新增 runtime_discover_claude。
- 检测 powershell/pwsh/cmd/user override。
- 检测 claude/claude.cmd/claude.ps1/Get-Command/npm prefix。
- 不要单押 cmd.exe。

验收：
- 发送时不再出现 Session not found: ses-xxx。
- Runtime 未 ready 时 ChatComposer disabled。
- Diagnostics 能显示 uiSessionId -> ptySessionId -> backend exists。
- backend registry 能看到 ptySessionId。
- ErrorLog 有完整 mapping payload。
- Runtime Contract Test 能明确通过或显示具体哪条 contract failed。
- 如果 Claude 找不到，Discovery Matrix 明确显示原因。
- npm run typecheck 通过。
- npm run build 通过。
- cargo check --manifest-path src-tauri/Cargo.toml 通过。

完成后输出：
1. 修改文件清单。
2. RuntimeTrace 示例。
3. Session Mapping 截图/文本结果。
4. Runtime Contract Test 结果。
5. Discovery Matrix 结果。
6. E2E New Session -> Send 测试结果。
```

---

# 17. 最终验收矩阵

| 层级 | 验收 |
|---|---|
| UI | New Session 1 秒内打开 Workspace |
| Mapping | UiSessionId 有 ptySessionId |
| Backend | runtime_list_pty_sessions 能看到 ptySessionId |
| Writer | hasWriter = true |
| Composer | 未 ready disabled |
| Write | ready 后写 ptySessionId，不写 ses-xxx |
| Error | ErrorLog 显示 traceId + mapping payload |
| Discovery | 能解释 Claude 找不到 / shell 失败 |
| PTY | shell echo ok |
| Claude | claude interactive 启动或显示精确失败 |
