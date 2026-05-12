# Ctrl-CC Commercial Product System Rebuild 10.0  
## Console × Projects × Resources × AI Dock 顶级商用级全面升级方案  
### 基于 Industrial Runtime Rebuild 9.0、当前 GitHub 代码审计、四主题设计系统与 100% / 200% / 500% 最终目标

> **可直接发送给 Claude CLI 执行。**  
> 本方案不是单页 UI 美化，也不是继续修补某个按钮，而是把 Ctrl-CC 的四个核心操作面：  
> **控制台 Console、项目管理 Projects、资源区 Resources、AI Dock 工作坞**  
> 全面升级为一个围绕 **真实 Claude Code CLI Runtime / Workspace / Chat / PTY / Resources / Diagnostics / Governance** 运作的商用级控制系统。
>
> 核心原则：  
> - 任何页面都不能绕过 RuntimeBridge。  
> - 任何页面都不能直接启动 PTY / Claude。  
> - 任何数据都不能假装存在。  
> - 任何失败都必须可见、可复制、可诊断、可恢复。  
> - 任何操作都必须有 traceId、source、target、status、audit。  
> - 四主题必须完整兼容：`light / dark / pale-blue / warm-sand`。  
> - 视觉必须达到温和、友好、现代、卡片化、信息清晰、可操作性强的商用软件水准。

---

# 0. 当前代码真实问题总览

根据当前仓库代码，四个页面存在共同结构性问题。

## 0.1 Console 当前仍是轻量统计页，不是 Runtime 首页

当前 `ConsoleSurface.tsx` 主要读取 legacy stores，并直接基于 session/project 统计 running、token、cost，然后跳转 workspace。它没有通过统一 `RuntimeBridge` 启动真实 Claude Runtime，也没有读取统一 RuntimeEvent / Diagnostics / ContractProbe。

结论：

```text
Console 目前是“漂亮的状态面板”，还不是“Runtime Mission Control”。
```

## 0.2 Projects 当前仍直接启动 PTY

当前 `ProjectsSurface.tsx` 直接导入 `startPtyV2ClaudeSession`，并在 `handleCreateSession()` 里手动：

```text
addSession
save_session_to_db
openSession
navigateTo('workspace')
startPtyV2ClaudeSession
```

结论：

```text
Projects 仍然是 Runtime split-brain 的主要来源。
Projects 必须退化为 RuntimeBridge 的客户端，不允许直接启动 PTY。
```

## 0.3 Resources 当前仍是文件查看器

当前 `ResourcesSurface.tsx` 是：

```text
Tabs: skills / agents / rules / memory / hooks / mcp
list_directory
read_file_content
write_file_content
delete_file
```

结论：

```text
Resources 当前是 ~/.claude 文件浏览器，不是资源中枢 / 上下文中枢 / 能力中枢。
```

## 0.4 AI Dock 当前只是主窗口内的悬浮窄条

当前 `AIDock.tsx` 被 `AppShell.tsx` 直接渲染在主窗口内，并读取 legacy sessionStore/openSessionStore/surfaceStore。它不是独立 Tauri Window，也没有 Snapshot Publisher / Dock Action Bridge。

结论：

```text
AI Dock 当前是 UI widget，不是常驻 Runtime Controller。
```

## 0.5 SurfaceHost 当前只有单层 ErrorBoundary

当前 `SurfaceHost.tsx` 只是根据 `activeSurface` 渲染 surface，并用单个 ErrorBoundary 包裹。这是必要的，但不足以支撑商用级稳定性。

必须升级为：

```text
SurfaceRuntimeBoundary
SurfaceDataBoundary
SurfaceActionBoundary
SurfaceDiagnosticsBoundary
```

---

# 1. 10.0 总体目标

## 1.1 100%：真实 Runtime 打通

```text
Project / Console / Dock 新建会话
  -> RuntimeBridge.startInteractiveSession
  -> RuntimeSession(uiSessionId, ptySessionId, traceId)
  -> Workspace 立即打开
  -> RuntimeKernel discovery + PTY start + Claude launch
  -> Terminal raw PTY
  -> ChatComposer writes same PTY
  -> ErrorLog / Diagnostics 可解释每一步
```

## 1.2 200%：语义增强和可视化

```text
statusLine collector
hooks collector
transcript reader
semantic event normalizer
tool cards
diff cards
permission cards
resource context cards
token/cost/context cards
timeline/replay
```

## 1.3 500%：系统级控制面

```text
Console = Mission Control
Projects = Project Operations Center
Resources = Capability and Context Center
AI Dock = Resident Runtime Controller
Diagnostics = Evidence Center
GitHub = Development Integration Center
Workspace = Execution Cockpit
```

