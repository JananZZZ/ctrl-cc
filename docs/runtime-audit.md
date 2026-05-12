# Ctrl-CC Runtime Audit Report

**日期**: 2026-05-11
**Claude CLI**: v2.1.138 (authenticated, firstParty)
**路径**: `C:\Users\48304\AppData\Roaming\npm\claude`

---

## 项目结构

```
src-tauri/src/
├── main.rs              # 入口 — 直接内联，无 lib.rs
├── error.rs             # AppError (thiserror)
├── runtime/             # stream-json runtime (structured-print)
│   ├── mod.rs           # 模块声明
│   ├── event_types.rs   # ClaudeEvent 类型 (serde tagged union)
│   ├── claude_runner.rs # ClaudeSession (std::process::Command, 非 PTY)
│   ├── ndjson_parser.rs # NDJSON 解析 + ChatRuntimeEvent 转换
│   └── commands.rs      # create/stop/send ClaudeChat 命令
├── pty/                 # PTY Data Plane (interactive mode)
│   ├── mod.rs           # 模块声明
│   ├── pty_types.rs     # PtySessionInfo/Status/StartOptions
│   ├── pty_session.rs   # PtySessionHandle (portable-pty + tokio async)
│   ├── pty_manager.rs   # PtyManager (Arc<Mutex<HashMap>>)
│   ├── pty_commands.rs  # 11 个 Tauri 命令
│   ├── pty_log.rs       # 原始日志写入
│   └── pty_parser.rs    # 语义事件解析
└── commands/            # 治理模块 (scanner/statusline/watchdog 等)

src/
├── features/            # 功能模块
│   ├── terminal/usePtyTerminal.ts    # xterm.js ↔ PTY 后端 hook
│   ├── chat/StreamCoalescer.ts       # stream-json 事件聚合
│   ├── chat/ChatBlockRenderer.tsx    # 聊天块渲染
│   ├── chat/MarkdownRenderer.tsx     # Markdown 渲染器
│   └── composer/                     # ComposerBar 子组件
├── surfaces/workspace/   # 工作区 Surface
│   ├── WorkspaceSurface.tsx          # 主控制器
│   ├── TerminalView.tsx              # xterm.js 终端视图
│   ├── ChatView.tsx                  # 聊天视图
│   └── ComposerBar.tsx              # 输入栏
├── services/invokeCommand.ts         # IPC 调用封装
└── stores/                           # Zustand 状态管理
```

## 审计发现

### P0 致命 Bug（已修复）

1. **TerminalView ref 非响应式** — `useRef(container)` 在首次渲染时为 null，
   ref 初始化不触发重渲染，导致 xterm.js 永远无法挂载 DOM。
   **修复**: 改用 `useState` + callback ref 模式。

2. **ComposerBar 不支持 PTY 模式** — `handleSend` 始终调用
   `create_claude_chat` (structured-print)，terminal 模式无法发送输入。
   **修复**: 添加 `runtimeMode === 'pty-interactive'` 分支调用 `pty_v2_write`。

3. **CWD 解析失败** — 选择项目时只传 projectId 不传 path，cwd 默认为 '.'。
   **修复**: 从 projectStore 查找项目路径。

### P1 严重 Bug（已修复）

4. **缺失 8 个 CSS 变量** — `--cc-navy`、`--cc-bg-muted`、`--cc-border-muted`、
   `--cc-text-secondary`、`--cc-text-on-accent`、`--cc-bg-danger-soft`、
   `--cc-bg-warning-soft`、`--cc-bg-success-soft` 被广泛使用但从未定义。
   **修复**: 在 tokens.css `:root` 添加别名映射到已有语义变量。

5. **ChatBlockRenderer 使用未定义变量** — `--cc-accent-blue`、
   `--cc-accent-green`、`--cc-bg-warning-soft`、`--cc-bg-danger-soft`。
   **修复**: 替换为对应的 `--cc-*` 语义变量。

6. **关闭 Tab 不停止 PTY** — 进程泄漏。
   **修复**: `handleCloseTab` 先调用 `pty_v2_stop` 再关闭 tab。

## 验证结果

- TypeScript typecheck: **0 errors** ✅
- Cargo check: **0 errors** ✅ (16 pre-existing warnings)
- 前后端字段名一致: `ChatRuntimeEvent` 使用 `#[serde(rename_all = "camelCase")]` ✅
- PTY 事件 `pty://data`/`pty://status`/`pty://exit`/`pty://error` 正确使用 snake_case ✅

## E2E 数据流

```
用户点击 Start Claude
  → handleStartPtySession → NewSessionDialog
  → 选择项目 → startSessionWithProject(projectId)
  → 从 projectStore 查找 projectPath
  → invokeCommand('pty_start_claude_session', { sessionId, projectId, cliPath, cwd, extraArgs })
  → Rust PtySessionHandle::spawn → portable-pty 创建 PTY
  → cmd /c claude (interactive)
  → 返回 PtySessionInfo { id, sessionId, ... }
  → 加入 sessionStore + openSessionStore (viewMode: 'terminal')
  → WorkspaceSurface 渲染 TerminalView(sessionId)
  → usePtyTerminal hook 创建 xterm Terminal
  → 监听 pty://data → xterm.write(data)
  → xterm.onData → pty_v2_write(sessionId, data)
  → ResizeObserver → pty_v2_resize(sessionId, cols, rows)
  → 关闭 tab → pty_v2_stop(sessionId)
```
