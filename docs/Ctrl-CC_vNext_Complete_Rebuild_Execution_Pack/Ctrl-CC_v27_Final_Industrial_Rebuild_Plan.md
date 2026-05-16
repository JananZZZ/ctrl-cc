# Ctrl-CC v27 Final Industrial Rebuild Plan

目标：一次性修复卡死、异步未处理、首次引导失败、React #185、Chat/Terminal 运行时割裂，以及 Console / Project / Workspace / Resources / Canvas / GitHub 全页面视觉混乱问题。

适用仓库：`https://github.com/JananZZZ/ctrl-cc/tree/master`

执行分支：

```bash
git checkout master
git pull
git checkout -b v27-industrial-runtime-and-ui
```

---

## 0. 本轮不可违背的工程原则

本轮不是局部修补，而是把 Ctrl-CC 从实验型 GUI 改成商业级桌面应用。Claude CLI 必须严格执行以下原则。

### 0.1 UI 主线程绝不阻塞

任何按钮点击、环境检测、安装、扫描、Git、文件读取、Claude 进程启动、诊断、导入、导出都不能阻塞 WebView UI。

```text
错误：button onClick -> await invoke(longSyncRustCommand) -> UI 卡住/未响应
正确：button onClick -> 创建 taskId -> 后台 worker/spawn_blocking -> 前端订阅 progress event -> UI 一直可操作
```

### 0.2 Rust 长任务必须异步化

以下 Tauri command 必须是 `async fn`，并用 `tauri::async_runtime::spawn_blocking` 包住同步逻辑：

```text
setup_detect_all
scan_claude_sessions
runtime_discover_claude_v2
runtime_find_claude_js_candidates
runtime_discover_native_claude
runtime_discover_claude_commands
Git log / branch detection
large file read/write
resource scan
diagnostic export
```

### 0.3 所有外部命令必须静默运行

Windows 下任何非 PTY 的 `Command::new()` 都必须带：

```rust
CREATE_NO_WINDOW = 0x08000000
```

禁止弹出 cmd / powershell / node / claude 黑窗口。

### 0.4 所有外部命令必须有 timeout

禁止裸 `.output()`。

```text
default timeout: 4s
heavy timeout: 30s
installer timeout: 10min
```

### 0.5 Workspace Chat 只能绑定 Persistent Runtime

Workspace Chat 主链路禁止：

```text
runtime_start_chat_stream
claude -p
每条消息启动新进程
RuntimeFabricBridge.sendChatMessage
```

Workspace Chat 必须：

```text
一个 GUI session -> 一个长期存活 RuntimeKernel -> Chat / Terminal / Inspector 同步绑定
```

### 0.6 React 状态更新必须受控

禁止：

```text
render 阶段 setState / store set
useEffect 依赖 unstable object / array / inline function 导致循环
Zustand selector 返回新数组/新对象
ErrorBoundary 中反复写 store 触发二次崩溃
同一个 event bridge 重复 install
```

React #185 是 `Maximum update depth exceeded`，本轮必须按无限更新循环处理。

---

# 1. 根因诊断

## 1.1 卡死与未响应

当前 `setup_detect_all()` 是同步 Tauri command：

```rust
#[tauri::command]
pub fn setup_detect_all() -> SetupSnapshot {
    crate::setup::detector::detect_all_setup()
}
```

它会同步执行大量 `Command::new(...).output()`，包括 node、npm、git、claude、where、powershell、runtime discovery。当前 `subprocess_runner.rs` 没有 timeout，也没有 Windows 隐藏窗口。这会造成：

```text
外部命令卡住 -> 整个检测卡住
前端 60s timeout 后后端仍继续跑
按钮点击后 WebView 看起来未响应
Windows 弹出大量终端窗口
失败后没有部分结果、进度、恢复按钮
```

## 1.2 检测失败没有按钮

`FirstRunSetupWizard.tsx` 在 `snapshot === null` 时只显示“检测失败，请重试”，但没有重试、复制错误、手动修复、跳过进入应用等恢复路径。

## 1.3 未处理异步错误

`invokeCommand()` 使用 `Promise.race` 做 timeout，但 timeout 后后端 command 仍在执行；多个 UI handler 没有稳定 `.catch()`，全局 `unhandledrejection` 只记录错误，没有变成可恢复后台任务状态。

## 1.4 React #185

风险最高的区域是：

```text
WorkspaceSurface.tsx
App.tsx
FirstRunSetupWizard.tsx
ErrorBoundary.tsx
useRenderLoopGuard.ts
```

`WorkspaceSurface.tsx` 同时订阅 sessionStore、openSessionStore、runtimeFabricStore、setupStore、runtime:event 和本地 rawEvents，并在视图切换时启动 terminal channel，在发送消息时走 RuntimeFabricBridge。这是典型状态环。

## 1.5 Chat / Terminal 无法打通

当前 Chat 使用：

```ts
RuntimeFabricBridge.sendChatMessage(...)
```

Terminal 使用：

```ts
usePtyTerminal -> RuntimeBridge.write -> useRuntimeStore
```

这是两套 runtime，因此会出现 session not found、Runtime missing、Backend Exists = No、PTY registry 空、每条消息像新会话。

## 1.6 UI 不统一

大量页面使用 inline style，虽然已有 tokens.css / typography.css / layout.css / surfaces.css / components.css，但页面没有系统化使用，导致字体、卡片、间距、响应式都不统一。

---

# 2. 修复卡死、弹窗和 timeout

## 2.1 替换 `src-tauri/src/setup/subprocess_runner.rs`

把整个文件替换为：

```rust
use std::io::Read;
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, Clone)]
pub struct CmdResult {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub code: Option<i32>,
    pub timed_out: bool,
    pub duration_ms: u128,
}

impl CmdResult {
    pub fn timeout(program: &str, timeout: Duration) -> Self {
        Self {
            success: false,
            stdout: String::new(),
            stderr: format!("Command `{}` timed out after {}ms", program, timeout.as_millis()),
            code: None,
            timed_out: true,
            duration_ms: timeout.as_millis(),
        }
    }

    pub fn error(err: impl ToString, elapsed: Duration) -> Self {
        Self {
            success: false,
            stdout: String::new(),
            stderr: err.to_string(),
            code: None,
            timed_out: false,
            duration_ms: elapsed.as_millis(),
        }
    }
}

pub fn default_timeout() -> Duration { Duration::from_secs(4) }
pub fn heavy_timeout() -> Duration { Duration::from_secs(30) }
pub fn install_timeout() -> Duration { Duration::from_secs(600) }

fn build_hidden_command(program: &str) -> Command {
    let mut cmd = Command::new(program);
    #[cfg(windows)]
    { cmd.creation_flags(CREATE_NO_WINDOW); }
    cmd
}

pub fn run_cmd(program: &str, args: &[&str]) -> CmdResult {
    run_cmd_timeout(program, args, default_timeout())
}

pub fn run_cmd_timeout(program: &str, args: &[&str], timeout: Duration) -> CmdResult {
    let start = Instant::now();

    let mut child = match build_hidden_command(program)
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
    {
        Ok(child) => child,
        Err(e) => return CmdResult::error(e, start.elapsed()),
    };

    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                let mut stdout = String::new();
                let mut stderr = String::new();
                if let Some(mut out) = child.stdout.take() { let _ = out.read_to_string(&mut stdout); }
                if let Some(mut err) = child.stderr.take() { let _ = err.read_to_string(&mut stderr); }
                return CmdResult {
                    success: status.success(),
                    stdout: stdout.trim().to_string(),
                    stderr: stderr.trim().to_string(),
                    code: status.code(),
                    timed_out: false,
                    duration_ms: start.elapsed().as_millis(),
                };
            }
            Ok(None) => {
                if start.elapsed() >= timeout {
                    let _ = child.kill();
                    let _ = child.wait();
                    return CmdResult::timeout(program, timeout);
                }
                thread::sleep(Duration::from_millis(30));
            }
            Err(e) => {
                let _ = child.kill();
                return CmdResult::error(e, start.elapsed());
            }
        }
    }
}

pub fn run_cmd_shell(command: &str) -> CmdResult {
    run_cmd_timeout("cmd.exe", &["/d", "/s", "/c", command], default_timeout())
}

pub fn run_cmd_shell_heavy(command: &str) -> CmdResult {
    run_cmd_timeout("cmd.exe", &["/d", "/s", "/c", command], heavy_timeout())
}

pub fn run_cmd_shell_install(command: &str) -> CmdResult {
    run_cmd_timeout("cmd.exe", &["/d", "/s", "/c", command], install_timeout())
}

pub fn run_powershell(script: &str) -> CmdResult {
    run_cmd_timeout(
        "powershell.exe",
        &["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
        default_timeout(),
    )
}

pub fn run_powershell_heavy(script: &str) -> CmdResult {
    run_cmd_timeout(
        "powershell.exe",
        &["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
        heavy_timeout(),
    )
}
```

