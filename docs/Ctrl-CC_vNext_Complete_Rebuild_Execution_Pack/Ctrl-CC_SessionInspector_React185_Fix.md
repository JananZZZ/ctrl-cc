# Ctrl-CC React #185 定点修复：SessionInspector 无限更新循环

> 当前错误已经定位到：
>
> ```text
> SessionInspector
>   -> WorkspaceSurface
>   -> SurfaceHost
>   -> AppShell
> ```
>
> 这说明 #185 不再是“未知前端错误”，而是 `SessionInspector` 内部或它直接触发的 store action / effect / subscription 正在造成无限更新。

---

## 0. 结论

这不是 Claude CLI 的问题。  
这是 `SessionInspector` 的 React 更新循环问题。

React #185 = Maximum update depth exceeded，典型触发链：

```text
SessionInspector render
  -> useEffect / selector / subscription / computed state
  -> setState 或 store.patchSession 或 workspaceStore action
  -> RuntimeStore / WorkspaceStore 更新
  -> SessionInspector 重新 render
  -> 再次 setState / patchSession
  -> 无限循环
```

当前必须先修 `SessionInspector`。  
不要继续改 PTY，不要继续改 Claude 启动，不要继续改 Workspace 跳转。  
否则 Runtime 主链路修好也会被这个组件直接拖崩。

---

# 1. 立刻打开并审计这些文件

优先搜索：

```bash
rg "function SessionInspector|const SessionInspector|export.*SessionInspector" src
rg "SessionInspector" src
```

然后在相关文件里搜索：

```bash
rg "useEffect|setState|set[A-Z]|patchSession|updateSession|openSessionTab|focusSession|navigate|setActive|subscribe|setMode|setTab|setSelected|appendEvent|addEvent" src/features src
```

重点看 `SessionInspector` 内部是否有：

```text
1. render 阶段调用 store action
2. useEffect 内 patchSession / setState / navigate
3. useEffect 依赖对象或数组，每次 render 都变化
4. selector 返回新 object，触发 effect
5. 根据 session/status 自动 setTab / setMode
6. 监听 runtime events 后写回同一个 runtime store
7. 读取 ptyTail 后又 patchSession
8. inspector 里“同步状态”到 store
```

---

# 2. SessionInspector 的硬性原则

`SessionInspector` 必须是只读组件。

允许：

```text
读取 RuntimeStore
读取 WorkspaceStore
读取 ResourceStore
读取 DiagnosticsStore
显示状态
用户点击按钮后调用 action
```

禁止：

```text
组件 render 阶段写 store
组件 useEffect 根据 store 数据再写同一个 store
自动 openSessionTab
自动 navigate
自动 patchSession
自动 appendEvent
自动 setActive
自动 setTab 无限同步
```

正确定位：

```text
SessionInspector = read-only monitor + user-triggered controls
```

它不能承担 Runtime 同步器角色。  
Runtime 同步必须在 RuntimeKernel / RuntimeEventBridge 中完成。

---

# 3. 最可能的错误模式和修法

## 3.1 render 阶段写 store

错误：

```tsx
export function SessionInspector({ sessionId }) {
  const session = useRuntimeStore((s) => s.sessions[sessionId]);

  if (session?.status === "failed") {
    useRuntimeStore.getState().addEvent(...);
  }

  return ...
}
```

修复：

```tsx
export function SessionInspector({ sessionId }) {
  const session = useRuntimeStore((s) => s.sessions[sessionId]);

  return ...
}
```

如果必须记录事件，放到 RuntimeKernel 状态变化处，不放 Inspector。

---

## 3.2 useEffect 里 patchSession，依赖 session

错误：

```tsx
useEffect(() => {
  if (session) {
    patchSession(session.id, { updatedAt: new Date().toISOString() });
  }
}, [session]);
```

这个会无限循环，因为 patchSession 改 session，session 变化，又触发 effect。

修复：

```tsx
// 删除。展示层不能因为展示而更新 updatedAt。
```

