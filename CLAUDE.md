# Ctrl-CC Project Memory — Stability-First Desktop Runtime Platform v7.0

> **Read-first rule**: Before ANY code change, read @docs/engineering/00_READ_FIRST.md and relevant engineering docs.

**版本**: v0.1.0 | **架构**: RuntimeBridge 5.0 (单入口 Runtime) | **语言**: zh-CN
**框架**: Tauri v2 + React 18 + TypeScript 5 + Zustand 5 + Vite 6
**视觉**: Neo Calm Industrial — 四主题 (暖沙/浅色/浅蓝/深色) + 热切换 i18n

---

## Non-negotiable architecture rules (20 rules)

1. All surfaces must use RuntimeBridge. No page may directly invoke PTY or Claude commands.
2. RuntimeKernel owns Claude discovery, shell strategy, PTY lifecycle, session registry, orphan cleanup.
3. Projects/Console/Dock/Resources/Diagnostics must not spawn Claude or PTY directly.
4. Workspace Terminal = raw PTY view. ChatSemanticPane = semantic only.
5. ChatComposer writes through `RuntimeBridge.write(uiSessionId, text + "\r")`.
6. Interactive Claude Code → PTY + `claude`. `claude -p` → structured tasks ONLY.
7. PTY raw output → xterm, raw log, bounded tail buffer ONLY. NOT React state.
8. All runtime errors → RuntimeEventStore + ErrorLog + Session Timeline + Diagnostic Bundle.
9. Store actions MUST be idempotent (`if (state.x === next) return state`).
10. No side effects during render. No useEffect updating its own dependencies.
11. Tauri commands return < 1s. Long work → background thread.
12. New Session → Workspace within 1s, before PTY is ready.
13. No silent failure. No fake success. Error always visible + classified + copyable.
14. Before every change: run /preflight, typecheck, build, cargo check.
15. Never bypass RuntimeBridge contract from any UI surface.
16. Shell strategy: PowerShell preferred over cmd.exe (0xc0000142 mitigation).
17. Composer disabled until session.status is pty-ready/claude-active.
18. PTY tail max 32KB/session. ErrorLog max 200. RuntimeEvents max 200.
19. Stop kills child process + removes from registry. No orphans.
20. Design tokens ONLY (`--cc-*`). No hard-coded colors.

## Debug log paths
- Rust: `%TEMP%/ctrl-cc-runtime-debug.log`
- React: `localStorage['ctrlcc:last-react-error']`, `localStorage['ctrlcc:render-loop']`
- Diagnostic bundle: `invoke('runtime_smoke_test')` or `collectDiagnosticsBundle()`

## Engineering docs (read before coding)
@docs/engineering/00_READ_FIRST.md through @docs/engineering/11_AGENT_OPERATING_PROTOCOL.md

---

## 编程行为准则：八荣八耻

所有代码编写/修改前必须逐条对照检查：

1. **以暗猜接口为耻，以认真查阅为荣** → 不确定的接口/API 先查阅文档或源码再使用
2. **以模糊执行为耻，以寻求确认为荣** → 需求不明确时向用户确认后再执行
3. **以盲想业务为耻，以人类确认为荣** → 业务逻辑必须以用户确认为准，不自作主张
4. **以创造接口为耻，以复用现有为荣** → 优先复用现有接口/工具函数/组件，避免重复造轮子
5. **以跳过验证为耻，以主动测试为荣** → 写完代码后主动运行 `npm run typecheck` + `cargo check` + `npm test`
6. **以破坏架构为耻，以遵循规范为荣** → 严格遵循项目现有架构、目录结构、命名规范、设计系统
7. **以假装理解为耻，以诚实无知为荣** → 不理解时坦诚说明，不假装懂得代码逻辑
8. **以盲目修改为耻，以谨慎重构为荣** → 修改前充分理解现有代码，评估影响范围后再动手

---

## 核心哲学

