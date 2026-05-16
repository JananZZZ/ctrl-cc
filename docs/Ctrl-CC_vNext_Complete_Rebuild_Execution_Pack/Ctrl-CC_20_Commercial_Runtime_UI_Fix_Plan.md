# Ctrl-CC 20.0 商用级彻底修复方案：Correct Claude Startup + Runtime Fabric Wiring + Responsive UI

适用仓库：

```text
https://github.com/JananZZZ/ctrl-cc/tree/master
```

建议新分支：

```bash
git checkout master
git pull origin master
git checkout -b fix/v20-correct-claude-startup-runtime-fabric-ui
```

---

## 0. 当前最新代码审计结论

当前问题不是“再调一下 PTY 参数”能解决的，而是 **运行时架构和启动策略仍然混乱**。

### 0.1 Chat 看起来已经是 Chat，但后台仍自动启动 PTY

`runtimeBridge.ts` 仍然是旧的“单入口 RuntimeBridge”。它在 `startInteractiveClaudeSession()` 里先打开 `viewMode: 'chat'`，随后立刻执行：

```ts
void startSessionInBackground(session, input);
```

这意味着：用户看到的是气泡 Chat，但后端仍然马上启动 PTY，所以继续出现 PTY / node.exe / cmd / powershell 错误。

必须改成：

```text
New Claude Session 只创建 CtrlCcSession + 打开 Chat。
不得自动启动 PTY。
Terminal tab 被点击时，才按需启动 PTY。
```

### 0.2 Workspace 仍然把 Chat 绑定到 PTY 可写状态

`WorkspaceSurface.tsx` 仍然导入并使用：

```ts
RuntimeBridge
runtimeWrite
useRuntimeStore
isRuntimeWritable
```

并且 `isComposerEnabled()` 要求：

```ts
rt?.ptySessionId && isRuntimeWritable(rt.status)
```

所以只要 PTY failed/exited，气泡 Chat 也被锁死。这是 Chat 仍然异常的直接原因。

必须改成：

```text
Chat Composer 只看 RuntimeFabric Chat Channel。
Terminal Composer / xterm 才看 PTY。
```

### 0.3 Project 区仍然调用旧 RuntimeBridge

`ProjectsSurface.tsx` 的 `handleCreateSession()` 和 `handleResumeSession()` 仍然调用：

```ts
RuntimeBridge.startInteractiveSession(...)
```

所以从 Project 新建会话仍然会走旧 PTY 自动启动路径。

必须改成：

```ts
RuntimeFabricBridge.createCtrlCcSession(...)
```

### 0.4 native discovery 仍然错误理解了 Windows 上的 `claude`

`native_claude_discovery.rs` 当前会把 PATH 里的 extensionless：

```text
C:\Users\48304\AppData\Roaming\npm\claude
```

当作可执行程序尝试运行，于是得到：

```text
%1 不是有效的 Win32 应用程序。 (os error 193)
```

这个文件通常不是 Windows native exe。真正应该执行的是：

```text
claude.exe
claude.cmd via cmd.exe
Git Bash: bash.exe -lc "claude ..."
真实 npm optional native binary
```

当前 discovery 还没有：

```text
1. 用 PATHEXT 正确解析 Windows 命令；
2. 运行 npm root -g 找全局 node_modules；
3. 解析 npm optional dependency 里的真实 claude.exe；
4. 把 npx plan 降级为 diagnostic-only；
5. 区分 versionOk / printOk / interactivePtyOk。
```

### 0.5 Console UI 仍然被 inline style 和过宽卡片撑坏

`ConsoleSurface.tsx` 仍然大量使用 inline style，`ResponsiveGrid` 未形成统一布局约束，导致：

```text
1. 大屏下卡片宽、空、视觉焦点散；
2. 中等宽度下两大卡片互相挤压；
3. 右侧字段长文本不换行；
4. 表格和长路径缺少统一 text overflow / wrapping；
5. Console 页没有真正的 12-column responsive layout。
```

---

# 1. 正确的 Claude CLI 启动事实

本项目必须遵守以下事实：

1. `claude` 是 interactive session 入口。
2. `claude -p` 是 non-interactive / print mode 入口，可配合 `--output-format stream-json`。
3. `--include-partial-messages` 需要 `--print` 和 `--output-format stream-json`。
4. Windows native setup 支持从 PowerShell、CMD 或 Git Bash 启动 Claude Code；Git Bash 推荐安装。
5. npm 包 `@anthropic-ai/claude-code` 安装的是同一个 native binary，npm 通过 per-platform optional dependency 拉取平台二进制，安装后的 `claude` binary 本身不应被当作 Node JS 脚本启动。

因此，Ctrl-CC 必须分为三条通道：

