# Ctrl-CC vNext 全新重构执行文档合集



---

# Ctrl-CC vNext 全新重构执行总则

> 本文档可直接发送给 Claude Code。  
> 目标：在 `G:/Claude Code/ctrl-cc/` 下新建一个干净的 Ctrl-CC vNext 项目，保留原有视觉语言、产品目标和全层架构，但彻底重写底层代码，避免继续在旧项目屎山代码上堆叠。  
> 核心定位：Ctrl-CC 是 Claude Code CLI 的 **PTY-first GUI Control Plane**，不是 Claude Code 的替代品，不复现 Claude Code 内部 agent loop，不破解、不逆向、不绕过官方权限与认证。

---

## 0. 总体原则

### 0.1 这次要重建，不要修补

旧项目中已经存在大量半实现、假按钮、状态混乱、页面职责不清、Runtime 链路不稳定的问题。vNext 必须重新建立清晰架构：

```text
新项目路径：G:/Claude Code/ctrl-cc/
保留：视觉风格、产品理念、全功能目标、架构分层
推翻：旧业务代码、旧页面耦合、旧状态混乱、假数据、假按钮、半实现 Runtime
```

可以参考旧项目：

```text
设计 token
视觉组件风格
页面布局概念
图标与动效逻辑
需求文档
IP 形象
```

禁止直接继承：

```text
旧 Runtime 代码
旧状态管理混乱代码
旧页面堆叠逻辑
旧假数据
旧无行为按钮
旧无法维护组件
```

### 0.2 最高产品目标

```text
1. 100% 承载 Claude Code CLI 原生交互能力
2. 200% 可视化 Claude Code 公开可观察行为
3. 500% 提升项目、会话、资源、风险、审计、自动化管理能力
```

### 0.3 PTY-first 是主架构

普通 Claude Code 会话必须通过真实 PTY 启动：

```text
Rust backend: portable-pty / Windows ConPTY
Frontend: xterm.js
普通交互：PTY interactive runtime
结构化任务：claude -p --output-format stream-json
```

注意：

```text
Terminal View = 完全原生 Claude Code CLI 体验，和 PowerShell / Windows Terminal 中打开 Claude Code 尽可能一致
Chat View = 小白友好语义视图，基于 RuntimeEvent / Semantic Overlay 增强展示
Split View = 原生终端 + 小白语义视图并排显示
```

---

## 1. 新主 Surface 架构

左侧主快捷切换栏固定为 7 个 Surface：

```text
1. 控制台 Console
2. 项目管理区 Projects
3. 工作区 Workspace / Chat
4. 资源区 Resources
5. 无限画布 Canvas
6. GitHub 映射 GitHub
7. 设置 Settings
```

### 1.1 左侧栏行为

```text
icon-only / icon+text 可切换
hover 显示 tooltip
选中 Surface 使用浅卡其高亮
运行中、待确认、风险使用状态点和 badge
底部显示 Claude CLI / PTY / AutoTrust / Dock 状态
```

### 1.2 Surface 职责

```text
Console：启动页、全局驾驶舱、最近动态、快捷入口
Projects：工作文件夹、项目、会话、resume/fork/archive、项目状态管理
Workspace：当前打开会话的 Chat / Terminal / Split / Inspector
Resources：Skills、Agents、MCP、Hooks、Plugins、CLAUDE.md、Memory、Permissions
Canvas：高级用户自由编排项目/会话/资源/风险节点
GitHub：安全 WebView + 当前项目 GitHub repo/PR/Issue 映射
Settings：首次引导、环境检测、Runtime、外观、安全、诊断
```

---

## 2. 工程目录建议

推荐采用清晰分层。可以使用单应用结构，也可以预留 monorepo，但不要复杂化第一版。

```text
G:/Claude Code/ctrl-cc/
├── apps/
│   └── desktop/
│       ├── src/
│       │   ├── app/
│       │   ├── surfaces/
│       │   ├── features/
│       │   ├── components/
│       │   ├── stores/
│       │   ├── services/
│       │   ├── types/
│       │   └── styles/
│       └── src-tauri/
│           └── src/
│               ├── commands/
│               ├── pty/
│               ├── runtime/
│               ├── database/
│               ├── repositories/
│               ├── resources/
│               ├── git/
│               ├── settings/
│               ├── audit/
│               ├── risk/
│               └── diagnostics/
├── docs/
├── scripts/
└── tests/
```

如果第一阶段不做 monorepo，可以直接：

```text
G:/Claude Code/ctrl-cc/
├── src/
├── src-tauri/
├── docs/
├── scripts/
└── tests/
```

但 src 内部必须保持模块边界。

---

## 3. 统一视觉语言

必须沿用 Ctrl-CC 已定视觉：

```text
Neo Calm Industrial
新极简主义 + 新复古主义 + 舒缓界面
浅卡其 Claude Sand
米白 / 深海军蓝 / 柔和蓝绿
低对比、弱边框、轻阴影
大圆角
图标优先、文字按需
中文默认
小白友好，高级用户不受限
```

### 3.1 基础组件

