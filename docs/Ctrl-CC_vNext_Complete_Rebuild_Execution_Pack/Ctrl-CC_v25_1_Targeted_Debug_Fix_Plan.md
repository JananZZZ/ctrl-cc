# Ctrl-CC v25.1 针对性审计、局部修复与连带修复执行计划

仓库：

```bash
https://github.com/JananZZZ/ctrl-cc/tree/master
```

目标：

```text
1. 修复首次引导环境检测失败、重复检测、弹出大量终端窗口的问题。
2. 修复 Chat 每轮新建 Claude 会话、回复重复、session not found、状态丢失的问题。
3. 修复 Terminal 与 Chat 不绑定、不可写、不可同步的问题。
4. 保留 v25 架构方向，但先做 v25.1 可落地局部修复，让核心功能先稳定可用。
5. 完成后再进入 v26 Runtime Kernel 全面重构。
```

---

## 0. 当前显式问题与根因

### 0.1 环境检测弹出很多终端窗口

现象：

```text
首次引导环境检测时，桌面弹出大量 cmd / powershell / node / claude 窗口。
检测很多次 claude --version。
最后 UI 只显示“检测失败，请重试”，无重新检测按钮、无局部结果、无 debug 入口。
```

根因：

```text
1. Rust 侧 subprocess_runner.rs 直接 Command::new("cmd.exe") / Command::new("powershell.exe")，没有 Windows CREATE_NO_WINDOW。
2. claude_command_resolver.rs 的 run_version() 也直接 Command::new()，会弹出 console-subsystem child。
3. chat_stream.rs 也直接 Command::new()，headless chat 也可能弹 node.exe/claude.exe 窗口。
4. detect_all_setup() 内部重复 discover：check_claude_code、check_claude_command、detect_all_setup 末尾 discover、select_for_chat、select_for_terminal。
5. Settings 的 EnvironmentStore 还有独立 refresh，Promise.all 同时调用 capability/discovery/jsCandidates，进一步重复检测。
```

---

### 0.2 Chat 每次发消息像新会话

根因：

```text
1. createCtrlCcSession 里 claudeSessionId 初始已改成 null，这是对的。
2. 但 runtimeFabricEventBridge 没有解析 system/init 的真实 session_id。
3. sendChatMessage 传入 session.claudeSessionId，但它永远没有被更新。
4. chat_stream.rs 当前使用 --session-id；Claude Code 官方 CLI resume 参数应为 --resume / -r。
5. 每一轮 headless claude -p 没有 resume 到上一轮 session，因此 Claude Code 会创建新的 backend 会话。
```

---

### 0.3 Chat 回复重复

根因：

```text
runtimeFabricEventBridge.ts 的 extractText() 既从 stream delta 取文本，也从 final assistant message / message.content 取完整文本。
Claude stream-json 通常会先发 partial text delta，之后再发完整 assistant message。
当前没有 sawStreamText 去重机制，所以同一段文本被插入两次。
```

---

### 0.4 Terminal 完全异常，并且和 Chat 不同步

根因：

```text
1. Chat 新系统：useRuntimeFabricStore。
2. Terminal 旧系统：useRuntimeStore + RuntimeBridge.write。
3. RuntimeFabricBridge.startTerminalChannel() 创建的 channel 没有注册到 useRuntimeStore。
4. usePtyTerminal() 写入时调用 RuntimeBridge.write(sessionId, data)，它在 useRuntimeStore 中找不到或状态不可写。
5. 两套 runtime store 并存，导致 session not found / missing / not writable。
```

---

### 0.5 Claude CLI 的完整状态信息被吞掉

根因：

```text
1. ChatBlockRenderer 已经准备了很多类型：tool_use、tool_result、thinking、command_output、summary 等。
2. 但 runtimeFabricEventBridge 只做 extractText()，基本只渲染 assistant text。
3. raw stream-json 被写进 ledger，但没有被归一化成 UI event。
4. stderr 被直接写成 chat.failed，缺少 status / warning / permission / progress 分类。
```

---

## 1. Phase A：立即修复所有后台进程弹窗

### 1.1 修改 `src-tauri/src/setup/subprocess_runner.rs`

完整替换为：

