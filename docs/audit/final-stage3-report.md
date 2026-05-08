# Stage 3 最终审计报告

**日期**: 2026-05-09
**项目**: Ctrl-CC vNext
**分支**: feat/v0.1.0-full-restructure (旧) → G:/Claude Code/ctrl-cc/ (新)

---

## 一、架构变革：PTY-first → 双轨制

### 核心转变

| 维度 | 旧架构 (PTY-first) | 新架构 (双轨制) |
|------|-------------------|----------------|
| Chat 通信 | PTY raw bytes → ANSI 解析 → 尽力提取 | stream-json NDJSON → 结构化事件 → 卡片渲染 |
| 终端交互 | 同上 (混合) | portable-pty → xterm.js (仅数据面) |
| 权限处理 | PTY stdin 注入字符 | SDK Hooks / 未来: canUseTool 回调 |
| 可靠性 | ANSI 解析脆弱/CJK 文本爆炸/状态混乱 | NDJSON 精确解析/零歧义 |
| 可视化 | 纯文本气泡 (3种) | 14种卡片 + Markdown + 流式渲染 |

### 双轨制原理

```
控制面 (Control Plane): claude -p --output-format stream-json
  → NDJSON 结构化事件 → 9种顶层事件 + 6种 content_block
  → Rust event_types.rs + ndjson_parser.rs
  → runtime:event Tauri 事件
  → ChatBlockRenderer (14种卡片)

数据面 (Data Plane): portable-pty + xterm.js
  → Terminal View 原生终端体验
  → Ctrl+C/D, resize, raw log
  → 仅用于 Bash/终端工具
```

---

## 二、已交付功能

### Sprint 1: 架构基础 ✅

| 功能 | 文件 | 状态 |
|------|------|------|
| Rust NDJSON 解析器 | `runtime/event_types.rs` (120行) | ✅ 15+ 事件类型 |
| NDJSON 行解析 | `runtime/ndjson_parser.rs` (130行) | ✅ parse_line + event_to_runtime |
| Claude CLI 管理 | `runtime/claude_runner.rs` (100行) | ✅ spawn/stop/RAII Drop |
| Tauri 命令 | `runtime/commands.rs` (35行) | ✅ create_claude_chat / stop_claude_chat |
| 前端事件管线 | WorkspaceSurface.tsx | ✅ listen('runtime:event') → setEvents |
| Mode Switch | WorkspaceSurface.tsx | ✅ 单 View 渲染 (chat/terminal/split) |
| 流式合并 | StreamCoalescer.ts (50行) | ✅ assistant_delta → 单气泡更新 |

### Sprint 2: 卡片系统 ✅

| 功能 | 文件 | 状态 |
|------|------|------|
| Markdown 渲染器 | MarkdownRenderer.tsx (110行) | ✅ 代码块/标题/列表/粗体/斜体/链接/代码 |
| ChatBlock 渲染器 | ChatBlockRenderer.tsx (180行) | ✅ 14种事件类型 switch |
| 用户气泡 | ChatBlockRenderer | ✅ 右对齐+品牌色+Markdown |
| Claude 气泡 | ChatBlockRenderer | ✅ 左对齐+卡片+token 角标 |
| 工具卡片 | ChatBlockRenderer | ✅ 图标+名称+输入预览 |
| 工具结果 | ChatBlockRenderer | ✅ 可折叠+错误着色 |
| 思考面板 | ChatBlockRenderer | ✅ 可折叠+斜体 |
| 权限卡片 | ChatBlockRenderer | ✅ 警告色+批准/拒绝按钮 |
| 文件变更卡片 | ChatBlockRenderer | ✅ 图标+类型+路径 |
| 命令卡片 | ChatBlockRenderer | ✅ 终端风格 |
| 错误卡片 | ChatBlockRenderer | ✅ 红色边框 |
| 摘要卡片 | ChatBlockRenderer | ✅ 绿色+token/cost/duration |
| Token/Cost 行 | ChatBlockRenderer | ✅ 内联指标 |
| 系统通知 | ChatBlockRenderer | ✅ 居中胶囊 |

### Sprint 3-4: Composer + Session Monitor ✅ (基础版)

