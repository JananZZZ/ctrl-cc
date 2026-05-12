# Ctrl-CC React #185 Surgical Fix：必须先定位并消灭无限更新循环

> **直接发给 Claude Code CLI 执行。**
>
> 当前错误：
>
> ```text
> Minified React error #185
> Component stack:
>   at x2
>   at E2
>   at FE
>   at XE
>   at GE
>   at QE
> ```
>
> 这不是 PTY 本身报错，而是前端 React 进入 **Maximum update depth exceeded**。  
> 必须先定位是哪一个组件 / effect / store action 在无限 setState。  
> 不解决 React #185，任何 Claude CLI / PTY 修复都会被 UI 崩溃掩盖。

---

# 0. 当前判断

现在仍然失败，说明至少有一个地方满足下面模式：

```text
render / effect / subscription
  -> setState / store action / navigate / openSessionTab
  -> 触发重新 render
  -> 再次 setState / store action / navigate / openSessionTab
  -> 无限循环
```

最可疑位置：

```text
1. AppShell / router / nav listener
2. ProjectsSurface 自动选择项目
3. Projects 点击新建会话后 openWorkspaceTab / navigate 循环
4. WorkspaceSurface 根据 URL/session 自动 open tab
5. RuntimeBridge startInteractiveSession 写 store 后又触发 effect 再 start
6. ErrorLog / Toast / EventLog 高频订阅后 setState 循环
7. DockSnapshotPublisher / ConsoleSnapshot interval 反复 setSnapshot
8. store selector 返回新 object，effect 依赖 object 后反复触发
```

---

# 1. 先生成可读源码映射，不能继续看 minified x2/E2

当前堆栈是 production minified bundle，`x2/E2/FE` 没有定位价值。  
必须先让构建可定位。

## 1.1 修改 Vite config

找到 `vite.config.ts`，临时设置：

```ts
export default defineConfig({
  build: {
    sourcemap: true,
    minify: false,
  },
});
```

如果有 `terserOptions` 或 `esbuild.drop`，临时移除。

## 1.2 用 dev 模式复现

优先运行：

```bash
npm run tauri dev
```

如果必须打包运行，则使用 sourcemap build：

```bash
npm run build
npm run tauri dev
```

## 1.3 ErrorBoundary 必须输出 componentStack

检查 App 根节点是否包了 ErrorBoundary。没有则新增：

```tsx
import React from "react";

export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null; info: React.ErrorInfo | null }
> {
  state: { error: Error | null; info: React.ErrorInfo | null } = {
    error: null,
    info: null,
  };

  static getDerivedStateFromError(error: Error) {
    return { error, info: null };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const payload = {
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
      ts: new Date().toISOString(),
    };

    console.error("[Ctrl-CC React Error]", payload);
    localStorage.setItem("ctrlcc:last-react-error", JSON.stringify(payload, null, 2));
  }

  render() {
    if (this.state.error) {
      return (
        <main style={{ padding: 32, fontFamily: "system-ui" }}>
          <h1>应用出现错误</h1>
          <p>{this.state.error.message}</p>
          <button onClick={() => location.reload()}>Reload</button>
          <pre style={{ whiteSpace: "pre-wrap", maxHeight: 500, overflow: "auto" }}>
            {this.state.info?.componentStack}
          </pre>
        </main>
      );
    }

    return this.props.children;
  }
}
```

根节点：

```tsx
<AppErrorBoundary>
  <App />
</AppErrorBoundary>
```

---

# 2. 加 RenderLoopGuard，直接抓死循环组件

创建：

```text
src/debug/useRenderLoopGuard.ts
```

```ts
import { useEffect, useRef } from "react";

const renderCounters = new Map<string, { count: number; firstTs: number }>();

export function useRenderLoopGuard(name: string, limit = 60, windowMs = 1000) {
  const nameRef = useRef(name);
  const now = performance.now();
  const current = renderCounters.get(nameRef.current);

  if (!current || now - current.firstTs > windowMs) {
    renderCounters.set(nameRef.current, { count: 1, firstTs: now });
  } else {
    current.count += 1;

    if (current.count === limit) {
      console.trace(`[RenderLoopGuard] ${nameRef.current} rendered ${limit} times within ${windowMs}ms`);
      localStorage.setItem(
        "ctrlcc:render-loop",
        JSON.stringify(
          {
            component: nameRef.current,
            count: current.count,
            windowMs,
            ts: new Date().toISOString(),
          },
          null,
          2
        )
      );
    }

    if (current.count > limit + 20) {
      throw new Error(`[RenderLoopGuard] ${nameRef.current} render loop detected`);
    }
  }

  useEffect(() => {
    return () => {
      renderCounters.delete(nameRef.current);
    };
  }, []);
}
```

