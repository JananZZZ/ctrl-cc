# Ctrl-CC 100% + 200% + 500% 一步到位执行方案：RuntimeBridge 4.0 总修复

> **可直接发送给 Claude Code CLI 执行。**  
> 目标不是继续打补丁，而是在当前代码基础上一次性建立最终架构：  
> **RuntimeBridge 4.0 = Interaction Plane + Control Plane + Telemetry Plane + Governance Plane**。  
> 本方案必须先打通 GUI 内 Claude Code CLI 真 PTY，再把 Projects / Workspace / Chat / Console / AI Dock / Resources 全部接入同一个 RuntimeBridge。

---

## 0. 当前代码审计结论

当前不是 Claude CLI 不可用，而是 **Runtime 主链路裂开**：

### 已发现事实

1. `main.rs` 同时注册了旧 PTY data plane 和新 runtime PTY command。旧通道包括：
   - `pty_start_claude_session`
   - `pty_v2_write`
   - `pty_v2_resize`
   - `pty_send_ctrl_c`
   - `pty_send_ctrl_d`
   - `pty_v2_stop`
   - `pty://data / pty://status / pty://exit / pty://error`

2. `main.rs` 又注册了新 runtime 命令：
   - `pty_start_claude`
   - `pty_write`
   - `pty_resize`
   - `pty_stop`
   - `structured_run`

3. 当前 `usePtyTerminal` 事实上使用的是旧 PTY 通道：
   - 监听 `pty://data`
   - 写入 `pty_v2_write`
   - resize 调用 `pty_v2_resize`
   - Ctrl+C 调用 `pty_send_ctrl_c`

4. `src/features/runtime` 和 `src/features/workspace` 为空或未完成，说明前端 RuntimeBridge / Workspace 主链路没有真正落地。

5. `ChatBlockRenderer` 是语义卡片渲染器，适合 `user_message / assistant_message / tool_use / permission_requested / file_diff / summary / token_usage / cost_update`，不应该承载 PTY 原始输出。

---

## 1. 一步到位的正确含义

“一步到位”不是跳过基础链路，而是：

```text
在一个统一架构里完成：
1. 100%：真实 Claude Code CLI 在 GUI PTY 中运行。
2. 200%：结构化事件 / statusLine / hooks / semantic cards 可视化增强。
3. 500%：Projects / Console / AI Dock / Resources 全部围绕同一个 RuntimeBridge 管理。
```

绝对不要继续：

```text
Projects 自己启动一套 Claude
Workspace 自己监听另一套 PTY
Chat 自己调用 claude -p
Console 自己做假状态
AI Dock 自己猜 session
Resources 自己假装激活
```

必须改成：

```text
所有 Surface 只调用 RuntimeBridge。
RuntimeBridge 只维护一个 SessionRegistry。
Interaction Adapter 只保留一个 P0 可用 PTY 通道。
Structured Adapter 只用于 claude -p 结构化任务。
Telemetry Adapter 接 statusLine / hooks / file/git/process watcher。
Governance Adapter 管理风险、权限、审计、进程清理。
```

---

## 2. P0 唯一主链路：先复用旧 PTY data plane，但包进 RuntimeBridge

这不是将就，而是架构封装。

当前已经存在可用前端 hook：`usePtyTerminal` 使用 `pty://data` 和 `pty_v2_write`。因此 P0 不再让前端调用 `pty_start_claude / pty_write` 新命令，而是建立：

```text
RuntimeBridge.startInteractiveSession()
  -> InteractionAdapter.startSession()
    -> pty_start_claude_session
  -> WorkspaceStore.openSessionTab()
  -> TerminalPane.usePtyTerminal(sessionId)
  -> ChatComposer.pty_v2_write(sessionId, text + "\r")
```

未来可以把 `InteractionAdapter` 内部从旧 PTY 换成新 `PtySessionManager`，但外部 API 不变。

---

## 3. 最终文件结构

必须新增 / 修复：