```text
Chat Channel       = claude -p --output-format stream-json
Terminal Channel   = claude interactive PTY
Background Channel = claude --bg / logs / attach / stop，后续实现
```

---

# 2. 最终目标架构

```text
RuntimeFabricKernel
├── CtrlCcSessionStore
├── RuntimeChannelStore
├── EventLedger
├── ClaudeCommandResolver
├── ChatChannelAdapter
├── TerminalChannelAdapter
└── DiagnosticsProbe
```

页面连接方式：

```text
Console      读 RuntimeFabricStore + DiagnosticsProbe
Projects     createCtrlCcSession，不直接启动 PTY
Workspace    Chat 默认；Terminal 懒启动
Resources    attach / insert，不直接碰 Runtime
Settings     环境检测、权限中心、Claude resolver 配置
AI Dock      独立窗口读 RuntimeFabric snapshot
```

---

# 3. Phase A：先阻断旧路径，防止继续反复炸 PTY

## A1. 修改 `src/features/runtime/services/runtimeBridge.ts`

在 `startInteractiveClaudeSession()` 末尾，把：

```ts
// Background PTY start — non-blocking
void startSessionInBackground(session, input);
return session;
```

替换为：

```ts
// v20: legacy RuntimeBridge no longer auto-starts PTY when opening a chat tab.
// PTY must be started explicitly by TerminalView / RuntimeFabricBridge.startTerminalChannel.
const shouldAutoStartPty = (input as StartInteractiveInput & { autoStartPty?: boolean }).autoStartPty === true;
if (shouldAutoStartPty) {
  void startSessionInBackground(session, input);
}
return session;
```

同时更新注释：

```ts
/**
 * RuntimeBridge is legacy terminal bridge only.
 * New Chat/Project/Console entrypoints must use RuntimeFabricBridge.
 */
```

最终必须保证：

```text
RuntimeBridge.startInteractiveSession(...) 默认不自动启动 PTY。
```

---

# 4. Phase B：Project / Workspace 全面切 RuntimeFabricBridge

## B1. 修改 `ProjectsSurface.tsx`

删除：

```ts
import { RuntimeBridge } from '../../features/runtime/services/runtimeBridge';
```

新增：

```ts
import { RuntimeFabricBridge } from '../../features/runtime-fabric/services/runtimeFabricBridge';
```

把 `handleCreateSession()` 中的旧 `RuntimeBridge.startInteractiveSession(...)` 替换为：

```ts
try {
  RuntimeFabricBridge.createCtrlCcSession({
    projectId,
    projectName: proj?.name || t('workspace.project'),
    cwd,
    title: cwd.split(/[/\\]/).pop() || undefined,
  });
} catch (e) {
  try {
    useErrorStore.getState().addError({
      severity: 'error',
      source: 'session',
      title: t('error.createSessionFailed'),
      detail: String(e),
    });
  } catch {}
} finally {
  setCreatingSession(false);
}
```

注意：这是同步函数，不要再 `.catch().finally()`。

把 `handleResumeSession()` 中的旧 `RuntimeBridge.startInteractiveSession(...)` 替换为：

```ts
try {
  RuntimeFabricBridge.createCtrlCcSession({
    projectId: ses.projectId,
    projectName: ses.title,
    cwd: ses.cwd,
    title: `${ses.title} (Resume)`,
  });
} catch (e) {
  try {
    useErrorStore.getState().addError({
      severity: 'error',
      source: 'session',
      title: t('error.createSessionFailed'),
      detail: String(e),
    });
  } catch {}
}
```

---

## B2. 修改 `WorkspaceSurface.tsx`

删除这些 import：

```ts
import { invokeCommand } from '../../services/invokeCommand';
import { RuntimeBridge, write as runtimeWrite } from '../../features/runtime/services/runtimeBridge';
import { useRuntimeStore } from '../../features/runtime/stores/runtimeStore';
import { isRuntimeWritable } from '../../features/runtime/types/runtimeTypes';
```

新增：

```ts
import { RuntimeFabricBridge } from '../../features/runtime-fabric/services/runtimeFabricBridge';
import { useRuntimeFabricStore } from '../../features/runtime-fabric/stores/runtimeFabricStore';
```

删除 `isComposerEnabled()` 当前实现，替换为：

```ts
const isComposerEnabled = useCallback((sessionId: string | null): boolean => {
  if (!sessionId) return false;
  const fabric = useRuntimeFabricStore.getState().sessions[sessionId];
  if (!fabric) return true; // legacy imported session: allow structured chat attempt
  return fabric.status !== 'failed';
}, []);
```

把 `handleSend()` 整体替换为：