---

# 2. 不可违反的底层工程规范

必须写入 `CLAUDE.md` 与 `docs/engineering/12_EIGHT_HONORS_AND_EIGHT_SHAMES.md`。

## 2.1 Runtime 单一事实源

```text
RuntimeBridge 是前端唯一入口。
RuntimeKernel 是后端唯一 Runtime owner。
UI surfaces 只能调用 RuntimeBridge，不允许直接 invoke PTY/Claude。
```

## 2.2 四个 ID 永远分离

```ts
type UiSessionId = string;      // ses-xxx
type PtySessionId = string;     // pty-uuid
type ClaudeSessionId = string;  // Claude 自己的 session id
type TraceId = string;          // trace-uuid
```

## 2.3 所有操作必须有 Action Contract

```ts
interface CtrlCcAction {
  id: string;
  traceId: TraceId;
  sourceSurface: "console" | "projects" | "workspace" | "resources" | "dock" | "github" | "diagnostics";
  type: string;
  target: {
    projectId?: string;
    uiSessionId?: string;
    ptySessionId?: string;
    resourceId?: string;
  };
  status: "queued" | "running" | "succeeded" | "failed" | "blocked";
  createdAt: string;
  updatedAt: string;
  error?: string | null;
}
```

## 2.4 所有页面只能读 SurfaceSnapshot

每个 surface 不直接拼散乱 store，而从 selector 得到稳定 snapshot：

```text
ConsoleSnapshot
ProjectsSnapshot
ResourcesSnapshot
DockSnapshot
WorkspaceSnapshot
```

## 2.5 错误统一

所有错误进入：

```text
RuntimeEventStore
ErrorStore bridge
SessionTimeline
DiagnosticBundle
AuditLog
```

禁止：

```text
顶部 toast 有错误，但 ErrorLog 没有。
页面显示失败，但 Diagnostics 没有 payload。
catch {} 静默吞错。
```

## 2.6 性能预算

```text
点击反馈 < 100ms
surface 切换 < 150ms
Workspace tab 打开 < 1s
Dock snapshot interval >= 500ms
大型列表虚拟化
PTY raw output 不进全量 React list
RuntimeEvent bounded 500/1000
```

---

# 3. 全局架构重建

## 3.1 新增全局层

```text
src/features/app-core/
├── navigation/
│   ├── navigationBus.ts
│   ├── navigationTypes.ts
│   └── navigationStore.ts
├── actions/
│   ├── actionBus.ts
│   ├── actionTypes.ts
│   └── actionStore.ts
├── snapshots/
│   ├── consoleSnapshot.ts
│   ├── projectsSnapshot.ts
│   ├── resourcesSnapshot.ts
│   └── dockSnapshot.ts
├── diagnostics/
│   ├── diagnosticBundleBuilder.ts
│   └── healthMatrix.ts
└── theme/
    ├── themeTokens.ts
    ├── themeBridge.ts
    └── surfaceTheme.ts
```

## 3.2 SurfaceShell 统一外壳

所有主页面必须使用同一个 `SurfaceFrame`：

```tsx
<SurfaceFrame
  surface="console"
  title="控制台"
  subtitle="Claude Code Runtime Mission Control"
  actions={...}
  diagnostics={...}
>
  ...
</SurfaceFrame>
```

文件：

```text
src/components/surface/SurfaceFrame.tsx
src/components/surface/SurfaceHeader.tsx
src/components/surface/SurfaceSearch.tsx
src/components/surface/SurfaceToolbar.tsx
src/components/surface/SurfaceInspector.tsx
src/components/surface/SurfaceEmptyState.tsx
src/components/surface/SurfaceHealthStrip.tsx
```

目的：

```text
视觉统一
错误统一
loading 统一
diagnostics 统一
动作反馈统一
```

---

# 4. 设计语言：Neo Calm Industrial 2.0

## 4.1 核心气质

```text
温和
干净
现代
略带新复古
低噪声
强信息层级
高可操作性
不冰冷
不幼稚
不游戏化过度
```

## 4.2 布局规律

```text
顶部：上下文 + 搜索 + 主操作
左侧：导航/筛选/上下文树
中间：卡片瀑布流 / 工作板 / 图表
右侧：Inspector / Diagnostics / Action panel
底部：可选命令条 / 状态条
```

## 4.3 卡片等级

```text
Level 1：Hero / Current mission card
Level 2：Runtime status / Project card / Resource card
Level 3：Mini KPI / Health badge / Action chip
Level 4：Timeline row / Audit row
```

## 4.4 颜色规则

所有颜色使用 token：