```rust
use std::process::{Command, Stdio};

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
}

pub fn hidden_command(program: &str) -> Command {
    let mut cmd = Command::new(program);
    #[cfg(windows)]
    {
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}

pub fn run_cmd(program: &str, args: &[&str]) -> CmdResult {
    match hidden_command(program)
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
    {
        Ok(o) => CmdResult {
            success: o.status.success(),
            stdout: String::from_utf8_lossy(&o.stdout).trim().to_string(),
            stderr: String::from_utf8_lossy(&o.stderr).trim().to_string(),
            code: o.status.code(),
        },
        Err(e) => CmdResult {
            success: false,
            stdout: String::new(),
            stderr: e.to_string(),
            code: None,
        },
    }
}

pub fn run_cmd_shell(command: &str) -> CmdResult {
    run_cmd("cmd.exe", &["/d", "/s", "/c", command])
}

pub fn run_powershell(script: &str) -> CmdResult {
    run_cmd(
        "powershell.exe",
        &[
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            script,
        ],
    )
}
```

验证：

```bash
npm run tauri:dev
打开首次引导
点击环境检测
必须没有任何 cmd/powershell/node/claude 弹窗
```

---

### 1.2 修改 `src-tauri/src/runtime_v2/claude_command_resolver.rs`

在顶部加入：

```rust
#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

fn hidden_command(program: &str) -> Command {
    let mut cmd = Command::new(program);
    #[cfg(windows)]
    {
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}
```

把所有：

```rust
Command::new(&spec.program)
Command::new(r"C:\Windows\System32\cmd.exe")
```

改成：

```rust
hidden_command(&spec.program)
hidden_command(r"C:\Windows\System32\cmd.exe")
```

特别是：

```text
run_version()
npm_root_g()
```

---

### 1.3 修改 `src-tauri/src/runtime_v2/chat_stream.rs`

在顶部加入：

```rust
#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;
```

把：

```rust
let mut child = Command::new(&invocation.program)
```

改为：

```rust
let mut cmd = Command::new(&invocation.program);
#[cfg(windows)]
{
    cmd.creation_flags(CREATE_NO_WINDOW);
}

let mut child = cmd
```

后面保持：

```rust
.args(&invocation.args)
.current_dir(&req.cwd)
.stdin(Stdio::null())
.stdout(Stdio::piped())
.stderr(Stdio::piped())
.spawn()
```

---

## 2. Phase B：环境检测去重、可视化、可恢复

### 2.1 后端引入 detection cache + single-flight

修改 `src-tauri/src/setup/detector.rs`：

新增缓存结构：

```rust
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

static SETUP_CACHE: OnceLock<Mutex<Option<(Instant, SetupSnapshot)>>> = OnceLock::new();
const SETUP_CACHE_TTL: Duration = Duration::from_secs(60);

pub fn clear_setup_cache() {
    let cache = SETUP_CACHE.get_or_init(|| Mutex::new(None));
    if let Ok(mut guard) = cache.lock() {
        *guard = None;
    }
}
```

在 `detect_all_setup()` 开头加入：

```rust
let cache = SETUP_CACHE.get_or_init(|| Mutex::new(None));
if let Ok(guard) = cache.lock() {
    if let Some((ts, snapshot)) = &*guard {
        if ts.elapsed() < SETUP_CACHE_TTL {
            return snapshot.clone();
        }
    }
}
```

函数结束前写缓存：

```rust
let snapshot = SetupSnapshot { ... };

if let Ok(mut guard) = cache.lock() {
    *guard = Some((Instant::now(), snapshot.clone()));
}

snapshot
```

---

### 2.2 `detect_all_setup()` 内 Claude command 只 discover 一次

新增函数：

```rust
fn check_claude_command_from(cmds: &[crate::runtime_v2::claude_command_resolver::ClaudeCommandSpec]) -> SetupCheckResult {
    let usable = cmds.iter().filter(|c| c.version_ok).count();
    let total = cmds.len();
    let ok = usable > 0;

    let mut r = check("Claude 命令入口", "claudeCommand", ok, true);
    r.details = serde_json::json!({
        "total": total,
        "usable": usable,
        "commands": cmds.iter().filter(|c| c.version_ok).map(|c| serde_json::json!({
            "id": c.id,
            "kind": c.kind,
            "program": c.program,
            "version": c.version_text,
        })).collect::<Vec<_>>(),
    });

    if !ok {
        r.fix_hint = Some("未找到可用的 Claude CLI 命令入口。请安装 Claude Code CLI 或运行 Setup Center。".to_string());
    } else {
        r.message = Some(format!("找到 {} 个可用命令入口 / {} 总计", usable, total));
    }

    r
}
```

