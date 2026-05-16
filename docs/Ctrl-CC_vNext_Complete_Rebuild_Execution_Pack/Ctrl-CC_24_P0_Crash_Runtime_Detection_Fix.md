# Ctrl-CC 24.0 / PLAN-P0：紧急止血修复包

目标：先把当前“大崩溃、Chat 无效、环境误判、React #185、页面字体不统一”全部止住。  
执行原则：只修阻断级问题，不大重构；所有修改必须可回滚、可验证。

---

## 0. 当前根因判断

### 0.1 React #185 不是普通 UI 报错，而是无限更新循环

React #185 的完整含义是：

```text
Maximum update depth exceeded.
```

也就是组件在渲染/更新链路中反复触发状态更新，最终 React 中断。

当前 `WorkspaceSurface.tsx` 的高风险点：

```ts
const fabricChatEvents = useRuntimeFabricStore(
  useCallback((s) => activeTabId ? (s.chatEvents[activeTabId] ?? []) : [], [activeTabId])
);
```

这里在 Zustand v5 下非常危险：当 `activeTabId` 没有对应 events 时，selector 每次都返回新的 `[]`，会导致订阅快照不稳定，进而触发连续渲染。

另一个问题是：

```ts
const coalesced = coalescerRef.current.feed(evt);
```

这在 `useMemo` 中执行，但 `feed()` 会修改 `StreamCoalescer` 内部 Map；也就是说，React render 阶段产生了副作用。必须移除。

---

## 1. 第一优先级：修复 WorkspaceSurface React #185

文件：

```text
src/surfaces/workspace/WorkspaceSurface.tsx
```

### 1.1 删除导入

找到：

```ts
import { StreamCoalescer } from '../../features/chat/StreamCoalescer';
```

删除。

### 1.2 删除 coalescerRef

找到：

```ts
const coalescerRef = useRef(new StreamCoalescer());
```

删除。

### 1.3 增加稳定空数组

在 `type ViewMode = ...` 后面增加：

```ts
const EMPTY_RUNTIME_EVENTS: RuntimeEvent[] = [];
```

### 1.4 替换 fabricChatEvents selector

把原来的：

```ts
const fabricChatEvents = useRuntimeFabricStore(
  useCallback((s) => activeTabId ? (s.chatEvents[activeTabId] ?? []) : [], [activeTabId])
);
```

替换成：

```ts
const fabricChatEvents = useRuntimeFabricStore(
  useCallback(
    (s) => (activeTabId ? (s.chatEvents[activeTabId] ?? EMPTY_RUNTIME_EVENTS) : EMPTY_RUNTIME_EVENTS),
    [activeTabId]
  )
);
```

### 1.5 替换 events useMemo

把当前整个 `const events = useMemo(() => { ... coalescerRef.current.feed ... }, ...)` 替换成纯函数版本：

```ts
const events = useMemo(() => {
  const merged = [...rawEvents, ...fabricChatEvents];
  const byId = new Map<string, RuntimeEvent>();

  for (const evt of merged) {
    byId.set(evt.id, evt);
  }

  return Array.from(byId.values()).sort((a, b) => {
    const at = Date.parse(a.createdAt || '');
    const bt = Date.parse(b.createdAt || '');
    if (Number.isNaN(at) || Number.isNaN(bt)) return 0;
    return at - bt;
  });
}, [rawEvents, fabricChatEvents]);
```

### 1.6 修复 runtime:event 监听重复安装

当前代码每次 activeTabId 改变都重新 listen，这可以保留，但建议改成稳定 ref，避免闭包旧值问题。替换为：