```text
--cc-bg
--cc-surface
--cc-surface-solid
--cc-surface-muted
--cc-border
--cc-border-soft
--cc-text
--cc-text-muted
--cc-text-soft
--cc-brand
--cc-brand-soft
--cc-green
--cc-green-soft
--cc-amber
--cc-amber-soft
--cc-red
--cc-red-soft
--cc-blue
--cc-blue-soft
--cc-shadow-floating
```

禁止硬编码颜色，除非是 design token 定义文件。

---

# 5. Console 10.0：Mission Control

## 5.1 产品定位

Console 是用户打开软件后的首页。它不是单纯统计页，而是：

```text
Runtime 首页
健康中心
任务入口
恢复入口
今日工作台
系统级控制面
```

## 5.2 页面布局

```text
┌──────────────────────────────────────────────────────────────────────┐
│ ConsoleTopCommandBar                                                 │
├──────────────────────────────────────────────────────────────────────┤
│ WelcomeMissionHero                                                   │
├─────────────────────┬─────────────────────┬──────────────────────────┤
│ RuntimeHealthStrip  │ QuickStartDeck      │ NeedAttentionQueue        │
├─────────────────────┴─────────────────────┴──────────────────────────┤
│ ActiveWorkBoard                                                      │
├───────────────────────────────┬──────────────────────────────────────┤
│ TodayPulseWaterfall           │ RecentActivityTimeline               │
├───────────────────────────────┴──────────────────────────────────────┤
│ ProAnalyticsTabs                                                     │
└──────────────────────────────────────────────────────────────────────┘
```

## 5.3 ConsoleTopCommandBar

功能：

```text
全局搜索
Daily / Pro switch
Runtime health badges
New Session
Run Diagnostics
Open AI Dock
```

主按钮：

```text
+ 新建 Claude 会话
```

点击链路：

```text
Console -> RuntimeBridge.startInteractiveSession -> Workspace
```

不允许：

```text
Console 只 navigateTo('workspace') 但不创建 RuntimeSession
```

## 5.4 WelcomeMissionHero

内容：

```text
晚上好，JananZZZ
Claude Runtime 已准备好 / 或 Runtime 未就绪
推荐操作：继续最近会话 / 新建会话 / 运行诊断
```

状态：

```text
ready: 绿色温和
warning: amber
error: red-soft with diagnostics CTA
idle: calm neutral
```

## 5.5 RuntimeHealthStrip

展示：

```text
Claude CLI
PTY Kernel
RuntimeBridge
Workspace
Git
Resources
AI Dock
Diagnostics
DB
Watchdog
```

每个 health pill 点击：

```text
打开 Diagnostics 对应 section
```

缺失能力显示：

```text
Unavailable
Not scanned
Not configured
```

## 5.6 QuickStartDeck

固定 6 个卡片：

```text
新建 Claude 会话
继续最近会话
打开项目
打开当前 Workspace
插入常用资源
运行诊断
```

每张卡必须有：

```text
enabled / disabled reason
trace preview
target project/session
```

## 5.7 ActiveWorkBoard

显示运行中的真实 RuntimeSession：

```text
Project
Session
Status
PTY alive
Claude status
waiting permission
risk count
changed files
last output tail
```

操作：

```text
Open Workspace
Send Ctrl+C
Stop
Open Diagnostics
Export Log
```

所有危险操作二次确认。

## 5.8 NeedAttentionQueue

来源：

```text
RuntimeEvent
PermissionEvent
RiskEvent
GitConflict
ResourceDiagnostic
ClaudeDiscoveryFailure
```

不允许 Console 直接批准高风险，只能：

```text
Open Workspace / Open Permission Center / Open Diagnostics
```

## 5.9 ProAnalyticsTabs

Tabs：

```text
Overview
Projects
Sessions
Tokens
Cost
Time
Code
Tools
Resources
Risks
System
Audit
```

时间筛选器只在 Pro 出现：

```text
today / yesterday / 7d / 1m / 6m / 1y / custom
```

所有缺失数据必须显示原因：

```text
Token data requires statusLine integration.
Tool analytics requires hook events.
Cost unavailable: pricing not configured.
```

## 5.10 Console 文件结构

```text
src/features/console/
├── pages/ConsoleSurface.tsx
├── components/
│   ├── ConsoleTopCommandBar.tsx
│   ├── WelcomeMissionHero.tsx
│   ├── RuntimeHealthStrip.tsx
│   ├── QuickStartDeck.tsx
│   ├── ActiveWorkBoard.tsx
│   ├── ActiveRuntimeCard.tsx
│   ├── NeedAttentionQueue.tsx
│   ├── TodayPulseWaterfall.tsx
│   ├── RecentActivityTimeline.tsx
│   ├── ProAnalyticsTabs.tsx
│   ├── ProAnalyticsHeader.tsx
│   ├── ConsoleInspectorDrawer.tsx
│   └── ConsoleEmptyState.tsx
├── services/
│   ├── consoleSnapshotBuilder.ts
│   ├── consoleRuntimeActions.ts
│   ├── consoleNavigationActions.ts
│   └── consoleExportService.ts
├── stores/consoleStore.ts
├── types/consoleTypes.ts
└── styles/console.css
```