Ctrl-CC = Claude Code CLI 的**可视化操作系统**，不是替代品。

**六个核心职责**: 承载 → 输入 → 显示 → 解析 → 管理 → 增强

**三个边界**:
1. 不复现 Claude Code 内部 agent loop，100% 承载其原生交互行为
2. 对所有公开可观察信息 200% 可视化
3. 通过 GUI 操作层实现 500% 的可操作性和可管理性

**设计原则 (八荣) — 视觉层面**:
1. 以语义变量为荣，以硬编码颜色为耻 — 全部 `--cc-*` CSS 变量
2. 以系统字体为荣，以外部加载为耻 — Inter + Noto Sans SC + JetBrains Mono
3. 以轻量动效为荣，以花哨动画为耻 — 120ms/180ms/260ms 三级
4. 以分层布局为荣，以平面堆砌为耻 — surface/card/elevated 视觉深度
5. 以WCAG对比为荣，以低可读性为耻 — body 4.5:1, UI 3:1
6. 以即时响应为荣，以延迟卡顿为耻 — transition < 200ms
7. 以组件复用为荣，以样式散落为耻 — Cc* 组件 + .cc-* CSS 类
8. 以设计一致为荣，以各自为政为耻 — 统一 design tokens + theme registry

---

## 技术栈

| 层 | 技术 |
|---|---|
| 桌面框架 | Tauri v2 (Rust 2021) |
| 前端 | React 18 + TypeScript 5.6 + Vite 6 |
| 状态管理 | Zustand v5 |
| 样式 | CSS Custom Properties (`--cc-*` tokens) + 全局 CSS 类 |
| 终端 | xterm.js 6 + @xterm/addon-fit/search/webgl |
| 持久化 | SQLite (rusqlite, bundled) |
| PTY | portable-pty (Claude CLI 伪终端) |
| i18n | i18next + react-i18next + LanguageDetector |
| 测试 | Vitest 4 (jsdom) + @testing-library/react |
| 打包 | NSIS installer (Windows, currentUser) |

## 项目目录

```
src/
├── app/           # App root (App.tsx + AppShell.tsx + SurfaceHost.tsx)
├── components/    # dock/ error/ layout/ ui/ (Cc* reusable components)
├── debug/         # useRenderLoopGuard.ts (React #185 prevention)
├── design/        # theme-types.ts, theme-registry.ts, xterm-themes.ts
├── features/      # 功能模块 (chat/ composer/ console/ dock/ projects/ resources/ runtime/ terminal/ workspace/)
├── i18n/          # index.ts + locales/zh.json + locales/en.json
├── services/      # invokeCommand.ts
├── stores/        # Zustand stores (app/project/session/surface/error/audit/openSession)
├── styles/        # tokens.css (四主题) + global.css + terminal.css + error.css
├── surfaces/      # canvas/ console/ github/ projects/ resources/ settings/ workspace/
└── types/         # domain.ts, index.ts
```

## 视觉设计系统

### 四主题色彩 (60-30-10 法则)

| ID | 名称 | 情绪 | Brand色 | bg色 |
|----|------|------|--------|------|
| warm-sand | 暖沙 Claude | 温暖亲切纸张感 | #D4A574 | #FAF8F2 |
| light | 浅色 | 干净通透轻盈 | #3B82F6 | #F9F9F8 |
| pale-blue | 浅蓝 | 清澈理性科技 | #4F8CDF | #F4F7FB |
| dark | 深色 | 沉稳专注低光 | #D4A574 | #0F0F14 |

### 字体系统
```css
--cc-font-sans: 'Inter', 'Noto Sans SC', system-ui, 'Microsoft YaHei UI', 'PingFang SC', sans-serif;
--cc-font-mono: 'JetBrains Mono', 'Sarasa Mono SC', 'Cascadia Code', ui-monospace, monospace;
```
字号阶梯: 2xs(11) xs(12) sm(13) md(14) lg(16) xl(20) 2xl(26) 3xl(34)
行高: tight(1.25) normal(1.50) relaxed(1.70)