---

## 3.3 useEffect 里根据状态自动切 tab

错误：

```tsx
useEffect(() => {
  if (session?.status === "failed") {
    setTab("errors");
  } else {
    setTab("overview");
  }
}, [session]);
```

如果 `session` 每次都是新对象，会循环。  
即使不循环，也会覆盖用户选择。

修复：

```tsx
const [tab, setTab] = useState<InspectorTab>("overview");

useEffect(() => {
  setTab("overview");
}, [sessionId]);
```

只在 sessionId 变化时重置，不根据 session 对象反复同步。

---

## 3.4 selector 返回新对象

错误：

```tsx
const data = useRuntimeStore((s) => ({
  session: s.sessions[sessionId],
  events: s.events.filter((e) => e.sessionId === sessionId),
}));
```

这每次 selector 都返回新对象。  
如果 effect 依赖 `data`，非常容易死循环。

修复：

```tsx
const session = useRuntimeStore((s) => s.sessions[sessionId]);
const allEvents = useRuntimeStore((s) => s.events);

const events = useMemo(
  () => allEvents.filter((e) => e.sessionId === sessionId).slice(0, 50),
  [allEvents, sessionId]
);
```

---

## 3.5 useEffect 依赖 unstable callback

错误：

```tsx
const actions = {
  stop: () => stopSession(sessionId),
};

useEffect(() => {
  setActions(actions);
}, [actions]);
```

修复：

```tsx
const stop = useCallback(() => {
  void RuntimeBridge.stop(sessionId);
}, [sessionId]);
```

不要把每次 render 新建的对象放进 dependency。

---

## 3.6 监听事件后写回同一 store

错误：

```tsx
useEffect(() => {
  return useRuntimeStore.subscribe((state) => {
    patchSession(sessionId, { status: deriveStatus(state) });
  });
}, [sessionId]);
```

这属于 store 订阅写回 store，极容易循环。

修复：

```text
删除。
状态派生放 selector/useMemo，或者 RuntimeKernel 统一写状态。
```

---

# 4. 推荐的最终 SessionInspector 结构

用这个结构替换当前 `SessionInspector`。  
如果项目已有样式，可以保留 className，但逻辑按这个来。