```ts
const activeTabIdRef = useRef<string | null>(null);

useEffect(() => {
  activeTabIdRef.current = activeTabId;
}, [activeTabId]);

useEffect(() => {
  let cancelled = false;
  let cleanup: UnlistenFn | null = null;

  listen<RuntimeEvent>('runtime:event', (e) => {
    const current = activeTabIdRef.current;
    if (current && e.payload.sessionId === current) {
      setRawEvents((prev) => {
        if (prev.some((x) => x.id === e.payload.id)) return prev;
        const next = [...prev, e.payload];
        return next.length > 500 ? next.slice(-200) : next;
      });
    }
  }).then((fn) => {
    if (cancelled) fn();
    else cleanup = fn;
  });

  return () => {
    cancelled = true;
    cleanup?.();
  };
}, []);
```

---

## 2. 第二优先级：把流式 coalesce 移到 store，而不是 render 阶段

文件：

```text
src/features/runtime-fabric/stores/runtimeFabricStore.ts
```

### 2.1 增加 action

在 interface 中增加：

```ts
upsertAssistantDelta: (sessionId: string, channelId: string, delta: string) => void;
```

### 2.2 实现 action

在 store 内增加：

```ts
upsertAssistantDelta: (sessionId, channelId, delta) => {
  set((state) => {
    const prev = state.chatEvents[sessionId] ?? [];
    const streamId = `assistant-stream-${channelId}`;
    const existingIndex = prev.findIndex((e) => e.id === streamId);

    const now = new Date().toISOString();

    if (existingIndex >= 0) {
      const next = [...prev];
      const old = next[existingIndex];
      next[existingIndex] = {
        ...old,
        content: `${old.content ?? ''}${delta}`,
        createdAt: old.createdAt || now,
      };
      return {
        chatEvents: {
          ...state.chatEvents,
          [sessionId]: next.slice(-500),
        },
      };
    }

    return {
      chatEvents: {
        ...state.chatEvents,
        [sessionId]: [
          ...prev,
          {
            id: streamId,
            sessionId,
            projectId: '',
            type: 'assistant_message',
            content: delta,
            severity: 'low',
            createdAt: now,
          } as RuntimeEvent,
        ].slice(-500),
      },
    };
  });
},
```

---

## 3. 第三优先级：修改 RuntimeFabricEventBridge

文件：

```text
src/features/runtime-fabric/services/runtimeFabricEventBridge.ts
```

### 3.1 替换 assistant_delta append

找到：

```ts
if (text) {
  useRuntimeFabricStore.getState().appendChatEvent(
    p.sessionId,
    makeRuntimeEvent(p.sessionId, 'assistant_delta', text)
  );
}
```

替换为：

```ts
if (text) {
  useRuntimeFabricStore.getState().upsertAssistantDelta(p.sessionId, p.channelId, text);
}
```

### 3.2 chat-exit 不要把 session 置 failed

当前：

```ts
useRuntimeFabricStore.getState().patchSession(p.sessionId, {
  status: p.code === 0 ? 'idle' : 'failed',
  error: p.code === 0 ? null : `chat exited with code ${p.code}`,
});
```

替换为：

```ts
useRuntimeFabricStore.getState().patchSession(p.sessionId, {
  status: 'idle',
  error: p.code === 0 ? null : `last chat turn exited with code ${p.code}`,
});
```

原因：一次 Chat turn 失败不等于整个会话死亡。不能让 UI 永久禁用输入框。

---

## 4. 第四优先级：修复 Windows Terminal 和 PATH 误判

文件：

```text
src-tauri/src/setup/detector.rs
```

### 4.1 替换 check_windows_terminal

当前实现使用：

```rust
C:\Users\*\AppData\Local\Microsoft\WindowsApps\wt.exe
```

Rust 的 `Path` 不会展开 `*`，所以必然误判。替换整个函数：