## 2.2 修改 `src-tauri/src/setup/commands.rs`

把同步命令改成 async + spawn_blocking。

替换：

```rust
#[tauri::command]
pub fn setup_detect_all() -> SetupSnapshot {
    crate::setup::detector::detect_all_setup()
}
```

为：

```rust
#[tauri::command]
pub async fn setup_detect_all() -> Result<SetupSnapshot, String> {
    tauri::async_runtime::spawn_blocking(|| {
        crate::setup::detector::detect_all_setup()
    })
    .await
    .map_err(|e| format!("setup_detect_all worker failed: {}", e))
}
```

安装类命令同样改成 async：

```rust
#[tauri::command]
pub async fn setup_install_claude_code_cli(
    app: AppHandle,
    tasks: State<'_, SetupTaskManager>,
) -> Result<String, String> {
    let tasks = tasks.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        crate::setup::installer::install_claude_code_cli(app, &tasks)
    })
    .await
    .map_err(|e| format!("setup_install_claude_code_cli worker failed: {}", e))?
}
```

对以下命令全部执行同样改造：

```text
setup_fix_powershell_policy
setup_set_npm_mirror
setup_install_claude_code_cli
setup_install_nodejs_lts
setup_install_git_for_windows
```

如果 `SetupTaskManager` 没有 Clone，把它改成：

```rust
#[derive(Clone)]
pub struct SetupTaskManager {
    inner: Arc<Mutex<HashMap<String, SetupTaskProgress>>>,
}
```

## 2.3 修改 `src-tauri/src/setup/installer.rs`

把 installer 中安装类命令：

```rust
run_cmd_shell("winget install ...")
run_cmd_shell("npm install -g ...")
```

替换为：

```rust
run_cmd_shell_install("winget install ...")
run_cmd_shell_install("npm install -g ...")
```

## 2.4 修改 `src-tauri/src/runtime_v2/claude_command_resolver.rs`

在顶部加入 hidden command helper：

```rust
#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

fn hidden_command(program: &str) -> Command {
    let mut cmd = Command::new(program);
    #[cfg(windows)]
    { cmd.creation_flags(CREATE_NO_WINDOW); }
    cmd
}
```

把：

```rust
Command::new(&spec.program)
```

替换为：

```rust
hidden_command(&spec.program)
```

把：

```rust
Command::new(r"C:\Windows\System32\cmd.exe")
```

替换为：

```rust
hidden_command(r"C:\Windows\System32\cmd.exe")
```

---

# 3. 修复 invoke timeout 和异步错误

## 3.1 替换 `src/services/invokeCommand.ts`

把整个文件替换为：

```ts
import { invoke } from '@tauri-apps/api/core';
import type { ErrorSource } from '../stores/errorStore';

export interface InvokeOptions {
  timeoutMs?: number;
  source?: ErrorSource;
  title?: string;
  silent?: boolean;
}

export class CtrlCcCommandTimeout extends Error {
  cmd: string;
  timeoutMs: number;
  constructor(cmd: string, timeoutMs: number) {
    super(`Command "${cmd}" timed out after ${timeoutMs}ms`);
    this.name = 'CtrlCcCommandTimeout';
    this.cmd = cmd;
    this.timeoutMs = timeoutMs;
  }
}

export function warnLog(source: ErrorSource, title: string, detail?: string) {
  console.warn(`[Ctrl-CC] ${source}: ${title}`, detail || '');
  try {
    import('../stores/errorStore').then(({ useErrorStore }) => {
      useErrorStore.getState().addError({
        severity: 'info', source, title: title.slice(0, 100), detail: detail || '',
      });
    }).catch(() => {});
  } catch {}
}

export async function invokeCommand<T>(
  cmd: string,
  args?: Record<string, unknown>,
  options?: InvokeOptions,
): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? 180_000;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const invokePromise = invoke<T>(cmd, args)
    .then((result) => result)
    .catch((error) => { throw error; });

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new CtrlCcCommandTimeout(cmd, timeoutMs)), timeoutMs);
  });

  try {
    return await Promise.race([invokePromise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function invokeCommandSafe<T>(
  cmd: string,
  args?: Record<string, unknown>,
  options?: InvokeOptions & { fallback?: T },
): Promise<T> {
  try {
    return await invokeCommand<T>(cmd, args, options);
  } catch (error) {
    const msg = String(error);
    if (!options?.silent) {
      try {
        const { useErrorStore } = await import('../stores/errorStore');
        useErrorStore.getState().addError({
          severity: error instanceof CtrlCcCommandTimeout ? 'warning' : 'error',
          source: options?.source || 'ipc',
          title: options?.title || `IPC command failed: ${cmd}`,
          detail: msg,
          rawError: msg,
        });
      } catch {}
    }
    if ('fallback' in (options ?? {})) return options!.fallback as T;
    throw error;
  }
}

export function runAsyncAction(
  action: () => Promise<void>,
  options?: { source?: ErrorSource; title?: string },
) {
  void action().catch(async (error) => {
    const msg = String(error);
    try {
      const { useErrorStore } = await import('../stores/errorStore');
      useErrorStore.getState().addError({
        severity: 'error',
        source: options?.source || 'unknown',
        title: options?.title || 'Async action failed',
        detail: msg,
        rawError: msg,
      });
    } catch {}
  });
}
```

## 3.2 所有按钮点击禁止裸 async

搜索：

```bash
grep -R "onClick={async" -n src
grep -R "onClick={() => .*detectAll" -n src
grep -R "onClick={() => .*invokeCommand" -n src
```

全部改成：

```tsx
onClick={() => runAsyncAction(async () => {
  await xxx();
}, { source: 'setup', title: 'Detect environment failed' })}
```