在 command resolver 里新增：

```rust
pub fn select_for_chat_from(specs: &[ClaudeCommandSpec]) -> Option<ClaudeCommandSpec> {
    let mut specs: Vec<_> = specs
        .iter()
        .filter(|s| s.version_ok && s.selectable_for_chat)
        .cloned()
        .collect();
    specs.sort_by_key(|s| command_rank(s, false));
    specs.into_iter().next()
}

pub fn select_for_terminal_from(specs: &[ClaudeCommandSpec]) -> Option<ClaudeCommandSpec> {
    let mut specs: Vec<_> = specs
        .iter()
        .filter(|s| s.version_ok && s.selectable_for_terminal && s.interactive_pty_ok)
        .cloned()
        .collect();
    specs.sort_by_key(|s| command_rank(s, true));
    specs.into_iter().next()
}
```

然后：

```rust
pub fn select_for_chat() -> Result<ClaudeCommandSpec, String> {
    select_for_chat_from(&discover_claude_commands())
        .ok_or_else(|| "No Claude command available for Chat. Install Claude Code CLI or run Setup Center.".to_string())
}

pub fn select_for_terminal() -> Result<ClaudeCommandSpec, String> {
    select_for_terminal_from(&discover_claude_commands())
        .ok_or_else(|| "No Claude command available for Terminal PTY. Install native Claude Code or npm wrapper, then run diagnostics.".to_string())
}
```

---

### 2.3 前端 SetupStore 加 single-flight

修改 `src/features/setup/stores/setupStore.ts`：

文件顶部加：

```ts
let detectInFlight: Promise<SetupSnapshot> | null = null;
```

替换 `detectAll`：

```ts
detectAll: async () => {
  if (detectInFlight) return detectInFlight;

  set({ checking: true, error: null });

  detectInFlight = invokeCommand<SetupSnapshot>('setup_detect_all')
    .then((snapshot) => {
      localStorage.setItem('ctrl-cc-setup-snapshot', JSON.stringify(snapshot));
      set({ snapshot, checking: false, error: null });
      return snapshot;
    })
    .catch((err) => {
      const msg = String(err);
      set({ checking: false, error: msg });
      throw err;
    })
    .finally(() => {
      detectInFlight = null;
    });

  return detectInFlight;
},
```

---

### 2.4 FirstRunSetupWizard 修复失败状态与重新检测按钮

修改 `src/features/setup/components/FirstRunSetupWizard.tsx`：

新增：

```ts
const setupError = useSetupStore((s) => s.error);
```

修改：

```ts
const handleStartCheck = async () => {
  setStep('check');
  try {
    await detectAll();
  } catch {
    // error is already stored in setupStore
  }
};
```

把 check step 中：

```tsx
<div style={{ color: 'var(--cc-red)' }}>检测失败，请重试</div>
```

替换为：

```tsx
<div style={{
  padding: 20,
  borderRadius: 'var(--cc-radius-lg)',
  background: 'var(--cc-red-soft)',
  border: '1px solid var(--cc-red)',
}}>
  <div style={{ color: 'var(--cc-red)', fontWeight: 700, marginBottom: 8 }}>
    检测没有完成
  </div>
  <div style={{ color: 'var(--cc-text-muted)', fontSize: 'var(--cc-font-sm)', marginBottom: 12 }}>
    {setupError || '后台检测未返回结果。可以重新检测，或复制诊断信息。'}
  </div>
  <div style={{ display: 'flex', gap: 10 }}>
    <button onClick={handleStartCheck} style={primaryBtnStyle}>重新检测</button>
    <button onClick={() => navigator.clipboard.writeText(setupError || JSON.stringify(snapshot, null, 2))} style={secondaryBtnStyle}>复制诊断</button>
    <button onClick={() => setStep('repair')} style={secondaryBtnStyle}>进入修复</button>
  </div>
</div>
```

---

## 3. Phase C：修复 Chat 会话绑定与重复回复

### 3.1 修改 `runtimeFabricEventBridge.ts`，解析真实 Claude session_id

新增：

```ts
function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object';
}

function getClaudeSessionId(parsed: unknown): string | null {
  if (!isRecord(parsed)) return null;
  if (parsed.type === 'system' && typeof parsed.session_id === 'string') {
    return parsed.session_id;
  }
  if (parsed.type === 'system' && isRecord(parsed.message) && typeof parsed.message.session_id === 'string') {
    return parsed.message.session_id;
  }
  return null;
}
```