```rust
fn check_windows_terminal() -> SetupCheckResult {
    let out = run_cmd_shell("where.exe wt");

    if out.success && !out.stdout.trim().is_empty() {
        let mut r = check("Windows Terminal", "windowsTerminal", true, false);
        r.paths = out.stdout.lines().map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
        r.method = Some("where.exe wt".to_string());
        return r;
    }

    let mut candidates = Vec::new();

    if let Ok(local_appdata) = std::env::var("LOCALAPPDATA") {
        candidates.push(std::path::PathBuf::from(local_appdata).join(r"Microsoft\WindowsApps\wt.exe"));
    }

    if let Ok(userprofile) = std::env::var("USERPROFILE") {
        candidates.push(std::path::PathBuf::from(userprofile).join(r"AppData\Local\Microsoft\WindowsApps\wt.exe"));
    }

    for p in candidates {
        if p.exists() {
            let mut r = check("Windows Terminal", "windowsTerminal", true, false);
            r.paths = vec![p.to_string_lossy().to_string()];
            r.method = Some("known path".to_string());
            return r;
        }
    }

    let mut r = check("Windows Terminal", "windowsTerminal", false, false);
    r.status = "warning".to_string();
    r.fix_hint = Some("winget install Microsoft.WindowsTerminal".to_string());
    r
}
```

### 4.2 替换 check_path_env

PATH 不应当通过字符串包含 `npm` / `node` 来判断。实际应该用 `where.exe` 证明命令可解析。

替换整个函数：

```rust
fn check_path_env() -> SetupCheckResult {
    let node = run_cmd_shell("where.exe node");
    let npm = run_cmd_shell("where.exe npm");
    let claude_cmd = run_cmd_shell("where.exe claude.cmd");
    let claude = run_cmd_shell("where.exe claude");
    let wt = run_cmd_shell("where.exe wt");

    let node_ok = node.success && !node.stdout.trim().is_empty();
    let npm_ok = npm.success && !npm.stdout.trim().is_empty();
    let claude_ok = (claude_cmd.success && !claude_cmd.stdout.trim().is_empty())
        || (claude.success && !claude.stdout.trim().is_empty());

    let ok = node_ok && npm_ok;

    let mut r = check("PATH 环境", "pathEnv", ok, false);
    r.required = false;
    r.status = if ok { "ok".to_string() } else { "warning".to_string() };
    r.installed = ok;
    r.ok = ok;

    r.details = serde_json::json!({
        "node": node.stdout,
        "npm": npm.stdout,
        "claude": claude.stdout,
        "claudeCmd": claude_cmd.stdout,
        "wt": wt.stdout,
        "nodeOk": node_ok,
        "npmOk": npm_ok,
        "claudeOk": claude_ok
    });

    if !ok {
        r.fix_hint = Some("PATH 可疑：请检查 Node.js 和 npm 是否可通过 where.exe 找到。".to_string());
    }

    r
}
```

### 4.3 required_ok 不应包括 PATH

确认 `pathEnv.required = false`。环境 ready 应由 `selected_chat_command_id` 和核心组件决定，不由 PATH 字符串决定。

---

## 5. 第五优先级：修复 Claude Code CLI 解析策略

当前截图显示：

```text
C:\Users\48304\AppData\Roaming\npm\claude exists=true
version FAIL
%1 不是有效的 Win32 应用程序 (os error 193)
```

这说明程序仍在尝试直接运行 npm 生成的 extensionless `claude`。这是错误的。

正确顺序：

```text
1. Native claude.exe
2. npm package cli-wrapper.cjs via node.exe
3. npm package cli.js / cli.cjs / cli.mjs legacy fallback via node.exe
4. APPDATA\npm\claude.cmd via cmd.exe only as fallback
5. npx diagnostic only，不作为正式 Chat/Terminal 默认入口
```

文件：

```text
src-tauri/src/runtime_v2/claude_command_resolver.rs
```

### 5.1 增加 npm cli-wrapper.cjs 搜索

新增函数：