---

# 4. 修复 Setup Store 和首次引导

## 4.1 修改 `src/features/setup/stores/setupStore.ts`

新增 state 字段：

```ts
lastCheckedAt: string | null;
detectAllSafe: () => Promise<SetupSnapshot | null>;
```

initial state 加入：

```ts
lastCheckedAt: null,
```

把 `detectAll` 替换为：

```ts
detectAll: async () => {
  set({ checking: true, error: null });
  try {
    const snapshot = await invokeCommand<SetupSnapshot>(
      'setup_detect_all',
      undefined,
      { timeoutMs: 180_000, source: 'setup', title: 'Environment detection failed' }
    );
    localStorage.setItem('ctrl-cc-setup-snapshot', JSON.stringify(snapshot));
    set({ snapshot, checking: false, error: null, lastCheckedAt: new Date().toISOString() });
    return snapshot;
  } catch (err) {
    const msg = String(err);
    set({ checking: false, error: msg, lastCheckedAt: new Date().toISOString() });
    throw err;
  }
},

detectAllSafe: async () => {
  try { return await get().detectAll(); }
  catch { return null; }
},
```

## 4.2 修改 `FirstRunSetupWizard.tsx`

删除 wizard 内部重复 installListeners 的 useEffect。App 已经全局安装监听。

新增 import：

```ts
import { runAsyncAction } from '../../../services/invokeCommand';
```

把 `handleStartCheck` 改为：

```ts
const handleStartCheck = async () => {
  setStep('check');
  setVerifyResult(null);
  setVerifyError(null);
  try { await detectAll(); }
  catch (err) { setVerifyError(String(err)); }
};
```

把 check step 中的失败区域替换为：

```tsx
<div className="setup-failure-card">
  <div className="setup-failure-title">检测失败</div>
  <div className="setup-failure-desc">
    后台检测没有成功完成，但应用仍可继续打开。您可以重新检测、复制错误，或进入手动配置。
  </div>

  {verifyError && <pre className="setup-error-pre">{verifyError}</pre>}

  <div className="setup-action-row">
    <button
      onClick={() => runAsyncAction(handleStartCheck, { source: 'setup', title: 'Retry setup detection failed' })}
      style={primaryBtnStyle}
      disabled={checking}
    >
      {checking ? '检测中...' : '重新检测'}
    </button>
    <button onClick={() => setStep('repair')} style={secondaryBtnStyle}>手动修复</button>
    <button onClick={() => setStep('config')} style={secondaryBtnStyle}>先配置 API</button>
    <button onClick={() => navigator.clipboard.writeText(verifyError || useSetupStore.getState().error || '')} style={secondaryBtnStyle}>复制错误</button>
    <button onClick={handleFinish} style={skipBtnStyle}>跳过并进入应用</button>
  </div>
</div>
```

## 4.3 给 `first-run-setup.css` 追加样式

```css
.setup-failure-card {
  padding: 18px;
  border-radius: var(--cc-radius-lg);
  border: 1px solid var(--cc-red);
  background: var(--cc-red-soft);
  color: var(--cc-text);
}
.setup-failure-title {
  font-size: var(--cc-text-section);
  font-weight: var(--cc-weight-section);
  color: var(--cc-red);
  margin-bottom: 6px;
}
.setup-failure-desc {
  font-size: var(--cc-text-body);
  color: var(--cc-text-muted);
  line-height: var(--cc-line-relaxed);
  margin-bottom: 12px;
}
.setup-error-pre {
  max-height: 160px;
  overflow: auto;
  padding: 10px 12px;
  border-radius: var(--cc-radius-sm);
  background: var(--cc-bg-elevated);
  border: 1px solid var(--cc-border);
  font-family: var(--cc-font-mono);
  font-size: var(--cc-text-caption);
  color: var(--cc-text);
  white-space: pre-wrap;
}
.setup-action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
```

---

# 5. 修复 React #185

## 5.1 修改 `src/debug/useRenderLoopGuard.ts`

替换为只记录、不 throw：

```ts
import { useEffect, useRef } from 'react';

const renderCounters = new Map<string, { count: number; firstTs: number; warned: boolean }>();

export function useRenderLoopGuard(name: string, limit = 80, windowMs = 1000) {
  const nameRef = useRef(name);
  const now = performance.now();
  const current = renderCounters.get(nameRef.current);

  if (!current || now - current.firstTs > windowMs) {
    renderCounters.set(nameRef.current, { count: 1, firstTs: now, warned: false });
  } else {
    current.count += 1;
    if (current.count >= limit && !current.warned) {
      current.warned = true;
      console.trace(`[RenderLoopGuard] ${nameRef.current} rendered ${current.count} times within ${windowMs}ms`);
      try {
        localStorage.setItem('ctrlcc:render-loop', JSON.stringify({
          component: nameRef.current,
          count: current.count,
          windowMs,
          ts: new Date().toISOString(),
        }, null, 2));
      } catch {}
    }
  }

  useEffect(() => () => { renderCounters.delete(nameRef.current); }, []);
}
```

## 5.2 修改 `ErrorBoundary.tsx`

类内加入：

```ts
private lastErrorKey = '';
private lastErrorAt = 0;
```

在 `componentDidCatch` 中计算 stack 后加入：

```ts
const key = `${error.message}|${stack}`;
const now = Date.now();
if (this.lastErrorKey === key && now - this.lastErrorAt < 3000) return;
this.lastErrorKey = key;
this.lastErrorAt = now;
```

## 5.3 WorkspaceSurface 必须移除多 runtime store 混用

第 7-9 部分完成后，`WorkspaceSurface.tsx` 不得再 import：

```text
RuntimeFabricBridge
useRuntimeFabricStore
useSetupStore
listen from @tauri-apps/api/event
```

---

# 6. 新增 RuntimeKernel 后端

## 6.1 新增 `src-tauri/src/runtime_kernel/mod.rs`

```rust
pub mod commands;
pub mod manager;
pub mod types;
```

