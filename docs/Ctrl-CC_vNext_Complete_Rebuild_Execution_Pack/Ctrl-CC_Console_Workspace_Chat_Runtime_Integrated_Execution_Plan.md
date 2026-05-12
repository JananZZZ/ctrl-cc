# Ctrl-CC Console × Workspace × Chat × Claude Code CLI 一体化执行方案

> **可直接发送给 Claude Code CLI 执行。**  
> 本方案修正 Console Surface 的核心缺陷：控制台不能只是 Daily / Pro 的视觉和统计页面，必须成为 **Claude Code Runtime 的首页入口、Workspace/Chat 的实时控制面、Projects/Resources/GitHub/Diagnostics 的全局路由中枢、Runtime/Audit/Telemetry 的聚合仪表盘**。  
> 本任务不重构最左侧 AppRail 图标，不处理最右侧悬浮 AI Dock。  
> 本任务必须把 **Console、Projects、Workspace、Chat、Claude Code CLI 真实 PTY Runtime、Structured Runtime、Resources、GitHub、Diagnostics** 打通。

---

## 0. 必须先修正的架构认知

旧 Console 方案已经正确提出：

```text
Daily Console：默认启动页，亲切、美观、实时、快捷。
Pro Console：专业统计中心，完整、可筛选、可对比、可导出。
时间筛选器只属于 Pro Console。
Daily Console 只展示实时状态、今日轻摘要、最近 7 天轻趋势。
```

但它仍然存在一个严重问题：

```text
Console 还没有和 Claude Code CLI Runtime / Workspace / Chat 形成闭环。
```

如果不修正，会继续出现：

```text
1. Daily 的“新建 Claude 会话”只是按钮，不能真实启动 Claude CLI。
2. ActiveWorkPanel 显示会话，但不能打开同一个 Workspace PTY。
3. Chat 可能又变成一个独立假聊天，而不是当前 Claude Code PTY 的输入层。
4. Pro 的会话、Token、开销、风险统计没有真实 RuntimeEvent / statusLine / hook / audit 数据来源。
5. Console 点击项目、资源、GitHub、风险时无法带 ProjectContext / SessionContext 深跳。
```

本方案强制执行：

```text
Console 是 Runtime 首页。
Projects 是 Project/Session 管理中枢。
Workspace 是当前会话执行空间。
Chat Composer 是当前真实 PTY 会话的输入层。
Claude Code CLI 是 interactive runtime 的唯一事实来源。
Structured Runtime 只用于 claude -p / stream-json，不冒充 interactive 会话。
```

---

## 1. 固定单路径架构

不要提供多方案选择。固定：

```text
Tauri 2
React + TypeScript
Rust backend
portable-pty
xterm.js
Zustand or existing store
CSS variables 四主题系统
```

Runtime 分两条：

```text
A. Interactive PTY Runtime
   命令：claude / claude --continue / claude --resume <target> / claude -n <name>
   用途：Workspace Terminal、Chat Composer、permission prompt、slash command、完整 Claude Code 交互。

B. Structured Runtime
   命令：claude -p --output-format stream-json --include-partial-messages --include-hook-events
   用途：批处理、自动化检查、结构化报告、Pro Console 可导出分析。
```

Console 的所有入口必须明确调用其中一条 Runtime。禁止“只改 UI 状态”。

---

## 2. Console 与核心功能的关系

### 2.1 Console 是全局入口

```text
Console
├── Daily Console
│   ├── 新建 Claude 会话        -> Interactive PTY Runtime -> Workspace
│   ├── 继续最近会话            -> claude --continue -> Workspace
│   ├── 打开运行中会话          -> Workspace existing tab
│   ├── 停止会话 / Ctrl+C       -> PTY kill / PTY write \x03
│   ├── 处理待确认 / 风险       -> Workspace / Monitor / Permission Center
│   ├── 打开项目                -> Projects selected project
│   ├── 打开资源                -> Resources with projectId
│   ├── 打开 GitHub             -> GitHub with projectId / remote
│   └── 运行诊断                -> Diagnostics with runtime smoke tests
└── Pro Console
    ├── 项目统计                -> Projects with projectId
    ├── 会话统计                -> Workspace with sessionId
    ├── Token / Cost / Time     -> statusLine / RuntimeEvent / Audit
    ├── 代码变化                -> FileChange / GitSnapshot
    ├── 工具资源                -> Resources with resource scope
    ├── 风险审计                -> Risk / Audit / Workspace details
    └── 系统健康                -> Diagnostics / Capability Matrix
```

### 2.2 不能出现的错误关系

```text
Console QuickStart -> fake session
Console Chat -> claude -p 假装当前会话
Console ActiveWorkCard -> 只跳 UI，不连接 ptySessionId
Console Pro Token -> mock token
Console Cost -> mock cost
Console Risk -> mock risk
```

---

## 3. 核心实体模型

Console 必须复用 Projects/Workspace/Runtime 的真实实体。

```text
Project
  └── ClaudeSession
        ├── PtySession
        ├── WorkspaceTab
        ├── ChatComposer
        ├── RuntimeEvent
        ├── StatusLineSnapshot
        ├── HookEvent
        ├── AuditLog
        ├── RiskItem
        ├── GitSnapshot
        └── FileChange
```

Console 不直接管理 PTY，它通过 `consoleRuntimeActions.ts` 调用 runtime service 和 workspace service。

---

## 4. 文件结构

请新增或重构以下文件。已有同名模块时优先合并，不要重复造 store。

```text
src/
├── features/
│   ├── console/
│   │   ├── pages/
│   │   │   └── ConsoleSurface.tsx
│   │   ├── components/
│   │   │   ├── ConsoleTopBar.tsx
│   │   │   ├── DailyConsole.tsx
│   │   │   ├── WelcomeHero.tsx
│   │   │   ├── QuickStartDeck.tsx
│   │   │   ├── TodayPulseCards.tsx
│   │   │   ├── ActiveWorkPanel.tsx
│   │   │   ├── NeedAttentionPanel.tsx
│   │   │   ├── LightInsightStrip.tsx
│   │   │   ├── RecentActivityPreview.tsx
│   │   │   ├── SystemHealthBar.tsx
│   │   │   ├── ProConsole.tsx
│   │   │   ├── ProHeader.tsx
│   │   │   ├── ProAnalyticsTabs.tsx
│   │   │   ├── ConsoleDrawerHost.tsx
│   │   │   └── ConsoleEmptyState.tsx
│   │   ├── services/
│   │   │   ├── consoleRuntimeActions.ts
│   │   │   ├── consoleNavigationActions.ts
│   │   │   ├── consoleAnalyticsSelectors.ts
│   │   │   └── consoleExportService.ts
│   │   ├── stores/
│   │   │   └── consoleStore.ts
│   │   ├── types/
│   │   │   └── consoleTypes.ts
│   │   └── styles/
│   │       └── console.css
│   ├── projects/
│   │   ├── stores/projectsStore.ts
│   │   ├── types/projectTypes.ts
│   │   └── services/projectRuntimeActions.ts
│   ├── workspace/
│   │   ├── stores/workspaceStore.ts
│   │   ├── services/workspaceRuntimeActions.ts
│   │   └── components/ChatComposer.tsx
│   ├── runtime/
│   │   ├── stores/runtimeStore.ts
│   │   ├── services/claudeRuntimeService.ts
│   │   ├── services/structuredRuntimeService.ts
│   │   ├── services/runtimeEvents.ts
│   │   └── types/runtimeTypes.ts
│   ├── resources/
│   │   └── services/resourceNavigationActions.ts
│   ├── github/
│   │   └── services/githubNavigationActions.ts
│   └── diagnostics/
│       └── services/diagnosticsNavigationActions.ts
```

---

## 5. Console 类型定义

创建：

```text
src/features/console/types/consoleTypes.ts
```

代码：

```ts
import type { ClaudeSession, GitStatusSnapshot, Project } from "../../projects/types/projectTypes";

export type ConsoleMode = "daily" | "pro";

export type AnalyticsRange =
  | "today"
  | "yesterday"
  | "7d"
  | "1m"
  | "6m"
  | "1y"
  | "custom";

export type ProAnalyticsTab =
  | "overview"
  | "projects"
  | "sessions"
  | "tokens"
  | "cost"
  | "time"
  | "code"
  | "tools"
  | "risks"
  | "system";

export type HealthState =
  | "ready"
  | "warning"
  | "error"
  | "unknown"
  | "unavailable";

export type MascotState =
  | "idle"
  | "working"
  | "thinking"
  | "waiting"
  | "risk"
  | "done"
  | "sleepy";

export interface DailyConsoleSnapshot {
  user: {
    displayName: string;
    avatar?: string | null;
  };

  greeting: {
    title: string;
    subtitle: string;
    mascotState: MascotState;
  };

  runtime: {
    claude: RuntimeHealthItem;
    pty: RuntimeHealthItem;
    git: RuntimeHealthItem;
    webview: RuntimeHealthItem;
    db: RuntimeHealthItem;
    watchdog: RuntimeHealthItem;
    dock: RuntimeHealthItem;
  };

  live: {
    runningSessions: number;
    waitingPermissions: number;
    highRisks: number;
    failedSessions: number;
    activeProjects: number;
  };

  today: {
    sessionsCreated: number;
    turns: number | null;
    workMs: number;
    inputTokens: number | null;
    outputTokens: number | null;
    estimatedCostUsd: number | null;
  };

  recent7d: {
    workTimeSeries: TimeSeriesPoint[];
    tokenSeries: TimeSeriesPoint[];
    costSeries: TimeSeriesPoint[];
    riskSeries: TimeSeriesPoint[];
  };

  activeSessions: ConsoleSessionSummary[];
  attentionItems: ConsoleAttentionItem[];
  recentAudit: ConsoleAuditItem[];
  recommendedAction: ConsoleRecommendedAction;
}

export interface RuntimeHealthItem {
  state: HealthState;
  label: string;
  detail?: string | null;
  action?: "diagnostics" | "settings" | "unavailable";
}

export interface TimeSeriesPoint {
  ts: string;
  value: number | null;
}

export interface ConsoleSessionSummary {
  sessionId: string;
  projectId: string;
  projectName: string;
  sessionName: string;
  status: string;
  runtimeMode: "pty" | "structured";
  ptySessionId?: string | null;
  model?: string | null;
  cwd: string;
  startedAt: string;
  updatedAt: string;
  workMs: number | null;
  changedFiles: number;
  riskCount: number;
  waitingPermissionCount: number;
  tokenInput?: number | null;
  tokenOutput?: number | null;
  estimatedCostUsd?: number | null;
}

export interface ConsoleAttentionItem {
  id: string;
  type: "permission" | "risk" | "error" | "runtime" | "git";
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  detail: string;
  projectId?: string;
  sessionId?: string;
  ptySessionId?: string | null;
  action: "open-workspace" | "open-project" | "open-diagnostics" | "open-risk" | "unavailable";
}

export interface ConsoleAuditItem {
  id: string;
  ts: string;
  type: string;
  title: string;
  detail: string;
  projectId?: string;
  sessionId?: string;
  severity?: "low" | "medium" | "high" | "critical";
}

export interface ConsoleRecommendedAction {
  type:
    | "start-first-project"
    | "start-claude-session"
    | "continue-session"
    | "handle-attention"
    | "run-diagnostics"
    | "open-workspace";
  label: string;
  projectId?: string;
  sessionId?: string;
}

export interface ProAnalyticsSnapshot {
  range: AnalyticsRange;
  customRange?: { start: string; end: string } | null;
  generatedAt: string;

  projects: ProjectAnalytics;
  sessions: SessionAnalytics;
  tokens: TokenAnalytics;
  cost: CostAnalytics;
  time: TimeAnalytics;
  code: CodeAnalytics;
  tools: ToolAnalytics;
  risks: RiskAnalytics;
  audit: AuditAnalytics;
  system: SystemHealthAnalytics;
}

export interface ProjectAnalytics {
  totalProjects: number;
  activeProjects: number;
  archivedProjects: number;
  missingPathProjects: number;
  gitProjects: number | null;
  topProjects: ProjectRankItem[];
}

export interface ProjectRankItem {
  projectId: string;
  name: string;
  path: string;
  sessions: number;
  workMs: number | null;
  tokens: number | null;
  costUsd: number | null;
  risks: number;
}

export interface SessionAnalytics {
  created: number;
  completed: number;
  running: number;
  failed: number;
  archived: number;
  ptySessions: number;
  structuredSessions: number;
  topSessions: ConsoleSessionSummary[];
}

export interface TokenAnalytics {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  cacheReadTokens: number | null;
  cacheCreateTokens: number | null;
  topTokenSessions: ConsoleSessionSummary[];
  unavailableReason?: string | null;
}

export interface CostAnalytics {
  estimatedCostUsd: number | null;
  topCostSessions: ConsoleSessionSummary[];
  unavailableReason?: string | null;
}

export interface TimeAnalytics {
  totalWorkMs: number;
  activeWorkMs: number | null;
  waitingMs: number | null;
  idleMs: number | null;
  apiDurationMs: number | null;
}

export interface CodeAnalytics {
  filesChanged: number | null;
  linesAdded: number | null;
  linesRemoved: number | null;
  gitDirtyEvents: number | null;
  unavailableReason?: string | null;
}

export interface ToolAnalytics {
  bashCalls: number | null;
  readCalls: number | null;
  editCalls: number | null;
  writeCalls: number | null;
  mcpCalls: number | null;
  agentRuns: number | null;
  hookEvents: number | null;
  unavailableReason?: string | null;
}

export interface RiskAnalytics {
  total: number;
  high: number;
  critical: number;
  pending: number;
  resolved: number;
  autoTrust: number | null;
}

export interface AuditAnalytics {
  totalEvents: number;
  recentEvents: ConsoleAuditItem[];
}

export interface SystemHealthAnalytics {
  claude: RuntimeHealthItem;
  pty: RuntimeHealthItem;
  git: RuntimeHealthItem;
  webview: RuntimeHealthItem;
  db: RuntimeHealthItem;
  watchdog: RuntimeHealthItem;
  residualProcesses: number | null;
}
```