## 5.11 Console 执行规则

```text
Console 不直接 import interactionAdapter。
Console 不直接 invoke pty_*。
Console 只调用 RuntimeBridge / NavigationBus / ActionBus。
Console 的所有按钮必须有 disabled reason。
Console 的每个失败必须进入 ErrorLog。
```

---

# 6. Projects 10.0：Project Operations Center

## 6.1 产品定位

Projects 是：

```text
项目管理
会话生命周期管理
Runtime 启动入口
Workspace 路由中枢
Resources / GitHub / Console / Diagnostics 上下文桥
```

不是：

```text
静态项目列表
fake session 列表
直接 PTY launcher
```

## 6.2 页面布局

```text
┌──────────────────────────────────────────────────────────────────────┐
│ ProjectsTopCommandBar                                                │
├───────────────┬───────────────────────────────────────┬──────────────┤
│ ProjectNav    │ ProjectOperationsCanvas               │ Inspector    │
│ 280px         │ flex                                  │ 420px        │
│               │ ├─ ProjectHero                        │              │
│               │ ├─ ProjectSignalDeck                  │              │
│               │ ├─ RuntimeActionRibbon                │              │
│               │ ├─ SessionWaterfall                   │              │
│               │ ├─ ContextGraphPreview                │              │
│               │ └─ IntegrationCards                   │              │
└───────────────┴───────────────────────────────────────┴──────────────┘
```

## 6.3 ProjectNav

分区：

```text
Favorites
Running
Needs Attention
All Projects
Archived
Missing Path
```

每个 project row：

```text
status dot
name
path tail
running count
risk count
git branch
```

## 6.4 ProjectHero

显示：

```text
Project name
Path
Git branch / dirty
Claude readiness
Running sessions
Last activity
```

主操作：

```text
New Claude Session
Continue
Open Workspace
Resources
GitHub
Diagnostics
```

## 6.5 RuntimeActionRibbon

按钮：

```text
+ 新建 Claude 会话
继续最近会话
恢复指定会话
分支会话
运行 /doctor
运行 /cost
打开 CLAUDE.md
```

规则：

```text
新建/继续/恢复/分支全部走 RuntimeBridge。
Slash command 不直接由 Projects 写 PTY；它应打开 Workspace 并预填 Composer 或经 RuntimeBridge.write 写当前 active session。
```

## 6.6 SessionWaterfall

卡片信息：

```text
Session name
Runtime status
PTY status
Claude session id/name
Model
CWD
Token / cost
Files changed
Risk / waiting
Last output tail
```

操作：

```text
Open Workspace
Resume
Fork
Stop
Export Log
Open Replay
Open Diagnostics
```

## 6.7 ProjectInspector

Tabs：

```text
Overview
Sessions
Runtime
Resources
GitHub
Risks
Audit
Diagnostics
Settings
```

## 6.8 Projects 文件结构

```text
src/features/projects/
├── pages/ProjectsSurface.tsx
├── components/
│   ├── ProjectsTopCommandBar.tsx
│   ├── ProjectNav.tsx
│   ├── ProjectOperationsCanvas.tsx
│   ├── ProjectHero.tsx
│   ├── ProjectSignalDeck.tsx
│   ├── RuntimeActionRibbon.tsx
│   ├── SessionWaterfall.tsx
│   ├── SessionRuntimeCard.tsx
│   ├── IntegrationCards.tsx
│   ├── ContextGraphPreview.tsx
│   ├── ProjectInspector.tsx
│   └── ProjectEmptyState.tsx
├── services/
│   ├── projectSnapshotBuilder.ts
│   ├── projectRuntimeActions.ts
│   └── projectNavigationActions.ts
├── stores/projectsStore.ts
├── types/projectTypes.ts
└── styles/projects.css
```

## 6.9 Projects 必改点

从当前 `ProjectsSurface.tsx` 删除：

```ts
startPtyV2ClaudeSession
```

替换为：

```ts
RuntimeBridge.startInteractiveSession(...)
RuntimeBridge.resumeSession(...)
RuntimeBridge.forkSession(...)
RuntimeBridge.stop(...)
NavigationBus.openWorkspace(...)
```

