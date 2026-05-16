# Ctrl-CC 13.0 稳定恢复与设计回滚执行方案
## 目标：修复 PTY / Claude CLI 真连接；删除混乱的新 UI；恢复原 Console / Projects / Workspace / Resources / GitHub / AI Dock 设计路线

适用仓库：

```text
https://github.com/JananZZZ/ctrl-cc
branch: master
```

建议新建分支：

```bash
git checkout master
git pull origin master
git checkout -b fix/stabilize-runtime-and-restore-ui-13
```

---

# 0. 当前结论

当前问题不是一个 bug，而是三类错误叠加：

```text
A. Runtime 错误
   - frontend session 显示 claude-active
   - backend PTY 实际已经 exited
   - readerAlive=false
   - 继续 write 导致 os error 232：管道正在被关闭

B. Discovery 错误
   - 旧 runtime_discover_claude 仍被前端调用
   - 旧 discovery 仍 selected powershell
   - powershell.exe 继续 0xc0000142
   - runtime_v2 discovery 和旧 discovery 并存，UI 显示混乱

C. UI 错误
   - SurfaceHost 切到了半成品 feature pages
   - 新 Console / Projects / Resources 页面没有遵循原设计
   - 页面没有完整功能，视觉也不统一
   - 旧设计更完整，应该先恢复旧 UI，再修 Runtime
```

本方案固定执行顺序：

```text
Phase 1：冻结新 UI，恢复旧 Surface 设计
Phase 2：修 Runtime 生命周期，不允许 exited PTY 被显示为 claude-active
Phase 3：修 Discovery，禁止 powershell/cmd shell wrapper 默认选中
Phase 4：修 Diagnostics，使 contract test 检查 readerAlive/status/hasWriter，而不只检查 ID
Phase 5：修 Terminal 输入，不再向 dead pipe 重复写
Phase 6：稳定后再按旧蓝图重构美化，而不是继续半成品 feature pages
```

---

# 1. Phase 1：先还原原来的页面设计

## 1.1 修改 `src/app/SurfaceHost.tsx`

当前文件把 Console / Projects / Resources 指向了新 feature pages。它们是半成品，视觉和功能都不对。直接改回旧 surfaces。

### 用下面完整内容替换 `src/app/SurfaceHost.tsx`

```tsx
import { useSurfaceStore } from '../stores/surfaceStore';
import { ErrorBoundary } from '../components/error/ErrorBoundary';

import { ConsoleSurface } from '../surfaces/console/ConsoleSurface';
import { ProjectsSurface } from '../surfaces/projects/ProjectsSurface';
import { WorkspaceSurface } from '../surfaces/workspace/WorkspaceSurface';
import { ResourcesSurface } from '../surfaces/resources/ResourcesSurface';
import { CanvasSurface } from '../surfaces/canvas/CanvasSurface';
import { GitHubSurface } from '../surfaces/github/GitHubSurface';
import { SettingsSurface } from '../surfaces/settings/SettingsSurface';

const surfaces = {
  console: ConsoleSurface,
  projects: ProjectsSurface,
  workspace: WorkspaceSurface,
  resources: ResourcesSurface,
  canvas: CanvasSurface,
  github: GitHubSurface,
  settings: SettingsSurface,
};

export function SurfaceHost() {
  const activeSurface = useSurfaceStore((s) => s.activeSurface);
  const Component = surfaces[activeSurface] ?? ConsoleSurface;

  return (
    <div style={{ flex: 1, overflow: 'hidden' }}>
      <ErrorBoundary key={activeSurface}>
        <Component />
      </ErrorBoundary>
    </div>
  );
}
```

## 1.2 暂时冻结这些半成品页面

不要删除，避免 import 断裂；但不要在 SurfaceHost 挂载：

```text
src/features/console/pages/ConsoleSurface.tsx
src/features/projects/pages/ProjectsSurface.tsx
src/features/resources/pages/ResourcesSurface.tsx
```

后续真正升级时，必须按原蓝图重做，而不是现在这种临时卡片流。

---

# 2. Phase 2：修 Runtime 生命周期核心 bug

## 2.1 根因

当前 backend PTY 退出后，`runtime_manager.rs` 只把 `reader_alive=false` 和 `status=exited`，但没有移除 writer，也没有将 `has_writer=false`。前端 RuntimeStore 也没有收到 exit 后把 session 改成 exited，所以前端仍然认为 session 是 `claude-active`，继续写入，导致：