必须先建立统一 UI 组件，不允许各 Surface 自己写不同卡片：

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
CcCodeBlock
CcCollapsible
CcProgressBar
CcTimeline
CcTree
```

### 3.2 设计 token

```css
:root {
  --cc-bg: #f7f4ee;
  --cc-surface: rgba(255,255,255,0.88);
  --cc-surface-solid: #ffffff;
  --cc-surface-muted: #fbf8f2;
  --cc-border: #e8ded1;
  --cc-border-strong: #d7c7b4;
  --cc-text: #243044;
  --cc-text-muted: #7b6f62;
  --cc-text-soft: #9a8f83;
  --cc-brand: #d8c29b;
  --cc-brand-soft: #f1e7d2;
  --cc-navy: #223047;
  --cc-blue: #82afff;
  --cc-green: #63c59b;
  --cc-amber: #f0a54a;
  --cc-red: #e66b6b;
  --cc-purple: #9a8cff;
  --cc-radius-card: 20px;
  --cc-radius-panel: 24px;
  --cc-shadow-soft: 0 10px 30px rgba(36,48,68,0.08);
  --cc-shadow-card: 0 6px 18px rgba(36,48,68,0.06);
}
```

---

## 4. 数据模型总纲

必须从第一天建立真实数据模型，不允许假数据驱动 UI。

```text
WorkspaceRoot
Project
Session
OpenSessionTab
PtySession
StructuredTask
RuntimeEvent
AuditLog
RiskItem
FileChange
GitSnapshot
ResourceItem
AgentState
McpServer
HookConfig
SkillConfig
CanvasLayout
Settings
CapabilitySnapshot
RawLogBundle
DockState
NotificationItem
```

### 4.1 数据流

```text
用户操作
→ GUI 组件
→ Zustand Store / Service
→ Tauri Command
→ Rust backend / PTY / FileSystem / Git / Resource Scanner
→ SQLite / Raw Log
→ RuntimeEvent / AuditLog / RiskItem / FileChange
→ Surface / Inspector / Dock / Console 同步更新
```

禁止：

```text
UI 直接 spawn 进程
UI 直接读写 SQLite
UI 直接操作真实文件删除
UI 绕过 AuditLog
UI 绕过 RiskEngine
UI 使用假状态
```

---

## 5. 分阶段执行路线

### Stage 0：新项目初始化与架构搭建

只搭骨架，不接 Claude Runtime。

### Stage 1：Projects Surface 顶级项目管理体验

重构项目管理区，建立工作文件夹、项目、会话、resume、fork、archive、会话预览、项目详情。

### Stage 2：Workspace / Chat 顶级聊天与终端体验

建立 Workspace：Open Session Tabs + Chat / Terminal / Split View + Inspector + ComposerBar。

### Stage 3：PTY Runtime 与 Claude Code CLI 真连接

实现 portable-pty / ConPTY + xterm.js + raw log + semantic overlay。

### Stage 4：Resources / Settings / Console / Dock / GitHub / Canvas 全面融合

把所有 Surface 接入真实数据链和运行状态。

### Stage 5：真实物理 UI 自动化测试与发布标准

建立 watchdog、安全循环、E2E、截图、回放、回归矩阵。

---

## 6. Claude Code 执行总 Prompt

```text
你现在负责在 G:/Claude Code/ctrl-cc/ 下新建 Ctrl-CC vNext。

这是一个全新重构项目，不要继续在旧项目上堆代码。
目标是保留 Ctrl-CC 原有全层架构、视觉语言和功能要求，但彻底重写底层代码。

最高原则：
1. 新项目路径必须是 G:/Claude Code/ctrl-cc/
2. 不复制旧项目业务代码。
3. 可以参考旧项目视觉 token、组件风格、需求文档和页面设计。
4. 普通 Claude Code 会话最终必须是 PTY-first：portable-pty / ConPTY + xterm.js。
5. Terminal View 必须尽可能等价于在 PowerShell / Windows Terminal 中打开 Claude Code CLI。
6. Chat View 是小白友好的语义增强视图。
7. Projects Surface 和 Workspace Surface 必须分离：
   - Projects 管理工作文件夹、项目、所有会话、resume/fork/archive
   - Workspace 负责当前打开会话的 Chat / Terminal / Split / Inspector
8. 所有功能必须接入真实 store/service/Tauri/SQLite/RuntimeEvent/AuditLog/RiskItem。
9. 禁止假按钮、假状态、假数据。
10. 所有 UI 保持 Ctrl-CC Neo Calm Industrial 视觉语言。
11. 所有危险操作必须确认并写 AuditLog，高风险永不自动通过。

