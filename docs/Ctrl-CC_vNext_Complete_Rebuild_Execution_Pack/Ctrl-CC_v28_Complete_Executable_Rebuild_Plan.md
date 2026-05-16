# Ctrl-CC v28 一体化商用级重构执行文档（可直接发给 Claude Code CLI）

> 适用仓库：`https://github.com/JananZZZ/ctrl-cc`  
> 分支：`master`  
> 目标：一次性修复 Runtime、Chat、Terminal、Setup、React #185、GitHub 页面、Console/Project/Workspace/Resources/Canvas/GitHub UI，以及所有页面自适应和性能问题。  
> 执行方式：Claude Code 必须严格按本文档顺序执行，不允许跳步，不允许只修表面 UI，不允许继续保留多套 Runtime 主链路。

---

## 0. 总目标与不可妥协原则

Ctrl-CC 的最终运行模型必须是：

```txt
一个 GUI Session
  └── 一个 Runtime Session
        └── 一个长期存活的 Claude Code CLI 进程
              ├── Raw PTY Event Ledger（唯一事实源）
              ├── Chat Projection（气泡聊天视图）
              ├── Terminal Projection（终端视图）
              └── Inspector Projection（右侧监控/审计/状态）
```

必须满足：

1. **新建会话时创建 Runtime**，发送消息时只写入已有 Runtime，绝不隐式新建 Claude 进程。
2. **Chat 和 Terminal 必须绑定同一个 Runtime**，只是不同视图，不是两套后端。
3. **关闭 GUI tab 默认 detach，不杀进程**。只有用户明确点击 Stop/Kill 才能杀 Claude 进程。
4. **环境检测只有一套系统**：`setupStore + setup_detect_all_v2 + persisted snapshot`。Console、Settings、FirstRun 必须显示同一份数据。
5. **所有外部命令必须静默后台运行**，Windows 下使用 `CREATE_NO_WINDOW`，不允许弹出 cmd/powershell/node 窗口。
6. **所有按钮和长任务不能阻塞 UI**，不允许出现“未响应”。
7. **React render 中禁止写 store / localStorage / invoke / 导致循环订阅**。
8. **所有页面必须使用统一 Design Tokens**，不允许每个页面散落大量不一致的 inline style。
9. **GitHub 页面不使用 iframe 嵌入 GitHub**，因为 GitHub 不允许 iframe embedding。改成 Repository Dashboard + 默认主页配置 + 外部打开。
10. **UI 不做降级**，必须整体升级为商用级、现代化、响应式、温和、清晰、稳定的界面。

---

## 1. 执行前准备

### 1.1 建立工作分支

```bash
git checkout master
git pull origin master
git checkout -b v28-supreme-runtime-ui-rebuild
```

### 1.2 清理旧构建缓存

```bash
rm -rf dist
rm -rf node_modules/.vite
rm -rf src-tauri/target/debug/build
npm install
```

Windows PowerShell：

```powershell
Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force node_modules\.vite -ErrorAction SilentlyContinue
npm install
```

### 1.3 先运行基线检查并记录

```bash
npm run typecheck
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

如果当前失败，先记录失败内容到：

```txt
docs/v28/baseline-errors.txt
```

---

## 2. 写入项目工程记忆

### 2.1 创建目录

```bash
mkdir -p docs/v28
```

### 2.2 创建 `CLAUDE.md`

覆盖 `CLAUDE.md`：

```md
# Ctrl-CC Engineering Memory

每次修改前必须先阅读：

1. docs/ENGINEERING_PRINCIPLES.md
2. docs/RUNTIME_ARCHITECTURE.md
3. docs/UI_DESIGN_SYSTEM.md
4. docs/V28_ACCEPTANCE_TESTS.md

## 不可违反的底层规则

- 一个 GUI session 只能绑定一个 Runtime session。
- 一个 Runtime session 只能绑定一个长期存活的 Claude Code CLI 进程。
- 发送消息不得新建 Claude 进程。
- Chat 和 Terminal 是同一个 Runtime session 的两个 projection。
- 关闭 tab 默认 detach，不杀进程。
- Stop/Kill 才能杀进程。
- 环境检测统一由 setupStore + setup_detect_all_v2 提供。
- 所有外部命令必须 CREATE_NO_WINDOW / 后台静默。
- 所有长任务必须 async / spawn_blocking / task queue。
- React render 中禁止写 store、写 localStorage、触发 invoke。
- 所有页面必须使用统一 design tokens。
- 所有运行输出必须先进入 Raw Runtime Event Ledger，再投影到 Chat/Terminal/Inspector。
```

### 2.3 创建 `docs/ENGINEERING_PRINCIPLES.md`

```md
# Ctrl-CC Engineering Principles

## 八荣

1. 以单一事实源为荣。
2. 以 Runtime 长生命周期为荣。
3. 以异步非阻塞为荣。
4. 以可观测、可诊断、可恢复为荣。
5. 以明确状态机为荣。
6. 以类型正确为荣。
7. 以统一设计系统为荣。
8. 以真实用户体验为荣。

## 八耻

1. 以重复 Runtime 链路为耻。
2. 以发送消息隐式新建进程为耻。
3. 以关闭 tab 杀后台进程为耻。
4. 以同步命令阻塞 UI 为耻。
5. 以弹出 cmd/powershell/node 窗口吓用户为耻。
6. 以 React render 中写状态为耻。
7. 以 inline style 混乱堆叠为耻。
8. 以“检测失败，请重试”但无恢复路径为耻。
```

### 2.4 创建 `docs/RUNTIME_ARCHITECTURE.md`

```md
# Runtime Architecture

Ctrl-CC v28 使用唯一 RuntimeKernel。

## Runtime 生命周期

New Session:
GUI Session -> RuntimeKernel.startSession -> Claude CLI PTY process -> Event Ledger

Send Message:
GUI Session -> RuntimeKernel.submitUserMessage -> writer.write -> same Claude process

Close Tab:
GUI tab removed only; Runtime continues detached.

Stop Runtime:
User explicit action -> RuntimeKernel.stopSession -> kill child.

Resume:
GUI tab reattached to existing Runtime or starts Claude CLI with resume/session recovery when supported.

## Event Model

Raw PTY data is never lost.

Backend emits:
- lifecycle
- status
- raw
- error

Frontend projects:
- terminalBuffers
- chatBlocks
- inspector telemetry
```

### 2.5 创建 `docs/UI_DESIGN_SYSTEM.md`

```md
# UI Design System

Ctrl-CC uses a unified visual system.

## Layout

- All main pages use SurfacePage + PageContainer.
- Page content must be centered with max-width.
- Wide screens use 2-3 columns.
- Narrow screens collapse to 1 column.
- Cards must not be empty huge blocks.
- Typography must use semantic classes.

## Required Page Quality

- Console: dashboard-quality, no overlap, no squeezed cards.
- Projects: project/session management as central commercial feature.
- Workspace: chat-first, terminal optional, split view supported.
- Resources: resource library with categories and status.
- Canvas: node graph with fit/zoom/pan.
- GitHub: dashboard, not iframe.

## AI Dock

AI Dock is an independent Tauri window, not an in-app floating rail.
```

### 2.6 创建 `docs/V28_ACCEPTANCE_TESTS.md`

```md
# v28 Acceptance Tests

## Runtime

- New session creates exactly one process.
- Sending 20 messages keeps same PID.
- Closing tab does not kill process.
- Stop button kills process.
- Chat and Terminal show same runtime output.

## Setup

- Detection does not auto-run on startup.
- Console/Settings/FirstRun share one setup snapshot.
- Detection failure shows retry, copy diagnostics, open logs, skip.
- No external terminal windows appear.

## React

- No React #185 after switching pages 100 times.
- No render-loop localStorage writes.
- No store writes inside render.

## UI