```text
PTY write failed: 管道正在被关闭。 (os error 232)
```

## 2.2 修改 `src-tauri/src/runtime_v2/runtime_manager.rs`

### 2.2.1 修改 reader 线程退出后的状态

找到：

```rust
if let Ok(mut sessions) = sessions_ref.lock() {
    if let Some(handle) = sessions.get_mut(&pty_session_id) {
        handle.reader_alive = false;
        handle.status = "exited".into();
    }
}
```

替换为：

```rust
if let Ok(mut sessions) = sessions_ref.lock() {
    if let Some(handle) = sessions.get_mut(&pty_session_id) {
        handle.reader_alive = false;
        handle.has_writer = false;
        handle.status = "exited".into();
        handle.last_error = Some("PTY reader exited; writer is no longer valid".to_string());
    }
}
```

### 2.2.2 修改 `write()`，禁止向已退出 PTY 写入

找到：

```rust
let handle = sessions.get_mut(&req.pty_session_id).ok_or_else(|| {
    format!(
        "PTY session not found: {} (uiSessionId={})",
        req.pty_session_id, req.ui_session_id
    )
})?;

handle
    .writer
    .write_all(req.data.as_bytes())
    .map_err(|e| format!("PTY write failed: {}", e))?;
```

替换为：

```rust
let handle = sessions.get_mut(&req.pty_session_id).ok_or_else(|| {
    format!(
        "PTY session not found: {} (uiSessionId={})",
        req.pty_session_id, req.ui_session_id
    )
})?;

if handle.status == "exited" || handle.status == "failed" || !handle.reader_alive || !handle.has_writer {
    return Err(format!(
        "PTY session is not writable: {} (uiSessionId={}, status={}, readerAlive={}, hasWriter={})",
        req.pty_session_id,
        req.ui_session_id,
        handle.status,
        handle.reader_alive,
        handle.has_writer
    ));
}

handle
    .writer
    .write_all(req.data.as_bytes())
    .map_err(|e| {
        handle.has_writer = false;
        handle.last_error = Some(e.to_string());
        format!("PTY write failed: {}", e)
    })?;
```

### 2.2.3 修改启动命令参数：临时不要默认加 `--model`

当前 Claude Code 2.x 如果模型枚举不匹配，可能会立即退出。先不要由 GUI 强行传 `--model sonnet`。模型在 Claude CLI 内部默认处理，等 Runtime 稳定后再加。

找到 `build_claude_args` 中：

```rust
if let Some(model) = &req.model {
    args.push("--model".into());
    args.push(model.clone());
}
```

替换为：

```rust
// Do not force --model during PTY bootstrap.
// Some Claude Code CLI versions reject short model aliases and exit immediately.
// Model switching should be done after session is stable, or through explicit settings validation.
if let Some(model) = &req.model {
    let m = model.trim();
    if !m.is_empty() && m != "default" && m != "sonnet" && m != "opus" && m != "haiku" {
        args.push("--model".into());
        args.push(m.to_string());
    }
}
```

---

# 3. Phase 3：修 RuntimeBridge 状态错误

## 3.1 修改 `src/features/runtime/services/runtimeBridge.ts`

### 3.1.1 删除旧 discovery 调用

当前 `startSessionInBackground()` 仍然调用：

```ts
invokeCommand<{ selectedStrategy?: string; selectedCandidate?: string }>('runtime_discover_claude')
```

这个旧命令会 selected powershell，必须禁止 RuntimeBridge 再调用它。

在 `startSessionInBackground()` 中，找到整个这一段：

```ts
let selectedStrategy: string | null = null;
try {
  const discovery = await invokeCommand<{ selectedStrategy?: string; selectedCandidate?: string }>('runtime_discover_claude');
  selectedStrategy = discovery.selectedStrategy ?? discovery.selectedCandidate ?? null;
  useRuntimeStore.getState().patchSession(session.id, {
    shellStrategy: selectedStrategy,
    status: 'pty-starting',
  });
  useRuntimeTraceStore.getState().append({
    traceId: session.traceId, source: "runtime-bridge", level: "info",
    type: "discovery.ok", message: `Selected: ${selectedStrategy || 'default'}`,
    uiSessionId: session.id, ptySessionId: session.ptySessionId,
  });
} catch (discErr) {
  useRuntimeTraceStore.getState().append({
    traceId: session.traceId, source: "runtime-bridge", level: "warning",
    type: "discovery.failed", message: `Discovery failed: ${String(discErr)}`,
    uiSessionId: session.id, ptySessionId: session.ptySessionId,
  });
  useRuntimeStore.getState().patchSession(session.id, { status: 'pty-starting' });
}
```

