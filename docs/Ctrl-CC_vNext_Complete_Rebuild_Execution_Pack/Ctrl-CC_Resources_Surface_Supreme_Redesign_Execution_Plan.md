# Ctrl-CC Resources Surface 最终 UI 蓝图 + Workspace/Chat 运行时连接专项方案

> **可直接发送给 Claude Code CLI 执行。**  
> 目标：将 Ctrl-CC 当前资源区从“资源文件查看器”升级为 **资源中枢 / 能力中枢 / 上下文中枢 / Runtime Bridge**。  
> 本方案同时包含两部分：
>
> 1. **资源区最终 UI 蓝图（逐区块说明版）**
> 2. **Resources × Workspace/Chat 运行时连接专项方案**
>
> 约束：
>
> - 不改最左侧 AppRail 图标。
> - 不重构 AI Dock 本体，但资源状态必须能被 AI Dock 读取。
> - 不破坏四主题系统：`light / dark / pale-blue / warm-sand`。
> - 不做假数据。缺失信息必须显示 `Unavailable / Not configured / Not scanned`。
> - 资源区不是 Claude Runtime。资源区通过 `ResourceActivationBridge` 服务于 Projects / Workspace / Chat / Claude Code CLI Runtime。

---

# Part A：资源区最终 UI 蓝图

## A0. 页面总定位

当前资源区是：

```text
左侧文件列表 + 右侧内容预览
```

升级后必须变成：

```text
Resources Command Center
资源中枢 / 能力中枢 / 上下文中枢 / 运行时连接中枢
```

核心回答：

```text
我有哪些 Claude Code 资源？
这些资源属于哪个作用域？
它们是否健康？
哪些资源正在被当前项目 / 当前会话使用？
能不能一键插入 Chat？
能不能一键用于项目？
哪个 Hook / MCP / Agent 有风险？
资源和 Projects / Workspace / Console / AI Dock 是否联动？
```

---

## A1. 页面整体布局

采用四区结构：

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ ResourcesTopBar                                                            │
├───────────────┬───────────────────────────────────────┬─────────────────────┤
│ ResourcesNav  │ ResourcesCanvas                       │ ResourceInspector   │
│ 260px         │ flex-1                                │ 420-520px           │
│               │ ├─ OverviewStrip                      │                     │
│               │ ├─ ResourceToolbar                    │                     │
│               │ ├─ ResourceGrid/List/Split            │                     │
│               │ └─ BulkActionBar                      │                     │
└───────────────┴───────────────────────────────────────┴─────────────────────┘
```

尺寸建议：

```text
ResourcesNav: 260px
ResourceInspector: 460px 默认，可折叠
ResourcesTopBar: 64px
Canvas padding: 22px
```

响应式：

```text
>= 1280px：三栏完整展示
900-1279px：Inspector 抽屉化
< 900px：Nav 抽屉化 + 单栏卡片流
```

---

## A2. ResourcesTopBar 顶部栏

### 视觉目标

不要像传统后台工具栏，而要像“资源控制台”。高度干净、轻、现代。

### 结构

```text
ResourcesTopBar
├── PageTitleBlock
│   ├── 标题：资源管理
│   └── 副标题：Skills / Agents / Rules / Memory / Hooks / MCP
├── GlobalResourceSearch
├── ScopeSwitcher
├── StatusHealthBadges
├── ViewModeSwitch
└── PrimaryActions
```

### 具体内容

#### PageTitleBlock

```text
资源管理
管理 Claude Code 的 Skills、Agents、Rules、Memory、Hooks、MCP 与项目上下文。
```

#### GlobalResourceSearch

placeholder：

```text
搜索资源、标签、路径、项目、会话、依赖...
```

搜索范围：

```text
name
description
tags
path
content
frontmatter
projectId
sessionId
dependency
diagnostic code
```

#### ScopeSwitcher

```text
全部
全局
用户
项目
当前会话
```

对应 enum：

```ts
type ResourceScopeFilter = "all" | "global" | "user" | "project" | "session";
```

#### StatusHealthBadges

显示：

```text
Ready 128
Warning 7
Error 2
MCP Online 3
Hooks 12
```

点击 badge 后设置筛选。

#### ViewModeSwitch

```text
Grid
List
Split
Graph
```

P0 必须实现 Grid / List / Split。Graph 可先显示 Coming soon，但数据结构预留。

#### PrimaryActions

```text
+ 新建资源
导入
扫描
诊断
批量操作
```

按钮层级：

```text
主按钮：+ 新建资源
次按钮：扫描 / 导入
文本按钮：诊断 / 批量操作
```

---

## A3. ResourcesNav 左侧导航

左侧不再是当前横向 tab，而是完整资源导航面板。

```text
ResourcesNav
├── QuickFilters
├── ResourceTypeNav
├── StatusFacets
├── ScopeTree
└── SavedViews
```

### QuickFilters

```text
全部资源
当前会话已使用
当前项目资源
收藏
最近更新
有风险
待修复
```

### ResourceTypeNav

```text
Overview
Skills
Agents
Rules
Memory
Hooks
MCP
Templates
CLAUDE.md
Packs
Diagnostics
```

每项显示数量：

```text
Skills        96
Agents        12
Hooks          8
MCP            4
```

### StatusFacets

```text
Ready
Warning
Error
Inactive
Missing dependency
Invalid frontmatter
Path missing
```

### ScopeTree

```text
Global Resources
User Resources ~/.claude
Project Resources
  ├── 默认项目
  ├── Ctrl-CC
  └── Other Project
