# Ctrl-CC Runtime / PTY / Workspace 抢救审计与可执行修复方案

> 目标：彻底解决“新建 Claude 会话卡死、未响应、创建失败、无法跳转 Workspace、无法 debug”的问题。  
> 结论：当前不是一个小 bug，而是 **Runtime 架构裂成了两套：旧 pty 数据面 + 新 runtime PTY 命令 + 空 workspace/runtime 前端目录**。必须先统一 P0 主链路，再谈 100%+200%+500%。

---

## 0. 当前关键判断

你现在上传的代码暴露了 4 个决定性问题：

1. `src/features/runtime` 和 `workspace` 为空，但 `main.rs` 已经注册了新的 runtime PTY 命令：`pty_start_claude / pty_write / pty_resize / pty_stop / structured_run`。
2. 同一个 `main.rs` 里又注册了旧 PTY 命令：`pty_start_claude_session / pty_v2_write / pty_v2_resize / pty_send_ctrl_c / pty_send_ctrl_d / pty_v2_stop / pty_get_status / pty_get_raw_log / pty_list_sessions`。
3. 当前前端 `usePtyTerminal` 监听的是旧事件：`pty://data / pty://status / pty://exit / pty://error`，并写入旧命令：`pty_v2_write / pty_v2_resize / pty_send_ctrl_c / pty_send_ctrl_d`。
4. 因此如果 Projects 页面调用了新的 `pty_start_claude`，而 Workspace Terminal 监听旧事件 `pty://data`，Terminal 永远收不到输出；如果 Projects 仍调用旧命令但流程里阻塞等待，就会未响应。

最终判断：

```text
不是 Claude Code CLI 本身失败；
是 Ctrl-CC 的 Runtime 主链路没有唯一事实来源。
```

---

## 1. P0 唯一修复方向

本阶段不做 UI 美化，不做 Resources，不做 AI Dock，不做 Console Pro。只做：

```text
Projects 点击新建会话
→ 立即创建 Ctrl-CC session
→ 立即打开 Workspace tab
→ 立即跳转 Workspace
→ Workspace Terminal 先显示 Starting
→ 后台启动 PTY shell
→ shell handshake
→ 写入 claude --name
→ Terminal 显示真实 Claude Code CLI
→ ChatComposer 写入同一个 PTY
```

P0 只允许一套 Runtime 通道：

```text
旧 pty data plane 作为 P0 主通道：
- pty_start_claude_session 或新增 pty_start_shell
- pty_v2_write
- pty_v2_resize
- pty_send_ctrl_c
- pty_send_ctrl_d
- pty_v2_stop
- event: pty://data / pty://status / pty://exit / pty://error
```

新的 `runtime::pty_session::PtySessionManager` 暂时冻结，不作为 P0 主路径。

原因：你已经有 `usePtyTerminal` 完整接入旧事件和旧命令。先用已有数据面跑通，再统一重构。

---

## 2. 必须立刻冻结/删除的错误路径

### 2.1 冻结新 runtime PTY 命令

在 `main.rs` 中，暂时不要让前端调用这些命令：

```rust
pty_start_claude
pty_write
pty_resize
pty_stop
```

不要立刻删除，避免编译牵连；但 P0 前端必须不再调用它们。

### 2.2 冻结 Stream JSON Chat 作为主 Chat

这些命令暂时只能作为后续结构化任务，不允许用于 interactive Chat：

```rust
runtime::commands::create_claude_chat
runtime::commands::send_claude_input
runtime::commands::stop_claude_chat
structured_run
```

ChatComposer P0 必须只写入 PTY。

---

## 3. 新增前端文件结构

现在 `src/features/runtime` 和 `src/features/workspace` 是空的，所以必须补齐最小主链路。