```tsx
import { useMemo, useState, useCallback } from "react";
import { useRuntimeStore } from "../runtime/stores/runtimeStore";
import { RuntimeBridge } from "../runtime/services/runtimeBridge";

type InspectorTab = "overview" | "events" | "diagnostics" | "resources" | "audit";

interface SessionInspectorProps {
  sessionId: string;
}

export function SessionInspector({ sessionId }: SessionInspectorProps) {
  const [tab, setTab] = useState<InspectorTab>("overview");

  const session = useRuntimeStore((s) => s.sessions[sessionId]);
  const allEvents = useRuntimeStore((s) => s.events);
  const ptyTail = useRuntimeStore((s) => s.ptyTail[sessionId] ?? "");

  const events = useMemo(
    () => allEvents.filter((event) => event.sessionId === sessionId).slice(0, 50),
    [allEvents, sessionId]
  );

  const statusLabel = session?.status ?? "unknown";

  const handleStop = useCallback(() => {
    void RuntimeBridge.stop(sessionId);
  }, [sessionId]);

  const handleCtrlC = useCallback(() => {
    void RuntimeBridge.ctrlC(sessionId);
  }, [sessionId]);

  const handleOpenDiagnostics = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent("ctrlcc:navigate", {
        detail: { surface: "diagnostics", sessionId },
      })
    );
  }, [sessionId]);

  if (!session) {
    return (
      <aside className="session-inspector">
        <div className="session-inspector-empty">
          <strong>Session unavailable</strong>
          <p>当前会话不存在或已被清理。</p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="session-inspector">
      <header className="session-inspector-header">
        <div>
          <strong>{session.name}</strong>
          <span>{session.cwd}</span>
        </div>
        <span className={`status-chip status-${statusLabel}`}>{statusLabel}</span>
      </header>

      <nav className="session-inspector-tabs">
        <button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}>Overview</button>
        <button className={tab === "events" ? "active" : ""} onClick={() => setTab("events")}>Events</button>
        <button className={tab === "diagnostics" ? "active" : ""} onClick={() => setTab("diagnostics")}>Diagnostics</button>
        <button className={tab === "resources" ? "active" : ""} onClick={() => setTab("resources")}>Resources</button>
        <button className={tab === "audit" ? "active" : ""} onClick={() => setTab("audit")}>Audit</button>
      </nav>

      <section className="session-inspector-body">
        {tab === "overview" && (
          <div className="inspector-panel">
            <Field label="Project" value={session.projectName} />
            <Field label="Status" value={statusLabel} />
            <Field label="CWD" value={session.cwd} />
            <Field label="Shell" value={session.shellStrategy ?? "Unavailable"} />
            <Field label="Claude" value={session.claudeCommand ?? "Unavailable"} />
            <Field label="Error" value={session.error ?? "None"} />
          </div>
        )}

        {tab === "events" && (
          <div className="inspector-panel">
            {events.length === 0 ? (
              <p>No events.</p>
            ) : (
              events.map((event) => (
                <article key={event.id} className={`event-row level-${event.level}`}>
                  <strong>{event.type}</strong>
                  <span>{event.message}</span>
                  <time>{event.ts}</time>
                </article>
              ))
            )}
          </div>
        )}

        {tab === "diagnostics" && (
          <div className="inspector-panel">
            <button onClick={handleOpenDiagnostics}>Open Diagnostics</button>
            <pre>{ptyTail.slice(-2000) || "No PTY tail."}</pre>
          </div>
        )}

        {tab === "resources" && (
          <div className="inspector-panel">
            <p>Active resources will be shown here.</p>
          </div>
        )}

        {tab === "audit" && (
          <div className="inspector-panel">
            <p>Audit events will be shown here.</p>
          </div>
        )}
      </section>

      <footer className="session-inspector-actions">
        <button onClick={handleCtrlC}>Ctrl+C</button>
        <button onClick={handleStop}>Stop</button>
      </footer>
    </aside>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="inspector-field">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
```

关键点：

```text
1. 没有 useEffect 写 store。
2. 没有 render 阶段副作用。
3. 所有 action 都在 button click 里。
4. events 用 useMemo 派生，不写回 store。
5. tab 只由用户点击改变。
```

---

# 5. RuntimeStore 必须同步修

如果 `patchSession` 每次都返回新对象，也可能让 Inspector 不断刷新。  
修为幂等：

```ts
patchSession: (id, patch) =>
  set((state) => {
    const old = state.sessions[id];
    if (!old) return state;

    const changed = Object.entries(patch).some(([key, value]) => {
      return old[key as keyof typeof old] !== value;
    });

    if (!changed) return state;

    return {
      sessions: {
        ...state.sessions,
        [id]: {
          ...old,
          ...patch,
          updatedAt: new Date().toISOString(),
        },
      },
    };
  });
```

注意：如果 Zustand store 里还有其他字段，return 时要保留：

```ts
return {
  ...state,
  sessions: ...
}
```

---

# 6. WorkspaceSurface 也要检查

`WorkspaceSurface` 不允许因为 activeSessionId 改变又反复 open tab。

错误：

```tsx
useEffect(() => {
  if (activeSessionId) {
    openSessionTab(...)
  }
}, [activeSessionId, tabs]);
```

修复原则：

```text
openSessionTab 只在 RuntimeBridge.startInteractiveSession 时执行。
WorkspaceSurface 只读取 tabs 和 activeSessionId。
```

WorkspaceSurface 应该是：