## 6.2 新增 `src-tauri/src/runtime_kernel/types.rs`

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeKernelStartRequest {
    pub trace_id: String,
    pub gui_session_id: String,
    pub project_id: String,
    pub cwd: String,
    pub model: Option<String>,
    pub permission_mode: Option<String>,
    pub session_name: Option<String>,
    pub resume_target: Option<String>,
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
pub struct RuntimeKernelWriteRequest {
    pub trace_id: String,
    pub gui_session_id: String,
    pub data: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeKernelStopRequest {
    pub trace_id: String,
    pub gui_session_id: String,
    pub force: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeKernelSessionSnapshot {
    pub trace_id: String,
    pub gui_session_id: String,
    pub runtime_process_id: String,
    pub project_id: String,
    pub cwd: String,
    pub pid: Option<u32>,
    pub status: String,
    pub has_writer: bool,
    pub reader_alive: bool,
    pub created_at: String,
    pub updated_at: String,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeKernelEvent {
    pub trace_id: String,
    pub gui_session_id: String,
    pub runtime_process_id: String,
    pub event_type: String,
    pub status: Option<String>,
    pub data: Option<String>,
    pub message: Option<String>,
    pub pid: Option<u32>,
    pub cwd: Option<String>,
    pub created_at: String,
}
```

## 6.3 新增 `src-tauri/src/runtime_kernel/manager.rs`

实现 persistent Claude PTY。核心要求：一个 GUI session 只启动一个 child，Chat/Terminal 都写入同一个 writer。

```rust
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use chrono::Utc;
use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use tauri::{AppHandle, Emitter};
use crate::runtime_v2::claude_command_resolver::{build_invocation, select_for_terminal};
use super::types::*;

#[derive(Clone, Default)]
pub struct RuntimeKernel {
    inner: Arc<Mutex<HashMap<String, RuntimeKernelHandle>>>,
}

pub struct RuntimeKernelHandle {
    pub trace_id: String,
    pub gui_session_id: String,
    pub runtime_process_id: String,
    pub project_id: String,
    pub cwd: String,
    pub pid: Option<u32>,
    pub status: String,
    pub has_writer: bool,
    pub reader_alive: bool,
    pub created_at: String,
    pub updated_at: String,
    pub last_error: Option<String>,
    pub writer: Box<dyn Write + Send>,
    pub child: Box<dyn portable_pty::Child + Send + Sync>,
}

impl RuntimeKernel {
    pub fn start_session(&self, app: AppHandle, req: RuntimeKernelStartRequest) -> Result<RuntimeKernelSessionSnapshot, String> {
        let cwd_path = std::path::PathBuf::from(&req.cwd);
        if !cwd_path.exists() || !cwd_path.is_dir() { return Err(format!("Invalid cwd: {}", req.cwd)); }

        {
            let sessions = self.inner.lock().map_err(|e| e.to_string())?;
            if let Some(existing) = sessions.get(&req.gui_session_id) { return Ok(snapshot(existing)); }
        }

        let spec = select_for_terminal()?;
        let claude_args = build_claude_args(&req);
        let invocation = build_invocation(&spec, &claude_args);

        let pty_system = NativePtySystem::default();
        let pair = pty_system.openpty(PtySize { rows: 32, cols: 120, pixel_width: 0, pixel_height: 0 })
            .map_err(|e| format!("openpty failed: {}", e))?;

        let mut cmd = CommandBuilder::new(invocation.program.clone());
        for arg in invocation.args { cmd.arg(arg); }
        cmd.cwd(&req.cwd);

        let child = pair.slave.spawn_command(cmd).map_err(|e| format!("spawn Claude failed: {}", e))?;
        drop(pair.slave);

        let mut reader = pair.master.try_clone_reader().map_err(|e| format!("clone PTY reader failed: {}", e))?;
        let writer = pair.master.take_writer().map_err(|e| format!("take PTY writer failed: {}", e))?;

        let now = Utc::now().to_rfc3339();
        let pid = child.process_id();
        let runtime_process_id = format!("rt-{}-{}", req.gui_session_id, Utc::now().timestamp_millis());

        let handle = RuntimeKernelHandle {
            trace_id: req.trace_id.clone(), gui_session_id: req.gui_session_id.clone(), runtime_process_id: runtime_process_id.clone(),
            project_id: req.project_id.clone(), cwd: req.cwd.clone(), pid, status: "ready".to_string(),
            has_writer: true, reader_alive: true, created_at: now.clone(), updated_at: now.clone(), last_error: None, writer, child,
        };

        self.inner.lock().map_err(|e| e.to_string())?.insert(req.gui_session_id.clone(), handle);

        emit(&app, RuntimeKernelEvent { trace_id: req.trace_id.clone(), gui_session_id: req.gui_session_id.clone(), runtime_process_id: runtime_process_id.clone(), event_type: "session.ready".to_string(), status: Some("ready".to_string()), data: None, message: Some("Claude runtime started".to_string()), pid, cwd: Some(req.cwd.clone()), created_at: Utc::now().to_rfc3339() });

        let inner = self.inner.clone();
        let app2 = app.clone();
        let trace_id = req.trace_id.clone();
        let gui_session_id = req.gui_session_id.clone();
        let cwd = req.cwd.clone();
        let runtime_process_id2 = runtime_process_id.clone();

        std::thread::spawn(move || {
            let mut buf = [0u8; 8192];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        let data = String::from_utf8_lossy(&buf[..n]).to_string();
                        emit(&app2, RuntimeKernelEvent { trace_id: trace_id.clone(), gui_session_id: gui_session_id.clone(), runtime_process_id: runtime_process_id2.clone(), event_type: "pty.data".to_string(), status: None, data: Some(data), message: None, pid, cwd: Some(cwd.clone()), created_at: Utc::now().to_rfc3339() });
                    }
                    Err(err) => {
                        emit(&app2, RuntimeKernelEvent { trace_id: trace_id.clone(), gui_session_id: gui_session_id.clone(), runtime_process_id: runtime_process_id2.clone(), event_type: "reader.error".to_string(), status: Some("failed".to_string()), data: None, message: Some(err.to_string()), pid, cwd: Some(cwd.clone()), created_at: Utc::now().to_rfc3339() });
                        break;
                    }
                }
            }
            if let Ok(mut sessions) = inner.lock() {
                if let Some(h) = sessions.get_mut(&gui_session_id) {
                    h.reader_alive = false;
                    h.has_writer = false;
                    h.status = "exited".to_string();
                    h.updated_at = Utc::now().to_rfc3339();
                    h.last_error = Some("PTY reader exited".to_string());
                }
            }
            emit(&app2, RuntimeKernelEvent { trace_id, gui_session_id, runtime_process_id: runtime_process_id2, event_type: "session.exited".to_string(), status: Some("exited".to_string()), data: None, message: Some("Claude runtime exited".to_string()), pid, cwd: Some(cwd), created_at: Utc::now().to_rfc3339() });
        });

        let sessions = self.inner.lock().map_err(|e| e.to_string())?;
        let h = sessions.get(&req.gui_session_id).ok_or("session not found after start")?;
        Ok(snapshot(h))
    }

    pub fn submit_user_message(&self, req: RuntimeKernelSubmitRequest) -> Result<(), String> {
        let mut sessions = self.inner.lock().map_err(|e| e.to_string())?;
        let h = writable(&mut sessions, &req.gui_session_id)?;
        h.writer.write_all(req.text.as_bytes()).map_err(|e| e.to_string())?;
        h.writer.write_all(b"\r").map_err(|e| e.to_string())?;
        h.writer.flush().map_err(|e| e.to_string())?;
        h.status = "streaming".to_string();
        h.updated_at = Utc::now().to_rfc3339();
        Ok(())
    }

    pub fn write_terminal(&self, req: RuntimeKernelWriteRequest) -> Result<(), String> {
        let mut sessions = self.inner.lock().map_err(|e| e.to_string())?;
        let h = writable(&mut sessions, &req.gui_session_id)?;
        h.writer.write_all(req.data.as_bytes()).map_err(|e| e.to_string())?;
        h.writer.flush().map_err(|e| e.to_string())?;
        h.updated_at = Utc::now().to_rfc3339();
        Ok(())
    }

    pub fn stop_session(&self, req: RuntimeKernelStopRequest) -> Result<(), String> {
        let mut sessions = self.inner.lock().map_err(|e| e.to_string())?;
        let mut h = sessions.remove(&req.gui_session_id).ok_or_else(|| format!("runtime session not found: {}", req.gui_session_id))?;
        h.child.kill().map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn list_sessions(&self) -> Result<Vec<RuntimeKernelSessionSnapshot>, String> {
        let sessions = self.inner.lock().map_err(|e| e.to_string())?;
        Ok(sessions.values().map(snapshot).collect())
    }
}

fn writable<'a>(sessions: &'a mut HashMap<String, RuntimeKernelHandle>, id: &str) -> Result<&'a mut RuntimeKernelHandle, String> {
    let h = sessions.get_mut(id).ok_or_else(|| format!("runtime session not found: {}", id))?;
    if !h.has_writer || !h.reader_alive || matches!(h.status.as_str(), "failed" | "exited" | "stopped") {
        return Err(format!("runtime session is not writable: status={} readerAlive={} hasWriter={}", h.status, h.reader_alive, h.has_writer));
    }
    Ok(h)
}