```text
src/features/runtime/
├── types/runtimeTypes.ts
├── stores/runtimeStore.ts
├── services/runtimeBridge.ts
├── services/interactionAdapter.ts
├── services/structuredAdapter.ts
├── services/telemetryNormalizer.ts
├── services/runtimeDebug.ts
├── services/runtimeEventBridge.ts
└── services/sessionRegistry.ts

src/features/workspace/
├── pages/WorkspaceSurface.tsx
├── components/WorkspaceTabs.tsx
├── components/TerminalPane.tsx
├── components/ChatComposer.tsx
├── components/ChatSemanticPane.tsx
├── components/SessionMonitorPane.tsx
├── stores/workspaceStore.ts
└── styles/workspace.css

src/features/projects/services/
└── projectRuntimeActions.ts

src/features/console/services/
└── consoleRuntimeActions.ts

src/features/dock/services/
└── dockActionBridge.ts

src/features/resources/services/
└── resourceActivationBridge.ts
```

---

## 4. RuntimeBridge 公共 API

创建：

```text
src/features/runtime/services/runtimeBridge.ts
```

必须暴露这些 API，所有页面只能用它：

```ts
export async function startInteractiveClaudeSession(input: {
  projectId: string;
  projectName: string;
  cwd: string;
  mode: "new" | "continue" | "resume" | "fork";
  sessionName?: string;
  resumeTarget?: string;
  initialPrompt?: string;
}): Promise<RuntimeSession>;

export async function sendTextToInteractiveSession(sessionId: string, text: string): Promise<void>;

export async function sendCtrlC(sessionId: string): Promise<void>;

export async function stopInteractiveSession(sessionId: string): Promise<void>;

export async function resizeInteractiveSession(sessionId: string, rows: number, cols: number): Promise<void>;

export function openRuntimeSessionInWorkspace(sessionId: string): void;

export function getRuntimeSession(sessionId: string): RuntimeSession | null;
```

---

## 5. 新建会话必须先打开 Workspace，再后台启动 PTY

这是硬规则。

错误：

```ts
await startInteractiveClaudeSession()
navigateToWorkspace()
```

正确：

```ts
const session = createSessionRecord()
runtimeStore.addSession(session)
workspaceStore.openTab(session)
navigateToWorkspace(session.id)
void backgroundStartPty(session)
```

### 具体实现

```ts
export async function startInteractiveClaudeSession(input: StartInteractiveInput): Promise<RuntimeSession> {
  runtimeDebug("new-session.request", input);

  const session = createPendingRuntimeSession(input);

  useRuntimeStore.getState().addSession(session);
  useWorkspaceStore.getState().openSessionTab({
    id: `tab_${session.id}`,
    sessionId: session.id,
    projectId: session.projectId,
    title: session.name,
    active: true,
  });

  openRuntimeSessionInWorkspace(session.id);

  void startInteractiveSessionInBackground(session, input);

  return session;
}
```

---

## 6. InteractionAdapter：P0 固定使用旧 PTY 命令

创建：

```text
src/features/runtime/services/interactionAdapter.ts
```

```ts
import { invokeCommand } from "../../services/invokeCommand";

export async function startPtyV2ClaudeSession(input: {
  sessionId: string;
  cwd: string;
  mode: "new" | "continue" | "resume" | "fork";
  sessionName: string;
  resumeTarget?: string;
  initialPrompt?: string;
}) {
  return invokeCommand("pty_start_claude_session", {
    sessionId: input.sessionId,
    cwd: input.cwd,
    mode: input.mode,
    sessionName: input.sessionName,
    resumeTarget: input.resumeTarget ?? null,
    initialPrompt: input.initialPrompt ?? null,
  });
}

export async function writePtyV2(sessionId: string, data: string) {
  return invokeCommand("pty_v2_write", { sessionId, data });
}

export async function resizePtyV2(sessionId: string, rows: number, cols: number) {
  return invokeCommand("pty_v2_resize", { sessionId, rows, cols });
}

export async function sendCtrlCPtyV2(sessionId: string) {
  return invokeCommand("pty_send_ctrl_c", { sessionId });
}

export async function stopPtyV2(sessionId: string) {
  return invokeCommand("pty_v2_stop", { sessionId });
}
```

如果后端 `pty_start_claude_session` 的参数名不同，先用 `rg "pty_start_claude_session"` 查真实参数，并适配。不要猜。