```tsx
export function WorkspaceSurface() {
  const tabs = useWorkspaceStore((s) => s.tabs);
  const activeSessionId = useWorkspaceStore((s) => s.activeSessionId);
  const focusSession = useWorkspaceStore((s) => s.focusSession);

  const active = useMemo(
    () => tabs.find((tab) => tab.sessionId === activeSessionId) ?? null,
    [tabs, activeSessionId]
  );

  if (!active) return <WorkspaceEmpty />;

  return (
    ...
  );
}
```

不要在这里启动 Runtime，也不要补 tab。

---

# 7. SurfaceHost / AppShell 也要检查 navigate loop

组件 stack 里有：

```text
SurfaceHost
AppShell
```

所以还要检查：

```bash
rg "ctrlcc:navigate|navigateTo|setSurface|setActiveSurface|SurfaceHost|AppShell" src
```

禁止：

```tsx
useEffect(() => {
  setSurface(route.surface);
}, [route, surface]);
```

必须做 no-op：

```ts
setSurface: (next) =>
  set((state) => {
    if (state.surface === next) return state;
    return { surface: next };
  });
```

Navigation handler 必须防重复：

```ts
if (
  current.surface === target.surface &&
  current.sessionId === target.sessionId &&
  current.projectId === target.projectId
) {
  return;
}
```

---

# 8. 执行 Prompt

把下面发给 Claude CLI：

```text
现在 React #185 已经定位到 SessionInspector：

Component stack:
SessionInspector
WorkspaceSurface
SurfaceHost
AppShell
ErrorBoundary
App

请不要继续改 PTY 或 Claude CLI。先修 SessionInspector 无限更新循环。

必须执行：
1. 打开 SessionInspector 源码。
2. 搜索其中所有 useEffect、setState、store action、patchSession、updateSession、openSessionTab、focusSession、navigate、subscribe。
3. 删除所有 render 阶段副作用。
4. 删除所有“根据 session 状态写回 RuntimeStore/WorkspaceStore”的 effect。
5. SessionInspector 必须改为只读 monitor + 用户点击触发 action。
6. selector 不允许返回新 object。
7. events/filter/tail 派生必须用 useMemo，不写回 store。
8. tab 状态只能由用户点击改变，或者只在 sessionId 改变时 reset。
9. RuntimeStore patchSession / WorkspaceStore openSessionTab / AppShell setSurface 必须幂等，无变化 return state。
10. WorkspaceSurface 不允许自动 openSessionTab。
11. SurfaceHost/AppShell navigation 必须防重复。
12. ErrorLog 不允许显示 pty.output raw chunk。

验收：
- App 启动不再 React #185。
- 进入 Workspace 不再 React #185。
- SessionInspector 可以显示 session 状态，但不会写 store。
- localStorage["ctrlcc:last-react-error"] 不再出现新的 #185。
- New Session 仍然必须通过 RuntimeBridge，1 秒内跳 Workspace。
- npm run typecheck 通过。
- npm run build 通过。

完成后输出：
1. SessionInspector 中造成循环的具体代码。
2. 删除或改写了哪些 useEffect。
3. 哪些 store action 做了幂等修复。
4. WorkspaceSurface / SurfaceHost 是否存在 navigate/open tab loop。
```

---

# 9. 快速验证办法

如果修完还报 #185：

1. 在 `SessionInspector` 顶部暂时加入：

```tsx
console.count("SessionInspector render");
```

如果持续刷屏，说明 selector 或父组件仍在无限更新。

2. 临时把 `SessionInspector` 替换为：

```tsx
export function SessionInspector() {
  return <aside>Inspector disabled for loop test</aside>;
}
```

如果 #185 消失，说明罪魁祸首就在 Inspector 内部。  
如果仍然出现，说明是 `WorkspaceSurface / SurfaceHost / AppShell` 在循环。

这一步是定位，不是最终方案。

---

# 10. 最高优先级

当前最高优先级只有一个：

```text
让 SessionInspector 不再写任何会触发自身重渲染的状态。
```

修好这个，再继续 RuntimeBridge / PTY / Claude CLI。