在以下组件顶部临时加入：

```tsx
useRenderLoopGuard("AppShell");
useRenderLoopGuard("ProjectsSurface");
useRenderLoopGuard("WorkspaceSurface");
useRenderLoopGuard("ConsoleSurface");
useRenderLoopGuard("ResourcesSurface");
useRenderLoopGuard("ErrorLog");
useRenderLoopGuard("RuntimeBridgeProvider");
useRenderLoopGuard("DockSnapshotPublisher");
```

如果不知道组件名，给所有顶层 surface 都加。  
目标是让 `localStorage["ctrlcc:render-loop"]` 直接显示罪魁祸首。

---

# 3. 所有 Store Action 必须 idempotent

React #185 经常来自 store action 每次都返回新对象，即使值没变。  
所有 store action 必须做 no-op 判断。

## 3.1 ProjectsStore

错误：

```ts
selectProject: (id) => set({ selectedProjectId: id })
```

修复：

```ts
selectProject: (id) =>
  set((state) => {
    if (state.selectedProjectId === id) return state;
    return { selectedProjectId: id };
  });
```

## 3.2 WorkspaceStore openSessionTab

必须 no-op：

```ts
openSessionTab: (tab) =>
  set((state) => {
    const existing = state.tabs.find((t) => t.sessionId === tab.sessionId);
    const alreadyActive = existing && state.activeSessionId === tab.sessionId;

    if (alreadyActive) {
      return state;
    }

    if (existing) {
      return {
        ...state,
        activeSessionId: tab.sessionId,
        tabs: state.tabs.map((t) => ({
          ...t,
          active: t.sessionId === tab.sessionId,
        })),
      };
    }

    return {
      ...state,
      activeSessionId: tab.sessionId,
      tabs: [
        ...state.tabs.map((t) => ({ ...t, active: false })),
        { ...tab, active: true },
      ],
    };
  });
```

## 3.3 RuntimeStore patchSession

必须判断 patch 是否真的改变：