Session Overlays
  ├── 当前 Workspace 会话
  └── 最近会话
```

### SavedViews

```text
常用资源
Claude CLI Debug Pack
Tauri UI Pack
Project Review Pack
```

---

## A4. OverviewStrip 概览条

位于 Canvas 顶部，6 张信息卡：

```text
总资源数
当前项目资源
当前会话激活
有风险资源
MCP 在线
最近使用
```

每张卡结构：

```text
数字
标题
趋势 / 状态
点击筛选
```

示例：

```text
128
总资源
+12 this month

4
当前会话激活
2 Skills · 1 Agent · 1 MCP
```

缺失数据：

```text
Unavailable
Not scanned
Not configured
```

---

## A5. ResourcesCanvas 主内容区

### 默认视图：Grid 卡片流

每张 ResourceCard：

```text
ResourceCard
├── Header
│   ├── TypeIcon
│   ├── Name
│   ├── HealthDot
│   └── MoreMenu
├── Description
├── Tags
├── Scope / PathTail
├── UsageMiniStats
├── DiagnosticsMini
└── QuickActions
```

#### Card Header

示例：

```text
[Skill] backend-patterns       Ready
```

#### UsageMiniStats

```text
3 Projects
1 Active Session
Used 12 times
```

#### DiagnosticsMini

```text
Ready
or
2 warnings
or
1 error: invalid frontmatter
```

#### QuickActions

```text
用于当前会话
插入 Chat
用于项目
诊断
```

注意：如果当前没有 active session：

```text
用于当前会话 -> disabled + tooltip: No active Workspace session
插入 Chat -> disabled
```

---

## A6. List 表格视图

列：

```text
名称
类型
作用域
健康
启用
使用次数
当前会话
项目
最近修改
操作
```

每行操作：

```text
查看
插入 Chat
用于项目
诊断
更多
```

适合批量管理。

---

## A7. Split 分栏视图

延续用户习惯，但升级视觉：

```text
左：紧凑资源列表
右：详情工作台
```

适合编辑和查看内容。

---

## A8. Graph 视图

P0 可不完整实现，但必须预留：

```text
ResourceGraphView
├── ProjectNode
├── SessionNode
├── SkillNode
├── AgentNode
├── HookNode
├── MCPNode
├── RuleNode
└── MemoryNode
```

关系：

```text
Project activates Resource
Session uses Resource
Agent depends on MCP
Hook watches Tool
Skill references Rule
```

---

## A9. ResourceInspector 右侧详情工作台

不是简单内容预览，而是完整资源操作面板。

```text
ResourceInspector
├── InspectorHeader
├── InspectorTabs
│   ├── 概览
│   ├── 内容
│   ├── 使用
│   ├── 激活
│   ├── 依赖
│   ├── 诊断
│   └── 历史
└── InspectorActionBar
```

### InspectorHeader

显示：

```text
资源名
类型徽章
健康状态
作用域
路径
收藏 / Pin / More
```

### 概览 Tab

字段：

```text
名称
描述
类型
作用域
来源
路径
标签
最后修改
创建时间
启用状态
健康状态
适配项目类型
```

### 内容 Tab

支持：

```text
Markdown viewer
Code viewer
Frontmatter collapse
Raw source
Edit mode
Diff mode
```

内容区不应像灰色大文本框，而应像高级文档阅读器：

```text
标题区
目录区
正文卡片
代码块
frontmatter badge
```

### 使用 Tab

显示：

```text
Referenced Projects
Referenced Sessions
Recent Usage Timeline
Console Recommendations
Dock Quick Insert History
```

### 激活 Tab

最重要，必须包含：

```text
用于当前会话
插入当前 ChatComposer
用于当前项目
复制引用
加入 Session Context Stack
Pin 到当前项目
克隆到项目作用域
```

不同资源类型按钮启用规则不同：

| 资源类型 | 用于当前会话 | 插入 Chat | 用于项目 | 说明 |
|---|---:|---:|---:|---|
| skill | yes | yes | yes | 可注入 prompt，也可复制到项目资源 |
| template | yes | yes | yes | 主要插入 ChatComposer |
| memory | yes | yes | yes | 可加入上下文或同步到项目 |
| rule | partial | partial | yes | 项目规则优先 |
| hook | no | no | yes | 配置型资源 |
| mcp | no | no | yes | 配置型资源 |
| agent | yes | yes | yes | 可引用/提示，也可配置到项目 |
| claude-context | no | partial | yes | 主要是 CLAUDE.md |
| pack | yes | partial | yes | 批量应用 |

### 依赖 Tab

显示：

```text
Dependencies
Dependents
Missing references
Conflicts
Scope overrides
```

### 诊断 Tab

检查：

```text
Frontmatter valid
Path exists
Content non-empty
MCP JSON valid
Hook executable
Referenced files exist
Conflicts with project settings
```

每条诊断：

```text
severity
title
detail
fixable
fix action
```

### 历史 Tab

P0 可显示：

```text
最近修改时间
使用记录
扫描记录
```

P1 接 Git history。

---

## A10. Create Resource Wizard

不要只是“新建文件”。必须是模板向导：

```text
Step 1: 选择资源类型
Step 2: 选择作用域
Step 3: 填写名称/描述/标签
Step 4: 选择模板
Step 5: 预览生成内容
Step 6: 创建并可选立即激活
```

资源类型模板：

```text
Skill
Agent
Rule
Memory
Hook
MCP Config
Prompt Template
CLAUDE.md
Pack
```

---

## A11. Bulk Action Bar

当多选时出现：

```text
已选择 6 个资源
[批量启用] [批量禁用] [加入当前项目] [加入当前会话] [收藏] [诊断] [删除]
```

危险操作：

```text
删除
覆盖项目资源
修改 MCP/Hook 配置
```

必须二次确认。

---

## A12. Empty / Error / Unavailable 状态

必须有高质量空状态：

### 无资源

```text
还没有资源
扫描 ~/.claude 或为当前项目创建第一个 Skill / Agent / MCP 配置。