---

## 7. RuntimeStore：只存摘要，不存 PTY 原始流

创建：

```text
src/features/runtime/stores/runtimeStore.ts
```

```ts
import { create } from "zustand";

export type RuntimeSessionStatus =
  | "creating"
  | "opening-workspace"
  | "starting-pty"
  | "pty-running"
  | "claude-launching"
  | "claude-active"
  | "failed"
  | "exited"
  | "killed";

export interface RuntimeSession {
  id: string;
  projectId: string;
  projectName: string;
  name: string;
  cwd: string;
  mode: "new" | "continue" | "resume" | "fork";
  status: RuntimeSessionStatus;
  startedAt: string;
  updatedAt: string;
  error?: string | null;
}

interface RuntimeState {
  sessions: Record<string, RuntimeSession>;
  activeSessionId: string | null;
  ptyTail: Record<string, string>;
  events: Array<{ id: string; type: string; sessionId?: string; message: string; ts: string }>;

  addSession: (session: RuntimeSession) => void;
  patchSession: (sessionId: string, patch: Partial<RuntimeSession>) => void;
  setActiveSession: (sessionId: string) => void;
  appendPtyTail: (sessionId: string, chunk: string) => void;
  addEvent: (event: { type: string; sessionId?: string; message: string }) => void;
}

export const useRuntimeStore = create<RuntimeState>((set) => ({
  sessions: {},
  activeSessionId: null,
  ptyTail: {},
  events: [],

  addSession: (session) =>
    set((state) => ({
      sessions: { ...state.sessions, [session.id]: session },
      activeSessionId: session.id,
    })),

  patchSession: (sessionId, patch) =>
    set((state) => ({
      sessions: {
        ...state.sessions,
        [sessionId]: {
          ...state.sessions[sessionId],
          ...patch,
          updatedAt: new Date().toISOString(),
        },
      },
    })),

  setActiveSession: (sessionId) => set({ activeSessionId: sessionId }),

  appendPtyTail: (sessionId, chunk) =>
    set((state) => {
      const prev = state.ptyTail[sessionId] ?? "";
      const next = (prev + chunk).slice(-32768);
      return { ptyTail: { ...state.ptyTail, [sessionId]: next } };
    }),

  addEvent: (event) =>
    set((state) => ({
      events: [
        { id: crypto.randomUUID(), ts: new Date().toISOString(), ...event },
        ...state.events,
      ].slice(0, 200),
    })),
}));
```

注意：`events` 最多 200 条，`ptyTail` 最多 32KB。PTY 原始流不能全量进入 React store。

---

## 8. WorkspaceStore

创建：

```text
src/features/workspace/stores/workspaceStore.ts
```

```ts
import { create } from "zustand";

export interface WorkspaceTab {
  id: string;
  sessionId: string;
  projectId: string;
  title: string;
  active: boolean;
}

interface WorkspaceState {
  tabs: WorkspaceTab[];
  activeSessionId: string | null;
  composerDrafts: Record<string, string>;

  openSessionTab: (tab: Omit<WorkspaceTab, "active"> & { active?: boolean }) => void;
  focusSession: (sessionId: string) => void;
  setComposerDraft: (sessionId: string, value: string) => void;
  appendComposerDraft: (sessionId: string, value: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  tabs: [],
  activeSessionId: null,
  composerDrafts: {},

  openSessionTab: (tab) =>
    set((state) => {
      const exists = state.tabs.some((t) => t.sessionId === tab.sessionId);
      const tabs = exists
        ? state.tabs.map((t) => ({ ...t, active: t.sessionId === tab.sessionId }))
        : [
            ...state.tabs.map((t) => ({ ...t, active: false })),
            { ...tab, active: true },
          ];

      return { tabs, activeSessionId: tab.sessionId };
    }),

  focusSession: (sessionId) =>
    set((state) => ({
      tabs: state.tabs.map((t) => ({ ...t, active: t.sessionId === sessionId })),
      activeSessionId: sessionId,
    })),

  setComposerDraft: (sessionId, value) =>
    set((state) => ({
      composerDrafts: { ...state.composerDrafts, [sessionId]: value },
    })),

  appendComposerDraft: (sessionId, value) =>
    set((state) => ({
      composerDrafts: {
        ...state.composerDrafts,
        [sessionId]: `${state.composerDrafts[sessionId] ?? ""}${value}`,
      },
    })),
}));
```

