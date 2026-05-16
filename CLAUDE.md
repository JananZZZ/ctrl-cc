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

---

**版本**: v28 | **架构**: RuntimeKernel (唯一 Runtime 入口) | **语言**: zh-CN
**框架**: Tauri v2 + React 18 + TypeScript 5 + Zustand 5 + Vite 6

## 技术栈

| 层 | 技术 |
|---|---|
| 桌面框架 | Tauri v2 (Rust 2021) |
| 前端 | React 18 + TypeScript 5.6 + Vite 6 |
| 状态管理 | Zustand v5 |
| 样式 | CSS Custom Properties (`--cc-*` tokens) |
| 终端 | xterm.js 6 |
| PTY | portable-pty (Claude CLI 伪终端) |
| i18n | i18next + react-i18next |

## 项目目录

```
src/
├── app/           # App root (App.tsx + AppShell.tsx + SurfaceHost.tsx)
├── components/    # dock/ error/ layout/ ui/ (Cc* reusable components)
├── debug/         # useRenderLoopGuard.ts (React #185 prevention)
├── design/        # theme-types.ts, theme-registry.ts, xterm-themes.ts
├── features/      # chat/ composer/ console/ dock/ projects/ resources/ runtime/ terminal/ workspace/ setup/
├── i18n/          # index.ts + locales/
├── runtime-kernel/ # RuntimeKernel types, store, bridge, parsers
├── services/      # invokeCommand.ts
├── stores/        # Zustand stores
├── styles/        # tokens.css + global.css + terminal.css + chat.css + commercial.css
├── surfaces/      # canvas/ console/ github/ projects/ resources/ settings/ workspace/
└── types/         # domain.ts

src-tauri/src/
├── main.rs          # 入口
├── commands/        # 命令模块
├── runtime/         # Claude PTY 运行时
├── runtime_v2/      # Runtime V2
├── runtime_kernel/  # RuntimeKernel (唯一 Runtime 主链路)
├── pty/             # PTY 会话管理
├── setup/           # 环境检测/安装
├── utils/           # hidden_command, command_timeout
├── db/              # SQLite
└── error.rs         # thiserror
```

## 构建命令

```bash
npm run dev           # Vite dev server (port 1420)
npm run build         # tsc --noEmit + vite build
npm run tauri:dev     # Tauri 开发模式
npm run tauri:build   # 生产构建
npm run typecheck     # tsc --noEmit
npm test              # vitest run
cargo check --manifest-path src-tauri/Cargo.toml
cargo build --release --manifest-path src-tauri/Cargo.toml
```

## 关键约束

- 所有 Surface 文本必须使用 `t()` 函数（i18n 热切换）
- 默认语言中文 (`lng: 'zh'`, `fallbackLng: 'zh'`)
- 设计 tokens ONLY (`--cc-*`)。禁止硬编码颜色。
- 每次修改后必须 `npm run typecheck` + `cargo check` 通过
- 禁止假数据/假按钮/假状态