fn snapshot(h: &RuntimeKernelHandle) -> RuntimeKernelSessionSnapshot {
    RuntimeKernelSessionSnapshot { trace_id: h.trace_id.clone(), gui_session_id: h.gui_session_id.clone(), runtime_process_id: h.runtime_process_id.clone(), project_id: h.project_id.clone(), cwd: h.cwd.clone(), pid: h.pid, status: h.status.clone(), has_writer: h.has_writer, reader_alive: h.reader_alive, created_at: h.created_at.clone(), updated_at: h.updated_at.clone(), last_error: h.last_error.clone() }
}

fn emit(app: &AppHandle, event: RuntimeKernelEvent) { let _ = app.emit("runtime-kernel://event", event); }

fn build_claude_args(req: &RuntimeKernelStartRequest) -> Vec<String> {
    let mut args = Vec::new();
    if let Some(model) = &req.model { if !model.trim().is_empty() && model != "default" { args.push("--model".to_string()); args.push(model.clone()); } }
    if let Some(permission) = &req.permission_mode { if !permission.trim().is_empty() && permission != "default" { args.push("--permission-mode".to_string()); args.push(permission.clone()); } }
    if let Some(target) = &req.resume_target { if !target.trim().is_empty() { args.push("--resume".to_string()); args.push(target.clone()); } }
    args
}
```

## 6.4 新增 `src-tauri/src/runtime_kernel/commands.rs`

```rust
use tauri::State;
use super::manager::RuntimeKernel;
use super::types::*;

#[tauri::command]
pub async fn runtime_kernel_start_session(app: tauri::AppHandle, kernel: State<'_, RuntimeKernel>, req: RuntimeKernelStartRequest) -> Result<RuntimeKernelSessionSnapshot, String> {
    let kernel = kernel.inner().clone();
    tauri::async_runtime::spawn_blocking(move || kernel.start_session(app, req)).await.map_err(|e| format!("runtime_kernel_start_session worker failed: {}", e))?
}

#[tauri::command]
pub async fn runtime_kernel_submit_user_message(kernel: State<'_, RuntimeKernel>, req: RuntimeKernelSubmitRequest) -> Result<(), String> {
    let kernel = kernel.inner().clone();
    tauri::async_runtime::spawn_blocking(move || kernel.submit_user_message(req)).await.map_err(|e| format!("runtime_kernel_submit_user_message worker failed: {}", e))?
}

#[tauri::command]
pub async fn runtime_kernel_write_terminal(kernel: State<'_, RuntimeKernel>, req: RuntimeKernelWriteRequest) -> Result<(), String> {
    let kernel = kernel.inner().clone();
    tauri::async_runtime::spawn_blocking(move || kernel.write_terminal(req)).await.map_err(|e| format!("runtime_kernel_write_terminal worker failed: {}", e))?
}

#[tauri::command]
pub async fn runtime_kernel_stop_session(kernel: State<'_, RuntimeKernel>, req: RuntimeKernelStopRequest) -> Result<(), String> {
    let kernel = kernel.inner().clone();
    tauri::async_runtime::spawn_blocking(move || kernel.stop_session(req)).await.map_err(|e| format!("runtime_kernel_stop_session worker failed: {}", e))?
}

#[tauri::command]
pub fn runtime_kernel_list_sessions(kernel: State<'_, RuntimeKernel>) -> Result<Vec<RuntimeKernelSessionSnapshot>, String> {
    kernel.list_sessions()
}
```

## 6.5 修改 `main.rs`

加入模块：

```rust
mod runtime_kernel;
```

加入 manage：

```rust
.manage(runtime_kernel::manager::RuntimeKernel::default())
```

加入 invoke_handler：

```rust
runtime_kernel::commands::runtime_kernel_start_session,
runtime_kernel::commands::runtime_kernel_submit_user_message,
runtime_kernel::commands::runtime_kernel_write_terminal,
runtime_kernel::commands::runtime_kernel_stop_session,
runtime_kernel::commands::runtime_kernel_list_sessions,
```

---

# 7. 前端 RuntimeKernel Bridge

## 7.1 新建 `src/runtime-kernel/types.ts`

```ts
export interface RuntimeKernelSessionSnapshot {
  traceId: string;
  guiSessionId: string;
  runtimeProcessId: string;
  projectId: string;
  cwd: string;
  pid: number | null;
  status: string;
  hasWriter: boolean;
  readerAlive: boolean;
  createdAt: string;
  updatedAt: string;
  lastError: string | null;
}

export interface RuntimeKernelEvent {
  traceId: string;
  guiSessionId: string;
  runtimeProcessId: string;
  eventType: string;
  status?: string | null;
  data?: string | null;
  message?: string | null;
  pid?: number | null;
  cwd?: string | null;
  createdAt: string;
}

export interface KernelChatMessage {
  id: string;
  sessionId: string;
  projectId: string;
  type: 'user_message' | 'assistant_message' | 'system' | 'thinking' | 'raw';
  content: string;
  severity: 'low' | 'medium' | 'high';
  createdAt: string;
}
```

## 7.2 新建 `src/runtime-kernel/runtimeKernelStore.ts`

```ts
import { create } from 'zustand';
import type { KernelChatMessage, RuntimeKernelEvent, RuntimeKernelSessionSnapshot } from './types';

interface RuntimeKernelState {
  sessions: Record<string, RuntimeKernelSessionSnapshot>;
  rawOutput: Record<string, string>;
  chatMessages: Record<string, KernelChatMessage[]>;
  lastEvent: Record<string, RuntimeKernelEvent>;
  upsertSession: (snapshot: RuntimeKernelSessionSnapshot) => void;
  appendChatMessage: (sessionId: string, msg: KernelChatMessage) => void;
  applyEvent: (event: RuntimeKernelEvent) => void;
  removeSession: (sessionId: string) => void;
}