在 `runtime://chat-stream` listener 里，JSON.parse 后加入：

```ts
const claudeSessionId = getClaudeSessionId(parsed);
if (claudeSessionId) {
  const store = useRuntimeFabricStore.getState();
  const session = store.sessions[p.sessionId];
  const providerState = (session?.providerState ?? {}) as Record<string, unknown>;
  store.patchSession(p.sessionId, {
    claudeSessionId,
    providerState: {
      ...providerState,
      claudeSessionId,
      previousClaudeSessionIds: Array.from(new Set([
        ...((providerState.previousClaudeSessionIds as string[] | undefined) ?? []),
        claudeSessionId,
      ])),
    },
  });
}
```

---

### 3.2 修改 `chat_stream.rs`，resume 使用 `--resume` 而不是 `--session-id`

把：

```rust
claude_args.push("--session-id".to_string());
claude_args.push(id.clone());
```

替换为：

```rust
claude_args.push("--resume".to_string());
claude_args.push(id.clone());
```

---

### 3.3 修改 `runtimeFabricBridge.ts`，发送时读取 providerState

替换：

```ts
claudeSessionId: session.claudeSessionId,
```

为：

```ts
claudeSessionId: (
  session.claudeSessionId ??
  ((session.providerState as { claudeSessionId?: string | null })?.claudeSessionId ?? null)
),
```

---

### 3.4 修复重复回复：实现 sawStreamText 去重

修改 `runtimeFabricStore.ts`，新增状态：

```ts
streamState: Record<string, { sawTextDelta: boolean; assistantFinalSeen: boolean }>;
markTextDeltaSeen: (channelId: string) => void;
hasTextDelta: (channelId: string) => boolean;
```

实现：

```ts
streamState: {},

markTextDeltaSeen: (channelId) => {
  set((state) => ({
    streamState: {
      ...state.streamState,
      [channelId]: {
        ...(state.streamState[channelId] ?? { sawTextDelta: false, assistantFinalSeen: false }),
        sawTextDelta: true,
      },
    },
  }));
},

hasTextDelta: (channelId) => {
  return get().streamState[channelId]?.sawTextDelta === true;
},
```

替换 `extractText()` 为：

```ts
function extractClaudeDeltaText(parsed: unknown): string {
  if (!isRecord(parsed)) return '';

  if (
    parsed.type === 'stream_event' &&
    isRecord(parsed.event) &&
    parsed.event.type === 'content_block_delta' &&
    isRecord(parsed.event.delta) &&
    parsed.event.delta.type === 'text_delta' &&
    typeof parsed.event.delta.text === 'string'
  ) {
    return parsed.event.delta.text;
  }

  if (typeof parsed.delta === 'string') return parsed.delta;
  if (typeof parsed.text === 'string' && parsed.type === 'assistant_delta') return parsed.text;

  return '';
}

function extractClaudeFinalAssistantText(parsed: unknown): string {
  if (!isRecord(parsed)) return '';
  if (parsed.type !== 'assistant') return '';

  const message = parsed.message;
  if (!isRecord(message)) return '';

  const content = message.content;
  if (!Array.isArray(content)) return '';

  return content
    .map((block) => {
      if (!isRecord(block)) return '';
      if (block.type === 'text' && typeof block.text === 'string') return block.text;
      return '';
    })
    .join('');
}
```

listener 中：

```ts
const delta = extractClaudeDeltaText(parsed);
if (delta) {
  useRuntimeFabricStore.getState().markTextDeltaSeen(p.channelId);
  useRuntimeFabricStore.getState().upsertAssistantDelta(p.sessionId, p.channelId, delta);
  return;
}

const finalText = extractClaudeFinalAssistantText(parsed);
if (finalText && !useRuntimeFabricStore.getState().hasTextDelta(p.channelId)) {
  useRuntimeFabricStore.getState().appendChatEvent(p.sessionId, {
    id: `assistant-final-${p.channelId}`,
    sessionId: p.sessionId,
    projectId: '',
    type: 'assistant_message',
    content: finalText,
    severity: 'low',
    createdAt: new Date().toISOString(),
  } as RuntimeEvent);
}
```

---

## 4. Phase D：把所有 Claude CLI 信息完整回传到 GUI

在 `runtimeFabricEventBridge.ts` 新增 mapper：