---

## 6. Console Store

创建：

```text
src/features/console/stores/consoleStore.ts
```

代码：

```ts
import { create } from "zustand";
import type { AnalyticsRange, ConsoleMode, ProAnalyticsTab } from "../types/consoleTypes";

interface ConsoleState {
  mode: ConsoleMode;
  proTab: ProAnalyticsTab;
  range: AnalyticsRange;
  customRange: { start: string; end: string } | null;
  drawer:
    | null
    | { type: "session"; sessionId: string }
    | { type: "project"; projectId: string }
    | { type: "attention"; itemId: string }
    | { type: "audit"; auditId: string }
    | { type: "health"; key: string };

  setMode: (mode: ConsoleMode) => void;
  openProTab: (tab: ProAnalyticsTab) => void;
  setRange: (range: AnalyticsRange) => void;
  setCustomRange: (range: { start: string; end: string } | null) => void;
  openDrawer: (drawer: ConsoleState["drawer"]) => void;
  closeDrawer: () => void;
}

export const useConsoleStore = create<ConsoleState>((set) => ({
  mode: "daily",
  proTab: "overview",
  range: "7d",
  customRange: null,
  drawer: null,

  setMode: (mode) => set({ mode }),
  openProTab: (tab) => set({ mode: "pro", proTab: tab }),
  setRange: (range) => set({ range }),
  setCustomRange: (customRange) => set({ customRange }),
  openDrawer: (drawer) => set({ drawer }),
  closeDrawer: () => set({ drawer: null }),
}));
```

后续可接 localStorage 持久化，但 P0 先保持简单。

---

## 7. Runtime Store：Console 需要的真实事件

如果 runtimeStore 已存在，合并以下能力。不要重复建第二个 Runtime Store。

创建或修改：

```text
src/features/runtime/stores/runtimeStore.ts
```

代码：

```ts
import { create } from "zustand";
import type { RuntimeEvent } from "../types/runtimeTypes";

interface RuntimeState {
  events: RuntimeEvent[];
  ptyHealth: "ready" | "warning" | "error" | "unknown";
  claudeHealth: "ready" | "not-found" | "auth-required" | "pty-failed" | "unknown";
  lastClaudeDiscovery?: unknown | null;

  appendEvent: (event: RuntimeEvent) => void;
  appendPtyOutput: (event: RuntimeEvent) => void;
  markPtyExited: (ptySessionId: string, code: number | null) => void;
  setClaudeHealth: (health: RuntimeState["claudeHealth"], snapshot?: unknown) => void;
}

export const useRuntimeStore = create<RuntimeState>((set) => ({
  events: [],
  ptyHealth: "unknown",
  claudeHealth: "unknown",
  lastClaudeDiscovery: null,

  appendEvent: (event) =>
    set((state) => ({
      events: [event, ...state.events].slice(0, 5000),
    })),

  appendPtyOutput: (event) =>
    set((state) => ({
      ptyHealth: "ready",
      events: [event, ...state.events].slice(0, 5000),
    })),

  markPtyExited: (ptySessionId, code) =>
    set((state) => ({
      events: [
        {
          type: "pty.exit",
          sessionId: ptySessionId,
          projectId: "",
          code,
          ts: new Date().toISOString(),
        } as any,
        ...state.events,
      ].slice(0, 5000),
    })),

  setClaudeHealth: (health, snapshot) =>
    set({
      claudeHealth: health,
      lastClaudeDiscovery: snapshot ?? null,
    }),
}));
```

---

## 8. Console Analytics Selectors

创建：

```text
src/features/console/services/consoleAnalyticsSelectors.ts
```

代码：