- All pages responsive.
- No text size chaos.
- No squeezed cards.
- No blank iframe GitHub page.
```

---

## 3. 删除旧 Runtime 主链路

### 3.1 修改 `src/app/App.tsx`

打开 `src/app/App.tsx`。

#### 删除 import

搜索并删除：

```ts
import { installRuntimeLifecycleBridge } from '../features/runtime/services/runtimeLifecycleBridge';
import { installRuntimeFabricEventBridge } from '../features/runtime-fabric/services/runtimeFabricEventBridge';
```

#### 删除旧 useEffect

删除类似以下代码：

```ts
useEffect(() => {
  const cleanup = installRuntimeLifecycleBridge();
  return cleanup;
}, []);
```

删除类似以下代码：

```ts
useEffect(() => {
  const cleanup = installRuntimeFabricEventBridge();
  return cleanup;
}, []);
```

#### 保留唯一 RuntimeKernelBridge

确保存在且仅存在：

```ts
useEffect(() => {
  let cleanup: undefined | (() => void);

  RuntimeKernelBridge.install()
    .then((fn) => {
      cleanup = fn;
    })
    .catch((err) => {
      console.error('[Ctrl-CC] RuntimeKernelBridge install failed', err);
    });

  RuntimeKernelBridge.listSessions().catch((err) => {
    console.warn('[Ctrl-CC] RuntimeKernelBridge listSessions failed', err);
  });

  return () => {
    cleanup?.();
  };
}, []);
```

### 3.2 验收

```bash
grep -R "installRuntimeLifecycleBridge\|installRuntimeFabricEventBridge" src
```

必须无结果。

---

## 4. 修复 React #185 的直接风险点

### 4.1 修改 `src/debug/useRenderLoopGuard.ts`

将整个文件替换为：

```ts
import { useEffect, useRef } from 'react';

type GuardState = {
  count: number;
  start: number;
};

const states = new Map<string, GuardState>();

export function useRenderLoopGuard(name: string, limit = 120, windowMs = 1000) {
  const nameRef = useRef(name);

  if (!import.meta.env.DEV) {
    return;
  }

  const now = performance.now();
  const current = states.get(nameRef.current);

  if (!current || now - current.start > windowMs) {
    states.set(nameRef.current, { count: 1, start: now });
  } else {
    current.count += 1;
    if (current.count > limit) {
      const payload = {
        name: nameRef.current,
        count: current.count,
        windowMs,
        at: new Date().toISOString(),
      };

      queueMicrotask(() => {
        try {
          localStorage.setItem('ctrlcc:render-loop', JSON.stringify(payload));
        } catch {
          // ignore
        }
      });

      // Dev-only hard error. Production must not crash from the guard.
      throw new Error(
        `[Ctrl-CC] Render loop suspected in ${nameRef.current}: ${current.count} renders/${windowMs}ms`
      );
    }
  }

  useEffect(() => {
    return () => {
      states.delete(nameRef.current);
    };
  }, []);
}
```

### 4.2 修改 `src/components/error/ErrorBoundary.tsx`

要求：

1. `componentDidCatch` 中可以记录错误，但不要触发会造成循环的同步 store 更新。
2. 写 localStorage 必须 `queueMicrotask`。
3. 错误弹窗关闭后不能自动重新 render 同一崩溃组件。

在 `componentDidCatch` 中使用：

```ts
componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
  const detail = {
    message: error.message,
    stack: error.stack,
    componentStack: errorInfo.componentStack,
    time: new Date().toISOString(),
  };

  queueMicrotask(() => {
    try {
      localStorage.setItem('ctrlcc:last-react-error', JSON.stringify(detail));
    } catch {
      // ignore
    }
  });

  console.error('[Ctrl-CC] React error boundary caught', detail);
}
```

不要在 render 阶段写任何 store。

### 4.3 修改 `src/surfaces/workspace/SessionInspector.tsx`

搜索：

```ts
const stableEvents = useMemo(() => rawEvents, [rawEvents.length]);
```

替换为：

```ts
const stableEvents = rawEvents;
```

原因：`[rawEvents.length]` 会在长度不变但内容变时使用旧引用，也会与父组件的 slice/new array 形成不稳定渲染关系。

### 4.4 Workspace 父组件禁止 inline slice

在 `WorkspaceSurface.tsx` 中搜索：

```tsx
events={events.slice(0, 200)}
```

或类似：

```tsx
events={activeEvents.slice(...)}
```

改为先 memo：

```ts
const inspectorEvents = useMemo(() => {
  return chatBlocks.slice(-200);
}, [chatBlocks]);
```

再传：

```tsx
<SessionInspector
  session={activeSession}
  events={inspectorEvents}
  collapsed={inspectorCollapsed}
  expanded={inspectorExpanded}
  onToggleCollapse={() => setInspectorCollapsed((v) => !v)}
  onToggleExpand={() => setInspectorExpanded((v) => !v)}
/>
```

---

## 5. RuntimeKernel 类型重构

### 5.1 修改 `src-tauri/src/runtime_kernel/types.rs`

确认或替换为以下结构。若已有相近结构，请合并字段，字段名必须保持 camelCase 序列化。

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum RuntimeStatus {
    Starting,
    Ready,
    Busy,
    WaitingInput,
    WaitingPermission,
    Exited,
    Failed,
    Stopped,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeKernelStartRequest {
    pub trace_id: String,
    pub gui_session_id: String,
    pub project_id: String,
    pub cwd: String,
    pub model: String,
    pub effort: String,
    pub permission_mode: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeKernelSubmitRequest {
    pub trace_id: String,
    pub gui_session_id: String,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeKernelStopRequest {
    pub trace_id: String,
    pub gui_session_id: String,
    pub force: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeKernelSnapshot {
    pub trace_id: String,
    pub gui_session_id: String,
    pub runtime_session_id: String,
    pub claude_session_id: Option<String>,
    pub project_id: String,
    pub cwd: String,
    pub pid: Option<u32>,
    pub status: RuntimeStatus,
    pub has_writer: bool,
    pub reader_alive: bool,
    pub created_at: String,
    pub updated_at: String,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeKernelEvent {
    pub seq: u64,
    pub trace_id: String,
    pub gui_session_id: String,
    pub runtime_session_id: String,
    pub event_type: String,
    pub channel: String,
    pub data: Option<String>,
    pub status: Option<RuntimeStatus>,
    pub pid: Option<u32>,
    pub cwd: Option<String>,
    pub created_at: String,
}
```

---

## 6. RuntimeKernel 后端状态机修改

### 6.1 修改 `src-tauri/src/runtime_kernel/manager.rs`

必须保证以下语义。

#### start_session：已有 alive session 直接返回

在 `start_session` 开始处加入：

```rust
if let Some(existing) = self.get_alive_snapshot(&req.gui_session_id)? {
    self.emit_status_event(
        &req.trace_id,
        &existing.gui_session_id,
        &existing.runtime_session_id,
        "runtime.reuse",
        RuntimeStatus::Ready,
        Some("Reusing existing runtime session".to_string()),
    );
    return Ok(existing);
}
```

新增 helper：

```rust
fn is_alive(snapshot: &RuntimeKernelSnapshot) -> bool {
    snapshot.has_writer
        && snapshot.reader_alive
        && !matches!(
            snapshot.status,
            RuntimeStatus::Failed | RuntimeStatus::Exited | RuntimeStatus::Stopped
        )
}
```

#### submit_user_message：只写，不启动

`submit_user_message` 中禁止调用 `start_session`、`spawn`、`create`。

替换为：

```rust
pub fn submit_user_message(&self, req: RuntimeKernelSubmitRequest) -> Result<(), String> {
    let mut sessions = self.sessions.lock().map_err(|e| e.to_string())?;

    let handle = sessions
        .get_mut(&req.gui_session_id)
        .ok_or_else(|| {
            format!(
                "Runtime session not found: {}. Start or reconnect the session first.",
                req.gui_session_id
            )
        })?;

    if !handle.has_writer || !handle.reader_alive {
        return Err(format!(
            "Runtime session is not writable: {}. Use reconnect/resume/restart.",
            req.gui_session_id
        ));
    }

    if matches!(
        handle.status,
        RuntimeStatus::Failed | RuntimeStatus::Exited | RuntimeStatus::Stopped
    ) {
        return Err(format!(
            "Runtime session is not alive: {:?}. Use reconnect/resume/restart.",
            handle.status
        ));
    }

    handle
        .writer
        .write_all(req.text.as_bytes())
        .map_err(|e| format!("PTY write failed: {}", e))?;

    handle
        .writer
        .write_all(b"\r")
        .map_err(|e| format!("PTY newline write failed: {}", e))?;

    handle
        .writer
        .flush()
        .map_err(|e| format!("PTY flush failed: {}", e))?;

    handle.status = RuntimeStatus::Busy;
    handle.updated_at = chrono::Utc::now().to_rfc3339();

    Ok(())
}
```