[扫描资源] [新建资源]
```

### 无当前会话

```text
当前没有打开的 Workspace 会话
启动 Claude 会话后，即可将资源插入 Chat 或用于当前会话。

[打开 Workspace] [新建 Claude 会话]
```

### 资源不可用

```text
资源不可用
路径不存在、内容为空或配置无法解析。

[运行诊断] [重新扫描]
```

---

# Part B：Resources × Workspace/Chat 运行时连接专项方案

## B0. 总原则

Resources 不直接运行 Claude CLI。  
Resources 通过 `ResourceActivationBridge` 连接到：

```text
ProjectsStore
WorkspaceStore
RuntimeStore
ChatComposer
Claude Code CLI PTY Runtime
Diagnostics
Console
AI Dock
```

核心数据流：

```text
ResourceItem
  -> ResourceActivationBridge
  -> SessionContextStack / ProjectResourceOverlay / ChatComposerDraft
  -> writeToPty 或 project/.claude config
  -> Claude Code CLI reads/receives
```

---

## B1. 资源分三类处理

### 1. 上下文注入型资源

包括：

```text
skill
template
memory
agent reference
prompt snippet
```

运行逻辑：

```text
读取资源内容
生成 ResourceContextBlock
插入 ChatComposer draft 或直接发送到 PTY
记录 ResourceUsageRecord
Workspace Active Resources 更新
```

### 2. 配置型资源

包括：

```text
hook
mcp
rule
claude-context
project CLAUDE.md
settings.json
```

运行逻辑：

```text
复制/写入/同步到 project/.claude 或 ~/.claude
触发 Diagnostics
提示用户重启/继续 Claude session 或新会话生效
记录 AuditLog
```

注意：不要在运行中的 Claude 会话里假装配置已立即生效。需要明确：

```text
Applied to project. It will be available to new Claude sessions.
```

### 3. 命令型资源

包括：

```text
slash command
hook test command
diagnostic command
skill invocation shortcut
```

运行逻辑：

```text
插入 ChatComposer
或 writeToPty(ptySessionId, command + "\r")
```

---

## B2. 新增核心类型

创建：

```text
src/features/resources/types/resourceRuntimeTypes.ts
```

```ts
export interface ResourceContextBlock {
  id: string;
  resourceId: string;
  title: string;
  type: "skill" | "template" | "memory" | "agent" | "rule" | "custom";
  content: string;
  insertionMode: "composer-draft" | "send-to-pty" | "session-context";
  createdAt: string;
}