| 功能 | 文件 | 状态 |
|------|------|------|
| 4 宽度 Session Monitor | SessionInspector.tsx | ✅ Collapsed/Compact(320px) |
| Statusline 仪表盘 | SessionInspector.tsx | ✅ 模型|tokens|费用|状态 |
| 会话信息卡片 | SessionInspector.tsx | ✅ 状态/模式/模型/权限 |
| 实时指标卡片 | SessionInspector.tsx | ✅ 6指标 3x2网格 |
| 工作目录 | SessionInspector.tsx | ✅ mono 字体 |
| 时间线 | SessionInspector.tsx | ✅ 创建/启动/结束/更新 |
| CWD 修复 | WorkspaceSurface | ✅ '.' → 当前目录 |

### Stage 4-5: Surface 融合 + 测试 ✅

| 功能 | 文件 | 状态 |
|------|------|------|
| Console 驾驶舱 | ConsoleSurface.tsx | ✅ 问候语+统计卡片+快捷入口+最近会话 |
| 7 Surface 导航 | LeftSurfaceRail | ✅ 全部可切换 |
| 测试代码隔离 | 架构设计 | ✅ 测试与发布严格分离 (项目记忆已写入) |
| 最终构建 | Release exe | ✅ ctrl-cc.exe (0 errors) |

---

## 三、尚未完成 (已知限制)

### 功能缺口

| # | 缺口 | 优先级 | 说明 |
|---|------|--------|------|
| 1 | **stream-json 真正跑通** | P0 | 当前 NDJSON 解析器已实现但需端到端验证。`create_claude_chat` 每次发送都是新进程 (claude -p 是一次性的)，需要实现会话历史管理 |
| 2 | **PTY tokio 异步** | P1 | 当前 `supervise_pty_output` 使用 `std::thread` 同步读取。Gemini 建议改用 tokio async 以避免阻塞 |
| 3 | **Session Monitor 完整版** | P1 | 当前只有 Compact 宽度。Expanded/Fullscreen 未实现。缺少 KPI 卡片 (10张)、LiveFlow、AuditStream |
| 4 | **@ 资源选择器 + / 命令面板** | P1 | ComposerBar 中的 @ 和 / 按钮仍为装饰性 |
| 5 | **PreToolUse 权限钩子** | P2 | 需要 SDK 集成。当前权限通过 chat 模式下的 stream-json permission 事件处理 |
| 6 | **会话持久化** | P2 | 会话数据仅在内存 store。关闭应用后丢失 |
| 7 | **Resources/Settings 真实数据** | P2 | 仍为占位页面 |
| 8 | **E2E 测试** | P3 | 测试基础设施未创建 |

---

## 四、当前架构总览

```
G:/Claude Code/ctrl-cc/
├── src/ (前端)
│   ├── app/          AppShell + SurfaceHost + LeftRail (7 Surface 导航)
│   ├── surfaces/     7 Surface: console/projects/workspace/resources/canvas/github/settings
│   ├── features/     chat (StreamCoalescer/MarkdownRenderer/ChatBlockRenderer)
│   │                 terminal (usePtyTerminal)
│   ├── components/   5 Cc* 组件 + layout
│   ├── stores/       5 stores (app/surface/project/session/openSession)
│   ├── services/     invokeCommand
│   └── types/        domain.ts (完整数据模型, 28事件类型)
├── src-tauri/src/ (Rust)
│   ├── pty/          7文件 PTY 数据面 (已从旧项目移植+优化)
│   ├── runtime/      4文件 stream-json 控制面 (新增)
│   │   ├── event_types.rs   15+ NDJSON 事件类型
│   │   ├── ndjson_parser.rs 解析器+转换器
│   │   ├── claude_runner.rs 进程管理
│   │   └── commands.rs      Tauri 命令
│   ├── database/     SQLite 初始化
│   └── main.rs       模块注册+命令注册
└── docs/             架构文档 + 审计报告
```

---

## 五、构建验证

```
tsc --noEmit:     0 errors
vite build:       ✅ (185KB JS)
cargo check:      0 errors (12 pre-existing warnings)
cargo test:       8/8 PASS (PTY parser)
Release exe:      ctrl-cc.exe (14.5 MB)
```

---

## 六、下一步建议

1. **P0 优先**：端到端验证 stream-json Chat 流程（创建一个 session，发送消息，确认 NDJSON 事件到达前端，卡片渲染正确）
2. **会话管理**：实现会话历史持久化（SQLite），支持 resume
3. **Session Monitor 完整版**：实现 LiveFlow/AuditStream/10 KPI 卡片
4. **Composer 增强**：@ 资源选择器，/ 命令面板，模型选择器