```ts
const handleSend = useCallback(async (
  text: string,
  config: { model: string; effort: string; permissionMode: string; runtimeMode: string }
): Promise<SendResult> => {
  if (!activeTabId) return { ok: false, error: 'No active session' };

  const userEvent: RuntimeEvent = {
    id: `usr-${Date.now()}`,
    sessionId: activeTabId,
    projectId: activeSession?.projectId ?? '',
    type: 'user_message',
    content: text,
    severity: 'low',
    createdAt: new Date().toISOString(),
  };
  setRawEvents((prev) => [...prev, userEvent]);

  try {
    await RuntimeFabricBridge.sendChatMessage(activeTabId, text, {
      model: config.model,
      permissionMode: config.permissionMode,
      effort: config.effort,
      cwd: activeSession?.cwd,
      projectId: activeSession?.projectId,
    } as any);
    return { ok: true };
  } catch (err) {
    const msg = String(err);
    setError(`${t('workspace.sendFailed')}: ${msg}`);
    setRawEvents((prev) => [...prev, {
      id: `sys-${Date.now()}`,
      sessionId: activeTabId,
      projectId: activeSession?.projectId ?? '',
      type: 'system',
      content: `Chat Runtime failed: ${msg}`,
      severity: 'medium',
      createdAt: new Date().toISOString(),
    } as RuntimeEvent]);
    try {
      useErrorStore.getState().addError({
        severity: 'error',
        source: 'session',
        title: 'Chat failed',
        detail: msg,
      });
    } catch {}
    return { ok: false, error: msg };
  }
}, [activeTabId, activeSession, t]);
```

如果 `RuntimeFabricBridge.sendChatMessage` 当前只接受 `(sessionId, prompt)` 两个参数，则先扩展它，见 B3。

### Terminal tab 懒启动

找到切换 viewMode 的按钮：

```tsx
<button key={mode} onClick={() => setViewMode(mode)} ...>
```

替换为：

```tsx
<button
  key={mode}
  onClick={() => {
    setViewMode(mode);
    if ((mode === 'terminal' || mode === 'split') && activeTabId) {
      const fabric = useRuntimeFabricStore.getState().sessions[activeTabId];
      if (fabric && !fabric.terminalChannelId) {
        RuntimeFabricBridge.startTerminalChannel(activeTabId).catch((e) => {
          const msg = String(e);
          setError(`Terminal start failed: ${msg}`);
          try {
            useErrorStore.getState().addError({
              severity: 'error',
              source: 'pty',
              title: 'Terminal start failed',
              detail: msg,
            });
          } catch {}
        });
      }
    }
  }}
  ...
>
```

把 `handleCloseTab()` 中：

```ts
RuntimeBridge.stop(sessionId).catch(() => {});
closeTab(sessionId);
```

替换为：

```ts
// v20: closing tab should not blindly kill all channels.
// TODO: add explicit channel stop in RuntimeFabricBridge.
closeTab(sessionId);
```

---

## B3. 修正 `RuntimeFabricBridge.sendChatMessage` 参数

修改：

```text
src/features/runtime-fabric/services/runtimeFabricBridge.ts
```

把函数签名：

```ts
export async function sendChatMessage(sessionId: string, prompt: string) {
```

改为：

```ts
export async function sendChatMessage(
  sessionId: string,
  prompt: string,
  options?: {
    model?: string;
    permissionMode?: string;
    effort?: string;
    cwd?: string;
    projectId?: string;
  }
) {
```

在 req 中改：

```ts
cwd: options?.cwd ?? session.cwd,
model: options?.model ?? 'sonnet',
permissionMode: options?.permissionMode ?? 'default',
```

并在 `invokeCommand('runtime_start_chat_stream')` 外包 try/catch：

```ts
try {
  const started = await invokeCommand<{ pid?: number }>('runtime_start_chat_stream', { req: { ... } });
  useRuntimeFabricStore.getState().patchChannel(channel.id, {
    status: 'running',
    pid: started.pid ?? null,
  });
} catch (error) {
  const msg = String(error);
  useRuntimeFabricStore.getState().patchChannel(channel.id, {
    status: 'failed',
    error: msg,
    exitedAt: new Date().toISOString(),
  });
  useRuntimeFabricStore.getState().appendEvent({
    sessionId,
    channelId: channel.id,
    level: 'error',
    type: 'chat.failed',
    message: msg,
  });
  throw error;
}
```

不要在 Chat failed 时全局把 Session 置为不可用，除非当前 activeView 只有 Chat 且无 Terminal channel。

---

# 5. Phase C：正确实现 ClaudeCommandResolver

## C1. 废弃当前 native-only discovery 的错误假设

当前 `native_claude_discovery.rs` 错误地尝试执行 extensionless `claude`，导致 Win32 193。必须改成统一 resolver：