```text
src/features/runtime/
├── services/
│   ├── ptyClient.ts
│   └── runtimeDebug.ts
└── types/
    └── ptyTypes.ts

src/features/workspace/
├── pages/
│   └── WorkspaceSurface.tsx
├── components/
│   ├── WorkspaceTabs.tsx
│   ├── TerminalPane.tsx
│   └── ChatComposer.tsx
└── stores/
    └── workspaceStore.ts

src/features/projects/services/
└── launchClaudeSession.ts
```

---

## 4. runtime/services/ptyClient.ts

P0 必须统一旧命令名。

```ts
import { invokeCommand } from '../../services/invokeCommand';

export interface StartPtySessionRequest {
  sessionId: string;
  projectId: string;
  cwd: string;
  cols?: number;
  rows?: number;
  sessionName?: string;
}

export async function startPtySession(req: StartPtySessionRequest) {
  // P0：优先调用现有旧后端命令。
  // 如果后端 pty_start_claude_session 目前会阻塞或直接 cmd /c claude，后端必须按第 9 节改成 shell-only + async。
  return invokeCommand('pty_start_claude_session', {
    sessionId: req.sessionId,
    projectId: req.projectId,
    cwd: req.cwd,
    cols: req.cols ?? 120,
    rows: req.rows ?? 32,
    sessionName: req.sessionName,
  });
}

export async function writePty(sessionId: string, data: string) {
  return invokeCommand('pty_v2_write', { sessionId, data });
}

export async function resizePty(sessionId: string, cols: number, rows: number) {
  return invokeCommand('pty_v2_resize', { sessionId, cols, rows });
}

export async function sendPtyCtrlC(sessionId: string) {
  return invokeCommand('pty_send_ctrl_c', { sessionId });
}

export async function sendPtyCtrlD(sessionId: string) {
  return invokeCommand('pty_send_ctrl_d', { sessionId });
}

export async function stopPty(sessionId: string) {
  return invokeCommand('pty_v2_stop', { sessionId });
}
```

---

## 5. runtime/services/runtimeDebug.ts

```ts
export function runtimeDebug(message: string, data?: unknown) {
  console.log(`[Ctrl-CC Runtime] ${message}`, data ?? '');
}

export function runtimeErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}
```

---

## 6. workspace/stores/workspaceStore.ts

```ts
import { create } from 'zustand';

export type WorkspaceTabStatus =
  | 'created'
  | 'starting'
  | 'pty-started'
  | 'shell-ready'
  | 'claude-launching'
  | 'running'
  | 'failed'
  | 'exited'
  | 'killed';

export interface WorkspaceTab {
  id: string;
  projectId: string;
  sessionId: string;
  title: string;
  cwd: string;
  status: WorkspaceTabStatus;
  error?: string | null;
}

interface WorkspaceState {
  tabs: WorkspaceTab[];
  activeSessionId: string | null;
  openTab: (tab: WorkspaceTab) => void;
  focusTab: (sessionId: string) => void;
  updateTab: (sessionId: string, patch: Partial<WorkspaceTab>) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  tabs: [],
  activeSessionId: null,

  openTab: (tab) =>
    set((state) => {
      const exists = state.tabs.some((t) => t.sessionId === tab.sessionId);
      return {
        tabs: exists
          ? state.tabs.map((t) => (t.sessionId === tab.sessionId ? { ...t, ...tab } : t))
          : [...state.tabs, tab],
        activeSessionId: tab.sessionId,
      };
    }),

  focusTab: (sessionId) => set({ activeSessionId: sessionId }),

  updateTab: (sessionId, patch) =>
    set((state) => ({
      tabs: state.tabs.map((t) => (t.sessionId === sessionId ? { ...t, ...patch } : t)),
    })),
}));
```

---

## 7. workspace/components/TerminalPane.tsx

继续复用你已有的 `usePtyTerminal`。