替换为：

```ts
let selectedStrategy: string | null = null;

try {
  const discovery = await invokeCommand<{
    selected?: { id: string; label: string; program: string; argsPrefix?: string[]; canaryOk?: boolean; versionOk?: boolean; error?: string | null } | null;
    plans?: Array<{ id: string; canaryOk: boolean; versionOk: boolean; error?: string | null }>;
    errors?: string[];
  }>('runtime_discover_claude_v2');

  if (!discovery.selected) {
    const detail = discovery.errors?.join('\n') || 'No runnable Claude launch plan.';
    throw new Error(detail);
  }

  selectedStrategy = discovery.selected.id;

  useRuntimeStore.getState().patchSession(session.id, {
    shellStrategy: selectedStrategy,
    claudeCommand: discovery.selected.program,
    status: 'pty-starting',
  });

  useRuntimeTraceStore.getState().append({
    traceId: session.traceId,
    source: 'runtime-bridge',
    level: 'info',
    type: 'discovery.ok',
    message: `Selected: ${selectedStrategy}`,
    uiSessionId: session.id,
    ptySessionId: session.ptySessionId,
  });
} catch (discErr) {
  const msg = String(discErr);
  useRuntimeTraceStore.getState().append({
    traceId: session.traceId,
    source: 'runtime-bridge',
    level: 'error',
    type: 'discovery.failed',
    message: msg,
    uiSessionId: session.id,
    ptySessionId: session.ptySessionId,
  });
  useRuntimeStore.getState().patchSession(session.id, { status: 'discovery-failed', error: msg });
  useSessionStore.getState().updateSession(session.id, { status: 'failed' as const });
  return;
}
```

### 3.1.2 启动后不要直接写 `claude-active`

找到：

```ts
useRuntimeStore.getState().patchSession(session.id, { status: 'claude-active' });
```

替换为：

```ts
useRuntimeStore.getState().patchSession(session.id, { status: 'pty-ready' });
```

真正的 `claude-active` 由全局生命周期监听器在收到第一段 `pty://data` 后设置。

### 3.1.3 修 `RuntimeBridge.runContractTest`

当前：

```ts
runContractTest: async (_project: unknown) => {
  // Contract test: create session, check ptySessionId, write echo, verify, stop
  const ids = SessionIdFactory.newSessionIds();
  return { ids, status: 'not-implemented' as const };
},
```

替换为：

```ts
runContractTest: async (project: { projectId?: string; projectName?: string; cwd?: string }) => {
  const session = await startInteractiveClaudeSession({
    projectId: project.projectId ?? 'diagnostic',
    projectName: project.projectName ?? 'Runtime Diagnostic',
    cwd: project.cwd ?? '.',
    mode: 'new',
    sessionName: 'runtime-contract-test',
  });

  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const s = useRuntimeStore.getState().sessions[session.id];
    if (s?.status === 'pty-ready' || s?.status === 'claude-active') break;
    if (s?.status === 'failed' || s?.status === 'exited' || s?.status === 'discovery-failed') {
      throw new Error(`Contract test failed during start: ${s.status} ${s.error ?? ''}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  const backend = await invokeCommand<Array<{
    ptySessionId: string;
    uiSessionId?: string | null;
    status: string;
    hasWriter: boolean;
    readerAlive?: boolean;
  }>>('runtime_list_sessions_v2');

  const found = backend.find((b) => b.ptySessionId === session.ptySessionId);
  if (!found) throw new Error(`Contract failed: backend missing ${session.ptySessionId}`);
  if (found.status === 'exited' || found.status === 'failed') throw new Error(`Contract failed: backend status=${found.status}`);
  if (!found.readerAlive) throw new Error('Contract failed: backend readerAlive=false');
  if (!found.hasWriter) throw new Error('Contract failed: backend hasWriter=false');

  await write(session.id, '\r');
  return { ok: true as const, session, backend: found };
},
```

---

# 4. Phase 4：新增全局 Runtime 生命周期监听器

## 4.1 新建文件

```text
src/features/runtime/services/runtimeLifecycleBridge.ts
```

内容如下：

```ts
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { useRuntimeStore } from '../stores/runtimeStore';
import { useSessionStore } from '../../../stores/sessionStore';
import { useRuntimeTraceStore } from '../stores/runtimeTraceStore';
import { useErrorStore } from '../../../stores/errorStore';