export interface ActiveSessionResource {
  id: string;
  resourceId: string;
  sessionId: string;
  projectId: string;
  activationType: "inserted" | "attached" | "configured" | "recommended";
  title: string;
  summary: string;
  activatedAt: string;
}

export interface ProjectResourceOverlay {
  id: string;
  resourceId: string;
  projectId: string;
  scope: "project";
  targetPath?: string | null;
  status: "pending" | "applied" | "failed";
  message?: string | null;
  appliedAt?: string | null;
}
```

---

## B3. WorkspaceStore 需要新增能力

在 WorkspaceStore 中新增：

```ts
interface WorkspaceState {
  composerDrafts: Record<string, string>;
  activeResourcesBySession: Record<string, ActiveSessionResource[]>;

  appendComposerDraft: (sessionId: string, text: string) => void;
  setComposerDraft: (sessionId: string, text: string) => void;
  addActiveSessionResource: (sessionId: string, resource: ActiveSessionResource) => void;
}
```

用途：

```text
资源插入 ChatComposer 时，不一定立即发送。
默认推荐：先 append 到 composer draft，由用户确认发送。
```

---

## B4. ChatComposer 需要支持资源块

ChatComposer UI 增加：

```text
Active Resources bar
Composer Draft area
Resource chips
```

示例：

```text
已加入上下文：
[backend-patterns] [claude-cli-debug] [project-memory]
```

Composer 发送时：

```text
finalPrompt =
  ResourceContextBlocks
  + userDraft
```

发送到：

```ts
writeToPty(ptySessionId, finalPrompt + "\r")
```

---

## B5. ResourceActivationBridge API

创建：

```text
src/features/resources/services/resourceActivationBridge.ts
```

必须实现：

```ts
export async function insertResourceIntoChat(resourceId: string, sessionId: string): Promise<void>;

export async function sendResourceToCurrentPty(resourceId: string, sessionId: string): Promise<void>;

export async function activateResourceForSession(resourceId: string, sessionId: string): Promise<void>;

export async function activateResourceForProject(resourceId: string, projectId: string): Promise<void>;

export async function cloneResourceToProject(resourceId: string, projectId: string): Promise<void>;

export async function applyResourcePackToProject(packId: string, projectId: string): Promise<void>;
```

### insertResourceIntoChat

```text
1. 读取 resource。
2. 判断类型是否允许插入 Chat。
3. 构建 ResourceContextBlock。
4. appendWorkspaceComposerDraft(sessionId, formattedBlock)。
5. addActiveSessionResource(sessionId, ...).
6. 写 ResourceUsageRecord。
7. 跳转 Workspace 并聚焦 ChatComposer。
```

### sendResourceToCurrentPty

```text
1. 读取 resource。
2. 构建 prompt。
3. 找到 session.ptySessionId。
4. 二次确认。
5. writeToPty(ptySessionId, prompt + "\r")。
6. 写 ResourceUsageRecord + AuditLog。
```

### activateResourceForSession

```text
1. 对上下文型资源：加入 activeResourcesBySession。
2. 对命令型资源：可作为 slash command/prompt chip。
3. 对配置型资源：提示应使用 activateResourceForProject。
```

### activateResourceForProject

```text
1. 判断资源类型。
2. 计算目标路径。
3. 对配置型资源写入 project/.claude 或 project/CLAUDE.md。
4. 对 skill/template 可复制到 project/.claude/resources 或项目自定义目录。
5. 写 ProjectResourceOverlay。
6. 写 AuditLog。
7. 触发 Diagnostics。
```

---

## B6. 资源内容格式化规范

插入 ChatComposer 时，不要直接把文件原文硬塞进去。需要标准包装：

```text
<resource_context name="backend-patterns" type="skill" path="...">
...resource content...
</resource_context>