export const useRuntimeKernelStore = create<RuntimeKernelState>((set) => ({
  sessions: {}, rawOutput: {}, chatMessages: {}, lastEvent: {},
  upsertSession: (snapshot) => set((s) => ({ sessions: { ...s.sessions, [snapshot.guiSessionId]: snapshot } })),
  appendChatMessage: (sessionId, msg) => set((s) => {
    const old = s.chatMessages[sessionId] ?? [];
    if (old.some((x) => x.id === msg.id)) return s;
    return { chatMessages: { ...s.chatMessages, [sessionId]: [...old, msg].slice(-1000) } };
  }),
  applyEvent: (event) => set((s) => {
    const old = s.sessions[event.guiSessionId];
    const patched = old && event.status ? { ...old, status: event.status, pid: event.pid ?? old.pid, cwd: event.cwd ?? old.cwd, updatedAt: event.createdAt, lastError: event.eventType.includes('error') ? (event.message ?? old.lastError) : old.lastError } : old;
    return {
      sessions: patched ? { ...s.sessions, [event.guiSessionId]: patched } : s.sessions,
      lastEvent: { ...s.lastEvent, [event.guiSessionId]: event },
      rawOutput: event.eventType === 'pty.data' && event.data ? { ...s.rawOutput, [event.guiSessionId]: ((s.rawOutput[event.guiSessionId] ?? '') + event.data).slice(-300_000) } : s.rawOutput,
    };
  }),
  removeSession: (sessionId) => set((s) => {
    const sessions = { ...s.sessions }; const rawOutput = { ...s.rawOutput }; const chatMessages = { ...s.chatMessages }; const lastEvent = { ...s.lastEvent };
    delete sessions[sessionId]; delete rawOutput[sessionId]; delete chatMessages[sessionId]; delete lastEvent[sessionId];
    return { sessions, rawOutput, chatMessages, lastEvent };
  }),
}));
```

## 7.3 新建 `src/runtime-kernel/runtimeKernelBridge.ts`

```ts
import { listen } from '@tauri-apps/api/event';
import { invokeCommand } from '../services/invokeCommand';
import { useRuntimeKernelStore } from './runtimeKernelStore';
import type { KernelChatMessage, RuntimeKernelEvent, RuntimeKernelSessionSnapshot } from './types';

function trace(prefix: string) { return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function stripAnsi(s: string) { return s.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '').replace(/\r/g, '\n'); }

function makeAssistantMessage(event: RuntimeKernelEvent): KernelChatMessage | null {
  if (event.eventType !== 'pty.data' || !event.data) return null;
  const text = stripAnsi(event.data);
  if (!text.trim()) return null;
  return { id: `assistant-${event.guiSessionId}-${event.createdAt}-${Math.random().toString(16).slice(2)}`, sessionId: event.guiSessionId, projectId: '', type: /thinking|思考|cogitat/i.test(text) ? 'thinking' : 'assistant_message', content: text, severity: 'low', createdAt: event.createdAt };
}

let installed = false;

export const RuntimeKernelBridge = {
  async install() {
    if (installed) return () => {};
    installed = true;
    const unlisten = await listen<RuntimeKernelEvent>('runtime-kernel://event', (e) => {
      const event = e.payload;
      const store = useRuntimeKernelStore.getState();
      store.applyEvent(event);
      const msg = makeAssistantMessage(event);
      if (msg) store.appendChatMessage(event.guiSessionId, msg);
    });
    return () => { installed = false; unlisten(); };
  },

  async listSessions() {
    const sessions = await invokeCommand<RuntimeKernelSessionSnapshot[]>('runtime_kernel_list_sessions', undefined, { timeoutMs: 30_000, source: 'session', title: 'List runtime kernel sessions failed' });
    sessions.forEach((s) => useRuntimeKernelStore.getState().upsertSession(s));
    return sessions;
  },

  async startSession(input: { guiSessionId: string; projectId: string; cwd: string; model?: string; permissionMode?: string; sessionName?: string; resumeTarget?: string | null }) {
    const snapshot = await invokeCommand<RuntimeKernelSessionSnapshot>('runtime_kernel_start_session', { req: { traceId: trace('runtime-start'), guiSessionId: input.guiSessionId, projectId: input.projectId, cwd: input.cwd, model: input.model ?? null, permissionMode: input.permissionMode ?? null, sessionName: input.sessionName ?? null, resumeTarget: input.resumeTarget ?? null } }, { timeoutMs: 60_000, source: 'session', title: 'Start runtime kernel session failed' });
    useRuntimeKernelStore.getState().upsertSession(snapshot);
    return snapshot;
  },

  async submitUserMessage(input: { guiSessionId: string; projectId: string; text: string }) {
    useRuntimeKernelStore.getState().appendChatMessage(input.guiSessionId, { id: `user-${Date.now()}-${Math.random().toString(16).slice(2)}`, sessionId: input.guiSessionId, projectId: input.projectId, type: 'user_message', content: input.text, severity: 'low', createdAt: new Date().toISOString() });
    await invokeCommand('runtime_kernel_submit_user_message', { req: { traceId: trace('runtime-submit'), guiSessionId: input.guiSessionId, text: input.text } }, { timeoutMs: 30_000, source: 'session', title: 'Send user message failed' });
  },

  async writeTerminal(input: { guiSessionId: string; data: string }) {
    await invokeCommand('runtime_kernel_write_terminal', { req: { traceId: trace('runtime-write'), guiSessionId: input.guiSessionId, data: input.data } }, { timeoutMs: 30_000, source: 'pty', title: 'Write terminal failed' });
  },

  async stopSession(guiSessionId: string) {
    await invokeCommand('runtime_kernel_stop_session', { req: { traceId: trace('runtime-stop'), guiSessionId, force: true } }, { timeoutMs: 30_000, source: 'session', title: 'Stop runtime kernel session failed' });
    useRuntimeKernelStore.getState().removeSession(guiSessionId);
  },
};
```

## 7.4 在 `App.tsx` 安装 RuntimeKernelBridge

加入：

```ts
import { RuntimeKernelBridge } from '../runtime-kernel/runtimeKernelBridge';
```

加入 useEffect：

```tsx
useEffect(() => {
  let cleanup: undefined | (() => void);
  RuntimeKernelBridge.install().then((fn) => { cleanup = fn; }).catch((err) => console.error('[Ctrl-CC] RuntimeKernelBridge install failed', err));
  RuntimeKernelBridge.listSessions().catch(() => {});
  return () => cleanup?.();
}, []);
```

---

# 8. 替换 Workspace 主链路

## 8.1 `WorkspaceSurface.tsx` 删除旧 import

删除：

```ts
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { RuntimeFabricBridge } from '../../features/runtime-fabric/services/runtimeFabricBridge';
import { useRuntimeFabricStore } from '../../features/runtime-fabric/stores/runtimeFabricStore';
import { useSetupStore } from '../../features/setup/stores/setupStore';
import { useSurfaceStore } from '../../stores/surfaceStore';
```

新增：

```ts
import { RuntimeKernelBridge } from '../../runtime-kernel/runtimeKernelBridge';
import { useRuntimeKernelStore } from '../../runtime-kernel/runtimeKernelStore';
```

## 8.2 删除 rawEvents / runtime:event / fabricChatEvents

删除：

```ts
const [rawEvents, setRawEvents] = useState<RuntimeEvent[]>([]);
const fabricChatEvents = useRuntimeFabricStore(...)
const events = useMemo(...)
useEffect(() => listen<RuntimeEvent>('runtime:event'...))
```

替换为：

```ts
const events = useRuntimeKernelStore(
  useCallback((s) => (activeTabId ? (s.chatMessages[activeTabId] ?? []) : []), [activeTabId])
) as unknown as RuntimeEvent[];

