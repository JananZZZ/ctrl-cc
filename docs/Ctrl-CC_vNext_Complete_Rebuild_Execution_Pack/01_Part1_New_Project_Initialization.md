# Part 1：Ctrl-CC vNext 新项目初始化执行文档

> 本文档可直接发送给 Claude Code。  
> 目标：在 `G:/Claude Code/ctrl-cc/` 下创建全新的 Ctrl-CC vNext 项目骨架。  
> 本阶段只搭建干净架构、统一视觉、基础 Surface 和核心类型，不实现完整 Claude Code Runtime。

---

## 1. 阶段目标

创建全新项目：

```text
G:/Claude Code/ctrl-cc/
```

不要修改旧项目，不要从旧项目复制业务代码。

本阶段完成：

```text
1. 新建 Tauri + React + TypeScript 项目
2. 建立前端模块边界
3. 建立 Rust/Tauri 后端模块边界
4. 建立统一设计 token
5. 建立基础 Cc* 组件
6. 建立 AppShell + 左侧 Surface 导航
7. 建立 7 个 Surface 占位页面
8. 建立核心类型和 store
9. 建立 docs 架构文档
10. 建立基本构建检查
```

---

## 2. 推荐目录结构

```text
G:/Claude Code/ctrl-cc/
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   ├── AppShell.tsx
│   │   ├── SurfaceHost.tsx
│   │   ├── SurfaceRegistry.ts
│   │   └── boot/
│   ├── surfaces/
│   │   ├── console/
│   │   ├── projects/
│   │   ├── workspace/
│   │   ├── resources/
│   │   ├── canvas/
│   │   ├── github/
│   │   └── settings/
│   ├── features/
│   │   ├── projects/
│   │   ├── sessions/
│   │   ├── runtime/
│   │   ├── terminal/
│   │   ├── chat/
│   │   ├── inspector/
│   │   ├── resources/
│   │   ├── audit/
│   │   ├── risk/
│   │   ├── git/
│   │   ├── worktree/
│   │   └── dock/
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   └── icons/
│   ├── stores/
│   ├── services/
│   ├── types/
│   └── styles/
├── src-tauri/
│   └── src/
│       ├── commands/
│       ├── pty/
│       ├── runtime/
│       ├── database/
│       ├── repositories/
│       ├── resources/
│       ├── git/
│       ├── settings/
│       ├── audit/
│       ├── risk/
│       └── diagnostics/
├── docs/
├── scripts/
└── tests/
```

---

## 3. Surface 列表

必须建立 7 个 Surface：

```text
ConsoleSurface
ProjectsSurface
WorkspaceSurface
ResourcesSurface
CanvasSurface
GitHubSurface
SettingsSurface
```

左侧导航顺序：

```text
控制台
项目管理
工作区
资源区
无限画布
GitHub
设置
```

每个 Surface 先建立真实布局占位，不要写假业务数据。占位文案必须明确：

```text
当前模块尚未接入真实数据
```

不要用假项目、假会话、假统计伪装功能。

---

## 4. 基础类型

在 `src/types/domain.ts` 或拆分文件中定义完整基础模型：WorkspaceRoot、Project、Session、OpenSessionTab、RuntimeEvent、AuditLog、RiskItem、FileChange、ResourceItem、Settings。字段应包含 id、关联 id、状态、创建与更新时间、必要元数据。类型必须从第一天服务真实数据流，不要只为静态 UI 造字段。

---

## 5. 基础 Store

建立 Zustand stores：

```text
appStore
surfaceStore
projectStore
sessionStore
openSessionStore
runtimeStore
settingsStore
auditStore
riskStore
resourceStore
dockStore
```

本阶段 store 可以只做内存状态和接口占位，但不能伪造真实业务数据。

---

## 6. 统一 UI 组件

建立：

```text
CcCard
CcPanel
CcButton
CcIconButton
CcBadge
CcStatusDot
CcTabs
CcTooltip
CcDropdown
CcSearchInput
CcEmptyState
CcLoadingState
CcErrorState
CcConfirmDialog
CcModal
CcDrawer
CcSplitPane
```

要求：

```text
1. 全部使用 CSS variables / design token
2. 不硬编码随机颜色
3. 支持 light/dark 基础模式
4. 支持 data-testid
5. 保持圆角、轻阴影、低对比
```

---

## 7. AppShell

结构：

```text
AppShell
├── LeftSurfaceRail
├── SurfaceHost
├── GlobalCommandPalettePlaceholder
├── ToastHostPlaceholder
└── DialogHostPlaceholder
```

LeftSurfaceRail：

```text
Logo
控制台
项目管理
工作区
资源区
无限画布
GitHub
设置
底部状态：Claude / PTY / Risk / Dock
```

---

## 8. docs 文档

创建：

```text
docs/architecture.md
docs/surface-design.md
docs/runtime-pty-first.md
docs/visual-language.md
docs/development-roadmap.md
```

每个文档写明当前阶段计划，不要空文件。

---

## 9. 验收标准

```text
[ ] 项目创建在 G:/Claude Code/ctrl-cc/
[ ] 能启动 Tauri + React 开发环境
[ ] AppShell 显示
[ ] 左侧 7 个 Surface 可切换
[ ] 每个 Surface 有真实占位页面
[ ] 统一 Cc* 组件存在
[ ] 核心 types 存在
[ ] 核心 stores 存在
[ ] docs 存在
[ ] 无假数据伪装
[ ] npm run typecheck 通过
[ ] npm run build 通过
[ ] cargo check 通过
```

---

## 10. 直接执行 Prompt

```text
请执行 Ctrl-CC vNext Part 1：新项目初始化。

在 G:/Claude Code/ctrl-cc/ 下新建全新的 Tauri + React + TypeScript 项目。
不要修改旧项目，不要复制旧项目业务代码。
只搭建干净架构、统一视觉组件、AppShell、7 个 Surface 占位、核心类型、核心 store、docs 文档。

本阶段不要实现 Claude Code Runtime，不要实现 PTY，不要实现完整 Chat，不要做假数据。

完成后运行：
npm run typecheck
npm run build
cargo check --manifest-path src-tauri/Cargo.toml

输出：
1. 创建的目录结构
2. 修改文件清单
3. 当前可运行效果
4. 构建结果
5. 下一阶段建议
```