### 动效系统
| 时长 | 用途 | 曲线 |
|------|------|------|
| 120ms | 微交互 (hover/click) | spring |
| 180ms | 状态切换 (tab/expand/主题) | standard |
| 260ms | 页面过渡 (模态/路由) | ease-out |

### 间距与圆角
间距: 8px 基准网格 (0,4,8,12,16,20,24,32,40,48,64)
圆角: sm(8) md(12) lg(16) xl(20) 2xl(24) full(9999)

---

## Rust 后端结构

```
src-tauri/src/
├── main.rs          # 入口: 日志, DB, 命令注册, 托盘
├── commands/        # 命令模块 (audit/fs/git/scanner/statusline等)
├── runtime/         # Claude PTY 运行时, NDJSON 解析器
├── pty/             # PTY 会话管理, 日志, 解析器
├── db/              # SQLite 初始化 + 迁移
├── repository/      # 仓储模式
├── safety/          # 自动信任引擎, 风险检测
└── error.rs         # thiserror 错误类型
```

## 编码规范

### TypeScript
- `strict: true`，禁止 `any`（用 `unknown` + 类型收窄）
- 组件 props 使用命名 `interface`
- 所有 IPC 调用通过 `src/services/invokeCommand.ts`
- 优先复用现有 stores/hooks/services

### React
- 函数组件 + 命名 props 接口
- 所有 Surface 使用 `useTranslation()` 实现 i18n
- 状态管理: Zustand v5，不可变更新

### CSS
- **始终使用 `--cc-*` CSS 自定义属性**（禁止硬编码颜色/间距/圆角/shadow/z-index）
- 4 主题通过 `[data-theme="..."]` 切换
- 动效仅作用于 compositor 属性 (transform, opacity)
- 主题切换统一 180ms `ease-standard` 过渡

### Rust
- 错误: `thiserror::Error` derive
- 所有命令在 `main.rs` 的 `generate_handler![]` 注册
- Repository 定义 trait 以便测试 mock
- 禁止 `unwrap()` — 使用 `?` 或 `expect()` (仅限启动阶段)

## 构建命令

```bash
npm run dev           # Vite dev server (port 1420)
npm run build         # tsc --noEmit + vite build
npm run tauri:dev     # Tauri 开发模式
npm run tauri:build   # 生产构建 → NSIS 安装程序
npm run typecheck     # tsc --noEmit
npm test              # vitest run

cargo check --manifest-path src-tauri/Cargo.toml   # Rust 快速类型检查
cargo build --release --manifest-path src-tauri/Cargo.toml  # Release 构建
```

**生产构建流程**: `npm run build` → `cargo build --release` → NSIS `.exe` installer

## 工作目录约束

- **正确项目路径**: `G:/Claude Code/ctrl-cc`
- **禁止在旧项目上工作**: `G:/claude-code/ctrl-cc` (v9.2.0, 已废弃)

## 关键约束

- 所有 Surface 文本必须使用 `t()` 函数（i18n 热切换）
- 默认语言中文 (`lng: 'zh'`, `fallbackLng: 'zh'`)
- 语言切换不刷新页面 (`i18n.changeLanguage()`)
- 主题切换不重载组件 (`document.documentElement.dataset.theme = ...`)
- 每次修改后必须 `npm run typecheck` 和 `cargo check` 通过
- 禁止假数据/假按钮/假状态 — 所有 UI 必须真实可用
- 高风险操作永不自动通过

## 设计规范引用

- 完整视觉系统: `Ctrl-CC_vNext_Four_Theme_Visual_System_Plan.md`
- 当前执行方案: `C:\Users\48304\.claude\plans\ctrl-cc-chat-chat-with-claude-code-composed-riddle.md`