每个阶段执行前：
1. 阅读当前阶段文档。
2. 输出最小实现计划。
3. 小步实现。
4. 运行 npm run typecheck、npm run build、cargo check。
5. 输出修改文件清单、测试结果、问题和下一阶段建议。
6. 不要跳阶段，不要一次性做完所有模块。
```


---

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


---

# Part 2：Projects Surface 顶级项目管理区执行文档

> 本文档可直接发送给 Claude Code。  
> 目标：把项目管理区设计成顶级项目管理软件风格，承担工作文件夹、项目、会话、resume、fork、archive、项目状态、会话状态和项目级风险管理。  
> 原则：Projects Surface 负责“管理所有项目与所有会话”；Workspace Surface 负责“当前会话实际工作”。

---

## 1. 产品定位

Projects Surface 是 Ctrl-CC 的“项目与会话管理中心”，不是简单项目列表。

它要像顶级项目管理软件一样清晰：

```text
工作文件夹在哪？
有哪些项目？
哪个项目正在运行？
每个项目有哪些会话？
哪些会话可以 resume？
哪些会话已经休眠或归档？
哪个会话有风险？
哪个会话修改了文件？
我能不能从一个旧会话 fork 一个新会话？
我应该进入哪个会话继续工作？
```

---

## 2. 页面整体布局

建议采用四栏可折叠布局：

```text
┌────────────────────┬────────────────────┬──────────────────────────────┬────────────────────┐
│ 工作文件夹 / 项目   │ 会话管理            │ 项目/会话预览主面板            │ 详情信息栏          │
│ Project Rail       │ Session Rail        │ Main Preview Panel            │ Info Drawer        │
└────────────────────┴────────────────────┴──────────────────────────────┴────────────────────┘
```

组件结构：

```text
ProjectsSurface
├── ProjectsTopBar
├── ProjectsLayout
│   ├── ProjectManagementRail
│   ├── SessionManagementRail
│   ├── ProjectSessionMainPanel
│   └── ProjectSessionInfoDrawer
└── ProjectsCommandPalette
```

所有栏都支持折叠：

```text
ProjectManagementRail 可折叠
SessionManagementRail 可折叠
InfoDrawer 可折叠
折叠状态持久化
```

---

## 3. 顶部 TopBar

ProjectsTopBar 包含：

```text
搜索框：搜索项目 / 会话 / 文件 / 风险
新建项目
导入项目
新建会话
继续最近会话
刷新状态
视图切换：列表 / 紧凑 / 分组
筛选：运行中 / 待确认 / 有风险 / 已归档
```

搜索应支持：

```text
项目名
路径
会话标题
会话摘要
Git branch
风险标题
```

---

## 4. 第一栏：ProjectManagementRail

### 4.1 结构

```text
ProjectManagementRail
├── RailHeader
│   ├── 搜索 / 过滤
│   ├── 新建工作文件夹
│   ├── 导入项目
│   └── 扫描按钮
├── WorkspaceFolderTree
│   ├── 工作文件夹 A
│   │   ├── 项目 1
│   │   ├── 项目 2
│   │   └── 项目 3
│   └── 工作文件夹 B
├── SmartProjectGroups
│   ├── 最近打开
│   ├── 收藏项目
│   ├── 正在运行
│   ├── 有待确认
│   ├── 有风险
│   └── 已归档
└── RailFooter
```

### 4.2 项目节点信息

每个项目节点显示：

```text
项目名
路径尾部
Git branch
运行中会话数
休眠会话数
待确认数
风险数
最近活动时间
状态点
```

视觉示例：

```text
● ctrl-cc
  main · 2 running · 1 risk
  G:/Claude Code/ctrl-cc
```

状态颜色：

```text
绿色：正常
蓝色：有运行中会话
黄色：待确认 / 轻风险
红色：高风险
灰色：路径缺失 / 已归档
紫色：Agent 活跃
```

### 4.3 项目右键菜单

```text
打开项目总览
新建 Claude 会话
继续最近会话
打开工作区
在文件管理器中打开
打开 GitHub
刷新 Git 状态
扫描资源
创建 Worktree 会话
收藏 / 取消收藏
归档项目
从列表移除
```

禁止默认提供“删除真实文件夹”。如果必须提供，必须二次确认并明确危险等级。

---

## 5. 第二栏：SessionManagementRail

### 5.1 职责

SessionManagementRail 跟随当前选中项目变化，展示该项目下所有会话。

分组：

```text
工作中 Running
等待输入 Waiting
暂停 Paused
休眠 Sleeping
已完成 Completed
失败 Failed
已归档 Archived
```

### 5.2 会话卡片

每张会话卡显示：

```text
会话标题
状态点
runtime mode：PTY / Structured
模型
permission mode
最后活动时间
token / cost 简要
文件变更数
风险数
审计数
是否可 resume
是否可 fork
```

视觉示例：

```text
🟢 修复 PTY Runtime
Sonnet · PTY · default
12 min ago · 8 files · 1 risk
[Resume] [Fork]
```

### 5.3 会话操作

每个会话支持：

```text
打开到 Workspace
Resume
Fork
Archive
Export Bundle
Open Raw Log
Rename
Pin
Delete Local Record
```

所有操作写 AuditLog。

---

## 6. Resume 会话逻辑

### 6.1 Resume 是什么

Resume 表示尽可能调用 Claude Code CLI 的原生 resume / continue 能力，恢复历史 Claude 会话。

### 6.2 流程

```text
用户点击 Resume
→ 检查项目路径存在
→ 检查 Claude CLI 可用
→ 检查 session.claudeSessionId
→ 检查当前项目是否已有 running session
→ 如有并发风险，弹窗提示
→ 通过 PTY 启动 claude resume / continue 命令
→ 绑定新的 PtySession 到该 Session
→ 状态变为 Running
→ 打开 Workspace
→ 打开对应 OpenSessionTab
→ 写 AuditLog(session_resumed)
```

### 6.3 如果不支持

如果当前 Claude CLI 不支持精确 resume：

```text
显示 disabled reason：
当前 Claude Code CLI 未暴露精确 resume 指定会话能力。
你可以使用 Fork Session 基于摘要创建新会话。
```

不要伪造 resume。

---

## 7. Fork 会话逻辑

### 7.1 Fork 是什么

Fork 是 Ctrl-CC 增强能力。它不等于 Claude 原生 resume，而是基于旧会话摘要创建一个新会话。

### 7.2 Fork 流程

```text
用户点击 Fork
→ 读取旧会话 summary
→ 读取最近 RuntimeEvent
→ 读取 FileChange
→ 读取 unresolved RiskItem
→ 读取相关 ResourceItem
→ 生成 SessionSeed
→ 弹出 ForkSessionDialog
→ 用户选择继承内容
→ 创建新 Session
→ 启动新的 PTY Claude 会话
→ 将摘要作为首条上下文注入
→ 打开 Workspace 新标签
→ 写 AuditLog(session_forked)
```

### 7.3 Fork 模板

```text
这是从历史会话「{sessionTitle}」派生的新会话。

上一会话摘要：
- 目标：
- 已完成：
- 未完成：
- 涉及文件：
- 风险：
- 下一步建议：