```ts
function mapClaudeEventToRuntimeEvents(parsed: unknown, p: ChatStreamPayload): RuntimeEvent[] {
  if (!isRecord(parsed)) return [];

  const now = new Date().toISOString();
  const events: RuntimeEvent[] = [];

  if (parsed.type === 'system') {
    events.push({
      id: `system-${p.channelId}-${crypto.randomUUID()}`,
      sessionId: p.sessionId,
      projectId: '',
      type: 'system_init',
      content: JSON.stringify(parsed),
      severity: 'low',
      createdAt: now,
    } as RuntimeEvent);
  }

  if (parsed.type === 'result') {
    events.push({
      id: `summary-${p.channelId}`,
      sessionId: p.sessionId,
      projectId: '',
      type: 'summary',
      content: 'Claude turn completed',
      totalCostUsd: typeof parsed.total_cost_usd === 'number' ? parsed.total_cost_usd : undefined,
      durationMs: typeof parsed.duration_ms === 'number' ? parsed.duration_ms : undefined,
      severity: 'low',
      createdAt: now,
    } as RuntimeEvent);
  }

  if (parsed.type === 'assistant' && isRecord(parsed.message) && Array.isArray(parsed.message.content)) {
    for (const block of parsed.message.content) {
      if (!isRecord(block)) continue;
      if (block.type === 'tool_use') {
        events.push({
          id: `tool-${p.channelId}-${String(block.id ?? crypto.randomUUID())}`,
          sessionId: p.sessionId,
          projectId: '',
          type: 'tool_use',
          toolName: String(block.name ?? 'tool'),
          toolInput: block.input,
          content: JSON.stringify(block.input ?? {}),
          severity: 'low',
          createdAt: now,
        } as RuntimeEvent);
      }
    }
  }

  if (parsed.type === 'user' && isRecord(parsed.message) && Array.isArray(parsed.message.content)) {
    for (const block of parsed.message.content) {
      if (!isRecord(block)) continue;
      if (block.type === 'tool_result') {
        events.push({
          id: `tool-result-${p.channelId}-${String(block.tool_use_id ?? crypto.randomUUID())}`,
          sessionId: p.sessionId,
          projectId: '',
          type: 'tool_result',
          content: typeof block.content === 'string' ? block.content : JSON.stringify(block.content ?? ''),
          isError: Boolean(block.is_error),
          severity: Boolean(block.is_error) ? 'medium' : 'low',
          createdAt: now,
        } as RuntimeEvent);
      }
    }
  }

  return events;
}
```

listener 中加入：

```ts
for (const evt of mapClaudeEventToRuntimeEvents(parsed, p)) {
  useRuntimeFabricStore.getState().appendChatEvent(p.sessionId, evt);
}
```

stderr 分类：

```ts
function classifyStderr(line: string): RuntimeEvent['type'] {
  const lower = line.toLowerCase();
  if (lower.includes('thinking') || lower.includes('cogitat')) return 'thinking';
  if (lower.includes('permission')) return 'permission_requested';
  if (lower.includes('error') || lower.includes('failed')) return 'error';
  return 'system_init';
}
```

注意：这里只显示 Claude Code CLI 实际输出的状态和 metadata，不显示模型隐藏推理链。

---

## 5. Phase E：Terminal 与 Chat 局部打通

### 5.1 短期修复：startTerminalChannel 同步注册旧 RuntimeStore

修改 `src/features/runtime-fabric/services/runtimeFabricBridge.ts`：

新增 import：

```ts
import { useRuntimeStore } from '../../runtime/stores/runtimeStore';
```

在 `startTerminalChannel()` 中，`state.addChannel(channel)` 后加入：

```ts
useRuntimeStore.getState().addSession({
  id: session.id,
  ptySessionId: channel.id,
  claudeSessionId: session.claudeSessionId,
  traceId: uid('trace'),
  projectId: session.projectId,
  projectName: session.projectName,
  name: session.title,
  cwd: session.cwd,
  mode: 'interactive-pty',
  status: 'pty-starting',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  startedAt: new Date().toISOString(),
} as any);
```

当 `runtime_start_interactive_v2` 成功后：

```ts
useRuntimeStore.getState().patchSession(sessionId, { status: 'pty-ready' as any });
```

catch 中：

```ts
useRuntimeStore.getState().patchSession(sessionId, { status: 'failed' as any, error: msg });
```