用户问题：
```

或者使用 Markdown：

```md
### Resource Context: backend-patterns

- Type: skill
- Path: ...
- Scope: user

```resource
...
```

---
```

建议 P0 使用 Markdown 包装，方便用户看懂。

---

## B7. ResourceUsageTracker

创建：

```text
src/features/resources/services/resourceUsageTracker.ts
```

实现：

```ts
export function recordResourceUsage(record: Omit<ResourceUsageRecord, "id" | "ts">): void;
export function getUsageByResource(resourceId: string): ResourceUsageRecord[];
export function getUsageBySession(sessionId: string): ResourceUsageRecord[];
export function getUsageByProject(projectId: string): ResourceUsageRecord[];
```

P0 可存在 Zustand store。P1 接 SQLite。

---

## B8. 与 Projects 的连接

Projects 页面需要显示：

```text
Project Resources
Active Resource Packs
Resource Health
```

从 Projects 进入 Resources：

```ts
navigateToResources({ projectId, scope: "project" })
```

Resources 返回 Projects：

```ts
navigateToProjects(projectId)
```

---

## B9. 与 Console 的连接

Console Daily：

```text
资源健康：Ready / Warning / Error
最近使用资源
当前会话 active resources
```

Console Pro：

```text
资源使用排行
资源风险排行
MCP/Hook 状态统计
```

---

## B10. 与 AI Dock 的连接

AI Dock Snapshot 增加：

```ts
resources: {
  activeForCurrentSession: number;
  recent: DockResourceSummary[];
  warnings: number;
  errors: number;
}
```

Dock 不管理完整资源，只显示：

```text
Active resources count
Recent resources
Resource warning dot
Quick insert favorite resources
```

Quick insert 的动作：

```text
Dock -> dock.action(insert-resource)
Main -> ResourceActivationBridge.insertResourceIntoChat()
```

P0 可先只显示数量和风险，不实现 quick insert。

---

## B11. 与 Diagnostics 的连接

Diagnostics 增加 Resources Diagnostics：

```text
scan resource paths
parse resources
validate frontmatter
validate hook executable
validate mcp json
validate references
validate project overlay
```

ResourceDiagnosticsPanel 调用同一套 diagnostics service。

---

# Part C：组件与文件拆分

## C1. 新增 / 重构文件

```text
src/features/resources/
├── pages/
│   └── ResourcesSurface.tsx
├── components/
│   ├── ResourcesTopBar.tsx
│   ├── ResourcesOverviewStrip.tsx
│   ├── ResourcesLeftNav.tsx
│   ├── ResourcesCanvas.tsx
│   ├── ResourcesGridView.tsx
│   ├── ResourcesListView.tsx
│   ├── ResourcesSplitView.tsx
│   ├── ResourcesGraphView.tsx
│   ├── ResourceCard.tsx
│   ├── ResourceDetailsPanel.tsx
│   ├── ResourceContentViewer.tsx
│   ├── ResourceUsagePanel.tsx
│   ├── ResourceActivationPanel.tsx
│   ├── ResourceDependencyPanel.tsx
│   ├── ResourceDiagnosticsPanel.tsx
│   ├── ResourceCreateWizard.tsx
│   ├── ResourceBulkActionBar.tsx
│   └── ResourceEmptyState.tsx
├── stores/
│   └── resourcesStore.ts
├── services/
│   ├── resourceScanner.ts
│   ├── resourceParser.ts
│   ├── resourceDiagnostics.ts
│   ├── resourceActivationBridge.ts
│   ├── resourceUsageTracker.ts
│   ├── resourceNavigationActions.ts
│   └── resourceTemplates.ts
├── types/
│   ├── resourceTypes.ts
│   └── resourceRuntimeTypes.ts
└── styles/
    └── resources.css