interface PtyDataPayload {
  traceId?: string;
  uiSessionId?: string;
  ptySessionId?: string;
  session_id?: string;
  data?: string;
}

interface PtyExitPayload {
  traceId?: string;
  uiSessionId?: string;
  ptySessionId?: string;
  session_id?: string;
  error?: string;
}

interface PtyErrorPayload extends PtyExitPayload {
  message?: string;
}

function resolveUiSessionId(payload: PtyDataPayload): string | null {
  if (payload.uiSessionId) return payload.uiSessionId;
  if (payload.session_id) return payload.session_id;
  return null;
}

export async function installRuntimeLifecycleBridge(): Promise<() => void> {
  const unlisteners: UnlistenFn[] = [];

  unlisteners.push(await listen<PtyDataPayload>('pty://data', (event) => {
    const payload = event.payload;
    const uiSessionId = resolveUiSessionId(payload);
    if (!uiSessionId) return;

    const state = useRuntimeStore.getState();
    const session = state.sessions[uiSessionId];
    if (!session) return;

    state.appendPtyTail(uiSessionId, payload.data ?? '');

    if (session.status === 'pty-ready' || session.status === 'claude-launching' || session.status === 'pty-starting') {
      state.patchSession(uiSessionId, { status: 'claude-active', error: null });
      try { useSessionStore.getState().updateSession(uiSessionId, { status: 'running' as const }); } catch {}
    }
  }));

  const markExited = (payload: PtyExitPayload, reason: string) => {
    const uiSessionId = resolveUiSessionId(payload);
    if (!uiSessionId) return;

    const state = useRuntimeStore.getState();
    const session = state.sessions[uiSessionId];
    if (!session) return;

    state.patchSession(uiSessionId, {
      status: 'exited',
      exitedAt: new Date().toISOString(),
      error: reason,
    });

    try { useSessionStore.getState().updateSession(uiSessionId, { status: 'exited' as const }); } catch {}

    useRuntimeTraceStore.getState().append({
      traceId: payload.traceId ?? session.traceId,
      source: 'runtime-lifecycle',
      level: reason === 'pty exit' ? 'warning' : 'error',
      type: reason === 'pty exit' ? 'pty.exit' : 'pty.error',
      message: reason,
      uiSessionId,
      ptySessionId: payload.ptySessionId ?? session.ptySessionId,
    });
  };

  unlisteners.push(await listen<PtyExitPayload>('pty://exit', (event) => {
    markExited(event.payload, 'pty exit');
  }));

  unlisteners.push(await listen<PtyErrorPayload>('pty://error', (event) => {
    const p = event.payload;
    markExited(p, p.message || p.error || 'pty error');
    try {
      useErrorStore.getState().addError({
        severity: 'error',
        source: 'pty',
        title: 'PTY runtime error',
        detail: p.message || p.error || JSON.stringify(p),
      });
    } catch {}
  }));

  unlisteners.push(await listen<{ traceId?: string; uiSessionId?: string; ptySessionId?: string; status?: string }>('runtime://session-status', (event) => {
    const p = event.payload;
    if (!p.uiSessionId || !p.status) return;
    const s = useRuntimeStore.getState().sessions[p.uiSessionId];
    if (!s) return;

    if (p.status === 'pty-ready' || p.status === 'reader-started') {
      useRuntimeStore.getState().patchSession(p.uiSessionId, { status: 'pty-ready' });
    }
  }));

  return () => {
    for (const fn of unlisteners) fn();
  };
}
```

## 4.2 修改 `src/app/App.tsx`

加入 import：

```ts
import { installRuntimeLifecycleBridge } from '../features/runtime/services/runtimeLifecycleBridge';
```

在 `App()` 内新增一个 `useEffect`：

```tsx
useEffect(() => {
  let cleanup: undefined | (() => void);
  installRuntimeLifecycleBridge().then((fn) => {
    cleanup = fn;
  }).catch((error) => {
    console.error('[Ctrl-CC] installRuntimeLifecycleBridge failed', error);
  });
  return () => cleanup?.();
}, []);
```

---

# 5. Phase 5：修 Terminal 重复写 dead pipe

## 5.1 修改 `src/features/terminal/usePtyTerminal.ts`

### 5.1.1 payload 类型改为兼容 v2

找到：

```ts
interface PtyDataPayload { session_id: string; pty_id: string; data: string; }
interface PtyStatusPayload { session_id: string; pty_id: string; status: string; }
interface PtyExitPayload { session_id: string; pty_id: string; exit_code: number | null; }
interface PtyErrorPayload { session_id: string; pty_id: string; message: string; }
```

替换为：

```ts
interface PtyDataPayload {
  session_id?: string;
  uiSessionId?: string;
  pty_id?: string;
  ptySessionId?: string;
  data: string;
}