```rust
fn find_claude_npm_wrapper_candidates() -> Vec<PathBuf> {
    let mut roots = Vec::new();

    if let Ok(appdata) = env::var("APPDATA") {
        roots.push(PathBuf::from(appdata).join("npm").join("node_modules"));
    }

    if let Some(root) = npm_root_g() {
        roots.push(root);
    }

    let rels = [
        r"@anthropic-ai\claude-code\cli-wrapper.cjs",
        r"@anthropic-ai\claude-code\cli.js",
        r"@anthropic-ai\claude-code\cli.cjs",
        r"@anthropic-ai\claude-code\cli.mjs",
        r"@anthropic-ai\claude-code\index.js",
        r"@anthropic-ai\claude-code\index.mjs",
        r"claude-code\cli-wrapper.cjs",
        r"claude-code\cli.js",
    ];

    let mut out = Vec::new();
    for root in roots {
        for rel in rels {
            let p = root.join(rel);
            if p.exists() {
                out.push(p);
            }
        }
    }
    out
}
```

### 5.2 增加 node wrapper spec

新增函数：

```rust
fn node_wrapper_spec(path: PathBuf, source: &str) -> Option<ClaudeCommandSpec> {
    let node = find_node_exe()?;
    Some(ClaudeCommandSpec {
        id: format!("node-wrapper-{}", sanitize(&path.to_string_lossy())),
        label: "Node + Claude npm wrapper".to_string(),
        program: node.to_string_lossy().to_string(),
        args_prefix: vec![path.to_string_lossy().to_string()],
        kind: "nodeWrapper".to_string(),
        source: source.to_string(),
        version_ok: false,
        version_text: None,
        print_ok: false,
        interactive_pty_ok: false,
        selectable_for_chat: false,
        selectable_for_terminal: false,
        error: None,
    })
}
```

### 5.3 在 discover_claude_commands 中加入

在 npm optional native 扫描后加入：

```rust
for p in find_claude_npm_wrapper_candidates() {
    if let Some(spec) = node_wrapper_spec(p, "npm global @anthropic-ai/claude-code wrapper") {
        specs.push(spec);
    }
}
```

### 5.4 inspect_spec 中增加 nodeWrapper

```rust
"nodeWrapper" => {
    spec.selectable_for_chat = true;
    spec.selectable_for_terminal = true;
    spec.interactive_pty_ok = true;
}
```

### 5.5 select_for_chat 优先级

不要 `.find()` 随机取第一个。新增：

```rust
fn command_rank(spec: &ClaudeCommandSpec, for_terminal: bool) -> i32 {
    if !spec.version_ok {
        return 10_000;
    }

    match spec.kind.as_str() {
        "nativeExe" => 0,
        "nodeWrapper" => 10,
        "cmdShim" => if for_terminal { 40 } else { 30 },
        "gitBash" => 50,
        _ => 1000,
    }
}
```

替换 `select_for_chat()`：

```rust
pub fn select_for_chat() -> Result<ClaudeCommandSpec, String> {
    let mut specs: Vec<_> = discover_claude_commands()
        .into_iter()
        .filter(|s| s.version_ok && s.selectable_for_chat)
        .collect();

    specs.sort_by_key(|s| command_rank(s, false));

    specs.into_iter().next().ok_or_else(|| {
        "No Claude command available for Chat. Install Claude Code CLI or run Setup Center.".to_string()
    })
}
```

替换 `select_for_terminal()`：

```rust
pub fn select_for_terminal() -> Result<ClaudeCommandSpec, String> {
    let mut specs: Vec<_> = discover_claude_commands()
        .into_iter()
        .filter(|s| s.version_ok && s.selectable_for_terminal && s.interactive_pty_ok)
        .collect();

    specs.sort_by_key(|s| command_rank(s, true));

    specs.into_iter().next().ok_or_else(|| {
        "No Claude command available for Terminal PTY. Install native Claude Code or npm wrapper, then run diagnostics.".to_string()
    })
}
```

### 5.6 build_invocation 增加 nodeWrapper