```

---

# Part D：执行 Prompt

```text
请对 Ctrl-CC Resources Surface 执行最终 UI 蓝图重构 + Workspace/Chat 运行时连接专项实现。

目标：
将当前资源区从“文件列表 + 内容预览”升级为“资源中枢 / 能力中枢 / 上下文中枢 / Runtime Bridge”。

硬性要求：
1. 不改最左侧 AppRail。
2. 不破坏四主题：light / dark / pale-blue / warm-sand。
3. 视觉遵循 Neo Calm Industrial：温和、高级、现代、卡片化、低对比边框、大圆角。
4. 不做假数据。缺失状态显示 Unavailable / Not configured / Not scanned。
5. 资源区必须和 Workspace / Chat / Projects / Console / AI Dock / Diagnostics 全连接。
6. 资源区不直接运行 Claude CLI，只通过 ResourceActivationBridge 影响 ChatComposer、项目配置和当前 PTY 会话。

第一部分：UI 蓝图落地
- ResourcesTopBar：搜索、ScopeSwitcher、状态筛选、视图切换、健康徽章、新建/导入/扫描。
- ResourcesLeftNav：分类导航、状态筛选、作用域树、Saved Views。
- ResourcesOverviewStrip：总资源、当前项目资源、当前会话激活、有风险资源、MCP 在线、最近使用。
- ResourcesCanvas：Grid / List / Split 三视图，Graph 预留。
- ResourceDetailsPanel：概览 / 内容 / 使用 / 激活 / 依赖 / 诊断 / 历史。
- ResourceCreateWizard：新建 Skill / Agent / Rule / Memory / Hook / MCP / Template / CLAUDE.md / Pack。
- ResourceBulkActionBar：批量启用、禁用、收藏、诊断、用于项目、用于会话、删除。

第二部分：运行时连接
- 新增 ResourceActivationBridge。
- 新增 ResourceUsageTracker。
- WorkspaceStore 增加 composerDrafts 和 activeResourcesBySession。
- ChatComposer 显示 Active Resources chips，并支持资源块插入。
- 实现：
  insertResourceIntoChat(resourceId, sessionId)
  sendResourceToCurrentPty(resourceId, sessionId)
  activateResourceForSession(resourceId, sessionId)
  activateResourceForProject(resourceId, projectId)
  cloneResourceToProject(resourceId, projectId)
  applyResourcePackToProject(packId, projectId)

资源运行规则：
- Skill / Template / Memory：可插入 ChatComposer，可加入当前会话上下文。
- Hook / MCP / Rule / CLAUDE.md：配置型资源，用于当前项目，写入 project/.claude 或相关配置。
- Slash command / command template：可插入 ChatComposer 或写入 PTY。
- Pack：批量应用到项目或会话。

交付：
1. 输出修改文件清单。
2. 输出已完成能力和 P1/P2 能力。
3. 运行 npm run typecheck。
4. 运行 npm run build。
5. 如涉及 Tauri 命令，运行 cargo check --manifest-path src-tauri/Cargo.toml。
```

---

# Part E：验收标准

```text
[ ] 资源区视觉显著优于旧版。
[ ] 四主题完全兼容。
[ ] TopBar / LeftNav / OverviewStrip / Grid / List / Split / Inspector 全部存在。
[ ] 资源详情有概览、内容、使用、激活、依赖、诊断。
[ ] 可将 Skill/Template 插入当前 ChatComposer。
[ ] 可将资源用于当前会话，并显示 Active Resources。
[ ] 可将配置型资源用于当前项目。
[ ] 当前无 Workspace 会话时，插入 Chat 显示禁用和说明。
[ ] 资源使用记录可在 UsagePanel 看到。
[ ] Console 可以读取资源健康摘要。
[ ] AI Dock 可以读取当前会话 active resources 数量。
[ ] Diagnostics 可运行资源诊断。
[ ] 不影响最左侧 AppRail。
[ ] 不伪造 MCP 在线、Hook 状态、使用记录。
```