interface PtyStatusPayload {
  session_id?: string;
  uiSessionId?: string;
  pty_id?: string;
  ptySessionId?: string;
  status: string;
}

interface PtyExitPayload {
  session_id?: string;
  uiSessionId?: string;
  pty_id?: string;
  ptySessionId?: string;
  exit_code?: number | null;
}

interface PtyErrorPayload {
  session_id?: string;
  uiSessionId?: string;
  pty_id?: string;
  ptySessionId?: string;
  message?: string;
  error?: string;
}

function sameUiSession(payload: { session_id?: string; uiSessionId?: string }, sessionId: string) {
  return payload.uiSessionId === sessionId || payload.session_id === sessionId;
}
```

### 5.1.2 增加 dead guard

在 hook 内部：

```ts
const deadRef = useRef(false);
```

在 `useEffect` 开始处：

```ts
deadRef.current = false;
```

### 5.1.3 修 `pty://data` 过滤

找到：

```ts
listen<PtyDataPayload>('pty://data', (e) => {
  if (e.payload.session_id !== sessionId) return;
  term.write(e.payload.data);
}).then((fn) => unlisteners.push(fn));
```

替换为：

```ts
listen<PtyDataPayload>('pty://data', (e) => {
  if (!sameUiSession(e.payload, sessionId)) return;
  if (deadRef.current) return;
  term.write(e.payload.data);
}).then((fn) => unlisteners.push(fn));
```

### 5.1.4 修 exit/error 监听必须按 session 过滤

找到：

```ts
listen<PtyExitPayload>('pty://exit', () => { setStatus('exited'); }).then((fn) => unlisteners.push(fn));
listen<PtyErrorPayload>('pty://error', () => { setStatus('failed'); }).then((fn) => unlisteners.push(fn));
```

替换为：

```ts
listen<PtyExitPayload>('pty://exit', (e) => {
  if (!sameUiSession(e.payload, sessionId)) return;
  deadRef.current = true;
  setStatus('exited');
}).then((fn) => unlisteners.push(fn));

listen<PtyErrorPayload>('pty://error', (e) => {
  if (!sameUiSession(e.payload, sessionId)) return;
  deadRef.current = true;
  setStatus('failed');
}).then((fn) => unlisteners.push(fn));
```

### 5.1.5 修 onData 防止继续写 dead pipe

找到：