在 `build_invocation` match 中增加：

```rust
"nodeWrapper" => {
    let mut args = spec.args_prefix.clone();
    args.extend(claude_args.iter().cloned());
    ResolvedInvocation {
        program: spec.program.clone(),
        args,
    }
}
```

---

## 6. 第六优先级：chat_stream.rs 必须使用 build_invocation

文件：

```text
src-tauri/src/runtime_v2/chat_stream.rs
```

### 6.1 修改 import

把：

```rust
use super::claude_command_resolver::select_for_chat;
```

替换成：

```rust
use super::claude_command_resolver::{build_invocation, select_for_chat};
```

### 6.2 替换 args 构造与 Command::new

所有 Claude 参数都先放入：

```rust
let mut claude_args = vec![
    "-p".to_string(),
    req.prompt.clone(),
    "--output-format".to_string(),
    "stream-json".to_string(),
    "--include-partial-messages".to_string(),
    "--verbose".to_string(),
];
```

后续 `--session-id` / `--model` / `--permission-mode` / `--max-turns` 全部追加到 `claude_args`。

最后：

```rust
let invocation = build_invocation(&spec, &claude_args);

let mut child = Command::new(&invocation.program)
    .args(&invocation.args)
```

---

## 7. 第七优先级：runtime_manager.rs 也必须使用 build_invocation

文件：

```text
src-tauri/src/runtime_v2/runtime_manager.rs
```

### 7.1 修改 import

把：

```rust
use super::claude_command_resolver::{select_for_terminal, ClaudeCommandSpec};
```

替换成：

```rust
use super::claude_command_resolver::{build_invocation, select_for_terminal};
```

### 7.2 删除本地 build_command_for_spec / shell_quote_args

删除：

```rust
fn build_command_for_spec(...)
fn shell_quote_args(...)
```

### 7.3 替换启动处

把：

```rust
let spec = select_for_terminal()?;
let (program, args) = build_command_for_spec(&spec, &req);
```

替换为：

```rust
let spec = select_for_terminal()?;
let cli_args = build_interactive_args(&req);
let invocation = build_invocation(&spec, &cli_args);
let program = invocation.program;
let args = invocation.args;
```

---

## 8. 第八优先级：Console 页面字体与卡片布局止血

新增 / 修改：

```text
src/styles/typography.css
```

确保存在统一层级：

```css
:root {
  --cc-font-xs: calc(12px * var(--cc-font-scale, 1));
  --cc-font-sm: calc(13px * var(--cc-font-scale, 1));
  --cc-font-md: calc(14px * var(--cc-font-scale, 1));
  --cc-font-lg: calc(16px * var(--cc-font-scale, 1));
  --cc-font-xl: calc(20px * var(--cc-font-scale, 1));
  --cc-font-2xl: calc(28px * var(--cc-font-scale, 1));
  --cc-font-3xl: calc(34px * var(--cc-font-scale, 1));

  --cc-line-tight: 1.15;
  --cc-line-normal: 1.45;
  --cc-line-relaxed: 1.65;
}
```

Console 卡片区必须使用：

```css
.cc-dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
  align-items: stretch;
}

.cc-dashboard-card {
  min-width: 0;
  overflow: hidden;
}
```

---

## 9. 验证命令

```bash
npm run typecheck
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
npm test
```

---

## 10. 手动验收

```text
[ ] 打开 Workspace 不再出现 React #185。
[ ] Chat 页面空会话不崩溃。
[ ] Windows Terminal 检测不再误判。
[ ] PATH 检测不再误判。
[ ] Diagnostics 不再直接运行 C:\Users\...\npm\claude。
[ ] Chat 启动使用 native exe 或 node + cli-wrapper.cjs。
[ ] Terminal 点击后才启动 PTY。
[ ] Terminal 失败不影响 Chat。
[ ] Console 卡片不重叠。
[ ] 字体大小统一。
```