```text
CommandSpec
- id
- label
- program
- argsPrefix
- kind: nativeExe | gitBash | cmdShim | powershellShim | npxDiagnostic
- capabilities:
  - versionOk
  - printOk
  - interactivePtyOk
  - selectableForChat
  - selectableForTerminal
```

新建文件：

```text
src-tauri/src/runtime_v2/claude_command_resolver.rs
```

写入完整实现骨架：

```rust
use serde::Serialize;
use std::env;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeCommandSpec {
    pub id: String,
    pub label: String,
    pub program: String,
    pub args_prefix: Vec<String>,
    pub kind: String,
    pub source: String,
    pub version_ok: bool,
    pub version_text: Option<String>,
    pub print_ok: bool,
    pub interactive_pty_ok: bool,
    pub selectable_for_chat: bool,
    pub selectable_for_terminal: bool,
    pub error: Option<String>,
}

pub fn discover_claude_commands() -> Vec<ClaudeCommandSpec> {
    let mut specs = Vec::new();

    if let Ok(p) = env::var("CTRL_CC_CLAUDE_BIN") {
        specs.push(native_spec(PathBuf::from(p), "CTRL_CC_CLAUDE_BIN"));
    }

    if let Ok(user_profile) = env::var("USERPROFILE") {
        specs.push(native_spec(
            PathBuf::from(user_profile).join(r".local\bin\claude.exe"),
            "native installer ~/.local/bin",
        ));
    }

    for p in find_path_candidates("claude.exe") {
        specs.push(native_spec(p, "PATH claude.exe"));
    }

    for p in find_npm_optional_native_candidates() {
        specs.push(native_spec(p, "npm optional native binary"));
    }

    if let Some(bash) = find_git_bash() {
        specs.push(shell_spec(
            "git-bash-claude",
            "Git Bash + claude",
            bash,
            vec!["-lc".to_string(), "claude".to_string()],
            "gitBash",
            "Git for Windows",
            true,
            true,
        ));
    }

    if let Some(cmd) = find_cmd_shim() {
        if env::var("CTRL_CC_ALLOW_CMD_SHIM").ok().as_deref() == Some("1") {
            specs.push(shell_spec(
                "cmd-claude-cmd",
                "cmd.exe + claude.cmd",
                PathBuf::from(r"C:\Windows\System32\cmd.exe"),
                vec!["/d".to_string(), "/s".to_string(), "/c".to_string(), cmd.to_string_lossy().to_string()],
                "cmdShim",
                "APPDATA npm shim",
                true,
                false,
            ));
        }
    }

    if let Some(npx) = find_npx_cli_js() {
        if let Some(node) = find_node_exe() {
            specs.push(shell_spec(
                "npx-diagnostic-anthropic-claude-code",
                "Diagnostic only: node+npx @anthropic-ai/claude-code",
                node,
                vec![npx.to_string_lossy().to_string(), "--yes".into(), "@anthropic-ai/claude-code".into()],
                "npxDiagnostic",
                "npx diagnostic",
                false,
                false,
            ));
        }
    }

    dedupe_specs(specs).into_iter().map(inspect_spec).collect()
}

pub fn select_for_chat() -> Result<ClaudeCommandSpec, String> {
    discover_claude_commands()
        .into_iter()
        .find(|s| s.version_ok && s.selectable_for_chat)
        .ok_or_else(|| "No Claude command available for Chat. Install Claude Code native or set CTRL_CC_CLAUDE_BIN.".to_string())
}

pub fn select_for_terminal() -> Result<ClaudeCommandSpec, String> {
    discover_claude_commands()
        .into_iter()
        .find(|s| s.version_ok && s.selectable_for_terminal && s.interactive_pty_ok)
        .ok_or_else(|| "No Claude command available for Terminal PTY. Install native Claude Code or Git for Windows, then run diagnostics.".to_string())
}

fn native_spec(path: PathBuf, source: &str) -> ClaudeCommandSpec {
    ClaudeCommandSpec {
        id: format!("native-{}", sanitize(&path.to_string_lossy())),
        label: "Native claude.exe".to_string(),
        program: path.to_string_lossy().to_string(),
        args_prefix: vec![],
        kind: "nativeExe".to_string(),
        source: source.to_string(),
        version_ok: false,
        version_text: None,
        print_ok: false,
        interactive_pty_ok: false,
        selectable_for_chat: false,
        selectable_for_terminal: false,
        error: None,
    }
}

fn shell_spec(
    id: &str,
    label: &str,
    program: PathBuf,
    args_prefix: Vec<String>,
    kind: &str,
    source: &str,
    selectable_for_chat: bool,
    selectable_for_terminal: bool,
) -> ClaudeCommandSpec {
    ClaudeCommandSpec {
        id: id.to_string(),
        label: label.to_string(),
        program: program.to_string_lossy().to_string(),
        args_prefix,
        kind: kind.to_string(),
        source: source.to_string(),
        version_ok: false,
        version_text: None,
        print_ok: false,
        interactive_pty_ok: false,
        selectable_for_chat,
        selectable_for_terminal,
        error: None,
    }
}

fn inspect_spec(mut spec: ClaudeCommandSpec) -> ClaudeCommandSpec {
    if !Path::new(&spec.program).exists() {
        spec.error = Some("program not found".to_string());
        return spec;
    }

    match run_version(&spec) {
        Ok(v) => {
            spec.version_ok = true;
            spec.version_text = Some(v);
        }
        Err(e) => {
            spec.error = Some(e);
            return spec;
        }
    }

    match spec.kind.as_str() {
        "nativeExe" => {
            spec.selectable_for_chat = true;
            spec.selectable_for_terminal = true;
            spec.interactive_pty_ok = true;
        }
        "gitBash" => {
            spec.selectable_for_chat = true;
            spec.selectable_for_terminal = true;
            spec.interactive_pty_ok = true;
        }
        "cmdShim" => {
            spec.selectable_for_chat = true;
            spec.selectable_for_terminal = false;
            spec.interactive_pty_ok = false;
        }
        "npxDiagnostic" => {
            spec.selectable_for_chat = false;
            spec.selectable_for_terminal = false;
            spec.interactive_pty_ok = false;
        }
        _ => {}
    }

    spec
}

fn run_version(spec: &ClaudeCommandSpec) -> Result<String, String> {
    let mut args = spec.args_prefix.clone();
    args.push("--version".to_string());

    let output = Command::new(&spec.program)
        .args(&args)
        .stdin(Stdio::null())
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}

fn find_path_candidates(name: &str) -> Vec<PathBuf> {
    let mut out = Vec::new();
    if let Some(path_env) = env::var_os("PATH") {
        for dir in env::split_paths(&path_env) {
            let p = dir.join(name);
            if p.exists() {
                out.push(p);
            }
        }
    }
    out
}

fn find_git_bash() -> Option<PathBuf> {
    [
        r"C:\Program Files\Git\bin\bash.exe",
        r"C:\Program Files\Git\usr\bin\bash.exe",
        r"C:\Program Files (x86)\Git\bin\bash.exe",
    ]
    .iter()
    .map(PathBuf::from)
    .find(|p| p.exists())
}

fn find_cmd_shim() -> Option<PathBuf> {
    env::var("APPDATA").ok()
        .map(PathBuf::from)
        .map(|p| p.join(r"npm\claude.cmd"))
        .filter(|p| p.exists())
}

fn find_node_exe() -> Option<PathBuf> {
    find_path_candidates("node.exe").into_iter().next()
        .or_else(|| {
            let p = PathBuf::from(r"C:\Program Files\nodejs\node.exe");
            p.exists().then_some(p)
        })
}

fn find_npx_cli_js() -> Option<PathBuf> {
    let mut candidates = Vec::new();
    if let Ok(appdata) = env::var("APPDATA") {
        candidates.push(PathBuf::from(appdata).join(r"npm\node_modules\npm\bin\npx-cli.js"));
    }
    candidates.push(PathBuf::from(r"C:\Program Files\nodejs\node_modules\npm\bin\npx-cli.js"));
    candidates.into_iter().find(|p| p.exists())
}

fn find_npm_optional_native_candidates() -> Vec<PathBuf> {
    let mut roots = Vec::new();

    if let Ok(appdata) = env::var("APPDATA") {
        roots.push(PathBuf::from(appdata).join("npm").join("node_modules"));
    }

    if let Some(root) = npm_root_g() {
        roots.push(root);
    }

    let mut out = Vec::new();
    for root in roots {
        scan_for_claude_exe(&root, 0, &mut out);
    }
    out
}

fn npm_root_g() -> Option<PathBuf> {
    let npm_cmd = find_path_candidates("npm.cmd").into_iter().next()?;
    let output = Command::new(r"C:\Windows\System32\cmd.exe")
        .args(["/d", "/s", "/c", &format!("\"{}\" root -g", npm_cmd.to_string_lossy())])
        .stdin(Stdio::null())
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let txt = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if txt.is_empty() { None } else { Some(PathBuf::from(txt)) }
}

fn scan_for_claude_exe(dir: &Path, depth: usize, out: &mut Vec<PathBuf>) {
    if depth > 8 || out.len() > 50 || !dir.exists() {
        return;
    }
    let entries = match std::fs::read_dir(dir) {
        Ok(v) => v,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let name = path.file_name().and_then(|v| v.to_str()).unwrap_or("").to_ascii_lowercase();

        if path.is_dir() {
            if name.contains("claude") || name.contains("anthropic") || name.starts_with("@") || depth > 0 {
                scan_for_claude_exe(&path, depth + 1, out);
            }
        } else if name == "claude.exe" {
            out.push(path);
        }
    }
}

fn dedupe_specs(specs: Vec<ClaudeCommandSpec>) -> Vec<ClaudeCommandSpec> {
    let mut seen = std::collections::HashSet::new();
    let mut out = Vec::new();
    for spec in specs {
        let key = format!("{}|{}", spec.program.to_ascii_lowercase(), spec.args_prefix.join("|"));
        if seen.insert(key) {
            out.push(spec);
        }
    }
    out
}

fn sanitize(s: &str) -> String {
    s.chars().map(|c| if c.is_ascii_alphanumeric() { c } else { '-' }).collect()
}
```