```ts
patchSession: (id, patch) =>
  set((state) => {
    const old = state.sessions[id];
    if (!old) return state;

    let changed = false;
    for (const key of Object.keys(patch) as Array<keyof typeof patch>) {
      if (old[key as keyof typeof old] !== patch[key]) {
        changed = true;
        break;
      }
    }

    if (!changed) return state;

    return {
      ...state,
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

## 3.4 Console / Dock / Resources settings

所有 `setMode / setView / setFilter / setTab / setTheme` 都要：

```ts
if (state.value === next) return state;
```

---

# 4. 修所有高危 useEffect

## 4.1 Projects 自动选择项目

错误：

```tsx
useEffect(() => {
  if (projects.length) selectProject(projects[0].id);
}, [projects]);
```

修复：

```tsx
useEffect(() => {
  if (!selectedProjectId && projects.length > 0) {
    selectProject(projects[0].id);
  }
}, [selectedProjectId, projects.length, selectProject]);
```

不要依赖整个 `projects` array。

## 4.2 Workspace 自动打开 session

错误：

```tsx
useEffect(() => {
  openSessionTab(session);
}, [session, tabs]);
```

修复：

```tsx
useEffect(() => {
  if (!routeSessionId) return;
  if (tabs.some((t) => t.sessionId === routeSessionId)) return;

  const session = runtimeSessions[routeSessionId];
  if (!session) return;

  openSessionTab({
    id: `tab_${routeSessionId}`,
    sessionId: routeSessionId,
    projectId: session.projectId,
    title: session.name,
  });
}, [routeSessionId, tabs.length, runtimeSessions, openSessionTab]);
```

更好：把 open tab 放在 RuntimeBridge 启动时做，不要在 Workspace render 时做。

## 4.3 Navigation event listener

必须防止重复 navigate：

```ts
function navigateOnce(target: NavigationTarget) {
  const current = getCurrentRouteSnapshot();

  if (
    current.surface === target.surface &&
    current.projectId === target.projectId &&
    current.sessionId === target.sessionId
  ) {
    return;
  }

  navigate(target);
}
```

## 4.4 Snapshot publisher

错误：

```tsx
useEffect(() => {
  const timer = setInterval(() => {
    setSnapshot(buildSnapshot());
  }, 500);
}, [snapshot]);
```

修复：

```tsx
useEffect(() => {
  const timer = window.setInterval(() => {
    publishSnapshot();
  }, 1000);

  return () => window.clearInterval(timer);
}, []);
```

Publisher 不应该依赖自己发布的 snapshot。

---

# 5. 临时关闭所有自动启动，直到 React #185 消失

加入 RuntimeFlags：

```text
src/features/runtime/services/runtimeFlags.ts
```

```ts
export const RuntimeFlags = {
  enableAutoStartClaude: false,
  enableRuntimeIntervals: false,
  enableDockPublisher: false,
  enableConsoleLivePublisher: false,
};
```

任何启动 Claude 的按钮暂时改为：

```ts
if (!RuntimeFlags.enableAutoStartClaude) {
  throw new Error("Runtime autostart disabled while React #185 is being fixed. Use Diagnostics > Runtime Smoke Test.");
}
```

这是为了定位 React #185，不是最终功能。

---

# 6. 建立 Diagnostics Runtime Smoke Test

React #185 修复后，不要直接点 New Session。  
先在 Diagnostics 里跑最小 smoke test。

新增 Rust command：

```rust
#[tauri::command]
pub fn runtime_smoke_test() -> serde_json::Value {
    use std::process::{Command, Stdio};

    let comspec = std::env::var("ComSpec").ok();
    let system_root = std::env::var("SystemRoot").ok();
    let windir = std::env::var("WINDIR").ok();
    let path_len = std::env::var("PATH").unwrap_or_default().len();

    let cmd_path = comspec.clone().unwrap_or_else(|| {
        let root = system_root.clone().or(windir.clone()).unwrap_or_else(|| "C:\\Windows".to_string());
        format!("{}\\System32\\cmd.exe", root)
    });

    let cmd_echo = Command::new(&cmd_path)
        .args(["/d", "/s", "/c", "echo CMD_OK"])
        .stdin(Stdio::null())
        .output();

    let where_claude = Command::new(&cmd_path)
        .args(["/d", "/s", "/c", "where claude"])
        .stdin(Stdio::null())
        .output();

    let claude_version = Command::new(&cmd_path)
        .args(["/d", "/s", "/c", "claude --version"])
        .stdin(Stdio::null())
        .output();

    serde_json::json!({
        "comspec": comspec,
        "systemRoot": system_root,
        "windir": windir,
        "pathLen": path_len,
        "cmdPath": cmd_path,
        "cmdEcho": format_output(cmd_echo),
        "whereClaude": format_output(where_claude),
        "claudeVersion": format_output(claude_version),
    })
}

