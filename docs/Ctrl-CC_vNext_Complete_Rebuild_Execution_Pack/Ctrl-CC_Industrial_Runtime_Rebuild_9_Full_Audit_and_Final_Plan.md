# Ctrl-CC Industrial Runtime Rebuild 9.0  
## 全仓库逐行审计协议 + 商用级 Runtime 内核重建 + 100%/200%/500% 最终执行方案

> **直接发给 Claude CLI 执行。**  
> 这不是继续“补丁式修复”。这是一次 **从审计制度、架构契约、Runtime 内核、PTY/Claude 启动、Chat 交互、错误诊断、性能稳定性、可观测性、工程记忆** 全面升级的工业级执行方案。
>
> 当前仓库已经进入典型的 **Runtime split-brain** 状态：  
> - 页面层直接启动 PTY。  
> - RuntimeBridge 也启动 PTY。  
> - 后端旧 PTY 命令和新 Runtime 命令并存。  
> - 前端有 `UiSessionId` / `PtySessionId` 概念，但旧后端实际用 `session_id` 作为 registry key。  
> - Chat、Terminal、Projects、Workspace、ErrorLog、Diagnostics 的数据源不完全一致。  
>
> 本方案目标：**彻底消灭 split-brain，建立唯一 RuntimeKernel，打通真实 Claude Code CLI interactive PTY，并在此基础上实现 100% + 200% + 500%。**

---

# 0. 先立规矩：不能再凭感觉修

从现在开始，Claude CLI 不允许直接修改代码。必须按以下顺序执行：

```text
Stage -1：全仓库 inventory + 每文件逐行审计
Stage 0：项目记忆与工程规范固化
Stage 1：现状证据报告与风险清单
Stage 2：唯一 Runtime 合约落地
Stage 3：后端 RuntimeKernel / PTY data plane 重建
Stage 4：前端 RuntimeBridge / Workspace / Projects 全部统一
Stage 5：Windows Claude discovery / shell strategy / direct node launch
Stage 6：Chat / Terminal / ErrorLog / Diagnostics 全链路打通
Stage 7：稳定性、性能、watchdog、safe mode、contract tests
Stage 8：200% Telemetry：statusLine / hooks / semantic cards
Stage 9：500% Governance：权限、风险、审计、资源、Dock、Console
```

任何阶段失败，不能假装完成，必须输出失败证据和下一步修复点。

---

# 1. 当前 GitHub 审计证据摘要

以下是当前已经确认的核心事实。

## 1.1 `WorkspaceSurface` 仍然绕过 RuntimeBridge

当前 `WorkspaceSurface.tsx` 同时导入：

```ts
import { startPtyV2ClaudeSession, stopPtyV2 } from '../../features/runtime/services/interactionAdapter';
import { write as runtimeWrite } from '../../features/runtime/services/runtimeBridge';
```

这意味着：

```text
启动路径：WorkspaceSurface -> interactionAdapter -> pty_start_claude_session
发送路径：WorkspaceSurface -> RuntimeBridge.write
终端路径：usePtyTerminal -> interactionAdapter.writePtyV2
```

这是第一处 split-brain。

## 1.2 `ProjectsSurface` 也绕过 RuntimeBridge

当前 `ProjectsSurface.tsx` 直接导入并调用：

```ts
import { startPtyV2ClaudeSession } from '../../features/runtime/services/interactionAdapter';
```

并在 `handleCreateSession()` 里手动：

```text
addSession
openSession
navigateTo('workspace')
startPtyV2ClaudeSession
```

这意味着 Projects 和 Workspace 都在自己创建会话，不是唯一入口。

## 1.3 `RuntimeBridge` 生成了 `ptySessionId`，但旧后端没有真正使用它

当前 `runtimeBridge.ts` 的 `createPendingSession()` 生成：

```ts
id: ids.uiSessionId,
ptySessionId: ids.ptySessionId,
traceId: ids.traceId
```

但后台启动实际调用：

```ts
await adapter.startPtyV2ClaudeSession({
  sessionId: session.id,
  projectId: session.projectId,
  cwd: session.cwd,
});
```

发送实际调用：

```ts
await adapter.writePtyV2(uiSessionId, data, session.traceId);
```

所以 `ptySessionId` 存在于前端对象里，但没有成为后端 registry key。

## 1.4 旧后端 PTY 明确用 `session_id` 作为 registry key

当前 `PtySessionHandle::spawn()` 内部：

```rust
let id = options.session_id.clone();
```

`PtyManager::create()`：

```rust
.insert(info.id.clone(), handle);
```

`PtyManager::with_handle()`：

```rust
sessions.get(session_id)
```

所以当前旧后端真实合约是：

```text
backend registry key = options.session_id
```

不是 `pty-xxx`。

## 1.5 `usePtyTerminal` 也绕过 RuntimeBridge

当前 `usePtyTerminal.ts` 中：