---

## 9. WorkspaceSurface

创建：

```text
src/features/workspace/pages/WorkspaceSurface.tsx
```

```tsx
import { useWorkspaceStore } from "../stores/workspaceStore";
import { TerminalPane } from "../components/TerminalPane";
import { ChatComposer } from "../components/ChatComposer";
import { ChatSemanticPane } from "../components/ChatSemanticPane";
import { SessionMonitorPane } from "../components/SessionMonitorPane";
import "../styles/workspace.css";

export function WorkspaceSurface() {
  const tabs = useWorkspaceStore((s) => s.tabs);
  const activeSessionId = useWorkspaceStore((s) => s.activeSessionId);
  const focusSession = useWorkspaceStore((s) => s.focusSession);

  const active = tabs.find((t) => t.sessionId === activeSessionId);

  if (!active) {
    return (
      <main className="workspace-empty">
        <h2>暂无打开的 Claude 会话</h2>
        <p>请从项目管理页或控制台新建一个 Claude Code 会话。</p>
      </main>
    );
  }

  return (
    <main className="workspace-surface">
      <div className="workspace-tabs">
        {tabs.map((tab) => (
          <button key={tab.id} className={tab.active ? "active" : ""} onClick={() => focusSession(tab.sessionId)}>
            {tab.title}
          </button>
        ))}
      </div>

      <div className="workspace-body">
        <section className="workspace-chat">
          <ChatSemanticPane sessionId={active.sessionId} />
          <ChatComposer sessionId={active.sessionId} />
        </section>

        <section className="workspace-terminal">
          <TerminalPane sessionId={active.sessionId} />
        </section>

        <section className="workspace-monitor">
          <SessionMonitorPane sessionId={active.sessionId} />
        </section>
      </div>
    </main>
  );
}
```

---

## 10. TerminalPane：只负责 xterm，真实输出走 usePtyTerminal

创建：

```text
src/features/workspace/components/TerminalPane.tsx
```

```tsx
import { useRef, useState } from "react";
import { usePtyTerminal } from "../../terminal/usePtyTerminal";
import { useRuntimeStore } from "../../runtime/stores/runtimeStore";

export function TerminalPane({ sessionId }: { sessionId: string }) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const terminal = usePtyTerminal(sessionId, el);
  const session = useRuntimeStore((s) => s.sessions[sessionId]);

  return (
    <div className="terminal-pane">
      <div className="terminal-toolbar">
        <span>{session?.status ?? terminal?.status ?? "starting"}</span>
        <button onClick={() => terminal?.sendCtrlC()} disabled={!terminal}>Ctrl+C</button>
        <button onClick={() => terminal?.clear()} disabled={!terminal}>Clear</button>
      </div>
      <div className="terminal-container" ref={setEl} />
    </div>
  );
}
```

路径 `../../terminal/usePtyTerminal` 请按当前真实文件位置调整。不要复制第二份 hook。

---

## 11. ChatComposer：只写同一个 PTY sessionId

创建：

```text
src/features/workspace/components/ChatComposer.tsx
```

```tsx
import { sendTextToInteractiveSession } from "../../runtime/services/runtimeBridge";
import { useWorkspaceStore } from "../stores/workspaceStore";

export function ChatComposer({ sessionId }: { sessionId: string }) {
  const value = useWorkspaceStore((s) => s.composerDrafts[sessionId] ?? "");
  const setComposerDraft = useWorkspaceStore((s) => s.setComposerDraft);

  async function submit() {
    const text = value.trim();
    if (!text) return;

    setComposerDraft(sessionId, "");
    await sendTextToInteractiveSession(sessionId, text);
  }

  return (
    <div className="chat-composer">
      <textarea
        value={value}
        onChange={(e) => setComposerDraft(sessionId, e.target.value)}
        placeholder="发送到当前真实 Claude Code PTY 会话..."
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            void submit();
          }
        }}
      />
      <button onClick={submit} disabled={!value.trim()}>
        发送到 PTY
      </button>
    </div>
  );
}
```