#### close tab 不杀进程

新增：

```rust
pub fn detach_session(&self, gui_session_id: String) -> Result<(), String> {
    // Backend keeps the process. This command only exists for explicit audit.
    let sessions = self.sessions.lock().map_err(|e| e.to_string())?;
    if sessions.contains_key(&gui_session_id) {
        Ok(())
    } else {
        Ok(())
    }
}
```

`stop_session` 只响应明确 Stop/Kill。

### 6.2 事件必须带 seq

每个 RuntimeKernelHandle 持有 `seq: u64`，emit 时：

```rust
handle.seq += 1;
let event = RuntimeKernelEvent {
    seq: handle.seq,
    trace_id: trace_id.to_string(),
    gui_session_id: handle.gui_session_id.clone(),
    runtime_session_id: handle.runtime_session_id.clone(),
    event_type: event_type.to_string(),
    channel: channel.to_string(),
    data,
    status,
    pid: handle.pid,
    cwd: Some(handle.cwd.clone()),
    created_at: chrono::Utc::now().to_rfc3339(),
};
app.emit("runtime-kernel://event", event)?;
```

---

## 7. Claude CLI 启动策略修复

### 7.1 修改 `src-tauri/src/runtime_v2/claude_command_resolver.rs`

必须区分：

- extensionless `...\npm\claude`：不能直接执行，Windows 会 os error 193。
- `claude.cmd`：可以通过 `cmd.exe /d /s /c claude.cmd` 作为 PTY shell entry。
- native `claude.exe`：如果存在，优先。
- `npx`：只作为安装/诊断，不作为长期交互 PTY 主链路。

### 7.2 terminal 启动排序

在选择函数中改成：

```rust
fn terminal_priority(plan: &ClaudeLaunchPlan) -> i32 {
    match plan.kind.as_str() {
        "native-exe" => 0,
        "cmd-shim" => 10,
        "git-bash" => 20,
        "node-wrapper" => 30,
        _ => 1000,
    }
}
```

### 7.3 允许 cmd shim

如果检测到：

```txt
C:\Users\<user>\AppData\Roaming\npm\claude.cmd
```

构建：

```rust
program = "C:\\Windows\\System32\\cmd.exe"
args = ["/d", "/s", "/c", "\"C:\\Users\\<user>\\AppData\\Roaming\\npm\\claude.cmd\""]
```

不要再把它判定为 blocked。

### 7.4 JS candidates 不是失败条件

诊断 UI 中：

```txt
Claude JS candidates = 0
```

只能显示为“未找到 JS 内部入口，不影响 cmd/native 启动”。

不要让它影响 `CLI available` 或 `Runtime ready`。

---

## 8. 静默子进程和无阻塞命令

### 8.1 新建 `src-tauri/src/utils/hidden_command.rs`

```rust
use std::process::{Command, Stdio};

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

pub fn hidden_command(program: &str) -> Command {
    let mut cmd = Command::new(program);

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    cmd.stdin(Stdio::null());
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());
    cmd
}
```

### 8.2 注册 module

在 `src-tauri/src/utils/mod.rs` 中加入：

```rust
pub mod hidden_command;
```

若没有 `utils/mod.rs`，在 `src-tauri/src/main.rs` 或 `lib.rs` 中加入对应 mod。

### 8.3 替换所有外部命令

搜索：

```bash
grep -R "Command::new" src-tauri/src
```

凡是用于：

```txt
setup 检测
version 检测
which/where
node/npm/claude 检测
diagnostics
installer
```

全部改为：

```rust
let mut cmd = hidden_command(program);
```

不得裸用 `Command::new(program).output()`。

### 8.4 加 timeout

新建 `src-tauri/src/utils/command_timeout.rs`：

```rust
use std::io::Read;
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

#[derive(Debug)]
pub struct CommandResult {
    pub stdout: String,
    pub stderr: String,
    pub code: i32,
    pub timed_out: bool,
}

pub fn run_with_timeout(mut cmd: Command, timeout: Duration) -> Result<CommandResult, String> {
    cmd.stdin(Stdio::null());
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| format!("spawn failed: {}", e))?;
    let start = Instant::now();

    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                let mut stdout = String::new();
                let mut stderr = String::new();

                if let Some(mut out) = child.stdout.take() {
                    let _ = out.read_to_string(&mut stdout);
                }
                if let Some(mut err) = child.stderr.take() {
                    let _ = err.read_to_string(&mut stderr);
                }

                return Ok(CommandResult {
                    stdout,
                    stderr,
                    code: status.code().unwrap_or(-1),
                    timed_out: false,
                });
            }
            Ok(None) => {
                if start.elapsed() >= timeout {
                    let _ = child.kill();
                    let _ = child.wait();

                    return Ok(CommandResult {
                        stdout: String::new(),
                        stderr: format!("Command timed out after {:?}", timeout),
                        code: -1,
                        timed_out: true,
                    });
                }
                thread::sleep(Duration::from_millis(50));
            }
            Err(e) => return Err(format!("try_wait failed: {}", e)),
        }
    }
}
```

---

## 9. 环境检测统一

### 9.1 后端新增 `setup_detect_all_v2`

在 `src-tauri/src/setup/detector.rs` 中新增 async command：

```rust
#[tauri::command]
pub async fn setup_detect_all_v2(app: tauri::AppHandle) -> Result<SetupSnapshot, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut snapshot = SetupSnapshot::default();

        // 每个 check 单独执行，失败记录到 snapshot，不整体 Err。
        // 每个 check 通过 app.emit("setup://check-progress", payload) 报告进度。
        // 所有命令必须 hidden_command + run_with_timeout。

        snapshot.generated_at = chrono::Utc::now().to_rfc3339();
        Ok(snapshot)
    })
    .await
    .map_err(|e| format!("setup detect task join failed: {}", e))?
}
```

要求：

```txt
1. 检测 Node。
2. 检测 npm。
3. 检测 Claude CLI。
4. 检测 claude.cmd。
5. 检测 native claude.exe。
6. 检测认证状态。
7. 检测 Windows Terminal，但失败不阻塞 Claude CLI。
8. 检测 Git。
9. 检测 PATH。
10. 返回 partial result。
```

### 9.2 修改 `src/features/setup/stores/setupStore.ts`

统一 snapshot：

```ts
type SetupRunState = 'idle' | 'running' | 'success' | 'partial' | 'failed';

interface SetupState {
  snapshot: SetupSnapshot | null;
  runState: SetupRunState;
  progress: SetupProgressEvent[];
  lastError: string | null;
  hydrated: boolean;

  hydrate: () => void;
  detectAll: () => Promise<SetupSnapshot | null>;
  clearCache: () => void;
}
```

缓存 key：

```ts
const SETUP_CACHE_KEY = 'ctrlcc.setup.snapshot.v2';
```

`detectAll()`：

```ts
detectAll: async () => {
  set({ runState: 'running', lastError: null, progress: [] });

  try {
    const snapshot = await invoke<SetupSnapshot>('setup_detect_all_v2');
    localStorage.setItem(SETUP_CACHE_KEY, JSON.stringify(snapshot));

    const hasCriticalFailure = snapshot.items?.some((x) => x.required && x.status === 'failed');
    set({
      snapshot,
      runState: hasCriticalFailure ? 'partial' : 'success',
      lastError: hasCriticalFailure ? 'Some required checks failed' : null,
    });

    return snapshot;
  } catch (err) {
    const message = String(err);
    set({ runState: 'failed', lastError: message });
    return null;
  }
}
```

### 9.3 删除/降级 `environmentStore`

`environmentStore` 不再单独检测。改成 adapter：