```tsx
import { useRef, useState, useEffect } from 'react';
import { usePtyTerminal } from '../../pty/usePtyTerminal';
import type { WorkspaceTab } from '../stores/workspaceStore';

interface Props {
  tab: WorkspaceTab;
}

export function TerminalPane({ tab }: Props) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const terminal = usePtyTerminal(tab.sessionId, container);

  useEffect(() => {
    terminal?.fit();
  }, [terminal]);

  return (
    <section className="workspace-terminal-pane">
      <div className="workspace-terminal-status">
        <span>{tab.status}</span>
        {tab.error && <strong>{tab.error}</strong>}
      </div>
      <div ref={setContainer} className="workspace-terminal-container" />
    </section>
  );
}
```

如果 `usePtyTerminal` 的实际路径不是 `../../pty/usePtyTerminal`，按当前文件位置修正 import。

---

## 8. workspace/components/ChatComposer.tsx

ChatComposer 必须写入旧 PTY 通道。

```tsx
import { useState } from 'react';
import { writePty } from '../../runtime/services/ptyClient';
import type { WorkspaceTab } from '../stores/workspaceStore';

interface Props {
  tab: WorkspaceTab;
}

export function ChatComposer({ tab }: Props) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    try {
      await writePty(tab.sessionId, `${value}\r`);
      setText('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <footer className="workspace-chat-composer">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="发送到当前真实 Claude Code PTY 会话..."
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            void submit();
          }
        }}
      />
      <button onClick={() => void submit()} disabled={!text.trim() || busy}>
        发送到 PTY
      </button>
    </footer>
  );
}
```

禁止调用 `claude -p`。

---

## 9. workspace/pages/WorkspaceSurface.tsx

```tsx
import { useWorkspaceStore } from '../stores/workspaceStore';
import { TerminalPane } from '../components/TerminalPane';
import { ChatComposer } from '../components/ChatComposer';

export function WorkspaceSurface() {
  const tabs = useWorkspaceStore((s) => s.tabs);
  const activeSessionId = useWorkspaceStore((s) => s.activeSessionId);
  const focusTab = useWorkspaceStore((s) => s.focusTab);

  const active = tabs.find((t) => t.sessionId === activeSessionId) ?? tabs[0];

  if (!active) {
    return (
      <main className="workspace-empty">
        <h2>暂无打开的 Claude 会话</h2>
        <p>请从项目页新建会话。新建后会立即进入这里。</p>
      </main>
    );
  }

  return (
    <main className="workspace-surface">
      <nav className="workspace-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.sessionId}
            className={tab.sessionId === active.sessionId ? 'active' : ''}
            onClick={() => focusTab(tab.sessionId)}
          >
            {tab.title}
          </button>
        ))}
      </nav>

      <section className="workspace-body">
        <TerminalPane tab={active} />
        <ChatComposer tab={active} />
      </section>
    </main>
  );
}
```

---

## 10. projects/services/launchClaudeSession.ts

核心：先跳 Workspace，再后台启动 PTY。