请基于这些上下文继续工作。不要假设未列出的文件状态，必要时先读取当前项目。
```

---

## 8. 中间 Main Preview Panel

### 8.1 选中项目时

展示 ProjectOverview：

```text
项目名
路径
Git branch
最近会话
运行中会话
风险
文件变更
资源绑定
Git 状态
快捷操作
```

模块：

```text
ProjectHero
ProjectStatsGrid
RecentSessions
ActiveRisks
GitSummary
ResourceSummary
QuickActions
```

快捷操作：

```text
新建 Claude 会话
继续最近会话
打开 Workspace
打开文件夹
打开 GitHub
创建 Worktree 会话
扫描资源
```

### 8.2 选中会话时

展示 SessionPreview：

```text
会话标题
状态
摘要
最近消息
最近命令
文件变更
风险
审计
按钮：打开工作区 / Resume / Fork / Export / Archive
```

注意：Projects Surface 不做完整 Chat，只做管理与预览。

---

## 9. 右侧 Info Drawer

Tabs：

```text
概览
摘要
文件
Git
风险
审计
资源
原始日志
```

职责：

```text
展示选中项目或会话的管理信息
允许快速跳转 Workspace / Inspector
不做完整实时 Chat
```

---

## 10. 与 Workspace 的连接

用户从 Projects 进入 Workspace 的路径：

```text
双击会话卡
点击打开工作区
点击 Resume 成功
点击 Fork 成功
点击运行中会话
```

进入后：

```text
Workspace Surface 激活
OpenSessionTabs 打开该会话
Chat / Terminal / Inspector 加载该会话
Projects 中该会话显示“已打开”
```

---

## 11. 验收标准

```text
[ ] Projects Surface 四栏布局可用
[ ] ProjectManagementRail 可折叠
[ ] SessionManagementRail 可折叠
[ ] InfoDrawer 可折叠
[ ] 可新建/导入项目
[ ] 可展示项目分组
[ ] 可展示会话分组
[ ] Resume 有真实能力检测和 disabled reason
[ ] Fork 可生成新会话 seed
[ ] 项目/会话预览清晰
[ ] 所有操作写 AuditLog
[ ] 无假项目/假会话伪装
[ ] build/typecheck/cargo check 通过
```

---

## 12. 直接执行 Prompt

```text
请执行 Ctrl-CC vNext Part 2：Projects Surface 顶级项目管理区。

目标：
把项目管理区设计成顶级项目管理软件风格，承担工作文件夹、项目、所有会话、resume、fork、archive、项目状态、会话状态和项目级风险管理。

要求：
1. 不做完整 Chat。
2. Projects 只做项目/会话管理与预览。
3. Workspace 才是实际会话工作区。
4. 建立四栏可折叠布局：Project Rail / Session Rail / Main Preview / Info Drawer。
5. 实现项目节点、会话节点、分组、筛选、搜索、右键菜单。
6. Resume 必须调用真实 Claude CLI 能力或显示 disabled reason，禁止伪造。
7. Fork 是 Ctrl-CC 增强能力，基于旧会话摘要创建新会话。
8. 所有操作写 AuditLog。
9. 所有 UI 复用 Cc* 组件和 Neo Calm Industrial 风格。

完成后运行：
npm run typecheck
npm run build
cargo check --manifest-path src-tauri/Cargo.toml