禁止这里调用 `claude -p`。

---

## 12. ChatSemanticPane：只能吃语义事件，不能吃 PTY raw

创建：

```text
src/features/workspace/components/ChatSemanticPane.tsx
```

```tsx
export function ChatSemanticPane({ sessionId }: { sessionId: string }) {
  return (
    <div className="chat-semantic-pane">
      <div className="semantic-empty">
        <strong>语义视图</strong>
        <p>当前版本只显示 Composer 输入、statusLine、hooks、structured events。PTY 原始输出请看右侧 Terminal。</p>
      </div>
    </div>
  );
}
```

后续接 `ChatBlockRenderer`，但只能用：
- composer submit
- structured_run events
- statusLine snapshot
- hooks
- file/git/process watcher

不能把 `pty://data` 原始 chunk 转成 `assistant_delta`。

---

## 13. Projects 新建会话必须改为 RuntimeBridge

在 Projects 的 `新建 Claude 会话` 按钮中，只调用：

```ts
await startInteractiveClaudeSession({
  projectId: project.id,
  projectName: project.name,
  cwd: project.path,
  mode: "new",
});
```

不要再直接 invoke `pty_start_claude` 或 `pty_start_claude_session`。只有 RuntimeBridge 可以调用 adapter。

---

## 14. usePtyTerminal 必须补丁

当前 `usePtyTerminal` 有两个风险：

1. 默认启用 `WebglAddon`，在 WebView2 / Windows 上容易出兼容问题。
2. `ResizeObserver` 每次都直接 invoke resize，可能高频卡顿。

修改：

```ts
const ENABLE_WEBGL = false;
if (ENABLE_WEBGL) {
  try {
    const wgl = new WebglAddon();
    term.loadAddon(wgl);
    wgl.onContextLoss(() => wgl.dispose());
  } catch {}
}
```

Resize 加 debounce：

```ts
let resizeTimer: number | null = null;

const resizeObserver = new ResizeObserver(() => {
  if (resizeTimer) window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    fit.fit();
    const dims = fit.proposeDimensions();
    if (dims?.rows && dims?.cols) {
      invokeCommand("pty_v2_resize", { sessionId, rows: dims.rows, cols: dims.cols })
        .catch((e) => console.warn("pty resize failed:", e));
    }
  }, 80);
});
```

清理时：

```ts
if (resizeTimer) window.clearTimeout(resizeTimer);
```

---

## 15. main.rs 必须明确冻结新 runtime PTY 前端调用

不需要删除后端函数，但要加注释：

```rust
// Experimental runtime PTY commands.
// Do not call from frontend P0. Frontend must use RuntimeBridge -> pty_v2 adapter.
```

并在前端全局搜索，确保没有调用：

```text
pty_start_claude
pty_write
pty_resize
pty_stop
```

P0 前端只允许：

```text
pty_start_claude_session
pty_v2_write
pty_v2_resize
pty_send_ctrl_c
pty_send_ctrl_d
pty_v2_stop
```

---

## 16. 200%：Telemetry 接入顺序

P0 先不做伪语义。

P1 接：

```text
statusLine snapshots
hooks events
structured_run events
file/git/process watcher
```

这些进入：

```text
TelemetryNormalizer
→ RuntimeEvent
→ ChatBlockRenderer
→ SessionMonitorPane
→ Console / Projects / Dock
```

优先级：

```text
Level A: statusLine/hooks/stream-json
Level B: file/git/process watcher
Level C: PTY title/OSC hints
Level D: Unavailable
```

---

## 17. 500%：全部页面只读 RuntimeBridge

这些页面不能自己管理 Claude 进程：

```text
Projects
Console
AI Dock
Resources
Diagnostics
```

它们只能调用：

```text
RuntimeBridge API
RuntimeStore selector
WorkspaceStore selector
ResourceActivationBridge
Diagnostics service
```

---

## 18. 一次性执行 Prompt

把下面这段直接发给 Claude CLI：