```ts
import { useWorkspaceStore } from '../../workspace/stores/workspaceStore';
import { startPtySession, writePty } from '../../runtime/services/ptyClient';
import { runtimeDebug, runtimeErrorMessage } from '../../runtime/services/runtimeDebug';

interface ProjectLike {
  id: string;
  name: string;
  path: string;
}

export async function launchClaudeSessionFromProject(project: ProjectLike) {
  const now = new Date().toISOString();
  const sessionId = `pty_${crypto.randomUUID()}`;
  const title = `${project.name}-${now.slice(0, 16).replace(/[:T]/g, '-')}`;

  runtimeDebug('new-session.clicked', { projectId: project.id, sessionId });

  useWorkspaceStore.getState().openTab({
    id: `tab_${sessionId}`,
    projectId: project.id,
    sessionId,
    title,
    cwd: project.path,
    status: 'created',
    error: null,
  });

  navigateToWorkspace(project.id, sessionId);

  // 不 await 到 Claude ready。后台跑。
  void startSessionBackground(project, sessionId, title);
}

async function startSessionBackground(project: ProjectLike, sessionId: string, title: string) {
  const workspace = useWorkspaceStore.getState();

  try {
    workspace.updateTab(sessionId, { status: 'starting' });

    await startPtySession({
      sessionId,
      projectId: project.id,
      cwd: project.path,
      sessionName: title,
      cols: 120,
      rows: 32,
    });

    workspace.updateTab(sessionId, { status: 'pty-started' });

    // 如果后端 pty_start_claude_session 已经直接启动 claude，则这里不用再写。
    // 如果后端已按 shell-only 改造，则这里写入 claude 命令。
    // P0 推荐后端 shell-only，因此保留：
    workspace.updateTab(sessionId, { status: 'claude-launching' });
    await writePty(sessionId, `claude --name "${escapeCmd(title)}"\r`);

    workspace.updateTab(sessionId, { status: 'running' });
  } catch (error) {
    const message = runtimeErrorMessage(error);
    runtimeDebug('new-session.failed', { sessionId, message });
    workspace.updateTab(sessionId, { status: 'failed', error: message });
  }
}

function escapeCmd(value: string) {
  return value.replace(/"/g, '\\"');
}

function navigateToWorkspace(projectId: string, sessionId: string) {
  window.dispatchEvent(
    new CustomEvent('ctrlcc:navigate', {
      detail: { surface: 'workspace', projectId, sessionId },
    }),
  );
}
```

如果现有路由不是 `ctrlcc:navigate` 事件，请替换为项目现有路由函数。

---

## 11. 后端必须确认：pty_start_claude_session 不得阻塞

你没有上传 `pty_manager.rs / pty_commands.rs`，所以这里是强制审计要求。

在后端搜索：

```text
pty_start_claude_session
spawn_command
child.wait
reader.read
loop
Mutex
emit
```

必须满足：

```text
1. Tauri command 1 秒内返回。
2. reader.read 必须在线程中。
3. child.wait 必须在线程中或不在 P0 使用。
4. Mutex 只用于短时间访问 session map。
5. 不能持锁 read / wait / emit / loop。
6. 不能 cmd /c claude 后等待输出。
```

推荐后端逻辑：

```rust
#[tauri::command]
pub fn pty_start_claude_session(
    app: tauri::AppHandle,
    manager: tauri::State<'_, PtyManager>,
    req: PtyStartRequest,
) -> Result<PtyStartResponse, String> {
    manager.start_shell_non_blocking(app, req)?;
    Ok(PtyStartResponse { status: "process-created".into() })
}
```

不要在这里等待 `__CTRL_CC_PTY_READY__`。

---

## 12. usePtyTerminal 必须修两个性能点

你当前 `usePtyTerminal` 基本方向是对的：它直接监听 `pty://data` 并 `term.write`，没有把 PTY raw output 送进 React 大状态，这是正确的。

但是必须修两个点。

### 12.1 关闭 WebGL 默认启用

现在每个 terminal 都尝试 `new WebglAddon()`。在 Windows WebView2 上，这可能导致卡顿或 GPU 问题。P0 先禁用。

改成：

```ts
const enableWebgl = false;
if (enableWebgl) {
  try {
    const wgl = new WebglAddon();
    term.loadAddon(wgl);
    wgl.onContextLoss(() => wgl.dispose());
  } catch {}
}
```

### 12.2 resize 必须 throttle

现在 ResizeObserver 每次变化都可能 invoke 后端。改为 100-200ms throttle。

```ts
let resizeTimer: number | null = null;
const resizeObserver = new ResizeObserver(() => {
  if (resizeTimer != null) window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    fit.fit();
    const dims = fit.proposeDimensions();
    if (dims?.rows && dims?.cols) {
      invokeCommand('pty_v2_resize', { sessionId, rows: dims.rows, cols: dims.cols })
        .catch((e) => console.warn('pty resize failed:', e));
    }
  }, 120);
});
```