---

## C2. 修改 `src-tauri/src/runtime_v2/mod.rs`

新增：

```rust
pub mod claude_command_resolver;
```

---

## C3. 修改 `runtime_commands.rs`

新增：

```rust
use super::claude_command_resolver::{discover_claude_commands, ClaudeCommandSpec};

#[tauri::command]
pub fn runtime_discover_claude_commands() -> Vec<ClaudeCommandSpec> {
    discover_claude_commands()
}
```

注册到 `main.rs`：

```rust
runtime_v2::runtime_commands::runtime_discover_claude_commands,
```

---

# 6. Phase D：ChatStream 使用 CommandSpec，不再 native-only

修改：

```text
src-tauri/src/runtime_v2/chat_stream.rs
```

替换 import：

```rust
use super::native_claude_discovery::select_claude_for_print_mode;
```

为：

```rust
use super::claude_command_resolver::select_for_chat;
```

把：

```rust
let claude = select_claude_for_print_mode()?;
let mut args = vec![ ... ];
```

改成：

```rust
let spec = select_for_chat()?;
let mut args = spec.args_prefix.clone();
args.extend(vec![
    "-p".to_string(),
    req.prompt.clone(),
    "--output-format".to_string(),
    "stream-json".to_string(),
    "--include-partial-messages".to_string(),
    "--verbose".to_string(),
]);
```