输出修改文件清单、构建结果、当前功能完成度和下一步建议。
```


---

# Part 3：Workspace / Chat 顶级交互区执行文档

> 本文档可直接发送给 Claude Code。  
> 目标：重构 Chat 功能，使 Ctrl-CC 在应用内部直接内嵌完整原生终端，同时保留小白友好的 Chat View。  
> 核心原则：Terminal View 必须尽可能等价于在 PowerShell / Windows Terminal 中运行 Claude Code CLI；Chat View 是顶级聊天应用体验，类似 QQ / 微信 / Discord / Telegram 的交互自然度。

---

## 1. Workspace Surface 定位

Workspace Surface 只负责当前打开会话的实际工作：

```text
当前打开的会话标签
Chat View
Terminal View
Split View
Structured Task View
当前会话 Inspector
ComposerBar
```

Projects Surface 管理所有项目和会话；Workspace Surface 处理当前会话工作。

---

## 2. 整体布局

```text
WorkspaceSurface
├── OpenSessionTabs
├── CurrentSessionHeader
├── WorkspaceBody
│   ├── ChatTerminalArea
│   │   ├── ChatView
│   │   ├── TerminalView
│   │   ├── SplitView
│   │   └── StructuredTaskView
│   └── SessionInspector
└── ComposerBar
```

视觉布局：

```text
┌────────────────────────────────────────────────────────────┐
│ Open Session Tabs                                          │
├──────────────────────────────────────────────┬─────────────┤
│ Chat / Terminal / Split View                  │ Inspector   │
├──────────────────────────────────────────────┴─────────────┤
│ ComposerBar                                                │
└────────────────────────────────────────────────────────────┘
```

---

## 3. OpenSessionTabs

顶部标签管理所有已打开会话。

每个标签显示：会话名、项目名、状态点、待确认 badge、风险 badge、关闭按钮。

支持：点击切换、关闭、固定、拖拽排序、右键菜单。右键菜单包括 Resume、Pause、Stop、Fork、Archive、Export、Reveal in Projects、Open Raw Log、Close Others、Close All Stopped。

多会话规则：不同项目允许并行；同项目提示风险，建议 Worktree；同文件 FileLock 强提醒。

---

## 4. ChatWorkbench 四种视图

### 4.1 Chat View

面向小白用户，类似顶级聊天软件。

必须具备：左右气泡布局、用户消息右侧、Claude 消息左侧、头像 / 状态点、消息时间、消息分组、连续消息合并、复制按钮、重试按钮、引用回复、折叠长消息、搜索消息、跳转最新、未读/新消息提示。

消息类型：UserBubble、AssistantBubble、SystemNotice、CommandCard、FileChangeCard、DiffCard、PermissionCard、RiskCard、AgentCard、McpCard、HookCard、SummaryCard、ErrorCard、RawEventCollapse。

### 4.2 Terminal View

完整原生终端体验：xterm.js、真实 Claude Code CLI、完整 ANSI、完整键盘、完整 slash command、完整 permission prompt、Ctrl+C、Ctrl+D、Resize、复制粘贴、搜索、Raw Log。Terminal View 是事实来源，不得用 div 模拟终端。

### 4.3 Split View

专业模式。可选左右分屏或上下分屏，支持拖拽调整比例并持久化。

### 4.4 Structured Task View

用于 claude -p、stream-json、JSON schema、批任务、CI 风格任务。

---

## 5. Chat View 顶级聊天体验设计

消息流包含日期分割线、会话状态提示、用户消息、Claude 流式回复、工具调用卡片、文件修改卡片、风险提示、权限确认卡、总结。

用户气泡：右对齐、浅卡其 / 柔和蓝色、圆角 18-22px、最大宽度 72%、支持编辑后重新发送。

Claude 气泡：左对齐、白色 / 低对比卡片、带 Ctrl-CC 猫猫小头像、支持 markdown、代码折叠、复制。

系统提示：居中小胶囊，低对比，例如 Claude Code 已启动、会话已恢复、权限等待中。

工具卡片包括命令卡、文件卡、权限卡、风险卡。每张卡必须可展开、可跳转 Inspector、可复制、可审计。

---

## 6. ComposerBar 输入区

小白模式默认只显示：输入框、发送按钮、+ 文件、模型、权限模式。

专业模式显示：Runtime 模式、模型、effort、permission、@Skill、@Agent、@MCP、/Command、+ File、+ Folder、Tools、Budget、Max turns、Command Preview、Raw Log。

输入交互：Enter 发送、Shift+Enter 换行、@ 打开资源选择、/ 打开命令选择、Ctrl+K 打开全局 Command Center、拖入文件、粘贴图片或文本、历史输入上下切换、草稿保存。

@ 面板显示文件、目录、Skill、Agent、MCP Tool、Hook、CLAUDE.md、最近上下文。

/ 面板显示 /help、/permissions、/agents、/mcp、/compact、/cost、/status、/resume、/clear。PTY 模式下 slash command 插入真实终端，不由 GUI 伪造执行。

---

## 7. Chat 与 Terminal 的关系

ChatComposer 输入：runtimeMode = pty-interactive → pty_write(text + Enter)；runtimeMode = structured-print → claude -p task。

Terminal 中直接输入：xterm.onData → pty_write。

PTY 输出路径：raw bytes → xterm Terminal View → raw log → semantic parser → RuntimeEvent → Chat View 卡片 → Inspector → Audit/Risk。

事实来源：Terminal View 是事实来源；Chat View 是语义增强；Inspector 是诊断与追踪。

---

## 8. SessionInspector

Workspace 中右侧 Inspector 是当前工作会话的实时诊断面板。

Tabs：详情、文件、Git、上下文、权限、风险、审计、Hook、Agent、资源、Raw Log。

Inspector 可折叠。折叠后只显示状态竖条：Details、Files、Risk、Audit、Raw。

---

## 9. 动效设计

新消息 fade + translateY 6px；流式输出平滑追加；工具卡片进入时轻微 scale 0.98 → 1；权限卡 amber 边框柔和 pulse 一次；风险卡 red/amber 静态强调，不持续闪烁；切换视图 120-180ms fade；标签切换保留滚动位置。

---

## 10. 验收标准

```text
[ ] OpenSessionTabs 可切换多个会话
[ ] Chat View 有顶级聊天软件体验
[ ] Terminal View 是真实 xterm 终端
[ ] Split View 可用
[ ] Composer 支持 @ 和 /
[ ] Chat 输入能进入 PTY
[ ] Terminal 输出能生成 RuntimeEvent
[ ] Permission/Risk/File/Command 卡片可见
[ ] Inspector 与当前会话同步
[ ] 视图切换不丢状态
[ ] build/typecheck/cargo check 通过
```

---

## 11. 直接执行 Prompt

```text
请执行 Ctrl-CC vNext Part 3：Workspace / Chat 顶级交互区。

目标：
重构 Workspace 和 Chat，让我们的应用内部直接内嵌完整原生终端，并同时提供小白友好的顶级 Chat View。

要求：
1. Workspace 只负责当前打开会话工作。
2. Projects Surface 负责项目和所有会话管理。
3. 建立 OpenSessionTabs。
4. 建立 Chat View / Terminal View / Split View / Structured Task View。
5. Terminal View 必须用 xterm.js，准备接入真实 PTY。
6. Chat View 必须做到类似 QQ / 微信 / Discord / Telegram 的顶级聊天体验。
7. ComposerBar 支持 @资源、/命令、模型、权限、runtime、文件、Command Preview。
8. Chat View 是语义增强，Terminal View 是事实来源。
9. Inspector 作为当前会话实时诊断面板。
10. 所有 UI 复用 Cc* 组件和 Neo Calm Industrial 风格。

本阶段可以先做前端结构和交互骨架，如果 PTY Runtime 还未实现，Terminal View 显示明确 EmptyState：PTY Runtime 尚未接入。不要用假终端输出伪装。

完成后运行：
npm run typecheck
npm run build
cargo check --manifest-path src-tauri/Cargo.toml