fn format_output(result: std::io::Result<std::process::Output>) -> serde_json::Value {
    match result {
        Ok(out) => serde_json::json!({
            "success": out.status.success(),
            "code": out.status.code(),
            "stdout": String::from_utf8_lossy(&out.stdout).to_string(),
            "stderr": String::from_utf8_lossy(&out.stderr).to_string(),
        }),
        Err(err) => serde_json::json!({
            "success": false,
            "error": err.to_string(),
        }),
    }
}
```

注册到 `main.rs`。

Diagnostics 面板：

```tsx
export function RuntimeSmokeTestPanel() {
  const [result, setResult] = useState<unknown>(null);
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    try {
      setResult(await invoke("runtime_smoke_test"));
    } catch (e) {
      setResult({ error: String(e) });
    } finally {
      setRunning(false);
    }
  }

  return (
    <section>
      <h2>Runtime Smoke Test</h2>
      <button onClick={run} disabled={running}>
        {running ? "Running..." : "Run"}
      </button>
      <pre>{JSON.stringify(result, null, 2)}</pre>
    </section>
  );
}
```

---

# 7. 如果仍然 cmd 0xc0000142

如果 smoke test 里 `cmdEcho.success=false` 或继续弹窗，则必须做 shell strategy fallback：

```text
1. powershell.exe -NoLogo -NoProfile
2. pwsh.exe -NoLogo -NoProfile
3. cmd.exe /d /q
4. user configured override
```

不要再单押 cmd。

PowerShell smoke：

```powershell
Write-Output CTRLCC_SHELL_OK
```

Claude discovery：

```powershell
Get-Command claude
claude --version
```

如果 `claude` 实际是 `claude.cmd`，PowerShell 可能仍调用 cmd wrapper；要进一步找 `claude.ps1` 或真实 npm package entry。

---

# 8. 恢复 New Session 的唯一条件

必须同时满足：

```text
[ ] React #185 消失。
[ ] RuntimeSmokeTest UI 能运行。
[ ] 至少一个 shell strategy echo 成功。
[ ] claude --version 成功，或明确显示 PATH/auth 问题。
```

才允许把：

```ts
RuntimeFlags.enableAutoStartClaude = true;
```

打开。

---

# 9. New Session 正确流程

```ts
export async function startInteractiveSession(input: StartInteractiveInput) {
  const session = createSession(input);

  runtimeStore.addSession(session);
  workspaceStore.openSessionTab(sessionToTab(session));
  navigateToWorkspace(session.id);

  queueMicrotask(() => {
    void runtimeKernel.startInBackground(session.id, input);
  });

  return session;
}
```

启动失败时：

```ts
runtimeStore.patchSession(session.id, {
  status: "failed",
  error: message,
});
workspaceStore.appendSystemMessage(session.id, message);
```

不能让 Projects 卡死。

---

# 10. usePtyTerminal 必须修

## 10.1 关闭 WebGL

```ts
const ENABLE_WEBGL = false;
```

## 10.2 Resize debounce

```ts
let resizeTimer: number | null = null;
const resizeObserver = new ResizeObserver(() => {
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    fit.fit();
    const dims = fit.proposeDimensions();
    if (dims) {
      void resizeRuntimeSession(sessionId, dims.rows, dims.cols);
    }
  }, 100);
});
```

## 10.3 pty.output 不能进 React 大列表

xterm 直接写：

```ts
terminal.write(chunk);
```

runtimeStore 只保留 tail。

---

# 11. ErrorLog 必须改

```ts
const visibleEvents = events
  .filter((e) => e.type !== "pty.output")
  .slice(0, 200);
```

如果必须展示 pty output，只显示 tail 和折叠。

---

# 12. 给 Claude CLI 的执行 Prompt

```text
继续修 Ctrl-CC，但现在目标不是改 PTY，而是定位 React #185 无限更新。

当前错误 stack 仍是 Minified React error #185，component 是 x2/E2/FE 等 minified 名称。必须先让错误可定位，然后消灭循环。

请执行：
1. vite build sourcemap=true, minify=false。
2. App 根部加入 AppErrorBoundary，保存 componentStack 到 localStorage["ctrlcc:last-react-error"]。
3. 新增 useRenderLoopGuard，在 AppShell、ProjectsSurface、WorkspaceSurface、ConsoleSurface、ResourcesSurface、ErrorLog、DockSnapshotPublisher、RuntimeBridgeProvider 等顶层组件使用。
4. 搜索所有 useEffect/setState/navigate/openSessionTab/selectProject/startInteractiveClaudeSession，修复无限更新。
5. 所有 Zustand store action 改成 idempotent，无变化 return state。
6. 禁止组件 render 阶段调用 store action、navigate、start session。
7. 临时关闭 DockSnapshotPublisher、Console live interval、Runtime auto start、Workspace auto-open last session。
8. 新增 RuntimeSmokeTestPanel 和 runtime_smoke_test command，只测 cmd echo、where claude、claude --version。
9. usePtyTerminal 关闭 WebGL，resize debounce。
10. ErrorLog 限制 200 条，过滤 pty.output。
11. React #185 消失后，再恢复 RuntimeBridge.startInteractiveSession。
12. New Session 必须先打开 Workspace tab，再后台启动 PTY。

验收：
- App 启动不再 React #185。
- localStorage["ctrlcc:render-loop"] 能定位或为空。
- localStorage["ctrlcc:last-react-error"] 不再出现新的 #185。
- RuntimeSmokeTest 能跑，不造成 UI 卡死。
- cmd echo / where claude / claude --version 给出明确结果。
- New Session 1 秒内跳 Workspace。
```

---

# 13. 交付必须输出

```text
1. React #185 的真实组件名。
2. 造成循环的具体代码位置。
3. 修复前后代码说明。
4. rg useEffect/setState/navigate/openSessionTab 的检查结果。
5. store action idempotent 修复清单。
6. RuntimeSmokeTest 结果。
7. New Session E2E 结果。
```