把：

```rust
Command::new(&claude)
```

改为：

```rust
Command::new(&spec.program)
```

---

# 7. Phase E：Terminal PTY 使用 CommandSpec，不再 native-only

修改：

```text
src-tauri/src/runtime_v2/runtime_manager.rs
```

替换：

```rust
use super::native_claude_discovery::select_native_claude_for_interactive;
```

为：

```rust
use super::claude_command_resolver::{select_for_terminal, ClaudeCommandSpec};
```

新增：

```rust
fn build_command_for_spec(spec: &ClaudeCommandSpec, req: &RuntimeStartInteractiveRequest) -> (String, Vec<String>) {
    let cli_args = build_interactive_args(req);

    if spec.kind == "gitBash" {
        let command = if cli_args.is_empty() {
            "claude".to_string()
        } else {
            format!("claude {}", shell_quote_args(&cli_args))
        };
        return (spec.program.clone(), vec!["-lc".to_string(), command]);
    }

    let mut args = spec.args_prefix.clone();
    args.extend(cli_args);
    (spec.program.clone(), args)
}

fn shell_quote_args(args: &[String]) -> String {
    args.iter()
        .map(|a| {
            if a.chars().all(|c| c.is_ascii_alphanumeric() || "-_./:".contains(c)) {
                a.clone()
            } else {
                format!("'{}'", a.replace('\'', "'\\''"))
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}
```

在 `start_interactive()` 中把 native 选择替换为：

```rust
let spec = select_for_terminal()?;
let (program, args) = build_command_for_spec(&spec, &req);
```

删除重复追加 `initial_prompt` 的旧逻辑，避免 prompt 被加两次。`build_interactive_args()` 内统一处理。

---

# 8. Phase F：修复 Console UI：不要再让大卡片互相挤压

## F1. 修改 `SurfacePage.tsx`

把 `dashboard maxWidth` 从 1420 改成 1280：

```ts
const maxWidthMap = {
  dashboard: 1280,
  management: 1440,
  workspace: 'none',
  diagnostics: 1280,
};
```

把 padding 改小：

```ts
padding: 'clamp(16px, 2vw, 28px)',
```

## F2. 新增 `src/surfaces/console/console-surface.css`

```css
.console-page {
  display: grid;
  gap: 16px;
}

.console-hero {
  max-width: 720px;
}

.console-stat-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}

.console-two-col {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(360px, 0.95fr);
  gap: 16px;
  align-items: stretch;
}

.console-card {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.console-env-grid {
  display: grid;
  grid-template-columns: minmax(120px, 0.8fr) minmax(0, 1fr);
  row-gap: 8px;
  column-gap: 12px;
  align-items: baseline;
}

.console-env-grid .value {
  min-width: 0;
  text-align: right;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.console-health-strip {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
  padding: 9px 12px;
  border-radius: var(--cc-radius-md);
  background: var(--cc-surface-solid);
  border: 1px solid var(--cc-border);
}

@media (max-width: 1200px) {
  .console-stat-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .console-two-col {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .console-stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 520px) {
  .console-stat-grid {
    grid-template-columns: 1fr;
  }
}
```