```ts
import { useSetupStore } from '../../setup/stores/setupStore';

export function useEnvironmentSnapshot() {
  return useSetupStore((s) => s.snapshot);
}
```

Console、Settings、FirstRun 只使用 `useSetupStore`。

### 9.4 FirstRun 失败恢复 UI

失败时必须显示：

```tsx
<div className="cc-setup-error-card">
  <h3>检测未完全通过</h3>
  <p>{lastError}</p>
  <div className="cc-action-row">
    <button onClick={detectAll}>重新检测</button>
    <button onClick={copyDiagnosticBundle}>复制诊断包</button>
    <button onClick={openLogDirectory}>打开日志目录</button>
    <button onClick={skipForNow}>暂时跳过</button>
  </div>
</div>
```

不允许只显示“检测失败，请重试”。

---

## 10. RuntimeKernel 前端 store 重写

### 10.1 修改 `src/runtime-kernel/types.ts`

新增：

```ts
export type RuntimeKernelStatus =
  | 'starting'
  | 'ready'
  | 'busy'
  | 'waiting-input'
  | 'waiting-permission'
  | 'exited'
  | 'failed'
  | 'stopped';

export interface RuntimeKernelEvent {
  seq: number;
  traceId: string;
  guiSessionId: string;
  runtimeSessionId: string;
  eventType: string;
  channel: 'raw' | 'status' | 'error' | 'lifecycle';
  data?: string | null;
  status?: RuntimeKernelStatus | null;
  pid?: number | null;
  cwd?: string | null;
  createdAt: string;
}

export interface RuntimeKernelSessionSnapshot {
  traceId: string;
  guiSessionId: string;
  runtimeSessionId: string;
  claudeSessionId?: string | null;
  projectId: string;
  cwd: string;
  pid?: number | null;
  status: RuntimeKernelStatus;
  hasWriter: boolean;
  readerAlive: boolean;
  createdAt: string;
  updatedAt: string;
  lastError?: string | null;
}

export type ChatBlock =
  | { id: string; kind: 'user'; content: string; createdAt: string }
  | { id: string; kind: 'assistant'; content: string; streaming: boolean; createdAt: string; updatedAt: string }
  | { id: string; kind: 'status'; label: string; content: string; createdAt: string }
  | { id: string; kind: 'tool'; name: string; content: string; createdAt: string }
  | { id: string; kind: 'error'; content: string; createdAt: string };
```

### 10.2 修改 `src/runtime-kernel/runtimeKernelStore.ts`

替换为以下核心结构：