---

# 7. Resources 10.0：Capability & Context Center

## 7.1 产品定位

Resources 从文件浏览器升级为：

```text
能力中枢
资源中枢
上下文中枢
项目配置中枢
Chat/Workspace ResourceActivationBridge
```

## 7.2 页面布局

```text
┌──────────────────────────────────────────────────────────────────────┐
│ ResourcesTopCommandBar                                               │
├───────────────┬───────────────────────────────────────┬──────────────┤
│ ResourceNav   │ ResourcesCanvas                       │ Inspector    │
│ 280px         │ Grid/List/Split/Graph                  │ 460px        │
└───────────────┴───────────────────────────────────────┴──────────────┘
```

## 7.3 Resource types

```text
Skill
Agent
Rule
Memory
Hook
MCP
Template
Slash Command
CLAUDE.md
Settings
Pack
Project Overlay
```

## 7.4 ResourcesTopCommandBar

功能：

```text
Global search
Scope switch: all/global/user/project/session
Health filters
View switch: grid/list/split/graph
Scan
Create
Import
Diagnostics
```

## 7.5 ResourceNav

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

状态筛选：

```text
Ready
Warning
Error
Inactive
Missing dependency
Invalid frontmatter
Path missing
```

## 7.6 ResourceCard

内容：

```text
type
name
health
scope
path tail
tags
used by current project/session
diagnostics mini
quick actions
```

Quick actions：

```text
Insert into Chat
Attach to Session
Apply to Project
Clone to Project
Diagnose
Open Raw
```

## 7.7 ResourceInspector

Tabs：

```text
Overview
Content
Usage
Activation
Dependencies
Diagnostics
History
```

Activation tab 是核心：

```text
插入当前 ChatComposer
加入当前会话 ContextStack
发送到当前 PTY
应用到当前项目
复制到 project/.claude
加入 Resource Pack
```

## 7.8 ResourceActivationBridge

```ts
export const ResourceActivationBridge = {
  insertIntoChat(resourceId, uiSessionId),
  attachToSession(resourceId, uiSessionId),
  sendToCurrentPty(resourceId, uiSessionId),
  applyToProject(resourceId, projectId),
  cloneToProject(resourceId, projectId),
  applyPackToProject(packId, projectId),
  diagnose(resourceId),
};
```

规则：

```text
Resources 不直接运行 Claude。
Resources 只能写 Composer draft、SessionContextStack、ProjectOverlay，或通过 RuntimeBridge.write 发送已确认内容。
```

## 7.9 资源插入格式

```md
### Resource Context: <name>

- Type: <type>
- Scope: <scope>
- Path: <path>

```resource
<content>
```

---
```

## 7.10 Resources 文件结构

```text
src/features/resources/
├── pages/ResourcesSurface.tsx
├── components/
│   ├── ResourcesTopCommandBar.tsx
│   ├── ResourceNav.tsx
│   ├── ResourceOverviewStrip.tsx
│   ├── ResourceGridView.tsx
│   ├── ResourceListView.tsx
│   ├── ResourceSplitView.tsx
│   ├── ResourceGraphView.tsx
│   ├── ResourceCard.tsx
│   ├── ResourceInspector.tsx
│   ├── ResourceContentViewer.tsx
│   ├── ResourceActivationPanel.tsx
│   ├── ResourceDiagnosticsPanel.tsx
│   ├── ResourceCreateWizard.tsx
│   └── ResourceBulkActionBar.tsx
├── services/
│   ├── resourceScanner.ts
│   ├── resourceParser.ts
│   ├── resourceActivationBridge.ts
│   ├── resourceDiagnostics.ts
│   ├── resourceUsageTracker.ts
│   └── resourceTemplates.ts
├── stores/resourcesStore.ts
├── types/resourceTypes.ts
└── styles/resources.css
```

---

# 8. AI Dock 10.0：Resident Runtime Controller

## 8.1 产品定位

AI Dock 是：

```text
常驻 Runtime Controller
Workspace/Chat 遥控器
Attention Queue
Quick Prompt to active PTY
Global Navigation Launcher
Health Mini Dashboard
```

不是：

```text
第二个 Terminal
第二个 Chat
假 Claude 客户端
绕过 RuntimeBridge 的快捷入口
```

## 8.2 架构选择

最终形态固定为：

```text
Tauri independent window
label = ai-dock
route = /dock
SnapshotPublisher from main
DockActionBridge in main
DockSurface in dock window
```

当前主窗口内 `components/dock/AIDock.tsx` 必须改为：

```text
P0: DockLauncher / DockFallbackBadge
P1: 独立 ai-dock window
```

不要继续把完整 dock 作为主窗口 fixed div。