## F3. 修改 `ConsoleSurface.tsx`

导入：

```ts
import './console-surface.css';
```

把根内容包一层：

```tsx
<SurfacePage variant="dashboard" testId="surface-console">
  <div className="console-page">
    ...
  </div>
</SurfacePage>
```

把 Stats 的 `ResponsiveGrid` 替换为：

```tsx
<div className="console-stat-grid">
  ...
</div>
```

把两列 `ResponsiveGrid` 替换为：

```tsx
<div className="console-two-col">
  ...
</div>
```

给两张大卡片：

```tsx
<CcCard className="cc-section-card console-card">
```

把 `E()` 组件替换成 class 版：

```tsx
function E({ label, value, c }: { label: string; value: string; c?: string }) {
  return (
    <>
      <span style={{ color: 'var(--cc-text-soft)' }}>{label}</span>
      <span className="value" style={{ color: c || 'var(--cc-text)', fontWeight: 500 }}>{value}</span>
    </>
  );
}
```

环境卡中：

```tsx
<div className="cc-kv-stack">
```

替换为：

```tsx
<div className="console-env-grid">
```

如果 `ResponsiveGrid` 不再使用，删除其 import。

---

# 9. Phase G：Diagnostics 降噪

当前 Diagnostics 直接展开几十条 Claude JS Candidates，淹没主要错误。必须改成 summary + 折叠。

## G1. RuntimeDiagnosticsPanel 主视图

新增顶部 Runtime Setup Summary：

```text
Chat command: OK / missing
Terminal command: OK / missing
Recommended fix
```

调用：

```ts
invokeCommand('runtime_discover_claude_commands')
```

## G2. Legacy Launch Plan Matrix 默认折叠

```tsx
<details>
  <summary>Legacy Launch Plan Matrix</summary>
  ...
</details>
```

## G3. Claude JS Candidates 默认折叠

```tsx
<details>
  <summary>
    Claude JS Candidates ({jsCandidates.filter(c => c.exists).length} found / {jsCandidates.length} scanned)
  </summary>
  <div className="cc-table-scroll">
    ...
  </div>
</details>
```

## G4. Native/Command candidates 只显示精简表

```text
id | kind | source | version | chat | terminal | error
```

不要默认展示所有不存在的 JS candidate。

---

# 10. Phase H：Terminal 正确启动优先级

```text
1. CTRL_CC_CLAUDE_BIN 指向 claude.exe
2. %USERPROFILE%\.local\bin\claude.exe
3. PATH 中 claude.exe
4. npm optional dependency 里的 claude.exe
5. Git Bash + claude
6. cmd shim，仅 CTRL_CC_ALLOW_CMD_SHIM=1
7. npx，仅 diagnostic，永不用于 PTY
```

---

# 11. 用户当前机器的直接修复命令

根据截图：

```text
C:\Users\48304\.local\bin\claude.exe 不存在
C:\Users\48304\AppData\Roaming\npm\claude 是 extensionless script，不是 Win32 exe
direct-node-npx 可以 --version，但不能作为 PTY
```

本地先运行：

```powershell
winget install Anthropic.ClaudeCode
winget upgrade Anthropic.ClaudeCode
where.exe claude
claude --version
claude doctor
```

如果 winget 安装后存在：

```powershell
Test-Path "$env:USERPROFILE\.local\bin\claude.exe"
```

则：

```powershell
setx CTRL_CC_CLAUDE_BIN "$env:USERPROFILE\.local\bin\claude.exe"
```

如果用 npm 安装，必须确认 optional native binary 存在：

```powershell
npm root -g
dir "$(npm root -g)" -Recurse -Filter claude.exe | Select-Object FullName
```

如果没有 `claude.exe`，重新安装并确保 optional dependencies 没有被禁用：

```powershell
npm config set optional true
npm uninstall -g @anthropic-ai/claude-code
npm install -g @anthropic-ai/claude-code@latest
```

---

# 12. Phase I：删除错误状态传播

## I1. RuntimeFabric terminal failed 不能污染 Chat

修改 `RuntimeFabricBridge.startTerminalChannel()`：