const runtimeSnapshot = useRuntimeKernelStore(
  useCallback((s) => (activeTabId ? s.sessions[activeTabId] ?? null : null), [activeTabId])
);
```

## 8.3 替换 Composer enable

```ts
const isComposerEnabled = useCallback((sessionId: string | null): boolean => {
  if (!sessionId) return false;
  const rt = useRuntimeKernelStore.getState().sessions[sessionId];
  return Boolean(rt && rt.hasWriter && rt.readerAlive && !['failed', 'exited', 'stopped'].includes(rt.status));
}, []);
```

## 8.4 替换 `handleSend`

```ts
const handleSend = useCallback(async (text: string, config: { model: string; effort: string; permissionMode: string; runtimeMode: string }): Promise<SendResult> => {
  if (!activeTabId) return { ok: false, error: 'No active session' };
  try {
    const existing = useRuntimeKernelStore.getState().sessions[activeTabId];
    if (!existing) {
      await RuntimeKernelBridge.startSession({ guiSessionId: activeTabId, projectId: activeSession?.projectId ?? 'default', cwd: activeSession?.cwd ?? '.', model: config.model, permissionMode: config.permissionMode, sessionName: activeSession?.title ?? activeTabId });
    }
    await RuntimeKernelBridge.submitUserMessage({ guiSessionId: activeTabId, projectId: activeSession?.projectId ?? 'default', text });
    return { ok: true };
  } catch (err) {
    const msg = String(err);
    setError(`${t('workspace.sendFailed')}: ${msg}`);
    useErrorStore.getState().addError({ severity: 'error', source: 'session', title: 'Chat failed', detail: msg });
    return { ok: false, error: msg };
  }
}, [activeTabId, activeSession, t]);
```

## 8.5 替换 `startSessionWithProject`

```ts
const startSessionWithProject = useCallback((projectId: string, projectPath?: string) => {
  setError(null);
  let cwd = projectPath || '.';
  if (cwd === '.') {
    const proj = projects.find((p) => p.id === projectId);
    if (proj?.path) cwd = proj.path;
  }
  const proj = projects.find((p) => p.id === projectId);
  const projName = proj?.name || t('workspace.project');
  const sessionId = `ses-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const title = cwd.split(/[/\\]/).pop() || projName;

  setShowNewSessionDialog(false);
  setShowNewProjectFromSession(false);
  setStarting(true);

  try {
    const session = { id: sessionId, projectId, title, runtimeMode: 'pty-interactive', status: 'starting', model: 'sonnet', permissionMode: 'default', cwd, inputTokens: 0, outputTokens: 0, totalCostUsd: 0, fileChangeCount: 0, riskCount: 0, auditCount: 0, isPinned: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as Session;
    useSessionStore.getState().addSession(session);
    useOpenSessionStore.getState().openSession({ sessionId, projectId, projectName: projName, title, status: 'starting', viewMode: 'chat', pendingConfirms: 0, riskCount: 0, isPinned: false });
    useOpenSessionStore.getState().setActiveTab(sessionId);
    RuntimeKernelBridge.startSession({ guiSessionId: sessionId, projectId, cwd, model: 'sonnet', permissionMode: 'default', sessionName: title }).catch((err) => {
      const msg = String(err);
      setError(`Runtime start failed: ${msg}`);
      useErrorStore.getState().addError({ severity: 'error', source: 'session', title: 'Runtime start failed', detail: msg });
    });
  } finally {
    setStarting(false);
  }
}, [projects, t]);
```

## 8.6 删除 Terminal/Split 里的 `RuntimeFabricBridge.startTerminalChannel`

切换视图只切 UI，不启动第二套 runtime。

---

# 9. Terminal 改为同一 RuntimeKernel

## 9.1 修改 `src/features/terminal/usePtyTerminal.ts`

删除旧 runtime imports：

```ts
import { RuntimeBridge } from '../runtime/services/runtimeBridge';
import { useRuntimeStore } from '../runtime/stores/runtimeStore';
import { isRuntimeWritable } from '../runtime/types/runtimeTypes';
```

新增：

```ts
import { RuntimeKernelBridge } from '../../runtime-kernel/runtimeKernelBridge';
import { useRuntimeKernelStore } from '../../runtime-kernel/runtimeKernelStore';
```

替换 runtime 状态读取：

```ts
const runtimeStatus = useRuntimeKernelStore((s) => sessionId ? s.sessions[sessionId]?.status : undefined);
const runtimeError = useRuntimeKernelStore((s) => sessionId ? s.sessions[sessionId]?.lastError : undefined);
```

替换事件监听为 `runtime-kernel://event`。

替换 `term.onData` 写入：

```ts
RuntimeKernelBridge.writeTerminal({ guiSessionId: sessionId, data })
```

替换 Ctrl+C / Ctrl+D：

```ts
RuntimeKernelBridge.writeTerminal({ guiSessionId: sessionId, data: '\x03' })
RuntimeKernelBridge.writeTerminal({ guiSessionId: sessionId, data: '\x04' })
```

---

# 10. 统一视觉系统与页面重构

## 10.1 修改 `SurfacePage.tsx`

把 `maxWidthMap` 改为：

```ts
const maxWidthMap = {
  dashboard: 'min(1480px, calc(100vw - 64px))',
  management: 'min(1680px, calc(100vw - 48px))',
  workspace: 'none',
  diagnostics: 'min(1560px, calc(100vw - 48px))',
};
```

把 padding 改为：

```ts
padding: 'clamp(18px, 2.2vw, 36px)',
```

## 10.2 新增 `src/components/layout/CommercialPage.tsx`

```tsx
import type { ReactNode } from 'react';
import { SurfacePage } from './SurfacePage';

interface CommercialPageProps {
  title: string;
  eyebrow?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  variant?: 'dashboard' | 'management' | 'workspace' | 'diagnostics';
  testId?: string;
}

export function CommercialPage({ title, eyebrow, description, actions, children, variant = 'dashboard', testId }: CommercialPageProps) {
  return (
    <SurfacePage variant={variant} testId={testId}>
      <div className="cc-commercial-page">
        <header className="cc-page-header">
          <div className="cc-page-title-block">
            {eyebrow && <div className="cc-page-eyebrow">{eyebrow}</div>}
            <h1 className="cc-page-title">{title}</h1>
            {description && <p className="cc-page-description">{description}</p>}
          </div>
          {actions && <div className="cc-page-actions">{actions}</div>}
        </header>
        {children}
      </div>
    </SurfacePage>
  );
}
```

## 10.3 新增 `src/styles/commercial.css`

并在 `src/main.tsx` 加入：

```ts
import './styles/commercial.css';
```

CSS：

```css
.cc-commercial-page { display: grid; gap: clamp(16px, 1.6vw, 24px); min-width: 0; }
.cc-page-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; min-width: 0; }
.cc-page-title-block { min-width: 0; }
.cc-page-eyebrow { font-size: var(--cc-text-caption); color: var(--cc-text-soft); font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; margin-bottom: 6px; }
.cc-page-title { margin: 0; font-size: var(--cc-text-display); line-height: var(--cc-line-tight); font-weight: var(--cc-weight-display); letter-spacing: -0.035em; color: var(--cc-text); }
.cc-page-description { margin: 8px 0 0; max-width: 720px; font-size: var(--cc-text-body); line-height: var(--cc-line-relaxed); color: var(--cc-text-muted); }
.cc-page-actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }
.cc-dashboard-grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: clamp(12px, 1.2vw, 18px); min-width: 0; }
.cc-panel { border: 1px solid var(--cc-border); background: var(--cc-surface-solid); border-radius: var(--cc-radius-xl); box-shadow: var(--cc-shadow-card); min-width: 0; overflow: hidden; }
.cc-panel-body { padding: clamp(16px, 1.5vw, 22px); }
.cc-panel-title { font-size: var(--cc-text-section); font-weight: var(--cc-weight-section); color: var(--cc-text); margin: 0 0 10px; }
.cc-kpi-card { grid-column: span 3; min-height: 116px; padding: 18px; border-radius: var(--cc-radius-xl); border: 1px solid var(--cc-border); background: radial-gradient(circle at top right, var(--cc-brand-soft), transparent 34%), var(--cc-surface-solid); box-shadow: var(--cc-shadow-card); }
.cc-kpi-value { font-size: clamp(26px, 2vw, 36px); line-height: 1; font-weight: 760; color: var(--cc-text); }
.cc-kpi-label { margin-top: 10px; font-size: var(--cc-text-body); font-weight: 660; color: var(--cc-text); }
.cc-kpi-sub { margin-top: 4px; font-size: var(--cc-text-caption); color: var(--cc-text-muted); }
.cc-work-grid { display: grid; grid-template-columns: minmax(280px, 360px) minmax(0, 1fr) minmax(280px, 360px); gap: 16px; min-width: 0; height: 100%; }
@media (max-width: 1280px) { .cc-kpi-card { grid-column: span 6; } .cc-work-grid { grid-template-columns: 280px minmax(0, 1fr); } .cc-work-grid .right-panel { display: none; } }
@media (max-width: 820px) { .cc-page-header { align-items: stretch; flex-direction: column; } .cc-page-actions { justify-content: flex-start; } .cc-kpi-card { grid-column: span 12; } .cc-work-grid { grid-template-columns: 1fr; } .cc-hide-compact { display: none !important; } }
```

---

# 11. 页面级升级目标

## 11.1 Console

改成 Mission Control：

```text
顶部：问候 + 快捷操作
中部：运行时 KPI + 环境状态 + 健康状态
底部：最近会话 + 需要关注 + 后台任务
```

要求：不自动检测环境，只加载 cache。环境卡右上角按钮：无环境信息显示“检测环境配置”，已有显示“刷新环境配置”。

## 11.2 Project

改成 Project Operations：

```text
左：Project Groups / Running / Needs Attention
中：Project Cards / Session Timeline
右：Selected Project Inspector
```

必须删除 `RuntimeFabricBridge`，新建会话自动跳 Workspace Chat。

## 11.3 Workspace / Chat

Chat 是 Persistent Runtime 的可视化投影，不是一次性请求输入框。必须显示：

```text
user bubble
assistant bubble
thinking/raw stream placeholder
tool card placeholder
permission card placeholder
right inspector runtime PID/status/cwd
```

## 11.4 Resources

改成 Claude Capability Studio：

```text
Skills / Agents / Rules / Memory / Hooks / MCP / Templates / Marketplace
```

每个资源卡片显示：名称、类型、路径、作用域、启用状态、关联项目、最近使用、风险扫描状态、操作。

## 11.5 Canvas

修复 Canvas 性能：`colors` 和 `nodes` 必须 useMemo，不允许每 render 重建大对象触发持续重绘。布局改为顶部 Toolbar + 左侧 Layers + 中央 Canvas + 右侧 Inspector。

## 11.6 GitHub

删除 github.com iframe。GitHub 禁止 iframe 是正常现象。改成 Repository Dashboard：repo 输入、open external、branch、status、PR/Issue placeholder、clone/open actions。

---

# 12. 旧链路禁用验收

执行：

```bash
grep -R "RuntimeFabricBridge.sendChatMessage" -n src
grep -R "RuntimeFabricBridge.startTerminalChannel" -n src
grep -R "runtime_start_chat_stream" -n src
```

要求：

```text
WorkspaceSurface.tsx：0 个
ProjectsSurface.tsx：0 个
TerminalView/usePtyTerminal：0 个
```

`runtime_start_chat_stream` 只允许保留在后端 one-shot / diagnostics / background automation，不作为 Workspace 主链路。

---

# 13. 测试矩阵

## 13.1 编译

```bash
npm run typecheck
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

## 13.2 UI 卡死测试

```text
打开 Ctrl-CC
点击环境检测
快速切换 Console / Projects / Resources / Settings
应用不能未响应
不能弹出终端黑窗口
检测中必须有局部进度状态
检测失败必须有重新检测按钮
```

## 13.3 Runtime 测试

```text
新建项目会话
自动进入 Workspace Chat
任务管理器中只出现一个 Claude runtime
发送“你好”
得到回复
再发送“我们刚才说了什么？”
Claude 必须知道上一轮上下文
切到 Terminal
Terminal 仍绑定同一个 PID
输入 /status
切回 Chat
Chat 仍可继续
```

## 13.4 React #185 测试

```text
连续打开关闭 Workspace
切换 Chat/Terminal/Split 30 次
新建/关闭 10 个 session tab
点击错误日志
不得出现 Minified React error #185
localStorage['ctrlcc:render-loop'] 不应持续更新
```

## 13.5 视觉测试

```text
窗口宽度 900px
窗口宽度 1280px
窗口宽度 1920px
深色主题
暖沙主题
浅色主题
浅蓝主题
```

每个页面必须：不挤压、不卡片重叠、字号一致、标题层级清楚、按钮大小统一。

---

# 14. 提交顺序

```bash
git add src-tauri/src/setup src-tauri/src/runtime_v2 src/services/invokeCommand.ts
git commit -m "fix(core): make setup and subprocess execution non-blocking and silent"

git add src/features/setup src/components/error src/debug
git commit -m "fix(ui): harden setup wizard and render error handling"

git add src-tauri/src/runtime_kernel src-tauri/src/main.rs src/runtime-kernel
git commit -m "feat(runtime): add persistent runtime kernel"

git add src/surfaces/workspace src/features/terminal
git commit -m "refactor(workspace): bind chat and terminal to persistent runtime kernel"

git add src/components/layout src/styles src/surfaces/console src/surfaces/projects src/surfaces/resources src/surfaces/canvas src/surfaces/github
git commit -m "feat(ui): rebuild commercial adaptive surfaces"

npm run typecheck
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

---

# 15. 最终验收标准

完成后 Ctrl-CC 必须达到：

```text
点击任何按钮都不会让软件未响应
所有环境检测静默后台运行
所有检测失败都有明确错误、重试、复制、手动修复路径
没有未处理异步错误
没有 React #185
Workspace Chat 不再每条消息新建进程
Chat 和 Terminal 完全绑定同一个 Claude runtime
Console / Project / Chat / Resources / Canvas / GitHub 页面统一视觉语言
四主题完全兼容
小窗口和全屏都美观
诊断信息能解释问题，而不是只告诉用户失败
```

---

# 16. 给 Claude CLI 的执行要求

```text
不要跳步
不要只做 UI 不做 runtime
不要继续修 RuntimeFabricBridge 作为主链路
不要把 headless stream-json 当 Workspace Chat
不要再引入新的 parallel runtime store
每改完一组文件必须运行 typecheck/cargo check
每个失败必须给出具体文件、行、错误原因、下一步修复
严禁说“暂时先这样”
```

Ctrl-CC 的最终定位不是包装 Claude CLI 的输入框，而是 Claude Code Runtime Operating System。