```ts
term.onData((data) => {
  writePtyV2(sessionId, data)
});
```

说明 Terminal raw input 直接写旧 PTY，不走 RuntimeBridge。

---

# 2. 这次必须选择真正的一步到位方案

之前出现过两种方案：

```text
方案 A：为了快速止血，让 ptySessionId = uiSessionId = ses-xxx。
方案 B：真正工业级迁移，后端 registry key = ptySessionId，UI session 和 PTY session 明确分离。
```

本方案选择 **方案 B：真正工业级迁移**。

原因：

```text
1. 你明确要求不投机取巧。
2. 商用级软件必须有清晰的 ID 分层。
3. 将来一个 UI session 可能 resume/fork/restart 多个 PTY session。
4. ClaudeSessionId 是 Claude 自己的身份，不应混入 UI 或 PTY 身份。
5. Diagnostics / Replay / Audit / Recovery 都需要清晰映射。
```

最终 ID 合约：

```ts
type UiSessionId = string;      // ses-xxx，用户层/Workspace/Chat/Session timeline
type PtySessionId = string;     // pty-uuid，后端 PTY registry key
type ClaudeSessionId = string;  // Claude Code 自己的 session id，来自 statusLine/transcript
type TraceId = string;          // trace-uuid，贯穿单次操作
```

最终映射：

```text
RuntimeSession.id = UiSessionId
RuntimeSession.ptySessionId = PtySessionId | null
RuntimeSession.claudeSessionId = ClaudeSessionId | null

Backend PtyManager.sessions key = PtySessionId
All backend events include both uiSessionId and ptySessionId
Terminal filters events by uiSessionId
Backend write uses ptySessionId
ChatComposer only knows uiSessionId
RuntimeBridge maps uiSessionId -> ptySessionId
```

---

# 3. 软件编程八荣八耻

写入 `docs/engineering/12_EIGHT_HONORS_AND_EIGHT_SHAMES.md`，并在 `CLAUDE.md` 中引用。

```md
# 软件编程八荣八耻

1. 以单一事实源为荣，以多头状态为耻。
   - Runtime 状态只能由 RuntimeKernel/RuntimeBridge 维护。
   - 页面不直接创建、启动、停止 PTY。

2. 以证据优先为荣，以猜测修复为耻。
   - 任何修复前必须给出 trace、probe、log、contract test。
   - 不允许“我觉得应该是”。

3. 以清晰契约为荣，以隐式耦合为耻。
   - UiSessionId、PtySessionId、ClaudeSessionId、TraceId 必须分离。
   - 任何函数参数必须写清楚 ID 类型。

4. 以可恢复失败为荣，以假成功为耻。
   - 失败必须进入 RuntimeEventStore、ErrorLog、SessionTimeline、DiagnosticBundle。
   - 不允许 spawn 失败后仍显示 ready。

5. 以后台异步为荣，以阻塞 UI 为耻。
   - UI 不等待 Claude ready。
   - Tauri command 不 child.wait、不长时间持锁、不阻塞 reader loop。

6. 以有界数据为荣，以无限堆积为耻。
   - RuntimeEvent max 200/500。
   - PTY raw output 不进 React 全量状态。
   - 大列表必须虚拟化。

7. 以幂等副作用为荣，以循环更新为耻。
   - store action 无变化必须 return state。
   - useEffect 不能更新自身依赖。

8. 以可验证交付为荣，以口头完成为耻。
   - 每次修改必须跑 typecheck/build/cargo check。
   - Runtime contract test 必须给出 pass/fail 证据。
```

---

# 4. Stage -1：全仓库逐行审计协议

> 这是本次升级的第一步。Claude CLI 必须先执行，不允许跳过。

## 4.1 创建审计目录

```bash
mkdir -p docs/audit
mkdir -p docs/audit/files
mkdir -p docs/audit/reports
mkdir -p docs/audit/checks
```

## 4.2 生成全仓库文件清单

创建 `scripts/audit_repo_inventory.mjs`：