```ts
import type {
  AnalyticsRange,
  ConsoleAttentionItem,
  ConsoleAuditItem,
  ConsoleRecommendedAction,
  ConsoleSessionSummary,
  DailyConsoleSnapshot,
  ProAnalyticsSnapshot,
  RuntimeHealthItem,
} from "../types/consoleTypes";
import type { ClaudeSession, Project } from "../../projects/types/projectTypes";

interface BuildSnapshotInput {
  projects: Project[];
  selectedProjectId?: string | null;
  sessions: ClaudeSession[];
  runtimeSnapshots: Record<string, any>;
  runtimeEvents: any[];
  claudeHealth: string;
  ptyHealth: string;
  range?: AnalyticsRange;
  customRange?: { start: string; end: string } | null;
}

export function buildDailyConsoleSnapshot(input: BuildSnapshotInput): DailyConsoleSnapshot {
  const now = new Date();
  const todayStart = startOfLocalDay(now).getTime();

  const activeSessions = input.sessions.filter(isSessionActive);
  const failedSessions = input.sessions.filter((s) => s.status === "failed");
  const waitingSessions = input.sessions.filter((s) => s.waitingPermissionCount > 0);

  const todaySessions = input.sessions.filter((s) => new Date(s.startedAt).getTime() >= todayStart);

  const highRisks = input.sessions.reduce((sum, s) => sum + (s.riskCount > 0 ? s.riskCount : 0), 0);

  const activeSummaries = activeSessions.slice(0, 5).map((s) =>
    toConsoleSessionSummary(s, findProjectName(input.projects, s.projectId))
  );

  const attentionItems = buildAttentionItems(input.projects, input.sessions, input.claudeHealth, input.ptyHealth);

  const recommendedAction = buildRecommendedAction(input.projects, input.sessions, input.claudeHealth, attentionItems);

  const tokenInput = sumNullable(todaySessions.map((s) => s.tokenInput ?? null));
  const tokenOutput = sumNullable(todaySessions.map((s) => s.tokenOutput ?? null));
  const cost = sumNullable(todaySessions.map((s) => s.estimatedCostUsd ?? null));

  return {
    user: {
      displayName: "JananZZZ",
      avatar: null,
    },

    greeting: {
      title: makeGreetingTitle("JananZZZ", now),
      subtitle: makeGreetingSubtitle(activeSessions.length, waitingSessions.length, input.claudeHealth, input.ptyHealth),
      mascotState: chooseMascotState(activeSessions.length, waitingSessions.length, highRisks, failedSessions.length),
    },

    runtime: {
      claude: mapClaudeHealth(input.claudeHealth),
      pty: mapPtyHealth(input.ptyHealth),
      git: inferGlobalGitHealth(input.runtimeSnapshots),
      webview: { state: "ready", label: "WebView Ready", detail: null, action: "unavailable" },
      db: { state: "unknown", label: "DB Unknown", detail: "DB health check not connected", action: "diagnostics" },
      watchdog: { state: "unknown", label: "Watchdog Unknown", detail: "Watchdog not connected", action: "diagnostics" },
      dock: { state: "unavailable", label: "Dock Unavailable", detail: "AI Dock is not implemented yet", action: "unavailable" },
    },

    live: {
      runningSessions: activeSessions.length,
      waitingPermissions: waitingSessions.reduce((sum, s) => sum + s.waitingPermissionCount, 0),
      highRisks,
      failedSessions: failedSessions.length,
      activeProjects: new Set(activeSessions.map((s) => s.projectId)).size,
    },

    today: {
      sessionsCreated: todaySessions.length,
      turns: null,
      workMs: estimateWorkMs(todaySessions),
      inputTokens: tokenInput,
      outputTokens: tokenOutput,
      estimatedCostUsd: cost,
    },

    recent7d: {
      workTimeSeries: makeEmpty7dSeries(),
      tokenSeries: makeEmpty7dSeries(),
      costSeries: makeEmpty7dSeries(),
      riskSeries: makeEmpty7dSeries(),
    },

    activeSessions: activeSummaries,
    attentionItems,
    recentAudit: buildRecentAudit(input.runtimeEvents, input.projects, input.sessions),
    recommendedAction,
  };
}

export function buildProAnalyticsSnapshot(input: BuildSnapshotInput): ProAnalyticsSnapshot {
  const range = input.range ?? "7d";
  const { start, end } = resolveRange(range, input.customRange);

  const sessionsInRange = input.sessions.filter((s) => {
    const t = new Date(s.startedAt).getTime();
    return t >= start.getTime() && t <= end.getTime();
  });

  const projectIdsInRange = new Set(sessionsInRange.map((s) => s.projectId));
  const projectsInRange = input.projects.filter((p) => projectIdsInRange.has(p.id));

  const tokenInput = sumNullable(sessionsInRange.map((s) => s.tokenInput ?? null));
  const tokenOutput = sumNullable(sessionsInRange.map((s) => s.tokenOutput ?? null));
  const cost = sumNullable(sessionsInRange.map((s) => s.estimatedCostUsd ?? null));

  const summaries = sessionsInRange.map((s) => toConsoleSessionSummary(s, findProjectName(input.projects, s.projectId)));

  return {
    range,
    customRange: input.customRange ?? null,
    generatedAt: new Date().toISOString(),

    projects: {
      totalProjects: input.projects.length,
      activeProjects: projectsInRange.length,
      archivedProjects: input.projects.filter((p) => p.status === "archived").length,
      missingPathProjects: input.projects.filter((p) => p.status === "missing-path").length,
      gitProjects: null,
      topProjects: input.projects.slice(0, 10).map((p) => {
        const ps = sessionsInRange.filter((s) => s.projectId === p.id);
        return {
          projectId: p.id,
          name: p.name,
          path: p.path,
          sessions: ps.length,
          workMs: estimateWorkMs(ps),
          tokens: sumNullable(ps.map((s) => (s.tokenInput ?? 0) + (s.tokenOutput ?? 0))),
          costUsd: sumNullable(ps.map((s) => s.estimatedCostUsd ?? null)),
          risks: ps.reduce((sum, s) => sum + s.riskCount, 0),
        };
      }),
    },

    sessions: {
      created: sessionsInRange.length,
      completed: sessionsInRange.filter((s) => s.status === "stopped").length,
      running: sessionsInRange.filter(isSessionActive).length,
      failed: sessionsInRange.filter((s) => s.status === "failed").length,
      archived: sessionsInRange.filter((s) => s.status === "archived").length,
      ptySessions: sessionsInRange.filter((s) => s.runtimeMode === "pty").length,
      structuredSessions: sessionsInRange.filter((s) => s.runtimeMode === "structured").length,
      topSessions: summaries.slice(0, 10),
    },

    tokens: {
      inputTokens: tokenInput,
      outputTokens: tokenOutput,
      totalTokens: tokenInput == null && tokenOutput == null ? null : (tokenInput ?? 0) + (tokenOutput ?? 0),
      cacheReadTokens: null,
      cacheCreateTokens: null,
      topTokenSessions: summaries
        .filter((s) => (s.tokenInput ?? 0) + (s.tokenOutput ?? 0) > 0)
        .sort((a, b) => ((b.tokenInput ?? 0) + (b.tokenOutput ?? 0)) - ((a.tokenInput ?? 0) + (a.tokenOutput ?? 0)))
        .slice(0, 10),
      unavailableReason: tokenInput == null && tokenOutput == null ? "Token data requires statusLine/transcript integration." : null,
    },

    cost: {
      estimatedCostUsd: cost,
      topCostSessions: summaries
        .filter((s) => s.estimatedCostUsd != null)
        .sort((a, b) => (b.estimatedCostUsd ?? 0) - (a.estimatedCostUsd ?? 0))
        .slice(0, 10),
      unavailableReason: cost == null ? "Cost data requires statusLine cost.total_cost_usd or configured pricing." : null,
    },

    time: {
      totalWorkMs: estimateWorkMs(sessionsInRange),
      activeWorkMs: null,
      waitingMs: null,
      idleMs: null,
      apiDurationMs: null,
    },

    code: {
      filesChanged: sumNullable(sessionsInRange.map((s) => s.changedFiles)),
      linesAdded: null,
      linesRemoved: null,
      gitDirtyEvents: null,
      unavailableReason: "Line-level code data requires GitSnapshot/FileChange/statusLine integration.",
    },

    tools: {
      bashCalls: null,
      readCalls: null,
      editCalls: null,
      writeCalls: null,
      mcpCalls: null,
      agentRuns: null,
      hookEvents: null,
      unavailableReason: "Tool analytics requires hooks or stream-json events.",
    },

    risks: {
      total: sessionsInRange.reduce((sum, s) => sum + s.riskCount, 0),
      high: 0,
      critical: 0,
      pending: sessionsInRange.reduce((sum, s) => sum + s.waitingPermissionCount, 0),
      resolved: 0,
      autoTrust: null,
    },

    audit: {
      totalEvents: input.runtimeEvents.length,
      recentEvents: buildRecentAudit(input.runtimeEvents, input.projects, input.sessions),
    },

    system: {
      claude: mapClaudeHealth(input.claudeHealth),
      pty: mapPtyHealth(input.ptyHealth),
      git: inferGlobalGitHealth(input.runtimeSnapshots),
      webview: { state: "ready", label: "WebView Ready", detail: null, action: "unavailable" },
      db: { state: "unknown", label: "DB Unknown", detail: "DB health not connected", action: "diagnostics" },
      watchdog: { state: "unknown", label: "Watchdog Unknown", detail: "Watchdog not connected", action: "diagnostics" },
      residualProcesses: null,
    },
  };
}

function isSessionActive(session: ClaudeSession) {
  return (
    session.status !== "stopped" &&
    session.status !== "failed" &&
    session.status !== "archived" &&
    !!session.ptySessionId
  );
}

function toConsoleSessionSummary(session: ClaudeSession, projectName: string): ConsoleSessionSummary {
  return {
    sessionId: session.id,
    projectId: session.projectId,
    projectName,
    sessionName: session.name,
    status: session.status,
    runtimeMode: session.runtimeMode,
    ptySessionId: session.ptySessionId,
    model: session.model,
    cwd: session.cwd,
    startedAt: session.startedAt,
    updatedAt: session.updatedAt,
    workMs: estimateWorkMs([session]),
    changedFiles: session.changedFiles,
    riskCount: session.riskCount,
    waitingPermissionCount: session.waitingPermissionCount,
    tokenInput: session.tokenInput,
    tokenOutput: session.tokenOutput,
    estimatedCostUsd: session.estimatedCostUsd,
  };
}

function findProjectName(projects: Project[], projectId: string) {
  return projects.find((p) => p.id === projectId)?.name ?? "Unknown Project";
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function makeGreetingTitle(name: string, now: Date) {
  const hour = now.getHours();
  if (hour < 6) return `夜深了，${name}`;
  if (hour < 12) return `早上好，${name}`;
  if (hour < 18) return `下午好，${name}`;
  return `晚上好，${name}`;
}

function makeGreetingSubtitle(running: number, waiting: number, claudeHealth: string, ptyHealth: string) {
  if (claudeHealth !== "ready") return "Claude Code CLI 还没有准备好，完成运行环境诊断后即可开始。";
  if (ptyHealth === "error") return "PTY Runtime 出现异常，建议先运行诊断。";
  if (running > 0) return `Claude Runtime 正常，当前有 ${running} 个会话运行，${waiting} 个操作等待确认。`;
  return "Ctrl-CC 已准备好，可以从一个小任务开始。";
}

function chooseMascotState(running: number, waiting: number, risks: number, failed: number) {
  if (failed > 0 || risks > 0) return "risk";
  if (waiting > 0) return "waiting";
  if (running > 0) return "working";
  return "idle";
}

function buildAttentionItems(projects: Project[], sessions: ClaudeSession[], claudeHealth: string, ptyHealth: string): ConsoleAttentionItem[] {
  const items: ConsoleAttentionItem[] = [];

  if (claudeHealth !== "ready") {
    items.push({
      id: "claude-runtime",
      type: "runtime",
      severity: "high",
      title: "Claude Runtime 未就绪",
      detail: `当前状态：${claudeHealth}`,
      action: "open-diagnostics",
    });
  }

  if (ptyHealth === "error") {
    items.push({
      id: "pty-runtime",
      type: "runtime",
      severity: "high",
      title: "PTY Runtime 异常",
      detail: "真实 Claude Code 交互需要 PTY Runtime 正常工作。",
      action: "open-diagnostics",
    });
  }

  for (const session of sessions) {
    if (session.waitingPermissionCount > 0) {
      items.push({
        id: `permission-${session.id}`,
        type: "permission",
        severity: "medium",
        title: "会话等待权限确认",
        detail: `${session.name} 有 ${session.waitingPermissionCount} 个操作等待处理。`,
        projectId: session.projectId,
        sessionId: session.id,
        ptySessionId: session.ptySessionId,
        action: "open-workspace",
      });
    }

    if (session.riskCount > 0) {
      items.push({
        id: `risk-${session.id}`,
        type: "risk",
        severity: "high",
        title: "会话存在风险",
        detail: `${session.name} 有 ${session.riskCount} 个风险项需要查看。`,
        projectId: session.projectId,
        sessionId: session.id,
        ptySessionId: session.ptySessionId,
        action: "open-risk",
      });
    }
  }

  return items.slice(0, 8);
}

function buildRecommendedAction(projects: Project[], sessions: ClaudeSession[], claudeHealth: string, attention: ConsoleAttentionItem[]): ConsoleRecommendedAction {
  if (claudeHealth !== "ready") {
    return { type: "run-diagnostics", label: "运行环境诊断" };
  }

  if (attention.length > 0) {
    return {
      type: "handle-attention",
      label: `处理 ${attention.length} 个待处理事项`,
      projectId: attention[0].projectId,
      sessionId: attention[0].sessionId,
    };
  }

  const active = sessions.find(isSessionActive);
  if (active) {
    return {
      type: "open-workspace",
      label: "回到当前 Claude 会话",
      projectId: active.projectId,
      sessionId: active.id,
    };
  }

  if (projects.length === 0) {
    return { type: "start-first-project", label: "导入第一个项目" };
  }

  return {
    type: "start-claude-session",
    label: "新建 Claude 会话",
    projectId: projects[0].id,
  };
}

function buildRecentAudit(events: any[], projects: Project[], sessions: ClaudeSession[]): ConsoleAuditItem[] {
  return events.slice(0, 8).map((event, index) => ({
    id: event.id ?? `event-${index}`,
    ts: event.ts ?? new Date().toISOString(),
    type: event.type ?? "event",
    title: formatEventTitle(event.type),
    detail: event.message ?? event.chunk?.slice?.(0, 80) ?? "Runtime event",
    projectId: event.projectId,
    sessionId: event.sessionId,
    severity: undefined,
  }));
}

function formatEventTitle(type: string) {
  switch (type) {
    case "pty.output":
      return "Claude 输出";
    case "pty.exit":
      return "会话退出";
    case "runtime.error":
      return "运行异常";
    default:
      return type || "事件";
  }
}

function mapClaudeHealth(health: string): RuntimeHealthItem {
  if (health === "ready") return { state: "ready", label: "Claude CLI Ready", detail: null, action: "diagnostics" };
  if (health === "not-found") return { state: "error", label: "Claude CLI Not Found", detail: "系统未找到 claude 命令", action: "diagnostics" };
  if (health === "auth-required") return { state: "warning", label: "Claude Auth Required", detail: "Claude 可能需要登录或授权", action: "diagnostics" };
  return { state: "unknown", label: "Claude CLI Unknown", detail: null, action: "diagnostics" };
}

function mapPtyHealth(health: string): RuntimeHealthItem {
  if (health === "ready") return { state: "ready", label: "PTY Ready", detail: null, action: "diagnostics" };
  if (health === "error") return { state: "error", label: "PTY Error", detail: "PTY Runtime 异常", action: "diagnostics" };
  return { state: "unknown", label: "PTY Unknown", detail: null, action: "diagnostics" };
}

function inferGlobalGitHealth(runtimeSnapshots: Record<string, any>): RuntimeHealthItem {
  const values = Object.values(runtimeSnapshots);
  if (values.length === 0) {
    return { state: "unknown", label: "Git Unknown", detail: "尚未扫描项目 Git 状态", action: "diagnostics" };
  }
  const hasError = values.some((v: any) => v?.git?.errorMessage);
  if (hasError) {
    return { state: "warning", label: "Git Warning", detail: "部分项目 Git 状态不可用", action: "diagnostics" };
  }
  return { state: "ready", label: "Git Ready", detail: null, action: "diagnostics" };
}

function estimateWorkMs(sessions: ClaudeSession[]) {
  return sessions.reduce((sum, s) => {
    const start = new Date(s.startedAt).getTime();
    const end = s.stoppedAt ? new Date(s.stoppedAt).getTime() : Date.now();
    if (!Number.isFinite(start) || !Number.isFinite(end)) return sum;
    return sum + Math.max(0, end - start);
  }, 0);
}

function sumNullable(values: Array<number | null | undefined>) {
  const valid = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (valid.length === 0) return null;
  return valid.reduce((sum, v) => sum + v, 0);
}

function makeEmpty7dSeries() {
  const out = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    out.push({ ts: d.toISOString().slice(0, 10), value: null });
  }
  return out;
}

function resolveRange(range: AnalyticsRange, customRange?: { start: string; end: string } | null) {
  const end = new Date();
  const start = new Date(end);

  if (range === "today") {
    return { start: startOfLocalDay(end), end };
  }

  if (range === "yesterday") {
    const y = new Date(end);
    y.setDate(end.getDate() - 1);
    return {
      start: startOfLocalDay(y),
      end: new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59, 999),
    };
  }

  if (range === "1m") start.setDate(end.getDate() - 30);
  else if (range === "6m") start.setDate(end.getDate() - 180);
  else if (range === "1y") start.setDate(end.getDate() - 365);
  else if (range === "custom" && customRange) return { start: new Date(customRange.start), end: new Date(customRange.end) };
  else start.setDate(end.getDate() - 7);

  return { start, end };
}
```