```ts
import { create } from 'zustand';
import type { ChatBlock, RuntimeKernelEvent, RuntimeKernelSessionSnapshot } from './types';
import { projectRawToChat } from './parsers/chatProjection';

interface RuntimeKernelState {
  sessions: Record<string, RuntimeKernelSessionSnapshot>;
  rawEvents: Record<string, RuntimeKernelEvent[]>;
  terminalBuffers: Record<string, string>;
  chatBlocks: Record<string, ChatBlock[]>;
  activeAssistantBlockId: Record<string, string | null>;

  upsertSession: (snapshot: RuntimeKernelSessionSnapshot) => void;
  ingestEventBatch: (events: RuntimeKernelEvent[]) => void;
  appendUserMessage: (sessionId: string, text: string) => void;
  detachView: (sessionId: string) => void;
  markStopped: (sessionId: string) => void;
}

export const useRuntimeKernelStore = create<RuntimeKernelState>((set, get) => ({
  sessions: {},
  rawEvents: {},
  terminalBuffers: {},
  chatBlocks: {},
  activeAssistantBlockId: {},

  upsertSession: (snapshot) => {
    set((state) => ({
      sessions: {
        ...state.sessions,
        [snapshot.guiSessionId]: snapshot,
      },
    }));
  },

  appendUserMessage: (sessionId, text) => {
    const now = new Date().toISOString();
    const block: ChatBlock = {
      id: `user-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      kind: 'user',
      content: text,
      createdAt: now,
    };

    set((state) => ({
      chatBlocks: {
        ...state.chatBlocks,
        [sessionId]: [...(state.chatBlocks[sessionId] ?? []), block],
      },
      activeAssistantBlockId: {
        ...state.activeAssistantBlockId,
        [sessionId]: null,
      },
    }));
  },

  ingestEventBatch: (events) => {
    if (events.length === 0) return;

    set((state) => {
      let sessions = state.sessions;
      let rawEvents = state.rawEvents;
      let terminalBuffers = state.terminalBuffers;
      let chatBlocks = state.chatBlocks;
      let activeAssistantBlockId = state.activeAssistantBlockId;

      for (const evt of events) {
        const sid = evt.guiSessionId;

        rawEvents = {
          ...rawEvents,
          [sid]: [...(rawEvents[sid] ?? []), evt].slice(-2000),
        };

        if (evt.channel === 'raw' && evt.data) {
          terminalBuffers = {
            ...terminalBuffers,
            [sid]: (terminalBuffers[sid] ?? '') + evt.data,
          };

          const projected = projectRawToChat({
            sessionId: sid,
            raw: evt.data,
            existingBlocks: chatBlocks[sid] ?? [],
            activeAssistantBlockId: activeAssistantBlockId[sid] ?? null,
          });

          chatBlocks = {
            ...chatBlocks,
            [sid]: projected.blocks,
          };

          activeAssistantBlockId = {
            ...activeAssistantBlockId,
            [sid]: projected.activeAssistantBlockId,
          };
        }

        if (evt.channel === 'status' && evt.status) {
          const existing = sessions[sid];
          if (existing) {
            sessions = {
              ...sessions,
              [sid]: {
                ...existing,
                status: evt.status,
                pid: evt.pid ?? existing.pid,
                cwd: evt.cwd ?? existing.cwd,
                updatedAt: evt.createdAt,
              },
            };
          }
        }

        if (evt.channel === 'error') {
          const block: ChatBlock = {
            id: `err-${evt.seq}-${evt.createdAt}`,
            kind: 'error',
            content: evt.data ?? 'Runtime error',
            createdAt: evt.createdAt,
          };

          chatBlocks = {
            ...chatBlocks,
            [sid]: [...(chatBlocks[sid] ?? []), block],
          };
        }
      }

      return {
        sessions,
        rawEvents,
        terminalBuffers,
        chatBlocks,
        activeAssistantBlockId,
      };
    });
  },

  detachView: (_sessionId) => {
    // no-op for backend; App tab store handles UI removal
  },

  markStopped: (sessionId) => {
    set((state) => {
      const existing = state.sessions[sessionId];
      if (!existing) return state;
      return {
        sessions: {
          ...state.sessions,
          [sessionId]: {
            ...existing,
            status: 'stopped',
            hasWriter: false,
            readerAlive: false,
            updatedAt: new Date().toISOString(),
          },
        },
      };
    });
  },
}));
```

### 10.3 新增 `src/runtime-kernel/parsers/ansi.ts`

```ts
export function stripAnsi(input: string): string {
  return input.replace(
    // eslint-disable-next-line no-control-regex
    /[\u001b\u009b][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[a-zA-Z\d]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g,
    ''
  );
}
```

### 10.4 新增 `src/runtime-kernel/parsers/chatProjection.ts`

```ts
import type { ChatBlock } from '../types';
import { stripAnsi } from './ansi';

interface ProjectInput {
  sessionId: string;
  raw: string;
  existingBlocks: ChatBlock[];
  activeAssistantBlockId: string | null;
}

interface ProjectOutput {
  blocks: ChatBlock[];
  activeAssistantBlockId: string | null;
}

function nowIso() {
  return new Date().toISOString();
}

function looksLikeStatusLine(line: string) {
  const s = line.trim().toLowerCase();
  return (
    s.includes('thinking') ||
    s.includes('cogitated') ||
    s.includes('tool use') ||
    s.includes('permission') ||
    s.includes('running') ||
    s.includes('esc to interrupt')
  );
}

function shouldIgnoreLine(line: string) {
  const s = line.trim();
  if (!s) return true;
  if (/^[>›❯]\s*$/.test(s)) return true;
  return false;
}

export function projectRawToChat(input: ProjectInput): ProjectOutput {
  const clean = stripAnsi(input.raw).replace(/\r/g, '\n');
  const lines = clean.split('\n');

  let blocks = input.existingBlocks;
  let activeAssistantBlockId = input.activeAssistantBlockId;

  for (const line of lines) {
    if (shouldIgnoreLine(line)) continue;

    if (looksLikeStatusLine(line)) {
      blocks = [
        ...blocks,
        {
          id: `status-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          kind: 'status',
          label: 'Claude',
          content: line.trim(),
          createdAt: nowIso(),
        },
      ];
      continue;
    }

    const at = nowIso();

    if (!activeAssistantBlockId) {
      const id = `assistant-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      activeAssistantBlockId = id;
      blocks = [
        ...blocks,
        {
          id,
          kind: 'assistant',
          content: line,
          streaming: true,
          createdAt: at,
          updatedAt: at,
        },
      ];
    } else {
      blocks = blocks.map((b) => {
        if (b.id !== activeAssistantBlockId || b.kind !== 'assistant') return b;
        return {
          ...b,
          content: b.content ? `${b.content}\n${line}` : line,
          updatedAt: at,
        };
      });
    }
  }

  return { blocks, activeAssistantBlockId };
}
```

---

## 11. RuntimeKernelBridge 前端改造

### 11.1 修改 `src/runtime-kernel/runtimeKernelBridge.ts`

核心要求：事件批量 ingestion，不直接创建 message。

替换 listener 安装逻辑为：

```ts
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { useRuntimeKernelStore } from './runtimeKernelStore';
import type { RuntimeKernelEvent, RuntimeKernelSessionSnapshot } from './types';

const eventQueue: RuntimeKernelEvent[] = [];
let scheduled = false;
let installed = false;

function enqueue(event: RuntimeKernelEvent) {
  eventQueue.push(event);

  if (!scheduled) {
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      const batch = eventQueue.splice(0, eventQueue.length);
      useRuntimeKernelStore.getState().ingestEventBatch(batch);
    });
  }
}

export const RuntimeKernelBridge = {
  async install(): Promise<UnlistenFn | undefined> {
    if (installed) return undefined;
    installed = true;

    const unlisten = await listen<RuntimeKernelEvent>('runtime-kernel://event', (evt) => {
      enqueue(evt.payload);
    });

    return () => {
      installed = false;
      unlisten();
    };
  },

  async startSession(input: {
    guiSessionId: string;
    projectId: string;
    cwd: string;
    model: string;
    effort: string;
    permissionMode: string;
  }): Promise<RuntimeKernelSessionSnapshot> {
    const snapshot = await invoke<RuntimeKernelSessionSnapshot>('runtime_kernel_start_session', {
      req: {
        traceId: `trace-${crypto.randomUUID()}`,
        guiSessionId: input.guiSessionId,
        projectId: input.projectId,
        cwd: input.cwd,
        model: input.model,
        effort: input.effort,
        permissionMode: input.permissionMode,
      },
    });

    useRuntimeKernelStore.getState().upsertSession(snapshot);
    return snapshot;
  },

  async submitUserMessage(input: {
    guiSessionId: string;
    projectId: string;
    text: string;
  }): Promise<void> {
    useRuntimeKernelStore.getState().appendUserMessage(input.guiSessionId, input.text);

    await invoke('runtime_kernel_submit_user_message', {
      req: {
        traceId: `trace-${crypto.randomUUID()}`,
        guiSessionId: input.guiSessionId,
        text: input.text,
      },
    });
  },

  async stopSession(guiSessionId: string, force = false): Promise<void> {
    await invoke('runtime_kernel_stop_session', {
      req: {
        traceId: `trace-${crypto.randomUUID()}`,
        guiSessionId,
        force,
      },
    });

    useRuntimeKernelStore.getState().markStopped(guiSessionId);
  },

  async detachSession(guiSessionId: string): Promise<void> {
    await invoke('runtime_kernel_detach_session', { guiSessionId });
  },

  async listSessions(): Promise<RuntimeKernelSessionSnapshot[]> {
    const snapshots = await invoke<RuntimeKernelSessionSnapshot[]>('runtime_kernel_list_sessions');
    for (const s of snapshots) {
      useRuntimeKernelStore.getState().upsertSession(s);
    }
    return snapshots;
  },
};
```

---

## 12. WorkspaceSurface 关键修复

### 12.1 修改 `src/surfaces/workspace/WorkspaceSurface.tsx`

#### 引入 ChatBlock

```ts
import type { ChatBlock } from '../../runtime-kernel/types';
```

#### 删除 RuntimeFabricBridge 相关调用

搜索并删除：

```ts
RuntimeFabricBridge
runtimeFabric
sendChatMessage
createCtrlCcSession
```

Workspace 只能使用 `RuntimeKernelBridge`。

#### 修改 chatBlocks selector

```ts
const chatBlocks = useRuntimeKernelStore(
  useCallback(
    (s) => (activeTabId ? s.chatBlocks[activeTabId] ?? [] : []),
    [activeTabId]
  )
);

const terminalBuffer = useRuntimeKernelStore(
  useCallback(
    (s) => (activeTabId ? s.terminalBuffers[activeTabId] ?? '' : ''),
    [activeTabId]
  )
);

const runtimeSnapshot = useRuntimeKernelStore(
  useCallback(
    (s) => (activeTabId ? s.sessions[activeTabId] : undefined),
    [activeTabId]
  )
);
```

#### 修改 handleSend

完整替换为：

```ts
const handleSend = useCallback(
  async (
    text: string,
    _config: {
      model: string;
      effort: string;
      permissionMode: string;
      runtimeMode: string;
    }
  ): Promise<SendResult> => {
    if (!activeTabId) {
      return { ok: false, error: 'No active session' };
    }

    const rt = useRuntimeKernelStore.getState().sessions[activeTabId];
    const alive =
      rt &&
      rt.hasWriter &&
      rt.readerAlive &&
      !['failed', 'exited', 'stopped'].includes(String(rt.status));

    if (!alive) {
      const msg = 'Claude Runtime 尚未连接。请点击重新连接、恢复或重启 Runtime。';
      setError(msg);
      useErrorStore.getState().addError({
        severity: 'warning',
        source: 'session',
        title: 'Runtime not connected',
        detail: msg,
      });
      return { ok: false, error: msg };
    }

    try {
      await RuntimeKernelBridge.submitUserMessage({
        guiSessionId: activeTabId,
        projectId: activeSession?.projectId ?? 'default',
        text,
      });

      return { ok: true };
    } catch (err) {
      const msg = String(err);
      setError(`${t('workspace.sendFailed')}: ${msg}`);
      useErrorStore.getState().addError({
        severity: 'error',
        source: 'session',
        title: 'Chat failed',
        detail: msg,
      });
      return { ok: false, error: msg };
    }
  },
  [activeTabId, activeSession?.projectId, setError, t]
);
```

#### 修改 handleCloseTab

完整替换为：

```ts
const handleCloseTab = useCallback(
  async (sessionId: string) => {
    try {
      await RuntimeKernelBridge.detachSession(sessionId);
    } catch {
      // detach failure should not block UI close
    }
    closeTab(sessionId);
  },
  [closeTab]
);
```

#### 新增 Stop Runtime 按钮 handler

```ts
const handleStopRuntime = useCallback(async () => {
  if (!activeTabId) return;
  await RuntimeKernelBridge.stopSession(activeTabId, false);
}, [activeTabId]);
```

#### ChatView 调用

替换：

```tsx
<ChatView events={...} />
```

为：

```tsx
<ChatView blocks={chatBlocks} streaming={runtimeSnapshot?.status === 'busy'} />
```

#### TerminalView 调用

替换为：

```tsx
<TerminalView
  sessionId={activeTabId}
  buffer={terminalBuffer}
  onSend={(data) => {
    if (!activeTabId) return;
    RuntimeKernelBridge.submitUserMessage({
      guiSessionId: activeTabId,
      projectId: activeSession?.projectId ?? 'default',
      text: data,
    });
  }}
/>
```

注意：Terminal 输入和 Chat 输入都写同一个 runtime writer。

---

## 13. ChatView 重写

### 13.1 修改 `src/surfaces/workspace/ChatView.tsx`

替换为：

```tsx
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CcEmptyState } from '../../components/ui/CcEmptyState';
import type { ChatBlock } from '../../runtime-kernel/types';
import { ChatBlockRenderer } from '../../features/chat/ChatBlockRenderer';