```ts
term.onData((data) => {
  RuntimeBridge.write(sessionId, data).catch((e: unknown) => {
    warnLog('pty', 'PTY write failed', String(e));
    term.writeln(`\x1b[31m[Ctrl-CC] Write failed: ${String(e)}\x1b[0m`);
  });
});
```

替换为：

```ts
term.onData((data) => {
  if (deadRef.current) {
    term.writeln('\x1b[33m[Ctrl-CC] This PTY session has exited. Start or resume a session before typing.\x1b[0m');
    return;
  }

  RuntimeBridge.write(sessionId, data).catch((e: unknown) => {
    const msg = String(e);
    warnLog('pty', 'PTY write failed', msg);
    if (msg.includes('not writable') || msg.includes('exited') || msg.includes('os error 232') || msg.includes('管道')) {
      deadRef.current = true;
      setStatus('exited');
    }
    term.writeln(`\x1b[31m[Ctrl-CC] Write failed: ${msg}\x1b[0m`);
  });
});
```

---

# 6. Phase 6：修 Diagnostics 判定逻辑

## 6.1 修改 `src/features/runtime/services/runtimeContractProbe.ts`

当前只判断 backend 是否有 ptySessionId。需要把 backend `status=exited`、`readerAlive=false`、`hasWriter=false` 也视为 mismatch。

找到：

```ts
} else if (!backendIds.has(s.ptySessionId)) {
  mismatches.push({ uiSessionId: s.uiSessionId, ptySessionId: s.ptySessionId, reason: "backend registry missing ptySessionId" });
}
```

替换为：

```ts
} else if (!backendIds.has(s.ptySessionId)) {
  mismatches.push({ uiSessionId: s.uiSessionId, ptySessionId: s.ptySessionId, reason: "backend registry missing ptySessionId" });
} else {
  const backend = backendPtySessions.find((b) => b.ptySessionId === s.ptySessionId);
  if (backend) {
    if (backend.status === 'exited' || backend.status === 'failed' || backend.status === 'killed') {
      mismatches.push({
        uiSessionId: s.uiSessionId,
        ptySessionId: s.ptySessionId,
        reason: `backend PTY is not alive: status=${backend.status}`,
      });
    }
    if (backend.readerAlive === false) {
      mismatches.push({
        uiSessionId: s.uiSessionId,
        ptySessionId: s.ptySessionId,
        reason: "backend readerAlive=false",
      });
    }
    if (!backend.hasWriter) {
      mismatches.push({
        uiSessionId: s.uiSessionId,
        ptySessionId: s.ptySessionId,
        reason: "backend hasWriter=false",
      });
    }
  }
}
```

## 6.2 修改 `src/features/runtime/components/RuntimeDiagnosticsPanel.tsx`

### 6.2.1 Discovery 必须用 v2，不再用旧 runtime_discover_claude

找到两处：

```ts
invoke<DiscoveryMatrix>('runtime_discover_claude').catch(() => null)
```

替换为：

```ts
invoke<any>('runtime_discover_claude_v2').catch(() => null)
```

### 6.2.2 Discovery UI 支持 v2 数据结构

当前 UI 假设：

```ts
discovery.shellStrategies
discovery.claudeCandidates
```

但 v2 返回：

```ts
selected
plans
errors
```

建议直接新增一个 v2 分支：

```tsx
{discovery && Array.isArray((discovery as any).plans) && (
  <Section title="Launch Plan Matrix">
    <table style={tableStyle}>
      <thead>
        <tr>
          {['Plan', 'Program', 'Args Prefix', 'Canary', 'Version', 'Selected', 'Error'].map((h) => (
            <th key={h} style={thStyle}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {(discovery as any).plans.map((p: any) => (
          <tr key={p.id}>
            <td style={tdStyle}>{p.id}</td>
            <td style={tdStyle}>{p.program}</td>
            <td style={tdStyle}>{(p.argsPrefix ?? p.args_prefix ?? []).join(' ')}</td>
            <td style={tdStyle}>{p.canaryOk ? '✅' : '❌'}</td>
            <td style={tdStyle}>{p.versionOk ? (p.versionText ?? 'OK') : '❌'}</td>
            <td style={tdStyle}>{p.selected ? '← SELECTED' : '-'}</td>
            <td style={tdStyle}>{p.error ?? '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </Section>
)}
```

### 6.2.3 旧 Discovery Matrix 暂时删除或放到折叠区

避免 UI 混乱。旧 command 只作为 legacy debug，不再默认显示。

---

# 7. Phase 7：修 Discovery，真正绕开 powershell/cmd

当前问题是：如果 direct node JS 没找到，还是会退回 PowerShell。你的环境 PowerShell 弹 0xc0000142，所以必须提供更稳的 shim 解析。

## 7.1 修改 `src-tauri/src/runtime_v2/claude_discovery.rs`

### 7.1.1 增加对 `where claude` / PATH shim 的解析

在文件底部新增：

```rust
fn resolve_node_plan_from_claude_shim() -> Option<ClaudeLaunchPlan> {
    let shim = find_on_path("claude.cmd")
        .or_else(|| find_on_path("claude.ps1"))
        .or_else(|| find_on_path("claude"));

    let shim = shim?;
    let content = std::fs::read_to_string(&shim).ok()?;

    let node = find_node_exe()?;

    let candidates = [
        r"node_modules\@anthropic-ai\claude-code\cli.js",
        r"node_modules\@anthropic-ai\claude-code\bin\claude.js",
        r"node_modules\@anthropic-ai\claude-code\index.js",
        r"node_modules/@anthropic-ai/claude-code/cli.js",
        r"node_modules/@anthropic-ai/claude-code/bin/claude.js",
        r"node_modules/@anthropic-ai/claude-code/index.js",
    ];

    let shim_dir = shim.parent()?.to_path_buf();

    for rel in candidates {
        if content.contains(rel) {
            let p = shim_dir.join(rel);
            if p.exists() {
                return Some(ClaudeLaunchPlan {
                    id: "direct-node-from-shim".to_string(),
                    label: "Direct Node.js resolved from Claude npm shim".to_string(),
                    program: node.to_string_lossy().to_string(),
                    args_prefix: vec![p.to_string_lossy().to_string()],
                    reason: format!("Resolved from shim {}", shim.to_string_lossy()),
                });
            }
        }
    }

    let common = shim_dir
        .join("node_modules")
        .join("@anthropic-ai")
        .join("claude-code");

    for file in ["cli.js", "bin/claude.js", "index.js"] {
        let p = common.join(file);
        if p.exists() {
            return Some(ClaudeLaunchPlan {
                id: "direct-node-from-shim-dir".to_string(),
                label: "Direct Node.js resolved from shim directory".to_string(),
                program: node.to_string_lossy().to_string(),
                args_prefix: vec![p.to_string_lossy().to_string()],
                reason: format!("Resolved from shim dir {}", shim_dir.to_string_lossy()),
            });
        }
    }

    None
}
```

### 7.1.2 在 `collect_launch_plans()` 中，direct node 之后加入 shim-resolved plan

找到：

```rust
if let (Some(node), Some(cli_js)) = (find_node_exe(), find_claude_cli_js()) {
    plans.push(ClaudeLaunchPlan {
        id: "direct-node-js".to_string(),
```

在这个 block 后面加入：

```rust
if let Some(plan) = resolve_node_plan_from_claude_shim() {
    plans.push(plan);
}
```

### 7.1.3 暂时禁用 PowerShell / CMD fallback 作为默认 selected

在 `select_launch_plan()` 中，找到：

```rust
for plan in collect_launch_plans() {
    if canary_launch_plan(&plan).is_ok() {
        return Ok(plan);
    }
}
```

替换为：

```rust
for plan in collect_launch_plans() {
    let is_shell_wrapper =
        plan.id.contains("powershell")
        || plan.id.contains("pwsh")
        || plan.id.contains("cmd");

    if is_shell_wrapper && std::env::var("CTRL_CC_ALLOW_SHELL_WRAPPER").is_err() {
        continue;
    }

    if canary_launch_plan(&plan).is_ok() {
        return Ok(plan);
    }
}
```

这样默认不再选 PowerShell / CMD。用户真要用 shell wrapper，必须显式设置：

```powershell
$env:CTRL_CC_ALLOW_SHELL_WRAPPER="1"
```

---

# 8. Phase 8：最终 UI 还原与后续升级路线

## 8.1 现在立刻恢复

立刻使用：

```text
src/surfaces/console/ConsoleSurface.tsx
src/surfaces/projects/ProjectsSurface.tsx
src/surfaces/workspace/WorkspaceSurface.tsx
src/surfaces/resources/ResourcesSurface.tsx
src/surfaces/github/GitHubSurface.tsx
src/components/dock/AIDock.tsx
```

不要挂载 `src/features/*/pages` 那些半成品页面。

## 8.2 后续真正升级时必须遵循旧蓝图

### Console

目标不是现在这种稀疏卡片，而是：

```text
Daily Console + Pro Console
Runtime 首页入口
Workspace/Chat 实时控制面
Projects/Resources/GitHub/Diagnostics 全局路由中枢
Runtime/Audit/Telemetry 聚合仪表盘
```

### Projects

目标是：

```text
Project Rail / Session Rail / Main Preview / Info Drawer
支持 resume / fork / archive / export
项目与会话管理中心
不是当前这种空白 waterfall
```

### Resources

目标是：

```text
Resources Command Center
ResourcesTopBar
ResourcesNav
ResourcesCanvas
ResourceInspector
ResourceActivationBridge
```

### AI Dock

目标是：

```text
Quiet / Calm / Focus 三模式
常驻 Runtime Controller
但当前先保持原固定悬浮条，不要再堆半成品
```

---

# 9. Debug 与验收流程

## 9.1 清理旧残留

先关闭 Ctrl-CC，然后在 PowerShell 里执行：

```powershell
taskkill /F /IM powershell.exe /T
taskkill /F /IM cmd.exe /T
taskkill /F /IM node.exe /T
taskkill /F /IM claude.exe /T
```

如果你还有其他 node 程序在运行，不要杀全部 node；可以用任务管理器手动关 Ctrl-CC 相关子进程。

## 9.2 构建检查

```bash
npm run typecheck
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

## 9.3 Runtime 验收

打开设置 → 诊断，执行：

```text
Run Runtime Contract Test
Run Active Runtime Contract Test
```

必须满足：

```text
[ ] Discovery selected 不是 powershell
[ ] Discovery selected 不是 cmd
[ ] 如果 direct-node 未找到，应明确显示 no runnable launch plan，不应继续弹 powershell 0xc0000142
[ ] 新建会话后 backend readerAlive=true
[ ] backend status 不应立即 exited
[ ] frontend status 不应在 backend exited 时仍显示 claude-active
[ ] 向 exited session 输入时，UI 显示 session exited，不再重复刷 os error 232
```

## 9.4 UI 验收

```text
[ ] Console 恢复原来的统计/架构/环境/Recent Sessions 风格
[ ] Projects 恢复四栏项目管理风格
[ ] Workspace 保持原 Chat / Terminal / Split / Inspector 结构
[ ] Resources 恢复原资源查看器，再逐步升级
[ ] GitHub 和 AI Dock 暂不大改
```

---

# 10. 给 Claude CLI / Codex 的执行 Prompt

```text
执行 Ctrl-CC 13.0 稳定恢复方案。

不要继续做新 UI。先把半成品 feature pages 从 SurfaceHost 下线，恢复旧 surfaces：
- ConsoleSurface -> src/surfaces/console/ConsoleSurface
- ProjectsSurface -> src/surfaces/projects/ProjectsSurface
- ResourcesSurface -> src/surfaces/resources/ResourcesSurface
- Workspace/GitHub/Settings/Canvas 保持旧 surfaces

然后修 Runtime：
1. runtime_manager.rs：reader 退出后设置 has_writer=false、reader_alive=false、status=exited、last_error。
2. runtime_manager.rs：write() 前检查 status/reader_alive/has_writer，禁止向 exited PTY 写。
3. runtime_manager.rs：不要默认传短 model alias 给 Claude CLI。
4. runtimeBridge.ts：删除旧 runtime_discover_claude 调用，只用 runtime_discover_claude_v2。
5. runtimeBridge.ts：runtime_start_interactive_v2 成功后只设置 pty-ready，不直接设置 claude-active。
6. 新增 runtimeLifecycleBridge.ts：监听 pty://data/pty://exit/pty://error/runtime://session-status，同步 RuntimeStore 和 SessionStore。
7. App.tsx 安装 runtimeLifecycleBridge。
8. usePtyTerminal.ts：payload 同时兼容 uiSessionId/session_id；exit/error 必须按 session 过滤；deadRef 阻止向 dead pipe 重复写。
9. runtimeContractProbe.ts：把 backend status=exited、readerAlive=false、hasWriter=false 判为 mismatch。
10. RuntimeDiagnosticsPanel.tsx：默认用 runtime_discover_claude_v2；显示 Launch Plan Matrix；旧 discovery 放弃默认展示。
11. claude_discovery.rs：新增 resolve_node_plan_from_claude_shim；默认禁止 powershell/cmd wrapper，除非 CTRL_CC_ALLOW_SHELL_WRAPPER=1。

完成后运行：
npm run typecheck
npm run build
cargo check --manifest-path src-tauri/Cargo.toml

验收：
- 不再弹 powershell.exe 0xc0000142
- 不再出现 os error 232 无限刷屏
- backend exited 时 frontend 不得显示 claude-active
- Contract Test 不得把 exited/readerAlive=false/hasWriter=false 判为 passed
- 原 Console / Projects / Workspace / Resources / GitHub / AI Dock 设计恢复
```