```text
请执行 Ctrl-CC RuntimeBridge 4.0 总修复。不要做 UI 美化，不要做资源区重构，不要继续加新页面。目标是一次性建立最终 Runtime 架构，并打通 GUI 内 Claude Code CLI。

当前审计结论：
1. main.rs 同时注册旧 PTY data plane 和新 runtime PTY command。
2. usePtyTerminal 使用旧 PTY 通道：pty://data + pty_v2_write。
3. src/features/runtime 和 src/features/workspace 为空或未完成。
4. ChatBlockRenderer 是语义卡片，不允许承载 PTY raw output。
5. 现在新建会话卡死，是因为 Projects / Runtime / Workspace 链路不统一，且可能 await PTY/Claude ready 后才跳 Workspace。

硬性目标：
1. 建立 src/features/runtime：RuntimeBridge / RuntimeStore / InteractionAdapter / TelemetryNormalizer。
2. 建立 src/features/workspace：WorkspaceSurface / TerminalPane / ChatComposer / ChatSemanticPane / SessionMonitorPane / WorkspaceStore。
3. P0 只使用一套 PTY 通道：pty_start_claude_session + pty_v2_write + pty_v2_resize + pty_send_ctrl_c + pty_v2_stop + pty://data。
4. 前端禁止调用 pty_start_claude / pty_write / pty_resize / pty_stop。
5. Projects 新建会话必须先创建 session、打开 Workspace tab、跳转 Workspace，再后台启动 PTY。
6. ChatComposer 只写入同一个 PTY sessionId，禁止 claude -p。
7. PTY raw output 只进入 xterm，不进入 ChatBlockRenderer，不进入无限 ErrorLog。
8. ErrorLog 只能保留最多 200 条摘要事件。
9. usePtyTerminal 关闭默认 WebGL，resize 加 80ms debounce。
10. 建立 Smoke Test：PTY shell / claude --version / Claude interactive。

执行顺序：
1. rg 搜索 pty_start_claude、pty_write、pty_resize、pty_stop、pty_start_claude_session、pty_v2_write、usePtyTerminal、ChatBlockRenderer。
2. 输出当前调用链报告。
3. 新增 runtime 和 workspace 文件。
4. 修改 Projects 的新建会话入口，只调用 RuntimeBridge。
5. 修改 Console / Dock / Resources 的相关入口，只调用 RuntimeBridge 或 ResourceActivationBridge。
6. 修补 usePtyTerminal：disable WebGL + debounce resize。
7. 修补 ErrorLog：不要渲染 pty raw chunk，限制 200 条。
8. 运行 npm run typecheck。
9. 运行 npm run build。
10. 运行 cargo check --manifest-path src-tauri/Cargo.toml。
11. 输出最终调用链、修改文件、测试结果、仍未完成的 P1/P2 项。

验收：
- 点击新建 Claude 会话后 1 秒内进入 Workspace。
- Workspace 立即出现新 tab 和 Terminal starting 状态。
- PTY 启动失败只显示在 Workspace tab，不会卡死 Projects。
- Terminal 能显示真实 Claude Code CLI。
- ChatComposer 输入进入同一个 PTY。
- Ctrl+C 生效。
- Stop 生效且无残留。
- Console/Projects/Dock/Resources 都围绕 RuntimeBridge，不再各自启动 Claude。
```

---

## 19. 交付必须输出

Claude CLI 完成后必须输出：

```text
1. 修改文件列表
2. RuntimeBridge API 清单
3. Projects -> RuntimeBridge -> Workspace -> PTY 的完整调用链
4. Workspace ChatComposer -> pty_v2_write 的证明
5. 前端不再调用新 runtime PTY 命令的 rg 结果
6. ErrorLog 不再吃 pty raw output 的证明
7. typecheck/build/cargo check 结果
8. 手动测试步骤和结果
```

---

## 20. 不妥协验收门槛

没有满足下面 5 条，就不算完成：

```text
[ ] 新建会话 1 秒内跳 Workspace。
[ ] UI 不再未响应。
[ ] Terminal 显示真实 Claude Code CLI。
[ ] ChatComposer 输入进入同一个 PTY。
[ ] Stop 后没有残留 cmd/conhost/claude。
```

满足这 5 条后，才开始做 200% 可视化和 500% 管理增强。