---

## 9. Console Runtime Actions

创建：

```text
src/features/console/services/consoleRuntimeActions.ts
```

代码：

```ts
import type { ConsoleAttentionItem, ConsoleRecommendedAction, ConsoleSessionSummary } from "../types/consoleTypes";
import type { Project, ClaudeSession } from "../../projects/types/projectTypes";
import { useProjectsStore } from "../../projects/stores/projectsStore";
import {
  continueProjectClaudeSession,
  openExistingSessionInWorkspace,
  startNewClaudeSessionFromProject,
  stopClaudeSession,
} from "../../projects/services/projectRuntimeActions";
import { writeToPty } from "../../runtime/services/claudeRuntimeService";
import {
  navigateToDiagnostics,
  navigateToProjects,
  navigateToResources,
  navigateToWorkspace,
  navigateToGithub,
} from "./consoleNavigationActions";

export async function consoleStartNewClaudeSession(projectId?: string) {
  const project = resolveProject(projectId);

  if (!project) {
    navigateToProjects();
    return;
  }

  return startNewClaudeSessionFromProject(project);
}

export async function consoleContinueRecentSession(projectId?: string) {
  const project = resolveProject(projectId);

  if (!project) {
    navigateToProjects();
    return;
  }

  return continueProjectClaudeSession(project);
}

export function consoleOpenWorkspaceSession(sessionId: string) {
  const session = resolveSession(sessionId);
  if (!session) return;

  if (session.ptySessionId) {
    openExistingSessionInWorkspace(session);
    return;
  }

  navigateToWorkspace(session.projectId, session.id);
}

export async function consoleSendCtrlC(sessionId: string) {
  const session = resolveSession(sessionId);
  if (!session?.ptySessionId) {
    throw new Error("No active PTY session to send Ctrl+C.");
  }

  const ok = window.confirm("确定要向该 Claude Code 会话发送 Ctrl+C 吗？");
  if (!ok) return;

  await writeToPty(session.ptySessionId, "\x03");
}

export async function consoleStopSession(sessionId: string) {
  const session = resolveSession(sessionId);
  if (!session) return;

  const ok = window.confirm("确定要停止这个 Claude Code 会话吗？");
  if (!ok) return;

  await stopClaudeSession(session);
}

export function consoleHandleAttention(item: ConsoleAttentionItem) {
  if (item.action === "open-workspace" && item.sessionId) {
    consoleOpenWorkspaceSession(item.sessionId);
    return;
  }

  if (item.action === "open-project" && item.projectId) {
    navigateToProjects(item.projectId);
    return;
  }

  if (item.action === "open-diagnostics") {
    navigateToDiagnostics(item.projectId);
    return;
  }

  if (item.action === "open-risk" && item.sessionId) {
    consoleOpenWorkspaceSession(item.sessionId);
    return;
  }
}

export async function consoleRunRecommendedAction(action: ConsoleRecommendedAction) {
  switch (action.type) {
    case "start-first-project":
      navigateToProjects();
      return;
    case "start-claude-session":
      return consoleStartNewClaudeSession(action.projectId);
    case "continue-session":
      return consoleContinueRecentSession(action.projectId);
    case "handle-attention":
      if (action.sessionId) {
        consoleOpenWorkspaceSession(action.sessionId);
      } else if (action.projectId) {
        navigateToProjects(action.projectId);
      }
      return;
    case "run-diagnostics":
      navigateToDiagnostics(action.projectId);
      return;
    case "open-workspace":
      if (action.sessionId) consoleOpenWorkspaceSession(action.sessionId);
      return;
  }
}

export function consoleOpenProject(projectId?: string) {
  navigateToProjects(projectId);
}

export function consoleOpenResources(projectId?: string) {
  navigateToResources(projectId);
}

export function consoleOpenGithub(projectId?: string) {
  navigateToGithub(projectId);
}

export function consoleOpenDiagnostics(projectId?: string) {
  navigateToDiagnostics(projectId);
}

function resolveProject(projectId?: string): Project | null {
  const state = useProjectsStore.getState();
  if (projectId) {
    return state.projects.find((p) => p.id === projectId) ?? null;
  }
  const activeSession = state.sessions.find((s) => s.ptySessionId && s.status !== "stopped" && s.status !== "failed");
  if (activeSession) {
    return state.projects.find((p) => p.id === activeSession.projectId) ?? null;
  }
  return state.projects[0] ?? null;
}

function resolveSession(sessionId: string): ClaudeSession | null {
  return useProjectsStore.getState().sessions.find((s) => s.id === sessionId) ?? null;
}
```

---

## 10. Console Navigation Actions

创建：

```text
src/features/console/services/consoleNavigationActions.ts
```

代码：

```ts
export function navigateToWorkspace(projectId: string, sessionId: string) {
  window.dispatchEvent(
    new CustomEvent("ctrlcc:navigate", {
      detail: {
        surface: "workspace",
        projectId,
        sessionId,
      },
    })
  );
}

export function navigateToProjects(projectId?: string) {
  window.dispatchEvent(
    new CustomEvent("ctrlcc:navigate", {
      detail: {
        surface: "projects",
        projectId,
      },
    })
  );
}

export function navigateToResources(projectId?: string, scope?: string) {
  window.dispatchEvent(
    new CustomEvent("ctrlcc:navigate", {
      detail: {
        surface: "resources",
        projectId,
        scope,
      },
    })
  );
}

export function navigateToGithub(projectId?: string, target?: string) {
  window.dispatchEvent(
    new CustomEvent("ctrlcc:navigate", {
      detail: {
        surface: "github",
        projectId,
        target,
      },
    })
  );
}

export function navigateToDiagnostics(projectId?: string) {
  window.dispatchEvent(
    new CustomEvent("ctrlcc:navigate", {
      detail: {
        surface: "diagnostics",
        projectId,
      },
    })
  );
}
```

在 App Shell 中统一监听 `ctrlcc:navigate`。如果项目已有路由系统，请把这个事件转成当前 router 的 navigate。

---

## 11. ConsoleSurface

创建或修改：

```text
src/features/console/pages/ConsoleSurface.tsx
```

代码：

```tsx
import { useConsoleStore } from "../stores/consoleStore";
import { useProjectsStore } from "../../projects/stores/projectsStore";
import { useRuntimeStore } from "../../runtime/stores/runtimeStore";
import { buildDailyConsoleSnapshot, buildProAnalyticsSnapshot } from "../services/consoleAnalyticsSelectors";
import { ConsoleTopBar } from "../components/ConsoleTopBar";
import { DailyConsole } from "../components/DailyConsole";
import { ProConsole } from "../components/ProConsole";
import { ConsoleDrawerHost } from "../components/ConsoleDrawerHost";
import "../styles/console.css";

export function ConsoleSurface() {
  const mode = useConsoleStore((s) => s.mode);
  const range = useConsoleStore((s) => s.range);
  const customRange = useConsoleStore((s) => s.customRange);

  const projects = useProjectsStore((s) => s.projects);
  const selectedProjectId = useProjectsStore((s) => s.selectedProjectId);
  const sessions = useProjectsStore((s) => s.sessions);
  const runtimeSnapshots = useProjectsStore((s) => s.runtimeSnapshots);

  const runtimeEvents = useRuntimeStore((s) => s.events);
  const claudeHealth = useRuntimeStore((s) => s.claudeHealth);
  const ptyHealth = useRuntimeStore((s) => s.ptyHealth);

  const dailySnapshot = buildDailyConsoleSnapshot({
    projects,
    selectedProjectId,
    sessions,
    runtimeSnapshots,
    runtimeEvents,
    claudeHealth,
    ptyHealth,
  });

  const proSnapshot = buildProAnalyticsSnapshot({
    projects,
    selectedProjectId,
    sessions,
    runtimeSnapshots,
    runtimeEvents,
    claudeHealth,
    ptyHealth,
    range,
    customRange,
  });

  return (
    <section className="console-surface">
      <ConsoleTopBar dailySnapshot={dailySnapshot} />
      {mode === "daily" ? (
        <DailyConsole snapshot={dailySnapshot} />
      ) : (
        <ProConsole snapshot={proSnapshot} />
      )}
      <ConsoleDrawerHost />
    </section>
  );
}
```

---

## 12. ConsoleTopBar

创建：

```text
src/features/console/components/ConsoleTopBar.tsx
```

代码：

```tsx
import type { DailyConsoleSnapshot } from "../types/consoleTypes";
import { useConsoleStore } from "../stores/consoleStore";

interface ConsoleTopBarProps {
  dailySnapshot: DailyConsoleSnapshot;
}

export function ConsoleTopBar({ dailySnapshot }: ConsoleTopBarProps) {
  const mode = useConsoleStore((s) => s.mode);
  const setMode = useConsoleStore((s) => s.setMode);

  return (
    <header className="console-topbar">
      <div className="console-identity">
        <div className="console-avatar">🐱</div>
        <div>
          <strong>{dailySnapshot.user.displayName}</strong>
          <span>{dailySnapshot.greeting.subtitle}</span>
        </div>
      </div>

      <div className="console-mode-switch" role="tablist" aria-label="Console mode">
        <button className={mode === "daily" ? "active" : ""} onClick={() => setMode("daily")}>
          日常
        </button>
        <button className={mode === "pro" ? "active" : ""} onClick={() => setMode("pro")}>
          专业
        </button>
      </div>
    </header>
  );
}
```