Cleanup 中清掉 timer。

---

## 13. ChatBlockRenderer 不能渲染 PTY 原始流

`ChatBlockRenderer` 适合作为语义卡片渲染器，不适合作为 PTY 原始输出渲染器。它会走 MarkdownRenderer 和大量 inline style，不能承载 terminal data stream。

规则：

```text
PTY raw output -> xterm only
Semantic RuntimeEvent -> ChatBlockRenderer
```

如果当前代码把 pty output 转成 `assistant_delta` 或 `command_output` 送到 ChatBlockRenderer，必须立刻停止。

---

## 14. main.rs 必须做的收口

P0 允许同时注册旧命令和新命令，但前端必须只走旧命令。等跑通后再删除重复。

当前 `main.rs` 同时注册新旧 PTY 命令，容易误用。建议加注释：

```rust
// P0 ACTIVE DATA PLANE:
// pty::pty_commands::pty_start_claude_session
// pty::pty_commands::pty_v2_write
// pty::pty_commands::pty_v2_resize
// pty::pty_commands::pty_send_ctrl_c
// pty::pty_commands::pty_send_ctrl_d
// pty::pty_commands::pty_v2_stop

// P0 FROZEN EXPERIMENTAL RUNTIME:
// pty_start_claude / pty_write / pty_resize / pty_stop
// Do not call from frontend until workspace/runtime split is consolidated.
```

---

## 15. 验收顺序

不要直接测 Claude。按三步：

### Step 1：Workspace 跳转测试

点击“新建 Claude 会话”：

```text
1 秒内必须跳 Workspace。
哪怕 PTY 失败，也必须看到新 tab 和错误状态。
```

### Step 2：PTY shell smoke test

后端如果支持 shell-only：

```text
echo __CTRL_CC_PTY_READY__
```

Terminal 必须显示。

### Step 3：Claude version test

在 ChatComposer 输入：

```text
claude --version
```

必须进入同一个 PTY。

### Step 4：Claude interactive test

输入：

```text
claude --name "test"
```

进入 Claude Code CLI。

---

## 16. 给 Claude CLI 的直接执行 Prompt

```text
当前 src/features/runtime 和 src/features/workspace 基本为空，但 main.rs 同时注册了两套 PTY/runtime 命令。前端 usePtyTerminal 实际监听旧 PTY 事件 pty://data/status/exit/error，并使用旧命令 pty_v2_write/resize/ctrl_c/ctrl_d。因此 P0 必须统一到旧 pty data plane。

请执行以下修复：

1. 不再从 Projects 调用新的 pty_start_claude / pty_write / runtime structured chat 作为 interactive 会话路径。
2. 新建 src/features/runtime/services/ptyClient.ts，统一封装旧命令：pty_start_claude_session、pty_v2_write、pty_v2_resize、pty_send_ctrl_c、pty_send_ctrl_d、pty_v2_stop。
3. 新建 src/features/workspace/stores/workspaceStore.ts。
4. 新建 WorkspaceSurface / TerminalPane / ChatComposer。
5. Projects 点击新建会话时，必须立即创建 workspace tab 并跳转 Workspace，然后后台异步调用 startPtySession。
6. 后端 pty_start_claude_session 必须 1 秒内返回，不允许等待 Claude ready，不允许 reader.read 或 child.wait 阻塞 Tauri command。
7. usePtyTerminal 禁用默认 WebGL，ResizeObserver 加 throttle。
8. PTY 原始输出只进入 xterm，不进入 ChatBlockRenderer / React 大事件列表。
9. ChatComposer 只调用 pty_v2_write，不调用 claude -p。
10. P0 先跑通：Workspace tab 出现、PTY 可写、Claude --version、Claude interactive。

完成后输出：修改文件清单、调用链、是否还有阻塞点、typecheck/build/cargo check 结果。
```