这是兼容修复。v26 应删除旧 RuntimeStore，统一 RuntimeKernel。

---

### 5.2 Terminal 启动同一 Claude session

修改 `startTerminalChannel()` 调用参数：

```ts
const claudeSessionId = (
  session.claudeSessionId ??
  ((session.providerState as { claudeSessionId?: string | null })?.claudeSessionId ?? null)
);
```

然后：

```ts
mode: claudeSessionId ? 'resume' : 'new',
resumeTarget: claudeSessionId,
```

这样 Terminal 打开时，若 Chat 已产生真实 Claude session id，则 Terminal 用同一 session 恢复。

---

## 6. Phase F：修复 `session not found`

在 `WorkspaceSurface.tsx` 中，发送前校验 Fabric session：

```ts
const fabricSession = useRuntimeFabricStore.getState().sessions[activeTabId];
if (!fabricSession) {
  const activeTab = useOpenSessionStore.getState().tabs.find((t) => t.sessionId === activeTabId);
  if (activeTab) {
    const project = projects.find((p) => p.id === activeTab.projectId);
    RuntimeFabricBridge.createCtrlCcSession({
      projectId: activeTab.projectId,
      projectName: activeTab.projectName,
      cwd: project?.path ?? activeSession?.cwd ?? '.',
      title: activeTab.title,
    });
    return { ok: false, error: 'Session runtime was missing and has been recreated. Please send again.' };
  }
  return { ok: false, error: `Session runtime missing: ${activeTabId}` };
}
```

更好的方式是 v26 通过持久化 RuntimeSessionRecord 修复。v25.1 先避免直接报错。

---

## 7. Phase G：性能与丝滑体验修复

### 7.1 事件批处理

在 `runtimeFabricEventBridge.ts` 中增加：

```ts
const eventQueue: Array<() => void> = [];
let rafPending = false;

function enqueueStoreWrite(fn: () => void) {
  eventQueue.push(fn);
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    const batch = eventQueue.splice(0, 200);
    for (const f of batch) f();
  });
}
```

把高频 append 包进：

```ts
enqueueStoreWrite(() => {
  useRuntimeFabricStore.getState().appendEvent(...);
});
```

### 7.2 ChatView 滚动节流

把 smooth scroll 改成 animation frame：

```ts
useEffect(() => {
  const id = requestAnimationFrame(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto' });
  });
  return () => cancelAnimationFrame(id);
}, [events.length]);
```

---

## 8. Phase H：UI 局部修复

### 8.1 ComposerBar 底部控制条分组

布局：

```text
[运行方式 CLI/Chat] [模型/推理/权限] [@ / /] [输入框] [发送]
```

CSS：

```css
.composer-bar {
  display: grid;
  grid-template-columns: auto auto auto 1fr auto;
  gap: 8px;
  align-items: center;
}

@media (max-width: 900px) {
  .composer-bar {
    grid-template-columns: 1fr auto;
  }

  .composer-controls {
    grid-column: 1 / -1;
    display: flex;
    overflow-x: auto;
  }
}
```

### 8.2 SessionInspector 右侧栏不要挤压 Chat 主区

```css
.workspace-inspector {
  width: clamp(260px, 20vw, 340px);
  min-width: 260px;
  max-width: 360px;
}

@media (max-width: 1100px) {
  .workspace-inspector {
    display: none;
  }
}
```

---

## 9. 必须新增测试

### 9.1 `tests/runtime/claudeStreamParser.test.ts`

覆盖：

```text
[ ] system/init 能提取 session_id
[ ] delta + final assistant 不重复
[ ] tool_use 映射成 tool_use event
[ ] tool_result 映射成 tool_result event
[ ] result 映射成 summary event
```

### 9.2 `tests/runtime/sessionResume.test.ts`

覆盖：

```text
[ ] 首轮 chat 不传 --resume
[ ] 收到 system/init 后保存 claudeSessionId
[ ] 第二轮 chat 传 --resume <id>
```

### 9.3 `tests/runtime/storeBridge.test.ts`

覆盖：

```text
[ ] startTerminalChannel 同步注册旧 RuntimeStore
[ ] TerminalView 可以找到 session
[ ] write 调用使用正确 ptySessionId
```

### 9.4 `tests/setup/singleFlight.test.ts`

覆盖：

```text
[ ] 连续调用 detectAll 3 次，只 invoke 一次 setup_detect_all
[ ] 失败后可以重新检测
[ ] snapshot null 时 UI 有重新检测按钮
```