---

## 13. DailyConsole

创建：

```text
src/features/console/components/DailyConsole.tsx
```

代码：

```tsx
import type { DailyConsoleSnapshot } from "../types/consoleTypes";
import { WelcomeHero } from "./WelcomeHero";
import { QuickStartDeck } from "./QuickStartDeck";
import { TodayPulseCards } from "./TodayPulseCards";
import { ActiveWorkPanel } from "./ActiveWorkPanel";
import { NeedAttentionPanel } from "./NeedAttentionPanel";
import { LightInsightStrip } from "./LightInsightStrip";
import { RecentActivityPreview } from "./RecentActivityPreview";
import { SystemHealthBar } from "./SystemHealthBar";

interface DailyConsoleProps {
  snapshot: DailyConsoleSnapshot;
}

export function DailyConsole({ snapshot }: DailyConsoleProps) {
  return (
    <div className="daily-console">
      <WelcomeHero snapshot={snapshot} />
      <QuickStartDeck snapshot={snapshot} />
      <TodayPulseCards snapshot={snapshot} />

      <div className="daily-console-grid">
        <ActiveWorkPanel sessions={snapshot.activeSessions} />
        <NeedAttentionPanel items={snapshot.attentionItems} />
      </div>

      <LightInsightStrip snapshot={snapshot} />
      <RecentActivityPreview items={snapshot.recentAudit} />
      <SystemHealthBar runtime={snapshot.runtime} />
    </div>
  );
}
```

---

## 14. WelcomeHero

创建：

```text
src/features/console/components/WelcomeHero.tsx
```

代码：

```tsx
import type { DailyConsoleSnapshot } from "../types/consoleTypes";
import { consoleRunRecommendedAction } from "../services/consoleRuntimeActions";

interface WelcomeHeroProps {
  snapshot: DailyConsoleSnapshot;
}

export function WelcomeHero({ snapshot }: WelcomeHeroProps) {
  return (
    <section className={`welcome-hero mascot-${snapshot.greeting.mascotState}`}>
      <div className="welcome-copy">
        <h1>{snapshot.greeting.title}</h1>
        <p>{snapshot.greeting.subtitle}</p>
        <button onClick={() => consoleRunRecommendedAction(snapshot.recommendedAction)}>
          {snapshot.recommendedAction.label}
        </button>
      </div>

      <div className="mascot-card">
        <div className="mascot-face">🐱</div>
        <strong>{formatMascotTitle(snapshot.greeting.mascotState)}</strong>
        <span>
          {snapshot.live.runningSessions} 个会话运行 · {snapshot.live.waitingPermissions} 个待处理
        </span>
      </div>
    </section>
  );
}

function formatMascotTitle(state: string) {
  switch (state) {
    case "working":
      return "猫猫正在工作";
    case "waiting":
      return "猫猫在等你确认";
    case "risk":
      return "猫猫发现了风险";
    case "sleepy":
      return "猫猫有点困";
    default:
      return "猫猫已就绪";
  }
}
```

---

## 15. QuickStartDeck：必须连接真实 Runtime

创建：

```text
src/features/console/components/QuickStartDeck.tsx
```

代码：

```tsx
import type { DailyConsoleSnapshot } from "../types/consoleTypes";
import {
  consoleContinueRecentSession,
  consoleOpenDiagnostics,
  consoleOpenProject,
  consoleStartNewClaudeSession,
} from "../services/consoleRuntimeActions";

interface QuickStartDeckProps {
  snapshot: DailyConsoleSnapshot;
}

export function QuickStartDeck({ snapshot }: QuickStartDeckProps) {
  const claudeReady = snapshot.runtime.claude.state === "ready";

  return (
    <section className="quick-start-deck">
      <button
        className="quick-card recommended"
        onClick={() => claudeReady ? consoleStartNewClaudeSession() : consoleOpenDiagnostics()}
      >
        <strong>{claudeReady ? "新建 Claude 会话" : "修复 Claude Runtime"}</strong>
        <span>{claudeReady ? "在项目中启动真实 PTY Claude Code 会话" : "检测 claude 命令、认证、PTY 与环境变量"}</span>
      </button>

      <button className="quick-card" onClick={() => consoleOpenProject()}>
        <strong>打开 / 导入项目</strong>
        <span>进入 Projects，管理项目与会话上下文</span>
      </button>

      <button
        className="quick-card"
        onClick={() => consoleContinueRecentSession()}
        disabled={!claudeReady}
      >
        <strong>继续最近会话</strong>
        <span>调用 claude --continue 并进入 Workspace</span>
      </button>

      <button className="quick-card" onClick={() => consoleOpenDiagnostics()}>
        <strong>运行环境诊断</strong>
        <span>检查 Claude CLI、PTY、Git、Workspace/Chat 连接</span>
      </button>
    </section>
  );
}
```

---

## 16. TodayPulseCards：点击连接 Pro / Workspace

创建：

```text
src/features/console/components/TodayPulseCards.tsx
```

代码：

```tsx
import type { DailyConsoleSnapshot } from "../types/consoleTypes";
import { useConsoleStore } from "../stores/consoleStore";

interface TodayPulseCardsProps {
  snapshot: DailyConsoleSnapshot;
}

export function TodayPulseCards({ snapshot }: TodayPulseCardsProps) {
  const openProTab = useConsoleStore((s) => s.openProTab);

  return (
    <section className="today-pulse-cards">
      <button className="pulse-card" onClick={() => openProTab("sessions")}>
        <strong>{snapshot.live.runningSessions}</strong>
        <span>运行中会话</span>
        <small>{snapshot.live.waitingPermissions} 个待确认</small>
      </button>

      <button className="pulse-card" onClick={() => openProTab("sessions")}>
        <strong>{snapshot.today.sessionsCreated}</strong>
        <span>今日会话</span>
        <small>{snapshot.today.turns == null ? "对话轮数 Unavailable" : `${snapshot.today.turns} 轮对话`}</small>
      </button>

      <button className="pulse-card" onClick={() => openProTab("tokens")}>
        <strong>{formatTokens(snapshot.today.inputTokens, snapshot.today.outputTokens)}</strong>
        <span>今日 Token</span>
        <small>{snapshot.today.estimatedCostUsd == null ? "预计开销 Unavailable" : `$${snapshot.today.estimatedCostUsd.toFixed(4)}`}</small>
      </button>

      <button className="pulse-card" onClick={() => openProTab("risks")}>
        <strong>{snapshot.live.highRisks}</strong>
        <span>风险</span>
        <small>{snapshot.live.failedSessions} 个失败会话</small>
      </button>
    </section>
  );
}

function formatTokens(input: number | null, output: number | null) {
  if (input == null && output == null) return "Unavailable";
  const total = (input ?? 0) + (output ?? 0);
  if (total > 1000) return `${Math.round(total / 1000)}K`;
  return `${total}`;
}
```

---

## 17. ActiveWorkPanel：打开 Workspace / Ctrl+C / 停止

创建：

```text
src/features/console/components/ActiveWorkPanel.tsx
```

代码：

```tsx
import type { ConsoleSessionSummary } from "../types/consoleTypes";
import {
  consoleOpenWorkspaceSession,
  consoleSendCtrlC,
  consoleStopSession,
} from "../services/consoleRuntimeActions";

interface ActiveWorkPanelProps {
  sessions: ConsoleSessionSummary[];
}

export function ActiveWorkPanel({ sessions }: ActiveWorkPanelProps) {
  return (
    <section className="console-panel active-work-panel">
      <header>
        <h2>当前运行工作</h2>
        <span>{sessions.length} 个活跃会话</span>
      </header>

      {sessions.length === 0 ? (
        <div className="console-empty-state">
          <strong>暂无运行中会话</strong>
          <p>从 Quick Start 新建一个真实 PTY Claude Code 会话。</p>
        </div>
      ) : (
        <div className="active-session-list">
          {sessions.map((session) => (
            <article key={session.sessionId} className="active-session-card">
              <div>
                <strong>{session.projectName} · {session.sessionName}</strong>
                <span>{session.status} · {session.runtimeMode.toUpperCase()} · {session.cwd}</span>
              </div>

              <div className="active-session-meta">
                <span>{session.changedFiles} files</span>
                <span>{session.riskCount} risks</span>
                <span>{session.waitingPermissionCount} waiting</span>
              </div>

              <footer>
                <button onClick={() => consoleOpenWorkspaceSession(session.sessionId)}>打开 Workspace</button>
                <button onClick={() => consoleSendCtrlC(session.sessionId)}>Ctrl+C</button>
                <button onClick={() => consoleStopSession(session.sessionId)}>停止</button>
              </footer>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
```

---

## 18. NeedAttentionPanel：不在 Console 里自动放行高风险

创建：

```text
src/features/console/components/NeedAttentionPanel.tsx
```

代码：

```tsx
import type { ConsoleAttentionItem } from "../types/consoleTypes";
import { consoleHandleAttention } from "../services/consoleRuntimeActions";

interface NeedAttentionPanelProps {
  items: ConsoleAttentionItem[];
}

export function NeedAttentionPanel({ items }: NeedAttentionPanelProps) {
  return (
    <section className="console-panel need-attention-panel">
      <header>
        <h2>需要处理</h2>
        <span>{items.length}</span>
      </header>

      {items.length === 0 ? (
        <div className="console-empty-state">
          <strong>暂时没有待处理事项</strong>
          <p>权限、风险、异常会在这里出现。</p>
        </div>
      ) : (
        <div className="attention-list">
          {items.slice(0, 6).map((item) => (
            <article key={item.id} className={`attention-item severity-${item.severity}`}>
              <div>
                <strong>{item.title}</strong>
                <span>{item.detail}</span>
              </div>
              <button onClick={() => consoleHandleAttention(item)}>查看处理</button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
```

---

## 19. SystemHealthBar：连接 Diagnostics

创建：

```text
src/features/console/components/SystemHealthBar.tsx
```

代码：

```tsx
import type { DailyConsoleSnapshot } from "../types/consoleTypes";
import { consoleOpenDiagnostics } from "../services/consoleRuntimeActions";

interface SystemHealthBarProps {
  runtime: DailyConsoleSnapshot["runtime"];
}

export function SystemHealthBar({ runtime }: SystemHealthBarProps) {
  const items = [
    runtime.claude,
    runtime.pty,
    runtime.git,
    runtime.webview,
    runtime.db,
    runtime.watchdog,
    runtime.dock,
  ];

  return (
    <section className="system-health-bar">
      {items.map((item) => (
        <button
          key={item.label}
          className={`health-pill health-${item.state}`}
          onClick={() => item.action === "diagnostics" ? consoleOpenDiagnostics() : undefined}
        >
          <span className="health-dot" />
          <strong>{item.label}</strong>
          {item.detail && <small>{item.detail}</small>}
        </button>
      ))}
    </section>
  );
}
```

---

## 20. RecentActivityPreview

创建：

