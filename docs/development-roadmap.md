# Ctrl-CC vNext 开发路线图

## Stage 0: 新项目初始化 ✅ 完成

- 项目骨架: Tauri + React + TypeScript
- 目录结构: 前端 + Rust 模块边界
- 视觉 token: tokens.css (Neo Calm Industrial 2.0)
- Cc* 组件: 5 个基础组件
- AppShell + 7 Surface 占位
- 核心 types (18 模型) + stores
- Docs: architecture, surface-design, runtime-pty-first, visual-language, development-roadmap

## Stage 1: Projects Surface (下一步)

顶级项目管理体验: 四栏可折叠布局、工作文件夹树、会话分组、Resume/Fork/Archive、项目预览。

## Stage 2: Workspace / Chat

顶级聊天与终端体验: OpenSessionTabs、Chat View、Terminal View、Split View、ComposerBar、Inspector。

## Stage 3: PTY Runtime

Claude Code CLI 真连接: portable-pty/ConPTY + xterm.js + raw log + semantic parser。

## Stage 4: Surface 融合

Console 驾驶舱、Resources 资源管理、Settings 环境检测、GitHub WebView、Canvas 节点、AI Dock。

## Stage 5: 测试发布

E2E 测试基建、P0/P1 测试、Watchdog、发布验收。

## 构建验证

```bash
npm run typecheck     # tsc --noEmit
npm run build         # vite build
cargo check           # Rust 类型检查
```
