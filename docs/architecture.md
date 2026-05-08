# Ctrl-CC vNext 全层架构

## 产品定位

Ctrl-CC = **Claude Code CLI 的 PTY-first GUI Operating Layer** = **AI Coding Control Plane for Claude Code**

Ctrl-CC 不是 Claude Code 的替代品，而是其可视化操作系统。它通过真实 PTY 承载 Claude Code CLI，并通过 GUI 提供输入、显示、解析、审计、安全控制和资源管理。

## 核心哲学

1. **不复现 Claude Code 内部实现** — Claude Code 的内部 agent loop、模型调度、上下文压缩策略、权限判断细节等不是公开 API。Ctrl-CC 尊重这一边界，只承载官方 CLI。
2. **PTY-first 架构** — 交互式会话默认通过 portable-pty/ConPTY 运行 Claude Code CLI，stream-json 降级为辅助通道。
3. **诚实的能力边界** — 内部私有状态标注"未由当前 Claude Code CLI 暴露"，不伪造。

## 六层核心职责

```
1. 承载 — 真实运行 Claude Code CLI
2. 输入 — Chat / Terminal / Command Center / Dock 多入口输入
3. 显示 — Terminal 原始显示 + Chat 语义卡片显示
4. 解析 — raw output → RuntimeEvent
5. 管理 — 项目、会话、资源、权限、风险、审计
6. 增强 — 多会话、Worktree、自动托管、可视化、测试闭环
```

## 技术栈

| 层 | 技术 |
|---|---|
| 桌面框架 | Tauri v2 (Rust 2021 edition) |
| 前端 | React 18 + TypeScript 5 + Vite 6 |
| 状态管理 | Zustand v5 |
| 终端 | xterm.js 6 + portable-pty 0.9 (ConPTY on Windows) |
| 持久化 | SQLite (rusqlite 0.32, bundled) |
| 样式 | CSS 自定义属性 (Neo Calm Industrial 2.0) |

## 九层架构

```
L1 用户侧       — 用户角色、目标、工作流
L2 交互入口层    — Console, Projects, Workspace, Resources, Canvas, GitHub, Settings
L3 前端表现层    — AppShell, ChatWorkbench, TerminalPanel, Inspector, Cc* 组件
L4 前端状态层    — Zustand Stores, Frontend Services
L5 核心能力层    — 项目管理、会话管理、资源管理、风险与安全、审计追踪、Git 集成、Agent 可视化
L6 Runtime 层   — PtyInteractiveRuntime, StructuredPrintRuntime, RuntimeCoordinator
L7 Rust 后端    — Tauri Commands, PtySessionManager, EventNormalizer, Resource Scanner
L8 数据持久层    — SQLite, Raw Logs, Local Config, Cache
L9 外部系统      — Claude Code CLI, Claude/Anthropic, Git/GitHub, MCP Servers
```

## 数据流

```
用户操作 → GUI 组件 → Zustand Store / Service → Tauri Command
→ Rust backend / PTY / FileSystem / Git / Resource Scanner
→ SQLite / Raw Log
→ RuntimeEvent / AuditLog / RiskItem / FileChange
→ Surface / Inspector / Dock / Console 同步更新
```

## 禁止

- UI 直接 spawn 进程
- UI 直接读写 SQLite
- UI 绕过 AuditLog / RiskEngine
- 假数据驱动 UI
- 伪造 Claude Code 内部状态
- 保存明文密钥
- 自动通过高风险操作