```text
src/features/console/components/RecentActivityPreview.tsx
```

代码：

```tsx
import type { ConsoleAuditItem } from "../types/consoleTypes";
import { consoleOpenWorkspaceSession } from "../services/consoleRuntimeActions";
import { consoleOpenProject } from "../services/consoleRuntimeActions";

interface RecentActivityPreviewProps {
  items: ConsoleAuditItem[];
}

export function RecentActivityPreview({ items }: RecentActivityPreviewProps) {
  return (
    <section className="console-panel recent-activity-preview">
      <header>
        <h2>最近动态</h2>
        <span>{items.length}</span>
      </header>

      {items.length === 0 ? (
        <div className="console-empty-state">
          <strong>暂无运行事件</strong>
          <p>Claude 会话启动后，Runtime 输出、退出、风险和审计事件会显示在这里。</p>
        </div>
      ) : (
        <div className="activity-list">
          {items.map((item) => (
            <button
              key={item.id}
              className="activity-item"
              onClick={() => {
                if (item.sessionId) consoleOpenWorkspaceSession(item.sessionId);
                else if (item.projectId) consoleOpenProject(item.projectId);
              }}
            >
              <time>{formatTime(item.ts)}</time>
              <strong>{item.title}</strong>
              <span>{item.detail}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function formatTime(ts: string) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "--:--";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
```

---

## 21. LightInsightStrip

创建：

```text
src/features/console/components/LightInsightStrip.tsx
```

代码：

```tsx
import type { DailyConsoleSnapshot } from "../types/consoleTypes";
import { useConsoleStore } from "../stores/consoleStore";

interface LightInsightStripProps {
  snapshot: DailyConsoleSnapshot;
}

export function LightInsightStrip({ snapshot }: LightInsightStripProps) {
  const openProTab = useConsoleStore((s) => s.openProTab);

  return (
    <section className="light-insight-strip">
      <button onClick={() => openProTab("time")}>
        <strong>最近 7 天工作时长</strong>
        <MiniBars values={snapshot.recent7d.workTimeSeries.map((p) => p.value)} />
      </button>

      <button onClick={() => openProTab("tokens")}>
        <strong>Token 趋势</strong>
        <MiniBars values={snapshot.recent7d.tokenSeries.map((p) => p.value)} />
      </button>

      <button onClick={() => openProTab("cost")}>
        <strong>开销趋势</strong>
        <MiniBars values={snapshot.recent7d.costSeries.map((p) => p.value)} />
      </button>

      <button onClick={() => openProTab("risks")}>
        <strong>风险趋势</strong>
        <MiniBars values={snapshot.recent7d.riskSeries.map((p) => p.value)} />
      </button>
    </section>
  );
}

function MiniBars({ values }: { values: Array<number | null> }) {
  const max = Math.max(1, ...values.map((v) => v ?? 0));
  return (
    <div className="mini-bars">
      {values.map((v, i) => (
        <span key={i} style={{ height: `${Math.max(8, ((v ?? 0) / max) * 42)}px` }} />
      ))}
    </div>
  );
}
```

---

## 22. ProConsole

创建：

```text
src/features/console/components/ProConsole.tsx
```

代码：

```tsx
import type { ProAnalyticsSnapshot } from "../types/consoleTypes";
import { ProHeader } from "./ProHeader";
import { ProAnalyticsTabs } from "./ProAnalyticsTabs";

interface ProConsoleProps {
  snapshot: ProAnalyticsSnapshot;
}

export function ProConsole({ snapshot }: ProConsoleProps) {
  return (
    <div className="pro-console">
      <ProHeader snapshot={snapshot} />
      <ProAnalyticsTabs snapshot={snapshot} />
    </div>
  );
}
```

---

## 23. ProHeader

创建：

```text
src/features/console/components/ProHeader.tsx
```

代码：

```tsx
import type { AnalyticsRange, ProAnalyticsSnapshot } from "../types/consoleTypes";
import { useConsoleStore } from "../stores/consoleStore";

interface ProHeaderProps {
  snapshot: ProAnalyticsSnapshot;
}

const ranges: Array<{ value: AnalyticsRange; label: string }> = [
  { value: "today", label: "今天" },
  { value: "yesterday", label: "昨天" },
  { value: "7d", label: "7天" },
  { value: "1m", label: "1月" },
  { value: "6m", label: "半年" },
  { value: "1y", label: "一年" },
  { value: "custom", label: "自定义" },
];

export function ProHeader({ snapshot }: ProHeaderProps) {
  const range = useConsoleStore((s) => s.range);
  const setRange = useConsoleStore((s) => s.setRange);

  return (
    <header className="pro-header">
      <div>
        <h1>专业控制台</h1>
        <p>基于真实 Runtime / Session / Audit 数据生成。缺失数据将显示 Unavailable。</p>
      </div>

      <div className="range-picker">
        {ranges.map((r) => (
          <button key={r.value} className={range === r.value ? "active" : ""} onClick={() => setRange(r.value)}>
            {r.label}
          </button>
        ))}
      </div>
    </header>
  );
}
```

---

## 24. ProAnalyticsTabs

创建：

```text
src/features/console/components/ProAnalyticsTabs.tsx
```

代码：

```tsx
import type { ProAnalyticsSnapshot, ProAnalyticsTab } from "../types/consoleTypes";
import { useConsoleStore } from "../stores/consoleStore";
import { consoleOpenProject, consoleOpenWorkspaceSession } from "../services/consoleRuntimeActions";
import { consoleOpenResources } from "../services/consoleRuntimeActions";

interface ProAnalyticsTabsProps {
  snapshot: ProAnalyticsSnapshot;
}

const tabs: Array<{ key: ProAnalyticsTab; label: string }> = [
  { key: "overview", label: "总览" },
  { key: "projects", label: "项目" },
  { key: "sessions", label: "会话" },
  { key: "tokens", label: "Token" },
  { key: "cost", label: "开销" },
  { key: "time", label: "时长" },
  { key: "code", label: "代码" },
  { key: "tools", label: "工具资源" },
  { key: "risks", label: "风险审计" },
  { key: "system", label: "系统健康" },
];

export function ProAnalyticsTabs({ snapshot }: ProAnalyticsTabsProps) {
  const tab = useConsoleStore((s) => s.proTab);
  const openProTab = useConsoleStore((s) => s.openProTab);

  return (
    <section className="pro-tabs">
      <nav className="pro-tab-nav">
        {tabs.map((t) => (
          <button key={t.key} className={tab === t.key ? "active" : ""} onClick={() => openProTab(t.key)}>
            {t.label}
          </button>
        ))}
      </nav>

      <div className="pro-tab-body">
        {tab === "overview" && <OverviewTab snapshot={snapshot} />}
        {tab === "projects" && <ProjectsTab snapshot={snapshot} />}
        {tab === "sessions" && <SessionsTab snapshot={snapshot} />}
        {tab === "tokens" && <TokenTab snapshot={snapshot} />}
        {tab === "cost" && <CostTab snapshot={snapshot} />}
        {tab === "time" && <TimeTab snapshot={snapshot} />}
        {tab === "code" && <CodeTab snapshot={snapshot} />}
        {tab === "tools" && <ToolsTab snapshot={snapshot} />}
        {tab === "risks" && <RisksTab snapshot={snapshot} />}
        {tab === "system" && <SystemTab snapshot={snapshot} />}
      </div>
    </section>
  );
}

function OverviewTab({ snapshot }: { snapshot: ProAnalyticsSnapshot }) {
  return (
    <div className="pro-grid">
      <Kpi label="活跃项目" value={snapshot.projects.activeProjects} />
      <Kpi label="新建会话" value={snapshot.sessions.created} />
      <Kpi label="运行中" value={snapshot.sessions.running} />
      <Kpi label="风险" value={snapshot.risks.total} />
      <Kpi label="Token" value={formatNullable(snapshot.tokens.totalTokens)} />
      <Kpi label="预计开销" value={snapshot.cost.estimatedCostUsd == null ? "Unavailable" : `$${snapshot.cost.estimatedCostUsd.toFixed(4)}`} />
    </div>
  );
}

function ProjectsTab({ snapshot }: { snapshot: ProAnalyticsSnapshot }) {
  return (
    <div className="pro-list">
      {snapshot.projects.topProjects.map((p) => (
        <button key={p.projectId} onClick={() => consoleOpenProject(p.projectId)}>
          <strong>{p.name}</strong>
          <span>{p.sessions} sessions · {p.risks} risks · {p.path}</span>
        </button>
      ))}
    </div>
  );
}

function SessionsTab({ snapshot }: { snapshot: ProAnalyticsSnapshot }) {
  return (
    <div className="pro-list">
      {snapshot.sessions.topSessions.map((s) => (
        <button key={s.sessionId} onClick={() => consoleOpenWorkspaceSession(s.sessionId)}>
          <strong>{s.projectName} · {s.sessionName}</strong>
          <span>{s.status} · {s.runtimeMode} · {s.cwd}</span>
        </button>
      ))}
    </div>
  );
}

function TokenTab({ snapshot }: { snapshot: ProAnalyticsSnapshot }) {
  if (snapshot.tokens.unavailableReason) return <Unavailable reason={snapshot.tokens.unavailableReason} />;
  return <SessionsTab snapshot={{ ...snapshot, sessions: { ...snapshot.sessions, topSessions: snapshot.tokens.topTokenSessions } }} />;
}

function CostTab({ snapshot }: { snapshot: ProAnalyticsSnapshot }) {
  if (snapshot.cost.unavailableReason) return <Unavailable reason={snapshot.cost.unavailableReason} />;
  return <SessionsTab snapshot={{ ...snapshot, sessions: { ...snapshot.sessions, topSessions: snapshot.cost.topCostSessions } }} />;
}

function TimeTab({ snapshot }: { snapshot: ProAnalyticsSnapshot }) {
  return (
    <div className="pro-grid">
      <Kpi label="总工作时长" value={formatDuration(snapshot.time.totalWorkMs)} />
      <Kpi label="活跃时长" value={snapshot.time.activeWorkMs == null ? "Unavailable" : formatDuration(snapshot.time.activeWorkMs)} />
      <Kpi label="等待时长" value={snapshot.time.waitingMs == null ? "Unavailable" : formatDuration(snapshot.time.waitingMs)} />
      <Kpi label="API 时长" value={snapshot.time.apiDurationMs == null ? "Unavailable" : formatDuration(snapshot.time.apiDurationMs)} />
    </div>
  );
}

function CodeTab({ snapshot }: { snapshot: ProAnalyticsSnapshot }) {
  if (snapshot.code.unavailableReason) return <Unavailable reason={snapshot.code.unavailableReason} />;
  return <Kpi label="文件改动" value={formatNullable(snapshot.code.filesChanged)} />;
}

function ToolsTab({ snapshot }: { snapshot: ProAnalyticsSnapshot }) {
  if (snapshot.tools.unavailableReason) {
    return (
      <div className="unavailable-card">
        <Unavailable reason={snapshot.tools.unavailableReason} />
        <button onClick={() => consoleOpenResources()}>打开资源区</button>
      </div>
    );
  }
  return <Kpi label="Hook Events" value={formatNullable(snapshot.tools.hookEvents)} />;
}

function RisksTab({ snapshot }: { snapshot: ProAnalyticsSnapshot }) {
  return (
    <div className="pro-grid">
      <Kpi label="风险总数" value={snapshot.risks.total} />
      <Kpi label="高风险" value={snapshot.risks.high} />
      <Kpi label="Critical" value={snapshot.risks.critical} />
      <Kpi label="待处理" value={snapshot.risks.pending} />
    </div>
  );
}

function SystemTab({ snapshot }: { snapshot: ProAnalyticsSnapshot }) {
  return (
    <div className="system-health-grid">
      {Object.entries(snapshot.system).map(([key, value]) => {
        if (typeof value !== "object" || value == null || !("state" in value)) return null;
        return (
          <div key={key} className={`health-card health-${(value as any).state}`}>
            <strong>{(value as any).label}</strong>
            <span>{(value as any).detail ?? "OK"}</span>
          </div>
        );
      })}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="pro-kpi-card">
      <strong>{value ?? "Unavailable"}</strong>
      <span>{label}</span>
    </div>
  );
}

function Unavailable({ reason }: { reason: string }) {
  return (
    <div className="unavailable-card">
      <strong>Unavailable</strong>
      <p>{reason}</p>
    </div>
  );
}

function formatNullable(v: number | null) {
  if (v == null) return "Unavailable";
  return v >= 1000 ? `${Math.round(v / 1000)}K` : String(v);
}

function formatDuration(ms: number) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}
```