interface Props {
  blocks: ChatBlock[];
  streaming?: boolean;
}

export function ChatView({ blocks, streaming }: Props) {
  const { t } = useTranslation();
  const bottomRef = useRef<HTMLDivElement>(null);

  const lastBlockId = blocks[blocks.length - 1]?.id;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [lastBlockId]);

  const renderedBlocks = useMemo(() => blocks, [blocks]);

  if (renderedBlocks.length === 0) {
    return (
      <div className="cc-chat-empty" data-testid="chat-view">
        <CcEmptyState
          icon="💬"
          title={t('workspace.startChat')}
          description={t('workspace.startChatDesc')}
        />
      </div>
    );
  }

  return (
    <div className="cc-chat-view" data-testid="chat-view">
      <div className="cc-chat-timeline">
        {renderedBlocks.map((block) => (
          <ChatBlockRenderer key={block.id} block={block} />
        ))}
        {streaming && (
          <div className="cc-chat-streaming-indicator">
            <span className="cc-pulse-dot" />
            {t('workspace.claudeReplying')}
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
```

---

## 14. ChatBlockRenderer 重写

### 14.1 修改 `src/features/chat/ChatBlockRenderer.tsx`

替换为：

```tsx
import type { ChatBlock } from '../../runtime-kernel/types';
import { MarkdownRenderer } from './MarkdownRenderer';

interface Props {
  block: ChatBlock;
}

export function ChatBlockRenderer({ block }: Props) {
  switch (block.kind) {
    case 'user':
      return <UserBubble content={block.content} />;
    case 'assistant':
      return <AssistantBubble content={block.content} streaming={block.streaming} />;
    case 'status':
      return <StatusBlock label={block.label} content={block.content} />;
    case 'tool':
      return <ToolBlock name={block.name} content={block.content} />;
    case 'error':
      return <ErrorBlock content={block.content} />;
    default:
      return null;
  }
}

function UserBubble({ content }: { content: string }) {
  return (
    <div className="cc-msg-row cc-msg-row-user">
      <div className="cc-msg-bubble cc-msg-user">
        <MarkdownRenderer content={content} />
      </div>
    </div>
  );
}

function AssistantBubble({ content, streaming }: { content: string; streaming?: boolean }) {
  return (
    <div className="cc-msg-row cc-msg-row-assistant">
      <div className="cc-msg-bubble cc-msg-assistant">
        <MarkdownRenderer content={content} />
        {streaming && <div className="cc-msg-streaming">typing…</div>}
      </div>
    </div>
  );
}

function StatusBlock({ label, content }: { label: string; content: string }) {
  return (
    <div className="cc-msg-row cc-msg-row-system">
      <div className="cc-status-chip">
        <span>{label}</span>
        <span>{content}</span>
      </div>
    </div>
  );
}

function ToolBlock({ name, content }: { name: string; content: string }) {
  return (
    <details className="cc-tool-card">
      <summary>{name}</summary>
      <pre>{content}</pre>
    </details>
  );
}

function ErrorBlock({ content }: { content: string }) {
  return (
    <div className="cc-msg-row cc-msg-row-system">
      <div className="cc-error-card">{content}</div>
    </div>
  );
}
```

---

## 15. TerminalView 修复

### 15.1 修改 `src/surfaces/workspace/TerminalView.tsx`

要求：

1. 不再自己创建 PTY。
2. 只显示 RuntimeKernel 的 terminalBuffer。
3. 输入写入同一个 RuntimeKernel writer。
4. xterm write 必须 requestAnimationFrame 批量执行。

核心代码：

```tsx
import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';

interface Props {
  sessionId: string | null;
  buffer: string;
  onSend: (data: string) => void;
}

export function TerminalView({ sessionId, buffer, onSend }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const writtenLengthRef = useRef(0);
  const pendingRef = useRef('');
  const scheduledRef = useRef(false);

  useEffect(() => {
    if (!hostRef.current) return;

    const terminal = new Terminal({
      convertEol: true,
      cursorBlink: true,
      fontFamily: 'var(--cc-font-mono)',
      fontSize: 13,
    });

    terminal.open(hostRef.current);
    terminalRef.current = terminal;

    const disposable = terminal.onData((data) => {
      onSend(data);
    });

    return () => {
      disposable.dispose();
      terminal.dispose();
      terminalRef.current = null;
      writtenLengthRef.current = 0;
    };
  }, [sessionId]);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;

    const next = buffer.slice(writtenLengthRef.current);
    if (!next) return;
    writtenLengthRef.current = buffer.length;

    pendingRef.current += next;

    if (!scheduledRef.current) {
      scheduledRef.current = true;
      requestAnimationFrame(() => {
        scheduledRef.current = false;
        const pending = pendingRef.current;
        pendingRef.current = '';
        terminal.write(pending);
      });
    }
  }, [buffer]);

  return <div className="cc-terminal-host" ref={hostRef} />;
}
```

---

## 16. Console / Settings / FirstRun 统一环境检测

### 16.1 ConsoleSurface 修改

Console 环境检测卡片使用 `useSetupStore`：

```tsx
const snapshot = useSetupStore((s) => s.snapshot);
const runState = useSetupStore((s) => s.runState);
const detectAll = useSetupStore((s) => s.detectAll);
const hydrate = useSetupStore((s) => s.hydrate);

useEffect(() => {
  hydrate();
}, [hydrate]);
```

按钮逻辑：

```tsx
<button onClick={detectAll} disabled={runState === 'running'}>
  {snapshot ? '刷新环境配置' : '检测环境配置'}
</button>
```

不得启动时自动检测。

### 16.2 SettingsSurface 修改

Settings 不再独立检测。复用同一份 snapshot 和 detectAll。

### 16.3 FirstRunSetupWizard 修改

流程：

```txt
欢迎
环境检测
修复建议
认证/API配置
完成
```

检测页必须有：

```txt
一键检测
重新检测
复制诊断包
打开日志目录
跳过本次
```

---

## 17. GitHub 页面重构

### 17.1 修改 `src/surfaces/github/GitHubSurface.tsx`

删除 iframe 逻辑。

改为：

```tsx
import { useMemo, useState } from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';

const DEFAULT_HOME_KEY = 'ctrlcc.github.home';

export function GitHubSurface() {
  const [home, setHome] = useState(
    () => localStorage.getItem(DEFAULT_HOME_KEY) || 'https://github.com'
  );
  const [input, setInput] = useState(home);

  const repo = useMemo(() => parseGitHubRepo(input), [input]);

  function saveHome() {
    localStorage.setItem(DEFAULT_HOME_KEY, input);
    setHome(input);
  }

  return (
    <div className="cc-surface-page">
      <div className="cc-page-inner">
        <div className="cc-page-header">
          <div>
            <h1 className="cc-title-xl">GitHub</h1>
            <p className="cc-body-sm">Repository dashboard and quick links</p>
          </div>
          <button className="cc-btn cc-btn-primary" onClick={() => openUrl(home)}>
            打开默认主页
          </button>
        </div>

        <div className="cc-card">
          <div className="cc-card-title">默认主页</div>
          <div className="cc-inline-form">
            <input value={input} onChange={(e) => setInput(e.target.value)} />
            <button onClick={saveHome}>设为默认</button>
            <button onClick={() => openUrl(input)}>打开</button>
          </div>
        </div>

        {repo ? (
          <div className="cc-card">
            <div className="cc-card-title">{repo.owner}/{repo.name}</div>
            <div className="cc-action-grid">
              <button onClick={() => openUrl(repo.url)}>Open</button>
              <button onClick={() => openUrl(`${repo.url}/issues`)}>Issues</button>
              <button onClick={() => openUrl(`${repo.url}/pulls`)}>Pull Requests</button>
              <button onClick={() => openUrl(`${repo.url}/actions`)}>Actions</button>
              <button onClick={() => openUrl(`${repo.url}/releases`)}>Releases</button>
            </div>
          </div>
        ) : (
          <div className="cc-card cc-muted-card">
            输入 GitHub repo URL 后显示仓库快捷入口。
          </div>
        )}
      </div>
    </div>
  );
}

function parseGitHubRepo(url: string): null | { owner: string; name: string; url: string } {
  const match = url.match(/github\.com\/([^/\s]+)\/([^/\s#?]+)/);
  if (!match) return null;
  const owner = match[1];
  const name = match[2].replace(/\.git$/, '');
  return { owner, name, url: `https://github.com/${owner}/${name}` };
}
```

---

## 18. 全局 UI Design Tokens

### 18.1 新建或修改 `src/styles/tokens.css`

```css
:root {
  --cc-font-sans: Inter, "HarmonyOS Sans SC", "Microsoft YaHei UI", system-ui, sans-serif;
  --cc-font-mono: "JetBrains Mono", "Cascadia Code", Consolas, monospace;

  --cc-text-11: 11px;
  --cc-text-12: 12px;
  --cc-text-13: 13px;
  --cc-text-14: 14px;
  --cc-text-16: 16px;
  --cc-text-20: 20px;
  --cc-text-28: 28px;

  --cc-line-tight: 1.25;
  --cc-line-normal: 1.5;
  --cc-line-relaxed: 1.7;

  --cc-page-max: 1440px;
  --cc-page-pad: clamp(16px, 2vw, 28px);
  --cc-card-pad: clamp(14px, 1.4vw, 22px);

  --cc-radius-xs: 6px;
  --cc-radius-sm: 10px;
  --cc-radius-md: 14px;
  --cc-radius-lg: 18px;
  --cc-radius-xl: 24px;
}

.cc-surface-page {
  width: 100%;
  height: 100%;
  overflow: auto;
  background: var(--cc-bg);
  color: var(--cc-text);
  font-family: var(--cc-font-sans);
}

.cc-page-inner {
  width: min(100%, var(--cc-page-max));
  margin: 0 auto;
  padding: var(--cc-page-pad);
}

.cc-page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}

.cc-title-xl {
  font-size: var(--cc-text-28);
  line-height: var(--cc-line-tight);
  font-weight: 800;
  letter-spacing: -0.03em;
  margin: 0;
}

.cc-title-lg {
  font-size: var(--cc-text-20);
  line-height: var(--cc-line-tight);
  font-weight: 750;
  margin: 0;
}

.cc-title-md {
  font-size: var(--cc-text-16);
  line-height: var(--cc-line-normal);
  font-weight: 700;
  margin: 0;
}

.cc-body {
  font-size: var(--cc-text-14);
  line-height: var(--cc-line-normal);
}

.cc-body-sm {
  font-size: var(--cc-text-13);
  line-height: var(--cc-line-normal);
  color: var(--cc-text-muted);
}

.cc-caption {
  font-size: var(--cc-text-12);
  line-height: var(--cc-line-normal);
  color: var(--cc-text-soft);
}

.cc-mono {
  font-family: var(--cc-font-mono);
}

.cc-card {
  border: 1px solid var(--cc-border);
  background: var(--cc-surface-solid);
  border-radius: var(--cc-radius-lg);
  padding: var(--cc-card-pad);
  box-shadow: var(--cc-shadow-card);
}

.cc-card-title {
  font-size: var(--cc-text-14);
  font-weight: 700;
  margin-bottom: 12px;
}

.cc-dashboard-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 14px;
}

.cc-two-column {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(360px, 0.9fr);
  gap: 18px;
}

.cc-three-column {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr) 360px;
  gap: 18px;
}

.cc-btn {
  height: 34px;
  border-radius: var(--cc-radius-sm);
  border: 1px solid var(--cc-border);
  background: var(--cc-surface-solid);
  color: var(--cc-text);
  padding: 0 14px;
  font-size: var(--cc-text-13);
  font-weight: 650;
  cursor: pointer;
}

.cc-btn-primary {
  background: var(--cc-brand);
  color: var(--cc-text-on-accent);
  border-color: var(--cc-brand);
}

@media (max-width: 1180px) {
  .cc-dashboard-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .cc-two-column,
  .cc-three-column {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .cc-dashboard-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .cc-page-header {
    flex-direction: column;
  }
}

@media (min-width: 1480px) {
  :root {
    --cc-page-max: 1600px;
  }
}
```

---

## 19. Chat UI CSS

新增 `src/styles/chat.css` 并在入口 import：

```css
.cc-chat-view {
  height: 100%;
  overflow: auto;
  background: var(--cc-bg);
}

.cc-chat-empty {
  height: 100%;
  display: grid;
  place-items: center;
}

.cc-chat-timeline {
  min-height: 100%;
  padding: 20px 24px 28px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cc-msg-row {
  display: flex;
  width: 100%;
}

.cc-msg-row-user {
  justify-content: flex-end;
}

.cc-msg-row-assistant {
  justify-content: flex-start;
}

.cc-msg-row-system {
  justify-content: center;
}

.cc-msg-bubble {
  max-width: min(840px, 78%);
  border-radius: var(--cc-radius-lg);
  padding: 12px 16px;
  font-size: var(--cc-text-14);
  line-height: var(--cc-line-relaxed);
  word-break: break-word;
}

.cc-msg-user {
  background: var(--cc-brand-soft);
  border-bottom-right-radius: 6px;
}

.cc-msg-assistant {
  background: var(--cc-surface-solid);
  border: 1px solid var(--cc-border);
  box-shadow: var(--cc-shadow-card);
  border-bottom-left-radius: 6px;
}

.cc-msg-streaming {
  margin-top: 8px;
  font-size: var(--cc-text-12);
  color: var(--cc-text-muted);
}

.cc-status-chip {
  max-width: 70%;
  border-radius: 999px;
  background: var(--cc-bg-muted);
  border: 1px solid var(--cc-border-muted);
  color: var(--cc-text-muted);
  padding: 4px 12px;
  font-size: var(--cc-text-12);
  display: flex;
  gap: 8px;
}

.cc-tool-card {
  margin: 2px auto;
  width: min(840px, 78%);
  border-radius: var(--cc-radius-md);
  border: 1px solid var(--cc-border);
  background: var(--cc-bg-subtle);
  padding: 10px 14px;
  font-size: var(--cc-text-13);
}

.cc-tool-card pre {
  white-space: pre-wrap;
  overflow: auto;
  max-height: 320px;
  font-family: var(--cc-font-mono);
  font-size: var(--cc-text-12);
}

.cc-error-card {
  max-width: 760px;
  background: var(--cc-red-soft);
  border: 1px solid var(--cc-red);
  color: var(--cc-red);
  border-radius: var(--cc-radius-md);
  padding: 10px 14px;
  font-size: var(--cc-text-13);
}

.cc-chat-streaming-indicator {
  align-self: center;
  color: var(--cc-text-muted);
  font-size: var(--cc-text-12);
  display: flex;
  align-items: center;
  gap: 6px;
}

.cc-pulse-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: var(--cc-brand);
  animation: ccPulse 1.2s infinite ease-in-out;
}

@keyframes ccPulse {
  0%, 100% { transform: scale(0.75); opacity: 0.55; }
  50% { transform: scale(1); opacity: 1; }
}
```

---

## 20. Console 页面重构

### 20.1 修改 `src/surfaces/console/ConsoleSurface.tsx`

结构必须改为：

```tsx
export function ConsoleSurface() {
  const setup = useSetupStore((s) => s.snapshot);
  const runState = useSetupStore((s) => s.runState);
  const detectAll = useSetupStore((s) => s.detectAll);
  const hydrate = useSetupStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <div className="cc-surface-page">
      <div className="cc-page-inner">
        <section className="cc-page-header">
          <div>
            <h1 className="cc-title-xl">晚上好，开发者</h1>
            <p className="cc-body-sm">Ctrl-CC Supreme · 双轨 AI Coding 控制台</p>
          </div>
          <div className="cc-action-row">
            <button className="cc-btn cc-btn-primary">新建会话</button>
            <button className="cc-btn" onClick={detectAll} disabled={runState === 'running'}>
              {setup ? '刷新环境配置' : '检测环境配置'}
            </button>
          </div>
        </section>

        <section className="cc-dashboard-grid">
          <KpiCard label="运行中" value="0" hint="active runtimes" />
          <KpiCard label="项目数" value="0" hint="projects" />
          <KpiCard label="今日费用" value="$0.000" hint="today" />
          <KpiCard label="Claude CLI" value={setup?.claude?.version ?? '-'} hint={setup?.claude?.authStatus ?? 'unknown'} />
          <KpiCard label="错误" value="0" hint="recent" />
        </section>

        <section className="cc-two-column" style={{ marginTop: 18 }}>
          <RuntimeCenterCard />
          <SetupCenterCard />
        </section>

        <section className="cc-two-column" style={{ marginTop: 18 }}>
          <RecentSessionsCard />
          <ActivityTimelineCard />
        </section>
      </div>
    </div>
  );
}
```

其中 `KpiCard`、`RuntimeCenterCard`、`SetupCenterCard` 不能用巨大空白卡，内容必须密集、清晰、对齐。

---

## 21. Project 页面重构

### 21.1 修改项目页面

目标布局：

```txt
左侧：项目分类 / 运行中 / 需要关注 / 全部项目
中间：项目卡片网格 / session timeline
右侧：项目详情 / runtime / git / actions
```

每个项目卡片必须包括：

```txt
项目名
路径
Git 分支
Active sessions
Last activity
New Chat
Open Workspace
Diagnose
```

点击 `New Claude Session` 必须：

```ts
const session = createUiSession(project);
openWorkspaceTab(session.id);
setWorkspaceView('chat');
await RuntimeKernelBridge.startSession({
  guiSessionId: session.id,
  projectId: project.id,
  cwd: project.path,
  model: defaultModel,
  effort: defaultEffort,
  permissionMode: defaultPermissionMode,
});
```

---

## 22. Workspace 页面重构

### 22.1 视图模式

Workspace 必须有：

```txt
Chat
Terminal
Split
```

不要默认跳 Terminal。新建会话默认 Chat。

### 22.2 状态栏

顶部显示：

```txt
项目 / 会话
Runtime status
PID
Mode
Model
Permission
Reconnect / Stop / Detach
```

### 22.3 Composer

底部保留：

```txt
runtime mode selector
model selector
effort selector
permission selector
@ context
/ command
input
send
```

但选择项必须真实影响 Runtime 启动，不要只是 UI 假状态。

---

## 23. Resources 页面重构

### 23.1 修改 `src/surfaces/resources/ResourcesSurface.tsx`

改为：

```txt
顶部：搜索 + 新建资源 + 刷新
左侧：Skills / Agents / Rules / Memory / Hooks / MCP / Templates
中间：资源卡片瀑布流
右侧：资源详情 / 绑定项目 / 启用状态 / 操作
```

资源卡片字段：

```txt
名称
类型
来源路径
启用状态
适用项目
更新时间
Open / Edit / Disable / Bind Project
```

---

## 24. Canvas 页面重构

Canvas 页面要求：

```txt
节点：
Project
Session
Runtime
Resource
Error
GitHub repo

边：
Project -> Session
Session -> Runtime
Project -> Resource
Project -> GitHub

操作：
zoom
pan
fit view
click inspect
open workspace
```

不要只画几个静态圆点。

---

## 25. AI Dock 独立窗口

### 25.1 删除主窗口内部浮动栏

搜索：

```bash
grep -R "AIDock\|FloatingDock\|dock rail\|ai-dock" src
```

主 AppShell 中不再渲染右侧浮动栏。

### 25.2 新增 Tauri window

创建 `src/dock/AiDockWindow.tsx`。

Tauri 配置新增窗口：

```json
{
  "label": "ai-dock",
  "title": "Ctrl-CC Dock",
  "decorations": false,
  "transparent": true,
  "alwaysOnTop": true,
  "skipTaskbar": true
}
```

功能：

```txt
右侧贴边
自动隐藏
显示 Runtime 状态
显示审批请求
显示后台任务
显示错误提醒
点击回到主窗口
```

---

## 26. Performance Task Runner

### 26.1 新建 `src/features/tasks/runAsyncAction.ts`

```ts
type AsyncActionOptions<T> = {
  key: string;
  title: string;
  timeoutMs?: number;
  run: (signal: AbortSignal) => Promise<T>;
  onSuccess?: (result: T) => void;
  onError?: (error: unknown) => void;
};

export async function runAsyncAction<T>(options: AsyncActionOptions<T>) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), options.timeoutMs ?? 60_000);

  try {
    const result = await options.run(controller.signal);
    options.onSuccess?.(result);
    return result;
  } catch (error) {
    options.onError?.(error);
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}
```

所有按钮长任务都通过它或同等机制执行。

---

## 27. 验收 grep

执行：

```bash
grep -R "installRuntimeLifecycleBridge\|installRuntimeFabricEventBridge" src
grep -R "as unknown as RuntimeEvent" src
grep -R "events.slice(0, 200)" src
grep -R "RuntimeKernelBridge.startSession" src/surfaces/workspace
grep -R "stopSession(sessionId)" src/surfaces/workspace
grep -R "Command::new" src-tauri/src
```

预期：

```txt
旧 bridge：0 hits
as unknown as RuntimeEvent：0 hits
events.slice(0, 200)：0 hits
handleSend 内无 startSession
close tab 内无 stopSession
Command::new 只允许在 hidden_command helper 或必须有 CREATE_NO_WINDOW 的地方出现
```

---

## 28. 构建验收

```bash
npm run typecheck
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
```

---

## 29. 手动验收

必须逐条完成：

```txt
1. 启动 App，不自动检测环境。
2. Console 点击“检测环境配置”。
3. 不弹出任何 cmd/powershell/node 窗口。
4. Console/Settings/FirstRun 显示同一份检测结果。
5. 检测失败时有重新检测/复制诊断/打开日志/跳过。
6. Project 点击 New Claude Session。
7. 自动进入 Workspace Chat。
8. 发送“你好”。
9. 记录 PID。
10. 再发送“刚才我说了什么？”
11. PID 不变。
12. Claude 能识别上下文。
13. 切 Terminal，看到同一 runtime 输出。
14. 切 Split，Chat/Terminal 同步。
15. 关闭 tab，Runtime 不被杀。
16. 重新打开 session 可 attach。
17. 点击 Stop Runtime 后进程才停止。
18. 快速切换页面 100 次，无 React #185。
19. 连续发送 20 条消息，无重复回复、无新建后台会话。
20. 全屏/小窗口下 Console/Project/Workspace/Resources/GitHub/Canvas 均不重叠、不挤压。
```

---

## 30. 完成报告格式

执行完成后必须输出：

```md
# Ctrl-CC v28 Completion Report