## 8.3 Dock modes

```text
Quiet: 52 × 220
Calm: 320 × 460
Focus: 520 × 680
```

## 8.4 DockSnapshot

```ts
interface AIDockSnapshot {
  generatedAt: string;
  appTheme: CtrlCcTheme;
  dockSettings: DockSettings;
  runtime: {
    claude: HealthItem;
    pty: HealthItem;
    runtimeBridge: HealthItem;
    diagnostics: HealthItem;
  };
  activeSession: DockSessionSummary | null;
  runningSessions: DockSessionSummary[];
  attention: DockAttentionItem[];
  resources: {
    activeForCurrentSession: number;
    warnings: number;
    errors: number;
  };
  recentEvents: DockEventItem[];
}
```

## 8.5 Dock actions

```ts
type DockAction =
  | { type: "open-console" }
  | { type: "open-project"; projectId?: string }
  | { type: "open-workspace"; uiSessionId: string }
  | { type: "open-resources"; projectId?: string; uiSessionId?: string }
  | { type: "open-diagnostics"; projectId?: string; uiSessionId?: string }
  | { type: "send-prompt"; uiSessionId: string; prompt: string }
  | { type: "send-ctrl-c"; uiSessionId: string }
  | { type: "stop-session"; uiSessionId: string }
  | { type: "set-mode"; mode: DockMode }
  | { type: "hide-dock" };
```

全部由主窗口 `DockActionBridge` 执行，Dock window 不直接操作 RuntimeStore。

## 8.6 Dock 视觉

```text
不透明或半透明可选，但 P0 不依赖 transparent。
大圆角
软阴影
主题跟随主程序
状态灯轻微 pulse
风险只一次性吸引注意，之后 steady
```

## 8.7 Dock 文件结构

```text
src/features/dock/
├── pages/AIDockSurface.tsx
├── components/
│   ├── DockRoot.tsx
│   ├── DockQuietMode.tsx
│   ├── DockCalmMode.tsx
│   ├── DockFocusMode.tsx
│   ├── DockSessionCard.tsx
│   ├── DockAttentionQueue.tsx
│   ├── DockQuickPrompt.tsx
│   ├── DockActionGrid.tsx
│   └── DockStatusLights.tsx
├── services/
│   ├── dockWindowService.ts
│   ├── dockSnapshotBuilder.ts
│   ├── dockSnapshotPublisher.ts
│   ├── dockActionBridge.ts
│   └── dockThemeBridge.ts
├── stores/dockStore.ts
├── types/dockTypes.ts
└── styles/dock.css

src-tauri/src/commands/dock_window.rs
```

---

# 9. 四页面互联矩阵

| 来源 | 目标 | 动作 | 规则 |
|---|---|---|---|
| Console | Workspace | 新建/继续/打开会话 | RuntimeBridge |
| Console | Projects | 打开项目上下文 | NavigationBus |
| Console | Resources | 打开资源健康/当前项目资源 | NavigationBus |
| Console | Dock | 显示/隐藏/模式切换 | DockWindowService |
| Projects | Workspace | open session | RuntimeBridge + NavigationBus |
| Projects | Resources | project resources | NavigationBus(projectId) |
| Projects | GitHub | repo/pr/issues | NavigationBus(projectId) |
| Resources | Workspace | insert resource into chat | ResourceActivationBridge |
| Resources | Projects | apply resource to project | ProjectOverlay |
| Dock | Workspace | open current session | DockActionBridge |
| Dock | Runtime | prompt / ctrl-c / stop | DockActionBridge -> RuntimeBridge |

---

# 10. 稳定性设计

## 10.1 SurfaceBoundary

每个大 surface 内部必须有：

```text
SurfaceErrorBoundary
PanelErrorBoundary
WidgetErrorBoundary
ActionErrorBoundary
```

## 10.2 Action status

所有按钮点击后必须：

```text
立即反馈
显示 running
成功/失败明确
失败可复制 diagnostics
```

## 10.3 Safe Mode

触发条件：

```text
React #185
Runtime start failed 3 times / 60s
Dock snapshot storm
EventLog > threshold
PTY output flood
```

Safe Mode 行为：

```text
停用自动扫描
停用自动启动 Runtime
停用 Dock publisher
只显示 Diagnostics 和 Recovery actions
```

## 10.4 Circuit Breaker

```text
Runtime start circuit
Claude discovery circuit
Dock snapshot circuit
Resource scan circuit
Git scan circuit
```

---

# 11. 执行阶段

## Stage A：全仓库逐行审计

先执行 Industrial Runtime Rebuild 9.0 中的：