---

## 25. ConsoleDrawerHost

创建：

```text
src/features/console/components/ConsoleDrawerHost.tsx
```

代码：

```tsx
import { useConsoleStore } from "../stores/consoleStore";
import { consoleOpenDiagnostics, consoleOpenProject, consoleOpenWorkspaceSession } from "../services/consoleRuntimeActions";

export function ConsoleDrawerHost() {
  const drawer = useConsoleStore((s) => s.drawer);
  const closeDrawer = useConsoleStore((s) => s.closeDrawer);

  if (!drawer) return null;

  return (
    <aside className="console-drawer">
      <header>
        <strong>详情</strong>
        <button onClick={closeDrawer}>关闭</button>
      </header>

      {drawer.type === "session" && (
        <div>
          <p>会话详情</p>
          <button onClick={() => consoleOpenWorkspaceSession(drawer.sessionId)}>打开 Workspace</button>
        </div>
      )}

      {drawer.type === "project" && (
        <div>
          <p>项目详情</p>
          <button onClick={() => consoleOpenProject(drawer.projectId)}>打开 Projects</button>
        </div>
      )}

      {drawer.type === "health" && (
        <div>
          <p>系统健康详情：{drawer.key}</p>
          <button onClick={() => consoleOpenDiagnostics()}>打开 Diagnostics</button>
        </div>
      )}
    </aside>
  );
}
```

---

## 26. CSS：四主题兼容

创建或修改：

```text
src/features/console/styles/console.css
```

代码：

```css
.console-surface {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--cc-bg);
  color: var(--cc-text);
}

.console-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 22px;
  border-bottom: 1px solid var(--cc-border-soft);
  background: color-mix(in srgb, var(--cc-surface) 86%, transparent);
  backdrop-filter: blur(18px);
}

.console-identity {
  display: flex;
  align-items: center;
  gap: 12px;
}

.console-avatar {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 14px;
  background: var(--cc-brand-soft);
}

.console-identity strong {
  display: block;
  font-size: 14px;
  font-weight: 700;
}

.console-identity span {
  display: block;
  margin-top: 2px;
  font-size: 12px;
  color: var(--cc-text-muted);
}

.console-mode-switch {
  display: flex;
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--cc-border-soft);
  border-radius: 999px;
  background: var(--cc-surface-muted);
}

.console-mode-switch button,
.range-picker button,
.pro-tab-nav button {
  border: 0;
  background: transparent;
  color: var(--cc-text-muted);
  border-radius: 999px;
  padding: 7px 12px;
  cursor: pointer;
}

.console-mode-switch button.active,
.range-picker button.active,
.pro-tab-nav button.active {
  background: var(--cc-brand);
  color: var(--cc-text-inverse);
  font-weight: 650;
}

.daily-console,
.pro-console {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 22px;
}

.welcome-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 260px;
  gap: 16px;
  align-items: stretch;
  padding: 24px;
  border: 1px solid var(--cc-border-soft);
  border-radius: 28px;
  background:
    radial-gradient(circle at 12% 15%, color-mix(in srgb, var(--cc-brand-soft) 70%, transparent), transparent 42%),
    var(--cc-surface);
  box-shadow: var(--cc-shadow-soft);
}

.welcome-copy h1 {
  margin: 0;
  font-size: 26px;
  line-height: 1.15;
  font-weight: 760;
}

.welcome-copy p {
  margin: 10px 0 18px;
  color: var(--cc-text-muted);
  line-height: 1.7;
}

.welcome-copy button,
.quick-card,
.pulse-card,
.console-panel button,
.system-health-bar button,
.pro-list button {
  border: 1px solid var(--cc-border-soft);
  background: var(--cc-surface-solid);
  color: var(--cc-text);
  border-radius: 16px;
  cursor: pointer;
  transition: transform var(--cc-duration-fast) var(--cc-ease-standard),
    border-color var(--cc-duration-fast) var(--cc-ease-standard),
    background var(--cc-duration-fast) var(--cc-ease-standard);
}

.welcome-copy button {
  padding: 10px 14px;
  background: var(--cc-brand);
  border-color: var(--cc-brand-strong);
  color: var(--cc-text-inverse);
  font-weight: 700;
}

.quick-card:hover,
.pulse-card:hover,
.console-panel button:hover,
.system-health-bar button:hover,
.pro-list button:hover {
  transform: translateY(-1px);
  border-color: var(--cc-brand);
  background: var(--cc-surface-hover);
}

.mascot-card {
  display: grid;
  place-items: center;
  text-align: center;
  border: 1px solid var(--cc-border-soft);
  border-radius: 24px;
  background: color-mix(in srgb, var(--cc-surface-solid) 74%, transparent);
}

.mascot-face {
  font-size: 42px;
}

.mascot-card span {
  margin-top: 4px;
  color: var(--cc-text-muted);
  font-size: 12px;
}

.quick-start-deck,
.today-pulse-cards {
  display: grid;
  grid-template-columns: repeat(4, minmax(160px, 1fr));
  gap: 14px;
  margin-top: 16px;
}

.quick-card,
.pulse-card {
  text-align: left;
  padding: 18px;
  min-height: 112px;
}

.quick-card.recommended {
  background: var(--cc-brand-soft);
  border-color: var(--cc-brand);
}

.quick-card strong,
.pulse-card strong {
  display: block;
  font-size: 18px;
  font-weight: 730;
}

.quick-card span,
.pulse-card span,
.pulse-card small {
  display: block;
  margin-top: 8px;
  color: var(--cc-text-muted);
  font-size: 12px;
  line-height: 1.5;
}

.pulse-card strong {
  font-size: 25px;
  font-variant-numeric: tabular-nums;
}

.daily-console-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr);
  gap: 16px;
  margin-top: 16px;
}

.console-panel,
.light-insight-strip,
.recent-activity-preview,
.system-health-bar,
.pro-header,
.pro-tabs {
  border: 1px solid var(--cc-border-soft);
  border-radius: 22px;
  background: var(--cc-surface);
  box-shadow: var(--cc-shadow-card);
}

.console-panel {
  padding: 18px;
}

.console-panel header,
.pro-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.console-panel h2,
.pro-header h1 {
  margin: 0;
  font-size: 18px;
  font-weight: 740;
}

.console-panel header span {
  color: var(--cc-text-muted);
  font-size: 12px;
}

.console-empty-state {
  margin-top: 14px;
  padding: 18px;
  border-radius: 18px;
  background: var(--cc-surface-muted);
  color: var(--cc-text-muted);
}

.active-session-list,
.attention-list,
.activity-list {
  display: grid;
  gap: 10px;
  margin-top: 14px;
}

.active-session-card,
.attention-item,
.activity-item {
  padding: 14px;
  border: 1px solid var(--cc-border-soft);
  border-radius: 18px;
  background: var(--cc-surface-solid);
}

.active-session-card strong,
.attention-item strong {
  display: block;
  font-size: 14px;
}

.active-session-card span,
.attention-item span {
  display: block;
  margin-top: 4px;
  color: var(--cc-text-muted);
  font-size: 12px;
  line-height: 1.5;
}

.active-session-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 0;
}

.active-session-meta span {
  padding: 5px 8px;
  border-radius: 999px;
  background: var(--cc-surface-muted);
}

.active-session-card footer {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.light-insight-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(150px, 1fr));
  gap: 12px;
  margin-top: 16px;
  padding: 14px;
}

.light-insight-strip button {
  border: 1px solid var(--cc-border-soft);
  border-radius: 18px;
  background: var(--cc-surface-solid);
  padding: 14px;
  text-align: left;
  color: var(--cc-text);
}

.mini-bars {
  display: flex;
  align-items: end;
  gap: 5px;
  height: 48px;
  margin-top: 12px;
}

.mini-bars span {
  width: 100%;
  border-radius: 999px 999px 4px 4px;
  background: var(--cc-brand);
  opacity: 0.75;
}

.recent-activity-preview {
  margin-top: 16px;
  padding: 18px;
}

.activity-item {
  display: grid;
  grid-template-columns: 52px 160px minmax(0, 1fr);
  gap: 12px;
  width: 100%;
  text-align: left;
  color: var(--cc-text);
}

.activity-item time {
  color: var(--cc-text-soft);
  font-variant-numeric: tabular-nums;
}

.system-health-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
  padding: 12px;
}

.health-pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 9px 10px;
}

.health-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--cc-text-soft);
}

.health-ready .health-dot {
  background: var(--cc-green);
}

.health-warning .health-dot {
  background: var(--cc-amber);
}

.health-error .health-dot {
  background: var(--cc-red);
}

.pro-header {
  align-items: center;
  padding: 18px;
}

.pro-header p {
  margin: 6px 0 0;
  color: var(--cc-text-muted);
  font-size: 13px;
}

.range-picker,
.pro-tab-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.pro-tabs {
  margin-top: 16px;
  padding: 14px;
}

.pro-tab-body {
  margin-top: 14px;
}

.pro-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(140px, 1fr));
  gap: 12px;
}

.pro-kpi-card,
.health-card,
.unavailable-card {
  padding: 16px;
  border: 1px solid var(--cc-border-soft);
  border-radius: 18px;
  background: var(--cc-surface-solid);
}

.pro-kpi-card strong {
  display: block;
  font-size: 24px;
  font-weight: 760;
  font-variant-numeric: tabular-nums;
}

.pro-kpi-card span,
.health-card span,
.unavailable-card p {
  display: block;
  margin-top: 6px;
  color: var(--cc-text-muted);
  font-size: 12px;
}

.pro-list {
  display: grid;
  gap: 10px;
}

.pro-list button {
  text-align: left;
  padding: 14px;
}

.pro-list strong {
  display: block;
}

.pro-list span {
  display: block;
  margin-top: 5px;
  color: var(--cc-text-muted);
  font-size: 12px;
}

.console-drawer {
  position: absolute;
  top: 64px;
  right: 18px;
  bottom: 18px;
  width: 380px;
  border: 1px solid var(--cc-border-soft);
  border-radius: 22px;
  background: var(--cc-surface);
  box-shadow: var(--cc-shadow-popover);
  padding: 18px;
  z-index: 20;
}

@media (max-width: 1200px) {
  .quick-start-deck,
  .today-pulse-cards,
  .light-insight-strip {
    grid-template-columns: repeat(2, minmax(160px, 1fr));
  }

  .daily-console-grid {
    grid-template-columns: 1fr;
  }

  .pro-grid {
    grid-template-columns: repeat(3, minmax(140px, 1fr));
  }
}
```