输出修改文件清单、构建结果、当前功能完成度和下一步建议。
```


---

# Part 4：PTY Runtime 与 Claude Code CLI 真连接执行文档

> 本文档可直接发送给 Claude Code。  
> 目标：让 Ctrl-CC 在应用内部直接打开真实 Claude Code CLI，Terminal View 尽可能等价于 PowerShell / Windows Terminal 中的 Claude Code 体验。

---

## 1. 阶段目标

实现 PTY-first Runtime：

```text
Rust backend：portable-pty / Windows ConPTY
Frontend：xterm.js
Claude Code：真实 interactive CLI
ChatComposer：向 PTY 写入输入
TerminalPanel：显示原始终端
Semantic Parser：生成 RuntimeEvent
RawLog：保存原始输出
```

---

## 2. 后端模块

创建：

```text
src-tauri/src/pty/
├── mod.rs
├── pty_session.rs
├── pty_manager.rs
├── pty_commands.rs
├── pty_types.rs
├── pty_log.rs
└── pty_parser.rs
```

### 2.1 Tauri Commands

```text
pty_check_support
pty_start_claude_session
pty_write
pty_resize
pty_send_ctrl_c
pty_send_ctrl_d
pty_stop
pty_get_status
pty_get_raw_log
pty_export_log_bundle
```

### 2.2 事件

```text
pty://data
pty://exit
pty://error
pty://status
pty://semantic-event
```

---

## 3. 前端集成

TerminalPanel 使用：

```text
@xterm/xterm
@xterm/addon-fit
@xterm/addon-search
@xterm/addon-web-links
@xterm/addon-serialize
```

支持：输入、输出、Ctrl+C、Ctrl+D、resize、复制粘贴、搜索、打开 raw log、导出 bundle。

---

## 4. Session 启动流程

```text
用户在 Projects 或 Workspace 点击新建会话
→ 选择 project cwd
→ 选择 runtimeMode = pty-interactive
→ 选择 model / permission / resources
→ 生成 command preview
→ 调用 pty_start_claude_session
→ 后端启动 Claude Code CLI
→ 前端 Terminal View 显示真实输出
→ Session 状态变为 running/waiting
→ 写 AuditLog(session_started)
```

---

## 5. Chat 输入到 PTY

```text
ChatComposer.send(text)
→ pty_write(sessionId, text + "\r")
→ 终端输出变化
→ raw log 保存
→ semantic parser 尽力解析
→ RuntimeEvent
→ Chat View 卡片显示
```

---

## 6. Raw Log

每个会话保存：pty_raw.bin、pty_utf8.log、pty_ansi.log、pty_events.jsonl、pty_command.json、pty_size_events.jsonl。

---

## 7. Semantic Parser

尽力识别 user input、assistant output、permission prompt、tool use、bash command、file read、file edit、diff、error、done、risk pattern、agent event、mcp event。识别不了就保留 raw，不得丢弃。

---

## 8. 风险规则

检测但不强行干预用户手动终端输入：rm -rf、del /s、rmdir、git reset --hard、git clean -fd、git push --force、.env、token、key、secret、bypassPermissions。

如果输入来自 GUI AutoTrust 自动操作，则必须阻断高风险。

---

## 9. 验收标准

```text
[ ] 可以在 Terminal View 中真实启动 Claude Code CLI
[ ] 键盘输入可进入 Claude CLI
[ ] ChatComposer 输入可进入 Claude CLI
[ ] Ctrl+C 可中断
[ ] resize 可同步
[ ] raw log 保存
[ ] RuntimeEvent 生成
[ ] Chat View 能显示语义卡片
[ ] Inspector 能查看 raw log / audit / risk
[ ] 停止会话后无残留进程
[ ] build/typecheck/cargo check 通过
```

---

## 10. 直接执行 Prompt

```text
请执行 Ctrl-CC vNext Part 4：PTY Runtime 与 Claude Code CLI 真连接。

目标：
在应用内部通过 PTY 真实运行 Claude Code CLI，让 Terminal View 尽可能等价于 PowerShell / Windows Terminal 中运行 claude 的体验。

要求：
1. 使用 portable-pty / Windows ConPTY。
2. 前端使用 xterm.js。
3. 实现 pty_start_claude_session、pty_write、pty_resize、pty_send_ctrl_c、pty_stop 等 commands。
4. raw output 必须保存。
5. output 必须通过 event 推送到前端。
6. ChatComposer 必须能向 PTY 写入用户输入。
7. Semantic Parser 只做 best effort，不能伪造 Claude 内部状态。
8. 所有操作写 AuditLog。
9. 高风险操作必须进入 RiskItem。
10. 停止会话后不得残留进程。

完成后运行：
npm run typecheck
npm run build
cargo check --manifest-path src-tauri/Cargo.toml

并手动测试：
1. 新建项目
2. 新建 PTY 会话
3. Terminal View 看到 Claude CLI
4. Chat 输入一句话
5. Claude 有响应
6. Ctrl+C 生效
7. 停止会话
8. 无残留进程