```js
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();

const IGNORE_DIRS = new Set([
  ".git", "node_modules", "target", "dist", "build", ".vite", ".next",
  "src-tauri/target"
]);

const INCLUDE_EXTS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".rs", ".toml", ".json", ".css", ".md"
]);

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = path.relative(ROOT, full).replaceAll("\\", "/");
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      if (!IGNORE_DIRS.has(name) && !IGNORE_DIRS.has(rel)) walk(full, out);
      continue;
    }
    const ext = path.extname(name);
    if (!INCLUDE_EXTS.has(ext)) continue;
    const content = fs.readFileSync(full);
    out.push({
      path: rel,
      ext,
      bytes: content.length,
      lines: content.toString("utf8").split(/\r?\n/).length,
      sha256: crypto.createHash("sha256").update(content).digest("hex"),
    });
  }
  return out;
}

const files = walk(ROOT).sort((a, b) => a.path.localeCompare(b.path));
fs.writeFileSync("docs/audit/repo-inventory.json", JSON.stringify(files, null, 2));
fs.writeFileSync(
  "docs/audit/repo-inventory.md",
  [
    "# Repository Inventory",
    "",
    `Total files: ${files.length}`,
    "",
    "| Path | Lines | Bytes | SHA256 |",
    "|---|---:|---:|---|",
    ...files.map(f => `| ${f.path} | ${f.lines} | ${f.bytes} | \`${f.sha256}\` |`)
  ].join("\n")
);
console.log(`Inventory written: ${files.length} files`);
```

执行：

```bash
node scripts/audit_repo_inventory.mjs
```

## 4.3 每文件逐行审计模板

创建 `docs/audit/files/_TEMPLATE.md`：

```md
# File Audit: <path>

## Metadata
- Path:
- Lines:
- SHA256:
- Layer:
- Owner:
- Status: pass / needs-change / deprecated / delete

## Responsibility
这个文件应该负责什么？

## Actual Behavior
这个文件当前实际做了什么？

## Forbidden Couplings
- [ ] Direct PTY invoke
- [ ] Direct Claude spawn
- [ ] RuntimeBridge bypass
- [ ] Render-time store write
- [ ] Unbounded state
- [ ] Missing cleanup
- [ ] Blocking backend operation
- [ ] Silent error
- [ ] Fake success

## Line-by-line Findings
| Lines | Severity | Finding | Required Fix |
|---|---|---|---|

## Required Patch
具体修改计划。

## Acceptance
如何证明这个文件修好了。
```

## 4.4 自动静态扫描脚本

创建 `scripts/audit_static_checks.mjs`：

```js
import fs from "node:fs";

const files = JSON.parse(fs.readFileSync("docs/audit/repo-inventory.json", "utf8"));

