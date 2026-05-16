# Ctrl-CC Engineering Memory

## 项目定位

Ctrl-CC 是 Claude Code CLI 的商用级图形化控制台，不是 Claude 桌面端替代品。  
它必须帮助小白用户完成环境部署、配置 API、创建项目、启动 Claude Code CLI、通过 Chat 或 Terminal 连续交互，并提供可视化诊断、权限控制、资源管理、GitHub 浏览和 AI Dock。

## 最高优先级

1. UI 永不因耗时任务未响应。
2. 一个 GUI session 对应一个长期存活 Runtime session。
3. Chat、Terminal、Split 是同一个 Runtime session 的不同视图。
4. 所有环境检测数据统一进入 setupStore。
5. 所有后台任务统一进入 Task Registry。
6. 所有错误统一进入 Diagnostic Ledger。
7. 默认中文。
8. 默认浅色主题。
9. 所有功能必须小白友好。
10. 所有复杂代码必须有中文注释。

## Runtime 硬规则

- 创建 GUI session 时可创建 Runtime。
- 发送 Chat 消息绝不能隐式创建新 Runtime。
- Terminal 输入必须调用 writeTerminal。
- Chat 输入必须调用 submitUserMessage。
- Close Tab 默认 detach，不杀后台 Runtime。
- Stop Runtime 才杀进程。
- Kill Runtime 才强杀进程。
- Runtime 输出必须同时进入 raw event ledger、terminal buffer、chat projection。
- 任何丢输出、重复输出、错序输出都必须视为严重 bug。

## Setup 硬规则

- 首次启动必须完整引导语言、主题、字体、工作方式、环境检测、修复依赖、API 配置、Chat 设置、AI Dock、权限、GitHub、最终验证。
- 环境检测必须逐项显示。
- 环境检测必须可暂停、继续、终止、重新检测、退出软件。
- 环境检测失败必须显示失败项、错误明细、修复建议、复制诊断包。
- Console、Settings、FirstRun、Diagnostics 使用同一个 setupStore snapshot。

## UI 硬规则

- 最小正常文字不低于 12px。
- 正文字号默认约 15px。
- 所有页面使用统一 Design Token。
- 主题只有 light、dark、pale-blue、warm-sand 四种。
- 默认主题是 light。
- 所有中文文案必须温和、清楚、礼貌。
- 所有页面必须小窗口和全屏都不重叠、不空洞。

## 性能硬规则

- 不允许 render 阶段写 store/localStorage/invoke。
- 不允许高频 setState 形成 render loop。
- 后端长任务必须 spawn_blocking 或异步任务。
- 外部命令必须隐藏窗口运行。
- 事件流必须批处理，不允许每字符触发重渲染。

---

**版本**: v29 | **架构**: RuntimeKernel (唯一 Runtime 入口) + Task Registry (全局任务系统) | **语言**: zh-CN
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
├── core/          # tasks/ lifecycle/ settings/ diagnostics/
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
├── task_control/    # 全局任务控制器
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
- 全局任务系统: 所有超 300ms 的操作必须进入 Task Registry
- 任务策略: safe-background / confirm-on-leave / cancel-on-leave / critical-noninterruptible / destructive-confirm
- 页面切换时必须检查 blockingTasks()，必要时显示 NavigationGuardModal
- 所有后台任务通过 task://progress 事件推送，前端订阅而非轮询