输出测试报告。
```


---

# Part 5：七大 Surface 融合、AI 工作坞与全局操作逻辑执行文档

> 本文档可直接发送给 Claude Code。  
> 目标：在 Projects、Workspace、PTY Runtime 打通之后，全面收口 Console、Resources、Canvas、GitHub、Settings、AI 工作坞，让所有 Surface 协同工作。

---

## 1. 全局协同原则

所有 Surface 不应是孤岛。

```text
Console → 快速进入 Projects / Workspace / Settings
Projects → 管理项目和会话 → 打开 Workspace
Workspace → 当前会话工作 → 跳转 Projects / Resources / GitHub
Resources → 管理 Claude 资源 → 被 ChatComposer / CommandCenter 调用
Canvas → 可视化项目 / 会话 / 风险 / 资源 → 跳转对应 Surface
GitHub → 当前项目仓库映射 → 来自 Projects / Inspector
Settings → 配置 Runtime / Appearance / Safety / Resources
AI Dock → 全局状态入口 → 跳转任意 Surface
```

---

## 2. Console Surface

功能：欢迎语、日期 / 时钟 / 月历、猫猫状态、运行中会话、待确认权限、高风险、最近项目、最近会话、最近审计、快捷入口。

快捷入口：新建项目、导入项目、新建 Claude 会话、继续最近会话、打开环境诊断、打开 Resources。

---

## 3. Resources Surface

管理 Skills、Agents、MCP、Hooks、Plugins、CLAUDE.md、Memory、Slash Commands、Permission Rules、Output Styles。

每个资源必须显示来源、作用域、路径、启用状态、风险等级、影响项目、最近修改。

资源与 Chat 的连接：ChatComposer @Skill、@Agent、@MCP；CommandCenter /agents、/mcp；Inspector Resources Tab。

---

## 4. Settings Surface

分类：通用、外观、Claude Code、PTY Runtime、Chat、Projects、Resources、AI 工作坞、安全 / AutoTrust、GitHub、Canvas、诊断。

必须支持环境检测：Windows、WebView2、Git、Claude Code CLI、Claude auth、ConPTY、portable-pty、xterm、默认工作目录、资源路径。

---

## 5. GitHub Surface

第一版只做安全 WebView 和项目映射：从当前 Project git remote 打开 GitHub repo、打开 Issues、打开 Pull Requests、打开 Actions、外部浏览器打开、不读取 token/cookie、不记录敏感 URL。

---

## 6. Canvas Surface

高级用户模式。节点：ProjectNode、SessionNode、PtySessionNode、FileChangeNode、RiskNode、AuditNode、ResourceNode、GitHubNode、AgentNode。只做可视化与跳转，不自动执行工作流。

---

## 7. AI 工作坞重构

### 7.1 定位

AI 工作坞是固定贴附在电脑屏幕最右侧中间的常驻工作状态控制器，不属于主窗口内部。

必须可折叠、可展开、可隐藏、可从托盘恢复、贴附屏幕右侧中间、不遮挡太多视野、显示多项目多会话状态、处理待确认、提醒风险、快速跳转主应用。

### 7.2 三种模式

Quiet 安静模式：极窄条，Logo、running dot、waiting dot、risk dot，hover 展开 mini popover。

Calm 舒缓模式：默认推荐，当前重点会话、待确认事项、风险摘要、最近完成、打开主窗口。

Focus 聚焦模式：运行中会话列表、待确认队列、风险队列、Agent 状态、Token/Cost、快捷操作。

### 7.3 工作坞操作

打开会话、跳转 Workspace、跳转 Inspector Permission、跳转 Risk、发送 Ctrl+C、停止会话、暂停 AutoTrust、导出日志。高风险操作必须二次确认。

### 7.4 状态灯

绿色 steady：正常；绿色 pulse：运行中；黄色 pulse：待确认；红色 pulse：高风险；蓝色 pulse：AutoTrust；灰色 steady：空闲。动画必须克制，不要持续强闪烁。

---

## 8. 全局 Command Center

Ctrl+K 打开。命令来源：Surface navigation、Project actions、Session actions、Runtime actions、Resources actions、Settings actions、Dock actions。

命令示例：新建项目、新建 Claude 会话、打开当前会话、Resume 会话、Fork 会话、停止会话、打开资源区、打开 Settings Runtime、打开 GitHub Repo、显示 AI 工作坞、导出 Session Bundle。

---

## 9. 通知系统

通知类型：会话完成、等待权限、高风险、Claude CLI 错误、PTY 崩溃、资源异常、Git 冲突、工作坞状态。

通知渠道：主窗口 Toast、AI 工作坞、系统右下角通知、Console 最近动态、AuditLog。

---

## 10. 验收标准

```text
[ ] Console 读取真实项目/会话/风险/审计
[ ] Resources 可管理真实资源
[ ] Settings 可检测环境
[ ] GitHub 可从项目打开 repo
[ ] Canvas 可展示真实节点
[ ] AI 工作坞贴附屏幕右侧中间
[ ] AI 工作坞 Quiet/Calm/Focus 可切换
[ ] Command Center 可用
[ ] 通知系统可用
[ ] 所有跳转准确
[ ] 所有危险操作审计
[ ] build/typecheck/cargo check 通过
```

---

## 11. 直接执行 Prompt

```text
请执行 Ctrl-CC vNext Part 5：七大 Surface 融合、AI 工作坞与全局操作逻辑。

目标：
让 Console、Projects、Workspace、Resources、Canvas、GitHub、Settings、AI 工作坞全部协同工作，而不是孤立页面。

要求：
1. Console 是生活化启动页和全局驾驶舱。
2. Resources 管理 Skills / Agents / MCP / Hooks / Plugins / CLAUDE.md / Memory。
3. Settings 管理环境检测、PTY Runtime、Chat、Projects、Resources、安全、工作坞。
4. GitHub 只做安全 WebView 和项目 repo 映射。
5. Canvas 只做可视化节点和跳转，不自动执行 workflow。
6. AI 工作坞固定贴附屏幕右侧中间，支持 Quiet / Calm / Focus。
7. 所有 Surface 通过真实 store / service / Tauri / SQLite 联动。
8. 所有危险操作写 AuditLog。
9. 所有 UI 保持 Neo Calm Industrial 视觉语言。