const rules = [
  { id: "direct-pty-invoke", re: /invoke(Command)?\(['"`](pty_|pty_v2_|pty_start_|structured_run)/ },
  { id: "direct-interaction-adapter", re: /startPtyV2ClaudeSession|writePtyV2|stopPtyV2|resizePtyV2/ },
  { id: "runtime-write-bypass", re: /pty_v2_write|pty_write/ },
  { id: "react-useeffect", re: /useEffect\s*\(/ },
  { id: "react-setstate", re: /set[A-Z][A-Za-z0-9_]*\s*\(/ },
  { id: "zustand-create", re: /create<.*>\(/ },
  { id: "tauri-listen", re: /listen<|listen\(/ },
  { id: "child-wait", re: /\.wait\(/ },
  { id: "mutex-lock", re: /\.lock\(/ },
  { id: "raw-pty-event", re: /pty:\/\/data|pty:\/\/status|pty:\/\/error|pty:\/\/exit/ },
  { id: "error-swallow", re: /catch\s*\(\s*\)\s*=>|catch\s*\{\s*\}/ },
];

const findings = [];

for (const f of files) {
  const text = fs.readFileSync(f.path, "utf8");
  const lines = text.split(/\r?\n/);
  lines.forEach((line, idx) => {
    for (const rule of rules) {
      if (rule.re.test(line)) {
        findings.push({
          file: f.path,
          line: idx + 1,
          rule: rule.id,
          text: line.trim().slice(0, 240),
        });
      }
    }
  });
}

fs.writeFileSync("docs/audit/static-findings.json", JSON.stringify(findings, null, 2));
fs.writeFileSync(
  "docs/audit/static-findings.md",
  [
    "# Static Findings",
    "",
    "| File | Line | Rule | Text |",
    "|---|---:|---|---|",
    ...findings.map(x => `| ${x.file} | ${x.line} | ${x.rule} | \`${x.text.replaceAll("|", "\\|")}\` |`)
  ].join("\n")
);
console.log(`Static findings: ${findings.length}`);
```

执行：

```bash
node scripts/audit_static_checks.mjs
```

## 4.5 Claude CLI 必须逐文件填写审计

Claude CLI 必须按 inventory 中每个文件逐一生成：

```text
docs/audit/files/<path-with-slashes-replaced-by-__>.md
```

例如：

```text
src__surfaces__workspace__WorkspaceSurface.tsx.md
src-tauri__src__pty__pty_session.rs.md
```

每个文件必须包含：

```text
Responsibility
Actual Behavior
Line-by-line Findings
Required Patch
Acceptance
```

如果 Claude CLI 无法逐文件完成，不允许进入代码修改阶段。

---

# 5. Stage 0：项目记忆与工程规范固化

必须创建/更新：

```text
CLAUDE.md
docs/engineering/00_READ_FIRST.md
docs/engineering/01_ARCHITECTURE_PRINCIPLES.md
docs/engineering/02_RUNTIME_BRIDGE_CONTRACT.md
docs/engineering/03_REACT_STABILITY_RULES.md
docs/engineering/04_TAURI_RUST_BACKEND_RULES.md
docs/engineering/05_PTY_AND_CLAUDE_CLI_RULES.md
docs/engineering/06_OBSERVABILITY_AND_DIAGNOSTICS.md
docs/engineering/07_PERFORMANCE_BUDGET.md
docs/engineering/08_UI_UX_AND_THEME_RULES.md
docs/engineering/09_TESTING_AND_ACCEPTANCE_GATES.md
docs/engineering/10_DEBUGGING_PROTOCOL.md
docs/engineering/11_AGENT_OPERATING_PROTOCOL.md
docs/engineering/12_EIGHT_HONORS_AND_EIGHT_SHAMES.md
```

`CLAUDE.md` 必须写入：

```md
# Ctrl-CC Project Memory

Before every code modification:

1. Read this file.
2. Read docs/engineering/00_READ_FIRST.md.
3. Read docs/engineering/12_EIGHT_HONORS_AND_EIGHT_SHAMES.md.
4. Run the relevant audit command.
5. State which layer is touched.
6. State whether the change touches RuntimeBridge, RuntimeKernel, PTY, Claude CLI, React state, or Tauri backend.
7. No code change may bypass RuntimeBridge.
8. No UI surface may directly invoke PTY/Claude.
9. No fake success. No silent failure.
10. Every runtime operation must be traceable.

Non-negotiable:
- Single RuntimeBridge.
- Single RuntimeKernel.
- UiSessionId / PtySessionId / ClaudeSessionId / TraceId separation.
- PTY raw output only to xterm/raw log/bounded tail.
- ErrorLog from RuntimeEventStore only.
- New Session opens Workspace within 1 second.
- Runtime starts in background.
```

---

# 6. Stage 1：架构冻结与删除双轨入口

## 6.1 必须冻结的旧入口

旧命令可以暂时保留作为兼容 wrapper，但前端不得直接调用：

```text
pty_start_claude_session
pty_v2_write
pty_v2_resize
pty_send_ctrl_c
pty_send_ctrl_d
pty_v2_stop
create_claude_chat
send_claude_input
```

前端唯一入口：

```ts
RuntimeBridge.startInteractiveSession()
RuntimeBridge.write()
RuntimeBridge.resize()
RuntimeBridge.ctrlC()
RuntimeBridge.ctrlD()
RuntimeBridge.stop()
RuntimeBridge.runStructuredTask()
RuntimeBridge.discover()
RuntimeBridge.listSessions()
```

## 6.2 删除 Surface 层直接 Runtime 调用

必须从这些文件删除直接 adapter 调用：

```text
src/surfaces/workspace/WorkspaceSurface.tsx
src/surfaces/projects/ProjectsSurface.tsx
src/features/terminal/usePtyTerminal.ts
```

禁止：

```ts
import { startPtyV2ClaudeSession, stopPtyV2, writePtyV2 } from ...
```

替换为：

```ts
import { RuntimeBridge } from '../../features/runtime/services/runtimeBridge';
```

---

# 7. Stage 2：唯一 Runtime 类型和 ID 合约

创建/修正：

```text
src/features/runtime/types/runtimeTypes.ts
```

```ts
export type UiSessionId = string;
export type PtySessionId = string;
export type ClaudeSessionId = string;
export type TraceId = string;

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
  claudeSessionId: ClaudeSessionId | null;
  traceId: TraceId;

  projectId: string;
  projectName: string;
  cwd: string;
  name: string;

  status: RuntimeSessionStatus;
  mode: "interactive-pty" | "structured-print";

  shellStrategyId: string | null;
  claudeCommand: string | null;
  error: string | null;

  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  exitedAt: string | null;
}

export function canWriteToRuntime(status: RuntimeSessionStatus): boolean {
  return status === "pty-ready" ||
    status === "claude-launching" ||
    status === "claude-active" ||
    status === "idle" ||
    status === "waiting-permission";
}
```

---

# 8. Stage 3：后端 RuntimeKernel / PTY data plane 重建

## 8.1 新建后端请求/响应类型

创建：

```text
src-tauri/src/runtime/runtime_types.rs
```

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
    pub initial_prompt: Option<String>,
    pub resume_claude_session_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeStartInteractiveResponse {
    pub trace_id: String,
    pub ui_session_id: String,
    pub pty_session_id: String,
    pub pid: Option<u32>,
    pub cwd: String,
    pub status: String,
    pub selected_strategy_id: String,
    pub selected_command: String,
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
pub struct RuntimeResizeRequest {
    pub trace_id: String,
    pub ui_session_id: String,
    pub pty_session_id: String,
    pub rows: u16,
    pub cols: u16,
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

## 8.2 修改 `PtyStartOptions`

当前 `PtyStartOptions` 只有一个 `session_id`。必须改成：

```rust
pub struct PtyStartOptions {
    pub trace_id: String,
    pub ui_session_id: String,
    pub pty_session_id: String,
    pub project_id: String,
    pub cli_path: String,
    pub cwd: String,
    pub extra_args: Vec<String>,
    pub selected_strategy: Option<ResolvedClaudeLaunch>,
}
```

兼容旧字段时必须只在 wrapper 内转换，核心 Manager 不再使用 `session_id`。

## 8.3 修改 `PtySessionInfo`

必须同时包含两个 ID：

```rust
pub struct PtySessionInfo {
    pub id: String,             // pty_session_id
    pub pty_session_id: String, // same as id
    pub ui_session_id: String,
    pub project_id: String,
    pub cwd: String,
    pub command: Vec<String>,
    pub rows: u16,
    pub cols: u16,
    pub status: PtySessionStatus,
    pub pid: Option<u32>,
    pub created_at: String,
}
```

## 8.4 修改 `PtySessionHandle::spawn()`

当前：

```rust
let id = options.session_id.clone();
```

必须改成：

```rust
let id = options.pty_session_id.clone();
let ui_session_id = options.ui_session_id.clone();
```

所有事件必须同时 emit：

```rust
app.emit("pty://status", json!({
  "uiSessionId": ui_session_id,
  "ptySessionId": id,
  "session_id": ui_session_id, // temporary compatibility
  "pty_id": id,
  "status": "starting"
}));
```

`pty://data` 也必须同时包含：

```rust
{
  uiSessionId,
  ptySessionId,
  session_id: uiSessionId,
  pty_id: ptySessionId,
  data
}
```

## 8.5 修改 `PtyManager`

核心 sessions map 必须：

```rust
sessions: HashMap<PtySessionId, PtySessionHandle>
```

`create()`：

```rust
let handle = PtySessionHandle::spawn(options, app)?;
let pty_id = handle.info.pty_session_id.clone();
sessions.insert(pty_id.clone(), handle);
```

`write()`：

```rust
pub fn write(&self, pty_session_id: &str, data: &str) -> Result<(), AppError> {
    self.with_handle(pty_session_id, |h| h.write(data))
}
```

错误信息必须：

```rust
AppError::SessionNotFound(format!("PTY session not found: {}", pty_session_id))
```

不能再返回：

```text
Session not found: ses-xxx
```

## 8.6 新建 Runtime commands

创建：

```text
src-tauri/src/runtime/runtime_commands.rs
```

命令：

```rust
#[tauri::command]
pub fn runtime_start_interactive(
    app: tauri::AppHandle,
    manager: tauri::State<'_, PtyManager>,
    req: RuntimeStartInteractiveRequest,
) -> Result<RuntimeStartInteractiveResponse, String> { ... }

#[tauri::command]
pub fn runtime_write(
    manager: tauri::State<'_, PtyManager>,
    req: RuntimeWriteRequest,
) -> Result<(), String> { ... }

#[tauri::command]
pub fn runtime_resize(
    manager: tauri::State<'_, PtyManager>,
    req: RuntimeResizeRequest,
) -> Result<(), String> { ... }

#[tauri::command]
pub fn runtime_stop(
    manager: tauri::State<'_, PtyManager>,
    req: RuntimeStopRequest,
) -> Result<(), String> { ... }

#[tauri::command]
pub fn runtime_list_sessions(
    manager: tauri::State<'_, PtyManager>,
) -> Result<Vec<RuntimePtySessionDebugInfo>, String> { ... }
```

## 8.7 旧命令降级为 wrapper

`pty_start_claude_session` 可以保留，但只能：

```rust
// Deprecated wrapper.
// It creates ui_session_id=session_id and pty_session_id=session_id for backward compatibility.
// No frontend surface may call it.
```

并且 audit 必须保证前端没有直接调用它。

---

# 9. Stage 4：工业级 Claude Discovery

## 9.1 为什么不能单押 cmd / PowerShell wrapper

Windows 上 `.cmd` wrapper 依赖 `cmd.exe`。你已经遇到 `cmd.exe 0xc0000142`。  
工业级方案不能依赖 `.cmd` 作为唯一入口。

## 9.2 最强启动策略顺序

```text
1. User configured absolute command
2. Direct node.exe + Claude CLI JS entry
3. Standalone claude.exe if exists
4. PowerShell + claude.ps1
5. pwsh + claude.ps1
6. cmd.exe + claude.cmd
```

优先策略是：

```text
node.exe <claude-code-cli-js>
```

这样绕开 `cmd.exe` 和 `.cmd` shim，最稳定。

## 9.3 Discovery 实现

新增：

```text
src-tauri/src/runtime/claude_discovery_v2.rs
```

检查：

```text
where node
where claude
where claude.cmd
where claude.ps1
npm root -g
npm prefix -g
%APPDATA%\npm\node_modules
%APPDATA%\npm\node_modules\@anthropic-ai\claude-code
```

候选路径：

```text
%APPDATA%\npm\node_modules\@anthropic-ai\claude-code\cli.js
%APPDATA%\npm\node_modules\@anthropic-ai\claude-code\bin\claude.js
%APPDATA%\npm\claude.ps1
%APPDATA%\npm\claude.cmd
```

如果找到 `node.exe` 和 CLI JS，则选择：

```text
program = node.exe
args = [cli_js_path, "--permission-mode", "default", ...]
shell = none
```

## 9.4 Discovery Matrix UI

Diagnostics 必须显示：

```text
Candidate | Type | Path | Runnable By | Version OK | Error
```

如果失败，用户看到：

```text
Claude CLI not runnable.

node.exe: found
claude cli js: not found
claude.ps1: found but PowerShell policy failed
claude.cmd: found but cmd.exe failed 0xc0000142
```

---

# 10. Stage 5：前端 RuntimeBridge 重建

## 10.1 RuntimeBridge public API

```ts
export const RuntimeBridge = {
  startInteractiveSession,
  write,
  resize,
  ctrlC,
  ctrlD,
  stop,
  discover,
  listBackendSessions,
  probeContract,
  runContractTest,
};
```

## 10.2 `startInteractiveSession`

必须：

```ts
export async function startInteractiveSession(input: StartInteractiveInput): Promise<RuntimeSession> {
  const ids = {
    uiSessionId: `ses-${Date.now()}-${shortId()}`,
    ptySessionId: `pty-${crypto.randomUUID()}`,
    traceId: `trace-${crypto.randomUUID()}`,
  };

  const session: RuntimeSession = {
    id: ids.uiSessionId,
    ptySessionId: ids.ptySessionId,
    claudeSessionId: null,
    traceId: ids.traceId,
    projectId: input.projectId,
    projectName: input.projectName,
    cwd: input.cwd,
    name: input.sessionName ?? input.projectName,
    mode: "interactive-pty",
    status: "workspace-opened",
    shellStrategyId: null,
    claudeCommand: null,
    error: null,
    createdAt: now(),
    updatedAt: now(),
    startedAt: null,
    exitedAt: null,
  };

  runtimeStore.addSession(session);

  legacySessionStore.addSession(convertRuntimeToLegacySession(session));
  openSessionStore.openSession(convertRuntimeToOpenTab(session));
  surfaceStore.navigateTo("workspace");

  queueMicrotask(() => {
    void startInteractiveInBackground(session, input);
  });

  return session;
}
```

## 10.3 `startInteractiveInBackground`

必须：

```ts
patch status discovering
const discovery = await invoke("runtime_discover_claude")
select strategy
patch status pty-starting
const response = await invoke("runtime_start_interactive", { req })
patch status pty-ready / claude-launching / claude-active
sync legacy session status running
```

所有失败：

```ts
recordRuntimeError(...)
patch RuntimeSession.status = failed
sync legacy status failed
ErrorLog visible
```

## 10.4 `write`

必须：

```ts
const session = runtimeStore.sessions[uiSessionId]
if !session -> error
if !session.ptySessionId -> error
if !canWrite -> blocked
await invoke("runtime_write", {
  req: { traceId, uiSessionId, ptySessionId, data }
})
```

---

# 11. Stage 6：Workspace / Projects 完全移除 Runtime 直连

## 11.1 `ProjectsSurface.tsx`

删除：

```ts
startPtyV2ClaudeSession
```

`handleCreateSession(projectId)` 改为：

```ts
const project = useProjectStore.getState().projects.find(p => p.id === projectId);
if (!project) return;

void RuntimeBridge.startInteractiveSession({
  projectId: project.id,
  projectName: project.name,
  cwd: project.path,
  mode: "new",
});
```

`handleResumeSession(sessionId)` 改为：

```ts
void RuntimeBridge.startInteractiveSession({
  projectId: ses.projectId,
  projectName: ses.title,
  cwd: ses.cwd,
  mode: "resume",
  resumeTarget: ses.claudeSessionId,
});
```

## 11.2 `WorkspaceSurface.tsx`

删除：

```ts
startPtyV2ClaudeSession
stopPtyV2
```

`startSessionWithProject()` 改为：

```ts
await RuntimeBridge.startInteractiveSession(...)
```

`handleCloseTab()`：

```ts
await RuntimeBridge.stop(sessionId)
closeTab(sessionId)
```

## 11.3 `usePtyTerminal.ts`

不再 import `writePtyV2`。  
改为：

```ts
import { RuntimeBridge } from '../runtime/services/runtimeBridge';

term.onData((data) => {
  RuntimeBridge.write(sessionId, data).catch(...)
});
```

`resize/ctrlC/ctrlD` 同理走 RuntimeBridge。

---

# 12. Stage 7：ChatComposer 可靠发送

`ComposerBar` 不应在 send 后立刻清空文本，除非上层确认 accepted。

改造：

```ts
onSend: (...) => Promise<{ ok: true } | { ok: false; error: string }>
```

流程：

```ts
const result = await onSend(...)
if result.ok setText("")
else keepText and show inline error
```

`WorkspaceSurface.handleSend()`：

```ts
if !canWrite:
  return { ok:false, error:"Runtime not ready" }

add message status=sending
try:
  await RuntimeBridge.write(...)
  patch message status=sent
  return {ok:true}
catch:
  patch message failed
  return {ok:false}
```

---

# 13. Stage 8：ErrorLog / Diagnostics / Contract Tests

## 13.1 RuntimeEventStore

所有错误必须进入：

```text
RuntimeEventStore
ErrorStore bridge
SessionTimeline
DiagnosticBundle
```

## 13.2 Diagnostics 面板

必须有：

```text
Runtime Contract
Discovery Matrix
Session Mapping
Trace Timeline
Backend PTY Registry
Raw log paths
Orphan processes
Copy Diagnostic Bundle
```

## 13.3 Contract Test

新增：

```ts
RuntimeBridge.runContractTest(project)
```

检查：

```text
New Session opens Workspace
RuntimeSession exists
ptySessionId exists
backend runtime_list_sessions contains ptySessionId
hasWriter true
write echo test succeeds
stop removes backend session
```

---

# 14. Stage 9：稳定性与商业级保障

## 14.1 Safe Mode

如果连续两次启动失败：

```text
disable auto runtime start
disable dock publisher
disable resource scan
show diagnostics first
```

## 14.2 Circuit Breaker

```text
runtime start fails 3 times in 60s -> runtime circuit open
error log flood > 50/min -> collapse summaries
pty output > threshold -> raw log only
```

## 14.3 Watchdog

后端 watchdog：

```text
child process alive
reader thread alive
writer exists
last output timestamp
kill orphan
```

## 14.4 Performance budget

```text
button feedback < 100ms
workspace open < 1s
no UI blocking command > 100ms
no unbounded arrays
no raw PTY in React state
```

---

# 15. 100% / 200% / 500% 的最终落地

## 15.1 100%：真实 Claude CLI interactive

```text
PTY + selected direct command
Terminal raw I/O
ChatComposer same PTY
Ctrl+C / Ctrl+D / Resize / Stop
Resume / Continue / Fork
No fake success
```

## 15.2 200%：可视化增强

```text
statusLine collector
hooks collector
transcript reader
semantic event normalizer
tool cards
diff cards
permission cards
token/cost/context cards
```

## 15.3 500%：系统级控制台

```text
Projects full lifecycle
Workspace multi-tab
Console health dashboard
AI Dock runtime controller
Resources activation bridge
GitHub integration
Audit / Risk / Permission / Replay / Bundle
```

---

# 16. 给 Claude CLI 的完整执行 Prompt

```text
执行 Ctrl-CC Industrial Runtime Rebuild 9.0。

本次不要继续补丁式修复。必须先做全仓库逐行审计，再进行工业级 Runtime 重建。

第一阶段：全仓库逐行审计
1. 创建 docs/audit 目录。
2. 创建 scripts/audit_repo_inventory.mjs。
3. 创建 scripts/audit_static_checks.mjs。
4. 生成 docs/audit/repo-inventory.md/json。
5. 生成 docs/audit/static-findings.md/json。
6. 按 repo-inventory 中每个源文件创建 docs/audit/files/*.md 审计报告。
7. 每个文件必须写 Responsibility、Actual Behavior、Line-by-line Findings、Required Patch、Acceptance。
8. 未完成逐文件审计前，不允许修改业务代码。

第二阶段：工程记忆
1. 创建/更新 CLAUDE.md。
2. 创建 docs/engineering/00_READ_FIRST.md 到 12_EIGHT_HONORS_AND_EIGHT_SHAMES.md。
3. 写入软件编程八荣八耻。
4. 每次后续修改前必须读取 CLAUDE.md。

第三阶段：唯一 Runtime 架构
1. 消灭 Runtime split-brain。
2. UI surfaces 禁止直接调用 interactionAdapter 或 PTY 命令。
3. ProjectsSurface / WorkspaceSurface / usePtyTerminal 全部改为 RuntimeBridge。
4. RuntimeBridge 是唯一入口。

第四阶段：ID 合约
1. UiSessionId = ses-xxx。
2. PtySessionId = pty-uuid。
3. ClaudeSessionId = Claude 自己的 session id。
4. TraceId = trace-uuid。
5. 后端 registry key 必须迁移为 PtySessionId。
6. 所有后端事件同时带 uiSessionId 和 ptySessionId。

第五阶段：后端 RuntimeKernel
1. 新增 runtime_types.rs。
2. 修改 PtyStartOptions，包含 trace_id/ui_session_id/pty_session_id。
3. 修改 PtySessionInfo，包含 ui_session_id/pty_session_id。
4. 修改 PtySessionHandle::spawn：id = options.pty_session_id。
5. 修改 PtyManager sessions key = pty_session_id。
6. 新增 runtime_start_interactive/runtime_write/runtime_resize/runtime_stop/runtime_list_sessions。
7. 旧 pty_v2_* 命令降级为 deprecated wrapper。

第六阶段：Claude Discovery
1. 新增 claude_discovery_v2.rs。
2. 优先 direct node.exe + Claude CLI JS。
3. 其次 standalone claude.exe。
4. 再 PowerShell + claude.ps1。
5. 再 pwsh + claude.ps1。
6. 最后 cmd + claude.cmd。
7. cmd.exe 0xc0000142 不得拖垮主流程。
8. Diagnostics 显示 Discovery Matrix。

第七阶段：前端 RuntimeBridge
1. startInteractiveSession 生成 uiSessionId/ptySessionId/traceId。
2. 立即写 RuntimeStore、legacy SessionStore、OpenSessionStore。
3. 立即跳 Workspace。
4. 后台 runtime_start_interactive。
5. write 根据 uiSessionId 查 ptySessionId，再调用 runtime_write。
6. stop/resize/ctrlC/ctrlD 全部通过 RuntimeBridge。

第八阶段：Chat/Terminal
1. ChatComposer 未 ready 禁用。
2. 发送消息 status=sending/sent/failed。
3. Terminal input 走 RuntimeBridge.write。
4. PTY raw output 只进入 xterm/raw log/bounded tail。
5. ChatSemanticPane 不渲染 raw PTY。

第九阶段：ErrorLog/Diagnostics/Tests
1. 所有错误进入 RuntimeEventStore。
2. ErrorLog 不再各自维护孤立错误。
3. Diagnostics 增加 Runtime Contract、Session Mapping、Trace Timeline、Discovery Matrix。
4. 新增 Runtime Contract Test。
5. 新增 Safe Mode、Circuit Breaker、Watchdog。

硬性验收：
- npm run typecheck 通过。
- npm run build 通过。
- cargo check --manifest-path src-tauri/Cargo.toml 通过。
- Projects 新建会话 1 秒内进入 Workspace。
- RuntimeSession 有 uiSessionId/ptySessionId/traceId。
- backend runtime_list_sessions 能看到 ptySessionId。
- Terminal 显示真实 Claude CLI 或明确 discovery 错误。
- ChatComposer 发送进入同一个 PTY。
- 不再出现 Session not found: ses-xxx。
- 如果失败，ErrorLog/Diagnostics 显示具体层级和证据。
- Stop 后无孤儿进程。
- 不破坏四主题。
- 不存在 surface 直接调用 PTY 的 import。
- 生成 docs/audit 完整审计报告。

交付：
1. docs/audit/repo-inventory.md。
2. docs/audit/static-findings.md。
3. docs/audit/files/*.md。
4. 修改文件清单。
5. 架构变更说明。
6. RuntimeBridge 调用链。
7. Backend RuntimeKernel 调用链。
8. Discovery Matrix 示例。
9. Runtime Contract Test 结果。
10. E2E 结果。
11. 未完成项和风险。
```

---

# 17. 你现在应该如何使用这份方案

推荐流程：

```text
1. 新建 git 分支：
   git checkout -b industrial-runtime-rebuild-9

2. 把本 md 发给 Claude CLI。

3. 明确要求 Claude CLI：
   “先做 Stage -1 审计，不准直接改业务代码。”

4. 审计完成后，让 Claude CLI 输出：
   docs/audit/repo-inventory.md
   docs/audit/static-findings.md
   docs/audit/files/*.md

5. 你把审计报告发给我复核。

6. 再进入 RuntimeKernel 重建。
```

---

# 18. 最终态

成功后，Ctrl-CC 必须满足：

```text
Project New Session
  -> RuntimeBridge.startInteractiveSession
  -> RuntimeSession created with uiSessionId/ptySessionId/traceId
  -> Workspace opens immediately
  -> RuntimeKernel discovers Claude launch strategy
  -> PTY starts with backend registry key ptySessionId
  -> Terminal receives pty output by uiSessionId
  -> ChatComposer writes by uiSessionId through RuntimeBridge
  -> RuntimeBridge maps to ptySessionId
  -> backend runtime_write writes to exact PTY writer
  -> statusLine/hooks/transcript generate semantic events
  -> Chat/Console/Dock/Resources read same RuntimeStore
  -> ErrorLog/Diagnostics can explain every failure
```

这才是真正的：

```text
100%：真实 Claude Code CLI interactive PTY
200%：结构化可视化与语义增强
500%：系统级控制台、治理、审计、恢复、资源联动
```