```ts
try {
  await invokeCommand('runtime_start_interactive_v2', { req: ... });
  useRuntimeFabricStore.getState().patchChannel(channel.id, { status: 'ready' });
} catch (error) {
  const msg = String(error);
  useRuntimeFabricStore.getState().patchChannel(channel.id, {
    status: 'failed',
    error: msg,
    exitedAt: new Date().toISOString(),
  });
  useRuntimeFabricStore.getState().appendEvent({
    sessionId,
    channelId: channel.id,
    level: 'error',
    type: 'terminal.failed',
    message: msg,
  });
  throw error;
}
```

不要：

```ts
patchSession(sessionId, { status: 'failed' })
```

因为 Terminal failed 不代表 Chat failed。

## I2. Chat failed 也不能影响 Terminal

Chat 失败只标记 ChatChannel failed；不要 kill terminal。

---

# 13. Phase J：全仓库强制检查

执行：

```bash
rg "RuntimeBridge.startInteractiveSession|RuntimeBridge.write|runtimeWrite|isRuntimeWritable|useRuntimeStore" src/surfaces src/features
```

允许保留的位置：

```text
src/features/terminal/usePtyTerminal.ts
src/surfaces/workspace/TerminalView.tsx
src/features/runtime/services/runtimeBridge.ts
src/features/runtime/services/runtimeLifecycleBridge.ts
```

不允许出现在：

```text
ProjectsSurface.tsx
WorkspaceSurface.tsx 的 Chat send handler
ConsoleSurface.tsx 的 New Session
ResourcesSurface.tsx
```

---

# 14. 构建与测试

## 14.1 构建

```bash
npm run typecheck
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

## 14.2 单元测试建议

新增：

```text
src/features/runtime-fabric/services/runtimeFabricBridge.test.ts
```

测试：

```text
createCtrlCcSession 不调用 runtime_start_interactive_v2
sendChatMessage 调用 runtime_start_chat_stream
startTerminalChannel 才调用 runtime_start_interactive_v2
terminal failed 不改变 chat channel status
```

## 14.3 手动验收

```text
[ ] 点击 Project → New Claude Session，进入 Chat 页面，无 node.exe/cmd/powershell 弹窗。
[ ] Chat Composer 可输入，不依赖 PTY。
[ ] Chat 失败时显示 Chat failed，不出现 Runtime not writable。
[ ] 点击 Terminal tab 后才启动 PTY。
[ ] Terminal 使用 Native/GitBash/cmdShim resolver 选出的 command。
[ ] Diagnostics 显示 Chat command 与 Terminal command。
[ ] Legacy Launch Plan 和 JS Candidates 默认折叠。
[ ] Console 卡片在 520/760/1200/1600 px 下均不重叠、不挤压。
```

---

# 15. 给 Claude CLI / Codex 的严格执行 Prompt

```text
执行 Ctrl-CC 20.0 商用级彻底修复。严格按 plan.md 顺序执行，禁止自由发挥，禁止继续把 Chat 建在 PTY 上。

最高优先级：
1. New Claude Session 默认只创建 RuntimeFabric CtrlCcSession，不自动启动 PTY。
2. Chat 只使用 RuntimeFabricBridge.sendChatMessage → runtime_start_chat_stream。
3. Terminal tab 才使用 RuntimeFabricBridge.startTerminalChannel → runtime_start_interactive_v2。
4. ProjectsSurface / WorkspaceSurface 必须移除普通 Chat 对 RuntimeBridge / runtimeWrite / isRuntimeWritable 的依赖。
5. 正确实现 ClaudeCommandResolver：
   - 不要执行 extensionless C:\Users\...\npm\claude；
   - npx 只能 diagnostic，不用于 PTY；
   - 优先 native claude.exe；
   - 支持 npm root -g 扫描 optional native binary；
   - 支持 Git Bash + claude；
   - cmd shim 仅 CTRL_CC_ALLOW_CMD_SHIM=1。
6. 修复 Console UI：
   - 新增 console-surface.css；
   - 使用 console-stat-grid / console-two-col；
   - 环境字段长文本自动换行；
   - 大屏集中，小屏单列，绝不重叠。
7. Diagnostics 降噪：
   - Legacy Launch Plan Matrix 默认折叠；
   - Claude JS Candidates 默认折叠；
   - 主视图只显示 Chat command / Terminal command / Native candidate / Recommended fix。
8. Terminal failed 不能污染 Chat，Chat failed 不能污染 Terminal。

执行后运行：
npm run typecheck
npm run build
cargo check --manifest-path src-tauri/Cargo.toml

验收：
- Project 新建会话不弹 node.exe 0xc0000142。
- Workspace 默认 Chat 可输入。
- Chat 不再显示 Runtime not writable。
- Terminal 点击后才启动 CLI。
- Diagnostics 能明确告诉用户应该安装 native claude.exe、设置 CTRL_CC_CLAUDE_BIN，或安装 Git Bash。
- Console 页面在不同窗口宽度下不重叠、不拥挤、不空散。
```