---

## 27. Console 与 Workspace/Chat 的强连接规则

### 27.1 新建 Claude 会话

```text
Daily QuickStart -> 新建 Claude 会话

1. consoleStartNewClaudeSession()
2. resolveProject()
3. discover_claude()
4. startInteractiveClaudeSession(project)
5. pty_start_claude(command="claude", args=["--name", sessionName], cwd=project.path)
6. addSession()
7. openSessionTab()
8. navigateToWorkspaceSession()
9. Workspace TerminalView 连接 ptySessionId
10. Workspace ChatComposer 写入同一个 ptySessionId
```

### 27.2 继续最近会话

```text
Daily QuickStart -> 继续最近会话

1. consoleContinueRecentSession()
2. resolveProject()
3. pty_start_claude(command="claude", args=["--continue"], cwd=project.path)
4. 进入 Workspace
```

### 27.3 打开运行中会话

```text
ActiveWorkPanel -> 打开 Workspace

1. sessionId -> ProjectsStore.sessions
2. 找到 ptySessionId
3. WorkspaceStore.openSessionTab()
4. navigateToWorkspace()
5. TerminalView 继续显示该 PTY 输出
6. ChatComposer 继续写入该 PTY
```

### 27.4 Ctrl+C

```text
ActiveWorkPanel -> Ctrl+C

1. window.confirm
2. pty_write(ptySessionId, "\x03")
3. RuntimeEvent 记录 action
4. 会话状态不立即改 stopped，等待 pty.exit 或后续输出
```

### 27.5 Stop

```text
ActiveWorkPanel -> Stop

1. window.confirm
2. pty_kill(ptySessionId)
3. pty.exit event
4. session.status = stopped
5. Console Daily activeSessions 自动刷新
```

### 27.6 Chat 输入

```text
Workspace ChatComposer

1. 读取 activeSessionId
2. 找到 ptySessionId
3. writeToPty(ptySessionId, text + "\r")
4. 不调用 claude -p
5. 不创建第二个 session
```

---

## 28. Structured Runtime 与 Pro Console 的连接

P0 不要求完整 Structured Runtime，但必须预留。

创建：

```text
src/features/runtime/services/structuredRuntimeService.ts
```

代码骨架：

```ts
import { invoke } from "@tauri-apps/api/core";

export interface StructuredClaudeTaskOptions {
  projectId?: string;
  cwd: string;
  prompt: string;
  maxTurns?: number;
}

export interface StructuredClaudeEvent {
  type: string;
  raw: unknown;
  ts: string;
}

export async function runStructuredClaudeTask(options: StructuredClaudeTaskOptions): Promise<StructuredClaudeEvent[]> {
  // P1/P2 implement with Rust command:
  // claude -p prompt --output-format stream-json --include-partial-messages --include-hook-events
  // For now, do not fake output.
  throw new Error("Structured Runtime is not implemented yet. Use Interactive PTY Runtime for live sessions.");
}
```

Pro Console 使用 `Unavailable`，直到 structured runtime / statusLine / hooks 真实接入。

---

## 29. statusLine / hooks 接入策略

本轮 P0 不强制，但必须按以下方式预留。

### 29.1 statusLine

用途：

```text
model
session_id
transcript_path
cwd
workspace
version
output_style
cost.total_cost_usd
cost.total_duration_ms
cost.total_api_duration_ms
cost.total_lines_added
cost.total_lines_removed
```

规则：

```text
1. 必须 opt-in。
2. 不静默覆盖用户 ~/.claude/settings.json。
3. 可以提供 Ctrl-CC statusLine probe 脚本。
4. 收到 JSON 后写 RuntimeEvent / StatusLineSnapshot。
5. Pro Token / Cost / Time / Code 才能从 Unavailable 变为真实数字。
```

### 29.2 hooks

用途：

```text
PreToolUse
PostToolUse
Notification
UserPromptSubmit
Stop
Subagent events
```

规则：

```text
1. 必须 opt-in。
2. 高风险不在 Console 里一键放行。
3. Daily NeedAttentionPanel 只显示和跳转处理。
4. Risk/Audit 统计从 HookEvent / AuditLog 聚合。
```

---

## 30. Resources / GitHub / Diagnostics 连接

### 30.1 Resources

Daily QuickStart 或 Pro Tools 点击资源：

```text
navigateToResources(projectId, scope)
```

Resources 必须按项目扫描：

```text
projectPath/CLAUDE.md
projectPath/.claude/settings.json
projectPath/.claude/settings.local.json
projectPath/.mcp.json
projectPath/.claude/agents/*
projectPath/.claude/hooks/*
```

不存在显示：

```text
Not configured
```

### 30.2 GitHub

Daily / Pro 项目卡点击 GitHub：

```text
navigateToGithub(projectId)
```

GitHub 页面基于 Git remote：

```text
git remote get-url origin
```

无 remote：

```text
No remote configured
```

### 30.3 Diagnostics

SystemHealthBar / QuickStart 进入 Diagnostics：

```text
navigateToDiagnostics(projectId?)
```

Diagnostics 必须至少检查：

```text
discover_claude()
claude --version
project path exists
git_snapshot(project.path)
PTY smoke test
Workspace route test
ChatComposer pty write test
```

---

## 31. Console Export

创建：

```text
src/features/console/services/consoleExportService.ts
```

P0 可以只导出 JSON，后续再加 Markdown / CSV。

代码：

```ts
import type { ProAnalyticsSnapshot } from "../types/consoleTypes";

export function exportProSnapshotJson(snapshot: ProAnalyticsSnapshot) {
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
    type: "application/json;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ctrl-cc-pro-console-${snapshot.range}-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
```

---

## 32. P0 执行顺序

严格按顺序执行，不要先做高级图表。

```text
1. 确认已有 ProjectsStore / WorkspaceStore / RuntimeStore。
2. 添加 Console 类型和 ConsoleStore。
3. 添加 consoleAnalyticsSelectors。
4. 添加 consoleRuntimeActions。
5. 添加 consoleNavigationActions。
6. 重构 ConsoleSurface。
7. 实现 DailyConsole 骨架。
8. QuickStartDeck 接 startNewClaudeSessionFromProject / continueProjectClaudeSession。
9. ActiveWorkPanel 接 openExistingSessionInWorkspace / pty_write Ctrl+C / pty_kill stop。
10. NeedAttentionPanel 接 Workspace / Diagnostics 跳转。
11. SystemHealthBar 接 Diagnostics。
12. ProConsole 骨架接真实 sessions/projects/runtimeEvents。
13. Token/Cost/Tool/Code 缺失时显示 Unavailable。
14. 运行 typecheck/build。
```

---

## 33. P1/P2/P3 后续

### P1：真实 Runtime 增强

```text
1. discover_claude 启动时自动刷新 claudeHealth。
2. pty.output / pty.exit 写 runtimeStore.events。
3. session.status 随 RuntimeEvent 变化。
4. Daily activeSessions 实时更新。
```

### P2：statusLine 接入

```text
1. 提供 opt-in statusLine probe。
2. 写 StatusLineSnapshot。
3. Pro Token/Cost/Time/Code 改用真实 statusLine 数据。
```

### P3：hooks 接入

```text
1. 提供 opt-in hooks collector。
2. PreToolUse/PostToolUse/Notification 写 HookEvent。
3. NeedAttentionPanel 显示真实 permission/risk。
4. Pro Tools/Risks/Audit 改用真实 hooks/audit 数据。
```

---

## 34. 验收标准

必须全部满足：

```text
[ ] Console 默认进入 Daily。
[ ] Daily 的“新建 Claude 会话”真实启动 Claude Code CLI PTY，并跳转 Workspace。
[ ] Daily 的“继续最近会话”调用 claude --continue，并跳转 Workspace。
[ ] ActiveWorkPanel 的“打开 Workspace”打开同一 ptySessionId。
[ ] ActiveWorkPanel 的 Ctrl+C 调用 pty_write("\x03")，不只是改 UI。
[ ] ActiveWorkPanel 的 Stop 调用 pty_kill。
[ ] Workspace ChatComposer 输入进入当前同一 PTY stdin。
[ ] ChatComposer 不使用 claude -p 冒充当前会话。
[ ] SystemHealthBar 点击进入 Diagnostics。
[ ] NeedAttentionPanel 不自动放行高风险，只跳转处理。
[ ] Pro Console 的 ProjectsTab 点击项目进入 Projects。
[ ] Pro Console 的 SessionsTab 点击会话进入 Workspace。
[ ] Pro Console 的 ToolsTab 点击资源进入 Resources。
[ ] Token/Cost/Tool/Code 数据没有真实来源时显示 Unavailable。
[ ] Pro 时间筛选只影响 ProAnalyticsSnapshot。
[ ] Daily 实时状态不受 Pro 时间筛选影响。
[ ] 所有功能兼容四主题 CSS variables。
[ ] 不修改最左侧 AppRail 图标。
[ ] 不处理最右侧 AI Dock。
[ ] npm run typecheck 通过。
[ ] npm run build 通过。
[ ] cargo check 通过。
```

---

## 35. 人工测试脚本

执行后按顺序手测：

```text
1. 打开 Ctrl-CC。
2. 进入 Console Daily。
3. 确认 WelcomeHero 显示 JananZZZ。
4. 点击“新建 Claude 会话”。
5. 应自动跳转 Workspace。
6. Terminal 中应真实出现 Claude Code CLI。
7. 在 Workspace ChatComposer 输入“请解释这个项目结构”，Ctrl+Enter。
8. 文本必须进入 Terminal 中的同一个 Claude 会话。
9. 返回 Console。
10. ActiveWorkPanel 应出现该会话。
11. 点击“打开 Workspace”，应回到同一会话。
12. 点击 Ctrl+C，应弹确认并向 PTY 发送 Ctrl+C。
13. 点击 Stop，应弹确认并停止 PTY。
14. 点击“继续最近会话”，应调用 claude --continue 并进入 Workspace。
15. 切换 Pro Console。
16. SessionsTab 应显示真实 session。
17. Token/Cost 如未接 statusLine，应显示 Unavailable。
18. 点击 Session 行，应打开 Workspace。
19. 点击 SystemHealthBar 的 Claude/PTY/Git，应进入 Diagnostics。
```

---

## 36. 最终目标

完成本方案后，Console 不再是一个孤立 Dashboard，而是：

```text
Ctrl-CC 的 AI 编程首页
Claude Code Runtime 的启动入口
Workspace/Chat 的实时控制面
Projects/Resources/GitHub/Diagnostics 的统一入口
Pro Analytics 的真实数据聚合中心
```

这才是 Daily / Pro Console 真正应该承担的职责。