完成后运行：
npm run typecheck
npm run build
cargo check --manifest-path src-tauri/Cargo.toml

输出修改文件清单、构建结果、功能完成度和下一步建议。
```


---

# Part 6：真实物理操作测试与发布验收执行文档

> 本文档可直接发送给 Claude Code。  
> 目标：建立受控、安全、不会拖死电脑的真实 UI 自动化测试闭环，验证 Ctrl-CC vNext 的全功能真实可用。

---

## 1. 测试目标

必须模拟真实用户操作，而不是只跑单元测试。

主链路：启动软件 → 环境检测 → 新建项目 → 新建 PTY Claude 会话 → Terminal 显示 Claude CLI → Chat 输入 → Claude 响应 → Inspector 监控 → AuditLog 记录 → RiskItem 记录 → 停止会话 → 清理进程 → 导出报告。

---

## 2. 工具链

```text
Tauri WebDriver + WebdriverIO：测试 WebView 内部 UI
Appium / WinAppDriver：测试主窗口、系统托盘、AI 工作坞
xterm 测试钩子：测试终端输入输出
PowerShell Watchdog：进程、CPU、内存保护
Screenshot / Video：测试证据
```

---

## 3. 安全护栏

必须先创建：

```text
scripts/e2e/preflight.ps1
scripts/e2e/process-watchdog.ps1
scripts/e2e/cleanup-ctrlcc-processes.ps1
scripts/e2e/run-e2e-safe.ps1
tests/e2e/README.md
```

Watchdog 限制：最多 1 个 Ctrl-CC，最多 1 个 Claude PTY session，claude 进程数 <= 2，cmd + powershell + bash <= 6，git 进程数 <= 4，单轮测试 <= 10 分钟，CPU 连续 60 秒不得 > 85%，可用内存不得 < 1.5GB。

触发后：截图，写 watchdog-failure.json，清理测试进程，停止循环。

---

## 4. data-testid

必须为关键组件补齐：app-shell、surface-console、surface-projects、surface-workspace、surface-resources、surface-canvas、surface-github、surface-settings、projects-surface、project-management-rail、session-management-rail、project-session-main-panel、project-session-info-drawer、create-project-button、import-project-button、create-session-button、project-node、session-node、session-resume-button、session-fork-button、workspace-surface、open-session-tabs、chat-view-tab、terminal-view-tab、split-view-tab、chat-composer-input、chat-send-button、terminal-panel、terminal-xterm-root、runtime-status-badge、stop-session-button、export-session-button、inspector-panel、inspector-tab-details、inspector-tab-files、inspector-tab-risk、inspector-tab-audit、inspector-tab-raw-log、floating-dock、dock-mode-quiet、dock-mode-calm、dock-mode-focus。

---

## 5. P0 测试

P0-001 启动与环境检测：启动 Ctrl-CC，等待 app-shell，进入 Settings，运行环境检测，验证 Claude / Git / WebView2 / PTY 状态，截图。

P0-002 新建项目：进入 Projects，点击新建项目，在 sandbox workspace 创建 ctrlcc-e2e-demo，验证 project-node、真实目录、AuditLog。

P0-003 新建 PTY 会话：选中项目，点击新建会话，选择 pty-interactive，启动，切 Workspace，打开 Terminal View，验证 terminal-xterm-root 和 Claude CLI 输出。

P0-004 Chat 输入进入 PTY：切 Split View，输入“请查看当前目录，只输出一句话说明当前目录里有什么，不要修改任何文件。”，点击发送，验证 Terminal 输出、Chat View 语义卡片、AuditLog。

P0-005 停止与清理：点击 stop-session-button，验证状态 stopped，导出 session bundle，关闭 App，执行 cleanup，验证无残留测试进程。

---

## 6. P1 测试

文件写入权限测试、风险拦截测试、多会话并发保护测试、Resume 会话测试、Fork 会话测试、AI 工作坞状态测试、Resources @Skill/@Agent/@MCP 测试。

---

## 7. 多轮循环

限制：maxIterations = 5，每轮最多 10 分钟，连续 3 次同类失败停止，每轮结束必须 cleanup，watchdog 触发立即停止。

每轮：preflight → run P0 → 收集截图 / 日志 / raw log / db snapshot / process snapshot → 分析失败 → 只修 P0 → 下一轮 → P0 全过后跑 P1 → 输出 final report。

---

## 8. 输出报告

每轮：`test-results/e2e-runs/<timestamp>/iteration-report.md`。

最终：`test-results/e2e-runs/final-e2e-report.md`。

内容包括总体结论、P0/P1/P2 通过情况、Chat / Terminal / Projects / Inspector / Dock 覆盖情况、进程泄漏检查、已修复问题、未解决阻塞、下一步建议。

---

## 9. 直接执行 Prompt

```text
请执行 Ctrl-CC vNext Part 6：真实物理操作测试与发布验收。

目标：
建立受控、安全、不会拖死电脑的真实 UI 自动化测试闭环。

第一步只做测试基建，不要立刻跑完整大循环：
1. 创建 scripts/e2e/preflight.ps1
2. 创建 scripts/e2e/process-watchdog.ps1
3. 创建 scripts/e2e/cleanup-ctrlcc-processes.ps1
4. 创建 scripts/e2e/run-e2e-safe.ps1
5. 创建 tests/e2e/README.md
6. 补齐关键 data-testid
7. 创建 docs/e2e-physical-ui-test-plan.md
8. 不要修改业务功能，除非只是 harmless data-testid

完成后停止，等待我确认，再进入 P0 自动化测试实现。
```