```text
scripts/audit_repo_inventory.mjs
scripts/audit_static_checks.mjs
docs/audit/files/*.md
```

未完成不得进入 UI 实现。

## Stage B：Runtime 单一事实源

```text
RuntimeBridge
RuntimeKernel
RuntimeStore
RuntimeEventStore
Diagnostics
Contract Tests
```

通过后才允许重构页面。

## Stage C：App Core

```text
NavigationBus
ActionBus
Snapshot builders
SurfaceFrame
ThemeBridge
ErrorHub
```

## Stage D：Console 10.0

迁移旧 `src/surfaces/console/ConsoleSurface.tsx` 到新 feature 结构。

验收：

```text
Console 新建会话真正进入 RuntimeBridge
ActiveWorkBoard 显示 RuntimeSession
Pro 数据缺失显示原因
```

## Stage E：Projects 10.0

迁移旧 `ProjectsSurface.tsx`。

验收：

```text
Projects 不再 import interactionAdapter
New Session / Continue / Resume / Fork 都走 RuntimeBridge
```

## Stage F：Resources 10.0

迁移旧 `ResourcesSurface.tsx`。

验收：

```text
资源区不再只是文件列表
ResourceActivationBridge 可插入 ChatComposer
配置型资源应用到项目
```

## Stage G：AI Dock 10.0

迁移旧 `components/dock/AIDock.tsx`。

验收：

```text
Dock 可独立 Window
Dock 读取 Snapshot
Dock action 回到 main 执行
```

## Stage H：Cross-surface E2E

测试：

```text
Console -> New Session -> Workspace -> Send Chat
Projects -> New Session -> Workspace -> Stop
Resources -> Insert Skill -> ChatComposer -> Send
Dock -> Quick Prompt -> active PTY
Dock -> Ctrl+C
Resources -> Apply MCP -> Project -> Diagnostics
```

---

# 12. Claude CLI 直接执行 Prompt

```text
执行 Ctrl-CC Commercial Product System Rebuild 10.0。

本任务基于 Industrial Runtime Rebuild 9.0，不允许继续补丁式修 UI。目标是全面升级 Console、Projects、Resources、AI Dock，并且必须遵守底层工程规范：

- RuntimeBridge 是前端唯一 Runtime 入口。
- RuntimeKernel 是后端唯一 Runtime owner。
- UI surfaces 不允许直接 import interactionAdapter 或 invoke pty_*。
- UiSessionId / PtySessionId / ClaudeSessionId / TraceId 必须分离。
- 所有 action 必须有 traceId。
- 所有错误必须进入 RuntimeEventStore / ErrorLog / Diagnostics。
- 四主题必须完整兼容。
- 不允许假数据，缺失信息显示 Unavailable / Not configured / Not scanned。
- 不允许 catch {} 静默吞错。
- 不允许 raw PTY output 进入无限 React state。
- 不允许 surface 自己创建 fake session。

第一步：
先执行 Industrial Runtime Rebuild 9.0 的全仓库审计：
1. 生成 docs/audit/repo-inventory.md/json。
2. 生成 docs/audit/static-findings.md/json。
3. 为每个源码文件生成 docs/audit/files/*.md。
4. 未完成审计前不改业务代码。

第二步：
完成 Runtime 单一事实源：
1. RuntimeBridge.startInteractiveSession/write/resize/ctrlC/stop。
2. RuntimeKernel runtime_start_interactive/runtime_write/runtime_stop/runtime_list_sessions。
3. 后端 registry key = ptySessionId。
4. 所有事件带 uiSessionId + ptySessionId + traceId。
5. Contract Test 通过。

第三步：
新增 app-core：
1. NavigationBus。
2. ActionBus。
3. SurfaceFrame。
4. Snapshot builders。
5. ThemeBridge。
6. ErrorHub。

第四步：Console 10.0
- 将 Console 升级为 Mission Control。
- 实现 ConsoleTopCommandBar、WelcomeMissionHero、RuntimeHealthStrip、QuickStartDeck、ActiveWorkBoard、NeedAttentionQueue、TodayPulseWaterfall、RecentActivityTimeline、ProAnalyticsTabs。
- Console 所有 Runtime 动作只走 RuntimeBridge。
- Pro 数据缺失显示 Unavailable 和原因。

第五步：Projects 10.0
- 将 Projects 升级为 Project Operations Center。
- 删除 ProjectsSurface 中对 startPtyV2ClaudeSession 的直接调用。
- RuntimeActionRibbon / SessionWaterfall / ProjectInspector 全部接 RuntimeBridge 和 NavigationBus。
- New / Continue / Resume / Fork / Stop 全部真实操作 RuntimeSession。

第六步：Resources 10.0
- 将 Resources 从文件浏览器升级为 Capability & Context Center。
- 实现 ResourcesTopCommandBar、ResourceNav、ResourceGrid/List/Split、ResourceInspector、ResourceActivationPanel、ResourceCreateWizard。
- 新增 ResourceActivationBridge。
- 支持 insertIntoChat / attachToSession / sendToCurrentPty / applyToProject / cloneToProject / applyPackToProject。
- Resources 不直接运行 Claude，只通过 RuntimeBridge 或项目配置写入。

第七步：AI Dock 10.0
- 将当前主窗口内 AIDock 升级为独立 Tauri Window。
- 新增 DockSnapshotPublisher、DockActionBridge、DockWindowService。
- Dock 支持 Quiet / Calm / Focus。
- Dock action 全部回到 main window 执行 RuntimeBridge。
- Dock 可 quick prompt 到 active PTY，但不能成为第二个 Chat。

第八步：稳定性与测试
- npm run typecheck。
- npm run build。
- cargo check --manifest-path src-tauri/Cargo.toml。
- Runtime Contract Test。
- Cross-surface E2E：
  Console -> New Session -> Workspace -> Send
  Projects -> New Session -> Workspace -> Stop
  Resources -> Insert Skill -> ChatComposer -> Send
  Dock -> Quick Prompt -> active PTY
  Dock -> Ctrl+C
  Diagnostics -> Copy Bundle

交付：
1. docs/audit 完整审计结果。
2. 修改文件清单。
3. Console/Projects/Resources/Dock 新结构说明。
4. RuntimeBridge 调用链。
5. NavigationBus/ActionBus 说明。
6. Dock Snapshot/Action Bridge 说明。
7. ResourceActivationBridge 说明。
8. E2E 测试结果。
9. 未完成项和风险。
```