## Modified Files

列出所有修改文件。

## Runtime Chain

说明现在唯一主链路是 RuntimeKernel。

## Removed Legacy Bridges

附 grep 结果。

## Chat Test

- PID before:
- PID after 20 messages:
- Context continuity:
- Screenshot:

## Terminal Sync Test

说明 Terminal 与 Chat 是否同一 Runtime。

## Setup Test

说明 Console/Settings/FirstRun 是否同源。

## React #185

说明如何防止 render loop。

## UI Upgrade

列出 Console / Project / Workspace / Resources / Canvas / GitHub 的改动。

## Build Results

粘贴：
- npm run typecheck
- npm run build
- cargo check
- cargo test
```

---

## 31. 最后提醒

不要再用以下方式“临时修好”：

```txt
- send message 时自动 startSession
- Chat 用 stream-json one-shot 假装连续会话
- Terminal 单独 create PTY
- close tab 调 stopSession
- Console/Settings 分开检测环境
- React render 里写 store/localStorage
- GitHub iframe 嵌入 github.com
- UI 继续 inline style 堆叠
```

本轮完成后，Ctrl-CC 必须变成：

```txt
稳定、连续、单 Runtime、Chat/Terminal 同步、环境检测统一、UI 商用级、操作丝滑、错误可恢复、诊断可追踪。
```