---

## 10. 验证流程

每个阶段执行：

```bash
npm run typecheck
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
npm test
```

手动验证：

```text
1. 清空 localStorage onboarding。
2. 启动软件。
3. 点击首次引导检测。
4. 不允许弹任何黑窗口。
5. 检测失败时必须显示成功项、失败项、重新检测按钮、复制诊断按钮。
6. 新建项目会话。
7. Chat 发“你好”。
8. 继续问“我们现在共有几条用户消息？”
9. Claude 必须知道上一轮上下文。
10. 回复不能重复。
11. 切 Terminal。
12. Terminal 必须能打开同一 session。
13. Terminal 输入 `/status` 或普通文字，必须可写。
14. Chat 和 Terminal 的 session_id 必须一致。
```

---

## 11. 为什么别的软件更丝滑，而当前 Ctrl-CC 很卡

核心不是体量，而是架构：

```text
别的软件：
1. 单一 runtime kernel。
2. 子进程统一调度。
3. 检测有缓存，有 single-flight。
4. UI 只订阅 ViewModel。
5. 日志和 raw data 默认不渲染。
6. 长列表虚拟化。
7. 事件批处理。
8. 状态单向流动。

当前 Ctrl-CC：
1. RuntimeFabricStore + RuntimeStore 并存。
2. Chat/Terminal/Setup/Diagnostics 多路直接 invoke。
3. 检测重复创建进程。
4. 每个事件多 store 写入。
5. raw diagnostics 长表直接渲染。
6. inline style 导致视觉和布局无法统一。
7. session/channel/providerState 没有严格状态机。
```

所以 v25.1 先局部止血；v26 必须进入 RuntimeKernel 统一架构。

---

## 12. 提交顺序

```bash
git checkout master
git pull origin master

# Phase A
git add src-tauri/src/setup/subprocess_runner.rs src-tauri/src/runtime_v2/claude_command_resolver.rs src-tauri/src/runtime_v2/chat_stream.rs
git commit -m "fix(runtime): hide background subprocess windows on Windows"

# Phase B
git add src-tauri/src/setup/detector.rs src/features/setup/stores/setupStore.ts src/features/setup/components/FirstRunSetupWizard.tsx src/features/setup/styles/first-run-setup.css
git commit -m "fix(setup): add cached single-flight environment detection and retry UI"

# Phase C-D
git add src/features/runtime-fabric/stores/runtimeFabricStore.ts src/features/runtime-fabric/services/runtimeFabricEventBridge.ts src/features/runtime-fabric/services/runtimeFabricBridge.ts src-tauri/src/runtime_v2/chat_stream.rs
git commit -m "fix(chat): persist Claude session id and dedupe stream output"

# Phase E-F
git add src/features/runtime-fabric/services/runtimeFabricBridge.ts src/surfaces/workspace/WorkspaceSurface.tsx
git commit -m "fix(terminal): attach PTY channel to active fabric session"

# Phase G-H
git add src/surfaces/workspace/ChatView.tsx src/surfaces/workspace/ComposerBar.tsx src/surfaces/workspace/SessionInspector.tsx src/styles/*.css
git commit -m "perf(ui): batch runtime events and improve workspace responsiveness"
```

---

## 13. 本轮不要做的事

```text
1. 不要继续大改 Console / Resources / GitHub 页面。
2. 不要再新建第三套 runtime store。
3. 不要在 UI 里直接解析所有 CLI 逻辑。
4. 不要把 PTY 当 Chat 的唯一实现。
5. 不要把 headless Chat 当 Terminal 的替代品。
6. 不要再做“看起来很酷”的大面板，先把核心链路打通。
```

---

## 14. v25.1 成功定义

```text
[ ] 环境检测无弹窗。
[ ] 环境检测只执行一次，失败可重试。
[ ] Setup UI 能展示成功/失败详情。
[ ] Chat 首轮创建 Claude session，后续轮次 resume 同一 session。
[ ] Chat 不重复回复。
[ ] system/init/result/tool/stderr 全部进入 ledger。
[ ] CLI 状态信息可见，不再被吞。
[ ] Terminal 能绑定 Chat 已创建的 Claude session。
[ ] Terminal 可写。
[ ] Chat/Terminal 至少共享同一个 Claude session id。
[ ] 软件交互不再明显卡顿。
```