---

# 13. 验收清单

## 13.1 Runtime

```text
[ ] 不存在 surface 直接 import startPtyV2ClaudeSession/writePtyV2/stopPtyV2。
[ ] Console/Projects/Resources/Dock 全部只调用 RuntimeBridge。
[ ] RuntimeSession 有 uiSessionId/ptySessionId/traceId。
[ ] backend runtime_list_sessions 能看到 ptySessionId。
[ ] ChatComposer 发送进入同一个 PTY。
[ ] 不再出现 Session not found: ses-xxx。
```

## 13.2 Console

```text
[ ] Console 是 Mission Control。
[ ] New Session 真正启动 Runtime。
[ ] ActiveWorkBoard 显示真实 RuntimeSession。
[ ] HealthStrip 点击进入 Diagnostics。
[ ] Pro 缺失数据显示 Unavailable + reason。
```

## 13.3 Projects

```text
[ ] Projects 是 Project Operations Center。
[ ] New/Continue/Resume/Fork/Stop 都走 RuntimeBridge。
[ ] SessionCard 显示 PTY/Claude/Token/Risk/Files。
[ ] ProjectInspector 有 Runtime/Resources/GitHub/Diagnostics tabs。
```

## 13.4 Resources

```text
[ ] Resources 是 Capability & Context Center。
[ ] ResourceCard 支持 Insert/Attach/Apply/Diagnose。
[ ] ResourceInspector 有 Activation tab。
[ ] 可把 Skill/Template 插入 ChatComposer。
[ ] 可把配置型资源应用到 Project。
```

## 13.5 AI Dock

```text
[ ] AI Dock 独立 Tauri Window。
[ ] Dock 读取 snapshot，不直接读 main store。
[ ] Dock action 回到 main DockActionBridge。
[ ] Quick Prompt 写 active PTY。
[ ] Ctrl+C/Stop 有二次确认。
```

## 13.6 商用级体验

```text
[ ] 四主题完整兼容。
[ ] 所有按钮有反馈。
[ ] 所有失败可复制 diagnostics。
[ ] 无假数据。
[ ] 无 silent catch。
[ ] 无无界列表。
[ ] 无明显卡顿。
[ ] Safe Mode 可用。
```

---

# 14. 最终用户体验目标

用户最终看到的不是四个割裂页面，而是一个统一产品：

```text
Console 告诉我：现在系统是否健康、我该做什么。
Projects 告诉我：每个项目正在发生什么、如何启动和管理 Claude 会话。
Resources 告诉我：有哪些能力和上下文可以用于当前项目/会话。
AI Dock 告诉我：系统正在后台做什么，并允许我快速处理和控制。
Workspace 告诉我：真实 Claude Code CLI 正在运行，我可以直接交互。
Diagnostics 告诉我：任何问题到底发生在哪里。
```

这就是 Ctrl-CC 的 100% + 200% + 500% 最终方向。
