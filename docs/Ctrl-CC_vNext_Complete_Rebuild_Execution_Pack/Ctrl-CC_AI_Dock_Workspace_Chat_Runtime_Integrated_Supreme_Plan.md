# Ctrl-CC AI Dock × Workspace × Chat × Claude Code CLI 一体化顶级执行方案

> **可直接发送给 Claude Code CLI 执行。**  
> 目标：把 AI Dock 从“悬浮 UI”升级为 **Claude Code CLI Runtime 的常驻状态控制器、Workspace/Chat 的轻量遥控器、Console/Projects/Resources/GitHub/Diagnostics 的全局入口、通知与风险的即时处理面板**。  
> 固定技术路径：**Tauri 2 独立 Window + React Dock Surface + Rust Dock Window Commands + PTY-first RuntimeBridge + 主窗口 Snapshot Publisher + Dock Action Bridge**。  
> 默认跟随主程序四主题，也允许在 Settings 中为 AI Dock 独立切换主题。

---

## 0. 架构总判断

AI Dock 不能只是右侧悬浮卡片。它必须连接真实 Claude Code CLI Runtime：

```text
AI Dock
  ├── 读取真实 PTY Session / RuntimeEvent / Project / Risk / Audit 状态
  ├── 打开同一个 Workspace 会话
  ├── 向当前 Claude Code PTY 发送 Prompt / Ctrl+C
  ├── 停止真实 PTY Session
  ├── 跳转 Console / Projects / Resources / GitHub / Diagnostics
  ├── 展示 Claude CLI / PTY / Git / DB / Watchdog 健康状态
  └── 作为通知系统和 Command Center 的外部常驻入口
```

AI Dock 不是：

```text
1. 不是第二个 Terminal。
2. 不是假 Chat。
3. 不是独立 Claude 客户端。
4. 不是普通 spawn 的旁路。
5. 不是绕过 Workspace/Chat 的输入层。
6. 不是权限和高风险操作的一键放行入口。
```

---

## 1. 固定单路径架构

### 1.1 独立 Tauri Window

固定窗口：

```text
Main Window label: main
Dock Window label: ai-dock
Dock route: /dock
```

Dock Window 参数：

```text
alwaysOnTop: true
skipTaskbar: true
decorations: false
resizable: false
transparent: false
visible: false on boot
shadow: true when supported
```

P0 不依赖透明窗口。用普通无边框窗口 + CSS 圆角 + 内部阴影实现高级视觉。

### 1.2 跨 Window 数据同步

Tauri 多 WebView 的 Zustand store 不共享，因此必须用事件桥接：

```text
Main Window
  └── DockSnapshotPublisher
        └── emitTo("ai-dock", "dock.snapshot", snapshot)

Dock Window
  └── AIDockSurface
        └── listen("dock.snapshot")
        └── dockStore.setSnapshot(snapshot)

Dock Window
  └── 用户操作
        └── emitTo("main", "dock.action", action)

Main Window
  └── DockActionBridge
        └── 执行真实 Runtime / Workspace / Navigation 操作
```

这条链路是 P0。不要让 Dock 自己猜状态，不要让 Dock 伪造 session。

---

## 2. Claude Code CLI 连接边界

### 2.1 Interactive PTY Runtime

Dock 所有 live 操作必须指向同一个真实 PTY 会话：

```text
Dock button
  -> dock.action
  -> main DockActionBridge
  -> projectRuntimeActions / workspaceRuntimeActions
  -> pty_write / pty_kill / openSessionTab
  -> Workspace TerminalView / ChatComposer
  -> Claude Code CLI running in PTY
```

允许使用的 interactive 命令路径：

```text
claude
claude "query"
claude --continue / claude -c
claude --resume <session-id-or-name> / claude -r <session-id-or-name>
claude --resume <target> --fork-session
claude --name <session-name> / claude -n <session-name>
```

### 2.2 Structured Runtime

Dock 可以显示 structured task 摘要，但不能把 structured task 伪装成当前 interactive session。

允许：

```text
Dock Focus -> Structured Tasks 列表
Dock Focus -> 打开 structured task detail
Dock Focus -> 运行 claude -p task，前提是 structuredRuntimeService 已真实实现
```

禁止：

```text
Dock Quick Prompt -> claude -p -> 假装写入当前 Chat
```

Dock Quick Prompt 必须：

```text
writeToPty(ptySessionId, prompt + "\r")
```

---

## 3. 三模式设计

### 3.1 Quiet Mode

```text
定位：极窄状态条，长期常驻，不干扰用户。
尺寸：52 × 220 px。
显示：猫猫 Logo、active PTY dot、waiting dot、risk dot、Claude CLI dot、展开按钮。
交互：click logo -> Calm；double click -> Console；right click -> Dock menu。
```

### 3.2 Calm Mode

```text
定位：默认推荐模式，温和状态面板。
尺寸：320 × 460 px。
显示：Dock Header、当前重点会话、待确认/风险摘要、运行状态灯、快捷操作、最近事件。
操作：打开 Workspace / Projects / Console / Resources / Diagnostics / Focus / Hide。
```

### 3.3 Focus Mode

```text
定位：多会话指挥板。
尺寸：520 × 680 px。
显示：运行中 PTY 会话列表、等待确认队列、风险队列、系统摘要、Quick Prompt 到当前 PTY。
注意：Focus 不复制完整 Terminal，只显示 tail/status/action；完整 Terminal 必须打开 Workspace。
```

---

## 4. 主题与视效规则

### 4.1 默认跟随主程序主题

```ts
export type DockThemeMode = "follow-app" | "independent";

export interface DockThemeSettings {
  mode: DockThemeMode;
  independentTheme: "light" | "dark" | "pale-blue" | "warm-sand";
}
```

规则：

```text
mode = follow-app:
  Dock 使用 main window 广播的 appTheme。

mode = independent:
  Dock 使用 dockSettings.independentTheme。
```

### 4.2 状态灯

```text
Ready      -> var(--cc-green)
Running    -> var(--cc-blue), soft pulse
Waiting    -> var(--cc-amber), soft pulse
Risk       -> var(--cc-red), one-shot attention then steady
AutoTrust  -> var(--cc-purple), soft pulse
Idle       -> var(--cc-text-soft)
Unknown    -> var(--cc-text-soft)
```

### 4.3 Dock 尺寸

```ts
export const DOCK_DIMENSIONS = {
  quiet: { width: 52, height: 220 },
  calm: { width: 320, height: 460 },
  focus: { width: 520, height: 680 },
} as const;
```

---

## 5. 文件结构

```text
src/
├── features/
│   ├── dock/
│   │   ├── pages/AIDockSurface.tsx
│   │   ├── components/
│   │   │   ├── DockRoot.tsx
│   │   │   ├── DockHeader.tsx
│   │   │   ├── DockQuietMode.tsx
│   │   │   ├── DockCalmMode.tsx
│   │   │   ├── DockFocusMode.tsx
│   │   │   ├── DockStatusLights.tsx
│   │   │   ├── DockSessionCard.tsx
│   │   │   ├── DockAttentionQueue.tsx
│   │   │   ├── DockQuickPrompt.tsx
│   │   │   ├── DockActionGrid.tsx
│   │   │   └── DockThemeSwitch.tsx
│   │   ├── services/
│   │   │   ├── dockWindowService.ts
│   │   │   ├── dockSnapshotBuilder.ts
│   │   │   ├── dockSnapshotPublisher.ts
│   │   │   ├── dockActionBridge.ts
│   │   │   └── dockThemeBridge.ts
│   │   ├── stores/dockStore.ts
│   │   ├── types/dockTypes.ts
│   │   └── styles/dock.css
│   └── settings/components/AIDockSettingsPanel.tsx
└── src-tauri/src/commands/dock_window.rs
```

---

## 6. TypeScript 类型

创建 `src/features/dock/types/dockTypes.ts`：

```ts
export type DockMode = "quiet" | "calm" | "focus";
export type DockThemeMode = "follow-app" | "independent";
export type CtrlCcTheme = "light" | "dark" | "pale-blue" | "warm-sand";

export type DockHealthState =
  | "ready"
  | "running"
  | "waiting"
  | "risk"
  | "error"
  | "idle"
  | "unknown"
  | "unavailable";

export interface DockThemeSettings {
  mode: DockThemeMode;
  independentTheme: CtrlCcTheme;
}

export interface DockSettings {
  visible: boolean;
  mode: DockMode;
  pinned: boolean;
  edge: "right";
  verticalAlign: "center";
  theme: DockThemeSettings;
}

export interface AIDockSnapshot {
  generatedAt: string;
  appTheme: CtrlCcTheme;
  dockSettings: DockSettings;
  global: DockGlobalState;
  sessions: DockSessionSummary[];
  attention: DockAttentionItem[];
  recentEvents: DockEventItem[];
  integrations: DockIntegrationState;
}

export interface DockGlobalState {
  claude: DockStatusItem;
  pty: DockStatusItem;
  git: DockStatusItem;
  db: DockStatusItem;
  watchdog: DockStatusItem;
  runningPtyCount: number;
  waitingCount: number;
  riskCount: number;
  failedCount: number;
  activeProjectCount: number;
  autoTrustPaused: boolean;
}

export interface DockStatusItem {
  state: DockHealthState;
  label: string;
  detail?: string | null;
}

export interface DockSessionSummary {
  sessionId: string;
  projectId: string;
  projectName: string;
  sessionName: string;
  runtimeMode: "pty" | "structured";
  status: string;
  ptySessionId?: string | null;
  cwd: string;
  model?: string | null;
  updatedAt: string;
  waitingPermissionCount: number;
  riskCount: number;
  changedFiles: number;
  tokenInput?: number | null;
  tokenOutput?: number | null;
  estimatedCostUsd?: number | null;
  tail?: string | null;
}

export interface DockAttentionItem {
  id: string;
  type: "permission" | "risk" | "error" | "runtime" | "git";
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  detail: string;
  projectId?: string;
  sessionId?: string;
  ptySessionId?: string | null;
}

export interface DockEventItem {
  id: string;
  ts: string;
  type: string;
  title: string;
  detail: string;
  projectId?: string;
  sessionId?: string;
}

export interface DockIntegrationState {
  consoleReady: boolean;
  projectsReady: boolean;
  workspaceReady: boolean;
  resourcesReady: boolean;
  githubReady: boolean;
  diagnosticsReady: boolean;
}

export type DockAction =
  | { type: "set-mode"; mode: DockMode }
  | { type: "show-dock"; mode?: DockMode }
  | { type: "hide-dock" }
  | { type: "open-main" }
  | { type: "open-console" }
  | { type: "open-project"; projectId?: string }
  | { type: "open-workspace"; projectId: string; sessionId: string }
  | { type: "open-resources"; projectId?: string; scope?: string }
  | { type: "open-github"; projectId?: string; target?: string }
  | { type: "open-diagnostics"; projectId?: string }
  | { type: "send-ctrl-c"; sessionId: string }
  | { type: "stop-session"; sessionId: string }
  | { type: "send-prompt"; sessionId: string; prompt: string }
  | { type: "pause-autotrust" }
  | { type: "export-session-log"; sessionId: string }
  | { type: "open-replay"; sessionId: string };
```

---

## 7. Rust：Dock Window Commands

创建 `src-tauri/src/commands/dock_window.rs`：

```rust
use serde::{Deserialize, Serialize};
use tauri::{
    AppHandle, Manager, PhysicalPosition, PhysicalSize, Position, Size, WebviewUrl,
    WebviewWindowBuilder,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DockGeometry {
    pub mode: String,
    pub width: u32,
    pub height: u32,
}

fn geometry_for_mode(mode: &str) -> DockGeometry {
    match mode {
        "quiet" => DockGeometry { mode: "quiet".to_string(), width: 52, height: 220 },
        "focus" => DockGeometry { mode: "focus".to_string(), width: 520, height: 680 },
        _ => DockGeometry { mode: "calm".to_string(), width: 320, height: 460 },
    }
}

fn position_right_center(app: &AppHandle, width: u32, height: u32) -> Result<Position, String> {
    let monitor = app
        .primary_monitor()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "No primary monitor found".to_string())?;

    let monitor_pos = monitor.position();
    let monitor_size = monitor.size();

    let margin = 18i32;
    let x = monitor_pos.x + monitor_size.width as i32 - width as i32 - margin;
    let y = monitor_pos.y + ((monitor_size.height as i32 - height as i32) / 2);

    Ok(Position::Physical(PhysicalPosition { x, y }))
}

#[tauri::command]
pub fn dock_show(app: AppHandle, mode: Option<String>) -> Result<DockGeometry, String> {
    let mode = mode.unwrap_or_else(|| "calm".to_string());
    let geom = geometry_for_mode(&mode);

    let window = if let Some(existing) = app.get_webview_window("ai-dock") {
        existing
    } else {
        WebviewWindowBuilder::new(&app, "ai-dock", WebviewUrl::App("/dock".into()))
            .title("Ctrl-CC AI Dock")
            .decorations(false)
            .resizable(false)
            .skip_taskbar(true)
            .always_on_top(true)
            .inner_size(geom.width as f64, geom.height as f64)
            .visible(false)
            .build()
            .map_err(|e| e.to_string())?
    };

    window
        .set_size(Size::Physical(PhysicalSize { width: geom.width, height: geom.height }))
        .map_err(|e| e.to_string())?;

    let pos = position_right_center(&app, geom.width, geom.height)?;
    window.set_position(pos).map_err(|e| e.to_string())?;
    window.set_always_on_top(true).map_err(|e| e.to_string())?;
    window.show().map_err(|e| e.to_string())?;

    Ok(geom)
}

#[tauri::command]
pub fn dock_hide(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("ai-dock") {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn dock_reposition(app: AppHandle, mode: String) -> Result<DockGeometry, String> {
    let geom = geometry_for_mode(&mode);

    if let Some(window) = app.get_webview_window("ai-dock") {
        window
            .set_size(Size::Physical(PhysicalSize { width: geom.width, height: geom.height }))
            .map_err(|e| e.to_string())?;

        let pos = position_right_center(&app, geom.width, geom.height)?;
        window.set_position(pos).map_err(|e| e.to_string())?;
    }

    Ok(geom)
}

#[tauri::command]
pub fn dock_set_always_on_top(app: AppHandle, enabled: bool) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("ai-dock") {
        window.set_always_on_top(enabled).map_err(|e| e.to_string())?;
    }
    Ok(())
}
```

在 `src-tauri/src/main.rs` 注册：

```rust
mod commands {
    pub mod dock_window;
}

use commands::dock_window::{dock_hide, dock_reposition, dock_set_always_on_top, dock_show};

// invoke_handler 中加入：
// dock_show,
// dock_hide,
// dock_reposition,
// dock_set_always_on_top
```

---

## 8. Dock Window Service

创建 `src/features/dock/services/dockWindowService.ts`：

```ts
import { invoke } from "@tauri-apps/api/core";
import { emitTo } from "@tauri-apps/api/event";
import type { DockAction, DockMode } from "../types/dockTypes";

export async function showDock(mode: DockMode = "calm") {
  return invoke("dock_show", { mode });
}

export async function hideDock() {
  return invoke("dock_hide");
}

export async function repositionDock(mode: DockMode) {
  return invoke("dock_reposition", { mode });
}

export async function setDockAlwaysOnTop(enabled: boolean) {
  return invoke("dock_set_always_on_top", { enabled });
}

export async function sendDockAction(action: DockAction) {
  await emitTo("main", "dock.action", action);
}

export async function setDockMode(mode: DockMode) {
  await sendDockAction({ type: "set-mode", mode });
  await repositionDock(mode);
}
```

---

## 9. Dock Store

创建 `src/features/dock/stores/dockStore.ts`：

```ts
import { create } from "zustand";
import type { AIDockSnapshot, CtrlCcTheme, DockMode, DockSettings, DockThemeSettings } from "../types/dockTypes";

const defaultTheme: DockThemeSettings = {
  mode: "follow-app",
  independentTheme: "warm-sand",
};

const defaultSettings: DockSettings = {
  visible: false,
  mode: "calm",
  pinned: true,
  edge: "right",
  verticalAlign: "center",
  theme: defaultTheme,
};

interface DockState {
  settings: DockSettings;
  snapshot: AIDockSnapshot | null;
  effectiveTheme: CtrlCcTheme;
  setSnapshot: (snapshot: AIDockSnapshot) => void;
  setMode: (mode: DockMode) => void;
  setVisible: (visible: boolean) => void;
  setThemeMode: (mode: DockThemeSettings["mode"]) => void;
  setIndependentTheme: (theme: CtrlCcTheme) => void;
}

export const useDockStore = create<DockState>((set, get) => ({
  settings: defaultSettings,
  snapshot: null,
  effectiveTheme: "warm-sand",

  setSnapshot: (snapshot) => {
    const local = get().settings;
    const effectiveTheme = local.theme.mode === "follow-app" ? snapshot.appTheme : local.theme.independentTheme;
    set({ snapshot, effectiveTheme });
    document.documentElement.dataset.theme = effectiveTheme;
    document.documentElement.dataset.dockMode = local.mode;
  },

  setMode: (mode) =>
    set((state) => {
      document.documentElement.dataset.dockMode = mode;
      return { settings: { ...state.settings, mode } };
    }),

  setVisible: (visible) =>
    set((state) => ({ settings: { ...state.settings, visible } })),

  setThemeMode: (mode) =>
    set((state) => ({ settings: { ...state.settings, theme: { ...state.settings.theme, mode } } })),

  setIndependentTheme: (theme) =>
    set((state) => ({
      settings: { ...state.settings, theme: { ...state.settings.theme, independentTheme: theme } },
      effectiveTheme: state.settings.theme.mode === "independent" ? theme : state.effectiveTheme,
    })),
}));
```

---

## 10. Dock Snapshot Builder

创建 `src/features/dock/services/dockSnapshotBuilder.ts`：

```ts
import type { AIDockSnapshot, DockAttentionItem, DockEventItem, DockSettings, DockStatusItem, CtrlCcTheme } from "../types/dockTypes";
import type { ClaudeSession, Project } from "../../projects/types/projectTypes";

interface BuildDockSnapshotInput {
  appTheme: CtrlCcTheme;
  dockSettings: DockSettings;
  projects: Project[];
  sessions: ClaudeSession[];
  runtimeSnapshots: Record<string, any>;
  runtimeEvents: any[];
  claudeHealth: string;
  ptyHealth: string;
}

export function buildDockSnapshot(input: BuildDockSnapshotInput): AIDockSnapshot {
  const activeSessions = input.sessions.filter(isActiveSession);
  const waitingCount = input.sessions.reduce((sum, s) => sum + s.waitingPermissionCount, 0);
  const riskCount = input.sessions.reduce((sum, s) => sum + s.riskCount, 0);
  const failedCount = input.sessions.filter((s) => s.status === "failed").length;

  return {
    generatedAt: new Date().toISOString(),
    appTheme: input.appTheme,
    dockSettings: input.dockSettings,
    global: {
      claude: mapClaudeHealth(input.claudeHealth),
      pty: mapPtyHealth(input.ptyHealth),
      git: inferGitHealth(input.runtimeSnapshots),
      db: { state: "unknown", label: "DB", detail: "Not connected" },
      watchdog: { state: "unknown", label: "Watchdog", detail: "Not connected" },
      runningPtyCount: activeSessions.length,
      waitingCount,
      riskCount,
      failedCount,
      activeProjectCount: new Set(activeSessions.map((s) => s.projectId)).size,
      autoTrustPaused: false,
    },
    sessions: activeSessions.slice(0, 8).map((s) => ({
      sessionId: s.id,
      projectId: s.projectId,
      projectName: input.projects.find((p) => p.id === s.projectId)?.name ?? "Unknown Project",
      sessionName: s.name,
      runtimeMode: s.runtimeMode,
      status: s.status,
      ptySessionId: s.ptySessionId,
      cwd: s.cwd,
      model: s.model,
      updatedAt: s.updatedAt,
      waitingPermissionCount: s.waitingPermissionCount,
      riskCount: s.riskCount,
      changedFiles: s.changedFiles,
      tokenInput: s.tokenInput,
      tokenOutput: s.tokenOutput,
      estimatedCostUsd: s.estimatedCostUsd,
      tail: findTailForSession(s, input.runtimeEvents),
    })),
    attention: buildAttention(input.sessions, input.claudeHealth, input.ptyHealth),
    recentEvents: buildRecentEvents(input.runtimeEvents),
    integrations: {
      consoleReady: true,
      projectsReady: true,
      workspaceReady: true,
      resourcesReady: true,
      githubReady: true,
      diagnosticsReady: true,
    },
  };
}

function isActiveSession(session: ClaudeSession) {
  return session.status !== "stopped" && session.status !== "failed" && session.status !== "archived" && !!session.ptySessionId;
}

function findTailForSession(session: ClaudeSession, runtimeEvents: any[]) {
  if (!session.ptySessionId) return null;
  const output = runtimeEvents.find((e) => e.type === "pty.output" && e.sessionId === session.ptySessionId);
  const raw = output?.chunk;
  if (!raw || typeof raw !== "string") return null;
  return raw.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "").trim().slice(-120) || null;
}

function buildAttention(sessions: ClaudeSession[], claudeHealth: string, ptyHealth: string): DockAttentionItem[] {
  const items: DockAttentionItem[] = [];

  if (claudeHealth !== "ready") {
    items.push({ id: "claude-runtime", type: "runtime", severity: "high", title: "Claude Runtime 未就绪", detail: `当前状态：${claudeHealth}` });
  }

  if (ptyHealth === "error") {
    items.push({ id: "pty-runtime", type: "runtime", severity: "critical", title: "PTY Runtime 异常", detail: "真实 Claude Code 交互需要 PTY 正常工作。" });
  }

  for (const s of sessions) {
    if (s.waitingPermissionCount > 0) {
      items.push({ id: `permission-${s.id}`, type: "permission", severity: "medium", title: "等待权限确认", detail: `${s.name} 有 ${s.waitingPermissionCount} 个操作等待处理。`, projectId: s.projectId, sessionId: s.id, ptySessionId: s.ptySessionId });
    }
    if (s.riskCount > 0) {
      items.push({ id: `risk-${s.id}`, type: "risk", severity: "high", title: "会话存在风险", detail: `${s.name} 有 ${s.riskCount} 个风险项。`, projectId: s.projectId, sessionId: s.id, ptySessionId: s.ptySessionId });
    }
  }

  return items.slice(0, 10);
}

function buildRecentEvents(runtimeEvents: any[]): DockEventItem[] {
  return runtimeEvents.slice(0, 8).map((e, i) => ({
    id: e.id ?? `event-${i}`,
    ts: e.ts ?? new Date().toISOString(),
    type: e.type ?? "event",
    title: e.type === "pty.output" ? "Claude 输出" : e.type === "pty.exit" ? "会话退出" : e.type ?? "事件",
    detail: e.message ?? e.chunk?.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "").trim().slice(0, 80) ?? "Runtime event",
    projectId: e.projectId,
    sessionId: e.sessionId,
  }));
}

function mapClaudeHealth(health: string): DockStatusItem {
  if (health === "ready") return { state: "ready", label: "Claude", detail: "Ready" };
  if (health === "not-found") return { state: "error", label: "Claude", detail: "Not found" };
  if (health === "auth-required") return { state: "waiting", label: "Claude", detail: "Auth required" };
  return { state: "unknown", label: "Claude", detail: "Unknown" };
}

function mapPtyHealth(health: string): DockStatusItem {
  if (health === "ready") return { state: "ready", label: "PTY", detail: "Ready" };
  if (health === "error") return { state: "error", label: "PTY", detail: "Error" };
  return { state: "unknown", label: "PTY", detail: "Unknown" };
}

function inferGitHealth(runtimeSnapshots: Record<string, any>): DockStatusItem {
  const values = Object.values(runtimeSnapshots);
  if (values.length === 0) return { state: "unknown", label: "Git", detail: "Not scanned" };
  const hasError = values.some((v: any) => v?.git?.errorMessage);
  if (hasError) return { state: "waiting", label: "Git", detail: "Some projects unavailable" };
  return { state: "ready", label: "Git", detail: "Ready" };
}
```

---

## 11. Dock Snapshot Publisher

创建 `src/features/dock/services/dockSnapshotPublisher.ts`：

```ts
import { emitTo } from "@tauri-apps/api/event";
import { buildDockSnapshot } from "./dockSnapshotBuilder";
import { useProjectsStore } from "../../projects/stores/projectsStore";
import { useRuntimeStore } from "../../runtime/stores/runtimeStore";
import { useDockStore } from "../stores/dockStore";
import type { CtrlCcTheme } from "../types/dockTypes";

let publisherTimer: number | null = null;

export function installDockSnapshotPublisher(getAppTheme: () => CtrlCcTheme) {
  if (publisherTimer != null) return () => {};

  publisherTimer = window.setInterval(async () => {
    const projectState = useProjectsStore.getState();
    const runtimeState = useRuntimeStore.getState();
    const dockState = useDockStore.getState();

    const snapshot = buildDockSnapshot({
      appTheme: getAppTheme(),
      dockSettings: dockState.settings,
      projects: projectState.projects,
      sessions: projectState.sessions,
      runtimeSnapshots: projectState.runtimeSnapshots,
      runtimeEvents: runtimeState.events,
      claudeHealth: runtimeState.claudeHealth,
      ptyHealth: runtimeState.ptyHealth,
    });

    try {
      await emitTo("ai-dock", "dock.snapshot", snapshot);
    } catch {
      // Dock may be hidden or not yet created.
    }
  }, 500);

  return () => {
    if (publisherTimer != null) {
      window.clearInterval(publisherTimer);
      publisherTimer = null;
    }
  };
}
```

---

## 12. Dock Action Bridge

创建 `src/features/dock/services/dockActionBridge.ts`：

```ts
import { listen } from "@tauri-apps/api/event";
import type { DockAction } from "../types/dockTypes";
import { useDockStore } from "../stores/dockStore";
import { hideDock, repositionDock, showDock } from "./dockWindowService";
import {
  consoleOpenDiagnostics,
  consoleOpenGithub,
  consoleOpenProject,
  consoleOpenResources,
  consoleOpenWorkspaceSession,
  consoleSendCtrlC,
  consoleStopSession,
} from "../../console/services/consoleRuntimeActions";
import { useProjectsStore } from "../../projects/stores/projectsStore";
import { writeToPty } from "../../runtime/services/claudeRuntimeService";

export async function installDockActionBridge() {
  const unlisten = await listen("dock.action", async (event) => {
    const action = event.payload as DockAction;
    try {
      await handleDockAction(action);
    } catch (err) {
      console.error("[AI Dock] action failed", action, err);
    }
  });

  return unlisten;
}

async function handleDockAction(action: DockAction) {
  switch (action.type) {
    case "set-mode":
      useDockStore.getState().setMode(action.mode);
      await repositionDock(action.mode);
      return;
    case "show-dock":
      await showDock(action.mode ?? useDockStore.getState().settings.mode);
      useDockStore.getState().setVisible(true);
      return;
    case "hide-dock":
      await hideDock();
      useDockStore.getState().setVisible(false);
      return;
    case "open-main":
    case "open-console":
      window.dispatchEvent(new CustomEvent("ctrlcc:navigate", { detail: { surface: "console" } }));
      return;
    case "open-project":
      consoleOpenProject(action.projectId);
      return;
    case "open-workspace":
      consoleOpenWorkspaceSession(action.sessionId);
      return;
    case "open-resources":
      consoleOpenResources(action.projectId);
      return;
    case "open-github":
      consoleOpenGithub(action.projectId);
      return;
    case "open-diagnostics":
      consoleOpenDiagnostics(action.projectId);
      return;
    case "send-ctrl-c":
      await consoleSendCtrlC(action.sessionId);
      return;
    case "stop-session":
      await consoleStopSession(action.sessionId);
      return;
    case "send-prompt":
      await sendPromptToSession(action.sessionId, action.prompt);
      return;
    case "pause-autotrust":
      window.alert("AutoTrust pause is not implemented yet.");
      return;
    case "export-session-log":
      window.alert("Session log export is not implemented yet.");
      return;
    case "open-replay":
      window.dispatchEvent(new CustomEvent("ctrlcc:navigate", { detail: { surface: "workspace", sessionId: action.sessionId, panel: "replay" } }));
      return;
  }
}

async function sendPromptToSession(sessionId: string, prompt: string) {
  const session = useProjectsStore.getState().sessions.find((s) => s.id === sessionId);
  if (!session?.ptySessionId) throw new Error("No active PTY session found for Dock prompt.");
  await writeToPty(session.ptySessionId, `${prompt.trim()}\r`);
}
```

---

## 13. Dock React 入口与核心组件

### AIDockSurface

`src/features/dock/pages/AIDockSurface.tsx`：

```tsx
import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import type { AIDockSnapshot } from "../types/dockTypes";
import { useDockStore } from "../stores/dockStore";
import { DockRoot } from "../components/DockRoot";
import "../styles/dock.css";

export function AIDockSurface() {
  const setSnapshot = useDockStore((s) => s.setSnapshot);

  useEffect(() => {
    let cleanup: undefined | (() => void);
    listen("dock.snapshot", (event) => setSnapshot(event.payload as AIDockSnapshot)).then((fn) => {
      cleanup = fn;
    });
    return () => cleanup?.();
  }, [setSnapshot]);

  return <DockRoot />;
}
```

### DockRoot

`src/features/dock/components/DockRoot.tsx`：

```tsx
import { useDockStore } from "../stores/dockStore";
import { DockQuietMode } from "./DockQuietMode";
import { DockCalmMode } from "./DockCalmMode";
import { DockFocusMode } from "./DockFocusMode";

export function DockRoot() {
  const settings = useDockStore((s) => s.settings);
  const snapshot = useDockStore((s) => s.snapshot);
  const effectiveTheme = useDockStore((s) => s.effectiveTheme);

  if (!snapshot) {
    return (
      <div className="ai-dock-root dock-loading" data-theme={effectiveTheme}>
        <div className="dock-cat">🐱</div>
        <span>Waiting...</span>
      </div>
    );
  }

  return (
    <div className={`ai-dock-root dock-${settings.mode}`} data-theme={effectiveTheme} data-dock-mode={settings.mode}>
      {settings.mode === "quiet" && <DockQuietMode snapshot={snapshot} />}
      {settings.mode === "calm" && <DockCalmMode snapshot={snapshot} />}
      {settings.mode === "focus" && <DockFocusMode snapshot={snapshot} />}
    </div>
  );
}
```

### DockStatusLights

`src/features/dock/components/DockStatusLights.tsx`：

```tsx
import type { DockGlobalState } from "../types/dockTypes";

export function DockStatusLights({ global, compact = false }: { global: DockGlobalState; compact?: boolean }) {
  const lights = [
    { key: "pty", label: "PTY", state: global.runningPtyCount > 0 ? "running" : global.pty.state },
    { key: "waiting", label: "Waiting", state: global.waitingCount > 0 ? "waiting" : "idle" },
    { key: "risk", label: "Risk", state: global.riskCount > 0 ? "risk" : "idle" },
    { key: "claude", label: "Claude", state: global.claude.state },
  ];

  return (
    <div className={compact ? "dock-status-lights compact" : "dock-status-lights"}>
      {lights.map((l) => (
        <div key={l.key} className={`dock-status-light state-${l.state}`} title={`${l.label}: ${l.state}`}>
          <span />
          {!compact && <small>{l.label}</small>}
        </div>
      ))}
    </div>
  );
}
```

### DockHeader

`src/features/dock/components/DockHeader.tsx`：

```tsx
import type { AIDockSnapshot, DockMode } from "../types/dockTypes";
import { sendDockAction } from "../services/dockWindowService";

export function DockHeader({ snapshot, title = "Ctrl-CC" }: { snapshot: AIDockSnapshot; title?: string }) {
  return (
    <header className="dock-header">
      <button className="dock-brand" onClick={() => sendDockAction({ type: "open-console" })}>
        <span className="dock-cat">🐱</span>
        <span>{title}</span>
      </button>
      <div className="dock-mode-buttons">
        <ModeButton mode="quiet" label="Q" />
        <ModeButton mode="calm" label="C" />
        <ModeButton mode="focus" label="F" />
      </div>
      <button className="dock-icon-button" onClick={() => sendDockAction({ type: "hide-dock" })}>×</button>
    </header>
  );
}

function ModeButton({ mode, label }: { mode: DockMode; label: string }) {
  return <button className="dock-mode-button" onClick={() => sendDockAction({ type: "set-mode", mode })}>{label}</button>;
}
```

### Quiet / Calm / Focus

`DockQuietMode.tsx`：

```tsx
import type { AIDockSnapshot } from "../types/dockTypes";
import { sendDockAction } from "../services/dockWindowService";
import { DockStatusLights } from "./DockStatusLights";

export function DockQuietMode({ snapshot }: { snapshot: AIDockSnapshot }) {
  return (
    <section className="dock-quiet">
      <button className="quiet-logo" onClick={() => sendDockAction({ type: "set-mode", mode: "calm" })}>🐱</button>
      <DockStatusLights global={snapshot.global} compact />
      <button className="quiet-expand" onClick={() => sendDockAction({ type: "set-mode", mode: "calm" })}>›</button>
      <div className="quiet-popover">
        <strong>{snapshot.global.runningPtyCount} running</strong>
        <span>{snapshot.global.waitingCount} waiting · {snapshot.global.riskCount} risks</span>
      </div>
    </section>
  );
}
```

`DockCalmMode.tsx`：

```tsx
import type { AIDockSnapshot } from "../types/dockTypes";
import { DockHeader } from "./DockHeader";
import { DockStatusLights } from "./DockStatusLights";
import { DockSessionCard } from "./DockSessionCard";
import { DockAttentionQueue } from "./DockAttentionQueue";
import { DockActionGrid } from "./DockActionGrid";

export function DockCalmMode({ snapshot }: { snapshot: AIDockSnapshot }) {
  const primarySession = snapshot.sessions[0];
  return (
    <section className="dock-calm">
      <DockHeader snapshot={snapshot} />
      <div className="dock-summary-card">
        <DockStatusLights global={snapshot.global} />
        <p>{snapshot.global.runningPtyCount} 个 Claude PTY 会话运行 · {snapshot.global.waitingCount} 个待确认 · {snapshot.global.riskCount} 个风险</p>
      </div>
      {primarySession ? <DockSessionCard session={primarySession} compact /> : <div className="dock-empty-card"><strong>暂无运行中会话</strong><span>从 Console 或 Projects 启动一个真实 Claude Code PTY 会话。</span></div>}
      <DockAttentionQueue items={snapshot.attention.slice(0, 3)} />
      <DockActionGrid snapshot={snapshot} compact />
    </section>
  );
}
```

`DockFocusMode.tsx`：

```tsx
import { useState } from "react";
import type { AIDockSnapshot } from "../types/dockTypes";
import { DockHeader } from "./DockHeader";
import { DockSessionCard } from "./DockSessionCard";
import { DockAttentionQueue } from "./DockAttentionQueue";
import { DockQuickPrompt } from "./DockQuickPrompt";
import { DockActionGrid } from "./DockActionGrid";

export function DockFocusMode({ snapshot }: { snapshot: AIDockSnapshot }) {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(snapshot.sessions[0]?.sessionId ?? null);
  const selected = snapshot.sessions.find((s) => s.sessionId === selectedSessionId) ?? snapshot.sessions[0] ?? null;

  return (
    <section className="dock-focus">
      <DockHeader snapshot={snapshot} title="AI Dock Focus" />
      <div className="focus-grid">
        <div className="focus-main">
          <header className="focus-section-header"><strong>运行中 Claude PTY 会话</strong><span>{snapshot.sessions.length}</span></header>
          <div className="focus-session-list">
            {snapshot.sessions.map((s) => (
              <button key={s.sessionId} className={s.sessionId === selected?.sessionId ? "selected" : ""} onClick={() => setSelectedSessionId(s.sessionId)}>
                <DockSessionCard session={s} compact />
              </button>
            ))}
          </div>
        </div>
        <div className="focus-side">
          <DockAttentionQueue items={snapshot.attention} />
          <DockActionGrid snapshot={snapshot} />
        </div>
      </div>
      {selected && <DockQuickPrompt session={selected} />}
    </section>
  );
}
```

---

## 14. 操作组件

### DockSessionCard

```tsx
import type { DockSessionSummary } from "../types/dockTypes";
import { sendDockAction } from "../services/dockWindowService";

export function DockSessionCard({ session, compact = false }: { session: DockSessionSummary; compact?: boolean }) {
  return (
    <article className={compact ? "dock-session-card compact" : "dock-session-card"}>
      <header>
        <div><strong>{session.projectName}</strong><span>{session.sessionName}</span></div>
        <i className={`session-state state-${mapStatusState(session.status)}`} />
      </header>
      {!compact && <p className="session-tail">{session.tail ?? "No recent terminal output"}</p>}
      <div className="session-meta"><span>{session.status}</span><span>{session.changedFiles} files</span><span>{session.riskCount} risks</span></div>
      <footer>
        <button onClick={() => sendDockAction({ type: "open-workspace", projectId: session.projectId, sessionId: session.sessionId })}>Workspace</button>
        <button onClick={() => sendDockAction({ type: "send-ctrl-c", sessionId: session.sessionId })}>Ctrl+C</button>
        <button className="danger" onClick={() => sendDockAction({ type: "stop-session", sessionId: session.sessionId })}>Stop</button>
      </footer>
    </article>
  );
}

function mapStatusState(status: string) {
  if (status.includes("risk") || status === "failed") return "risk";
  if (status.includes("waiting")) return "waiting";
  if (status === "idle") return "idle";
  return "running";
}
```

### DockAttentionQueue

```tsx
import type { DockAttentionItem } from "../types/dockTypes";
import { sendDockAction } from "../services/dockWindowService";

export function DockAttentionQueue({ items }: { items: DockAttentionItem[] }) {
  return (
    <section className="dock-attention">
      <header><strong>需要处理</strong><span>{items.length}</span></header>
      {items.length === 0 ? <div className="dock-mini-empty">没有待处理事项</div> : (
        <div className="dock-attention-list">
          {items.map((item) => (
            <button key={item.id} className={`attention-row severity-${item.severity}`} onClick={() => {
              if (item.sessionId && item.projectId) sendDockAction({ type: "open-workspace", projectId: item.projectId, sessionId: item.sessionId });
              else sendDockAction({ type: "open-diagnostics", projectId: item.projectId });
            }}>
              <strong>{item.title}</strong><span>{item.detail}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
```

### DockQuickPrompt

```tsx
import { useState } from "react";
import type { DockSessionSummary } from "../types/dockTypes";
import { sendDockAction } from "../services/dockWindowService";

export function DockQuickPrompt({ session }: { session: DockSessionSummary }) {
  const [value, setValue] = useState("");

  async function submit() {
    const prompt = value.trim();
    if (!prompt) return;
    await sendDockAction({ type: "send-prompt", sessionId: session.sessionId, prompt });
    setValue("");
  }

  return (
    <form className="dock-quick-prompt" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <textarea value={value} onChange={(e) => setValue(e.target.value)} placeholder={`发送到当前 Claude PTY：${session.sessionName}`} onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); submit(); } }} />
      <button disabled={!value.trim()}>发送到 PTY</button>
    </form>
  );
}
```

### DockActionGrid

```tsx
import type { AIDockSnapshot } from "../types/dockTypes";
import { sendDockAction } from "../services/dockWindowService";

export function DockActionGrid({ snapshot, compact = false }: { snapshot: AIDockSnapshot; compact?: boolean }) {
  const firstProjectId = snapshot.sessions[0]?.projectId;
  return (
    <section className={compact ? "dock-action-grid compact" : "dock-action-grid"}>
      <button onClick={() => sendDockAction({ type: "open-console" })}>Console</button>
      <button onClick={() => sendDockAction({ type: "open-project", projectId: firstProjectId })}>Projects</button>
      <button onClick={() => sendDockAction({ type: "open-resources", projectId: firstProjectId })}>Resources</button>
      <button onClick={() => sendDockAction({ type: "open-github", projectId: firstProjectId })}>GitHub</button>
      <button onClick={() => sendDockAction({ type: "open-diagnostics", projectId: firstProjectId })}>Diagnostics</button>
      <button onClick={() => sendDockAction({ type: "pause-autotrust" })}>Pause AutoTrust</button>
    </section>
  );
}
```

---

## 15. CSS

创建 `src/features/dock/styles/dock.css`：

```css
html, body, #root {
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
  background: transparent;
}

.ai-dock-root {
  width: 100vw;
  height: 100vh;
  box-sizing: border-box;
  color: var(--cc-text);
  font-family: Inter, "MiSans", "HarmonyOS Sans", "Source Han Sans", system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  user-select: none;
}

.ai-dock-root *, .ai-dock-root *::before, .ai-dock-root *::after {
  box-sizing: border-box;
}

.dock-loading, .dock-quiet, .dock-calm, .dock-focus {
  width: 100%;
  height: 100%;
  border: 1px solid var(--cc-border-soft);
  background:
    radial-gradient(circle at 20% 10%, color-mix(in srgb, var(--cc-brand-soft) 72%, transparent), transparent 48%),
    color-mix(in srgb, var(--cc-surface) 94%, transparent);
  box-shadow: var(--cc-shadow-popover);
  backdrop-filter: blur(18px);
  overflow: hidden;
}

.dock-loading { display: grid; place-items: center; border-radius: 26px; }
.dock-cat { font-size: 22px; line-height: 1; }

.dock-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 8px;
  padding: 10px;
  border-bottom: 1px solid var(--cc-border-soft);
}

.dock-brand, .dock-icon-button, .dock-mode-button, .quiet-logo, .quiet-expand,
.dock-session-card button, .dock-action-grid button, .dock-quick-prompt button, .attention-row {
  border: 1px solid var(--cc-border-soft);
  background: var(--cc-surface-solid);
  color: var(--cc-text);
  border-radius: 12px;
  cursor: pointer;
  transition: transform var(--cc-duration-fast) var(--cc-ease-standard), background var(--cc-duration-fast) var(--cc-ease-standard), border-color var(--cc-duration-fast) var(--cc-ease-standard);
}

.dock-brand:hover, .dock-icon-button:hover, .dock-mode-button:hover, .quiet-logo:hover, .quiet-expand:hover,
.dock-session-card button:hover, .dock-action-grid button:hover, .dock-quick-prompt button:hover, .attention-row:hover {
  transform: translateY(-1px);
  background: var(--cc-surface-hover);
  border-color: var(--cc-brand);
}

.dock-brand { display: inline-flex; align-items: center; gap: 7px; min-width: 0; padding: 8px 10px; font-weight: 700; }
.dock-mode-buttons { display: inline-flex; gap: 4px; padding: 3px; border-radius: 999px; background: var(--cc-surface-muted); }
.dock-mode-button { width: 26px; height: 26px; border-radius: 999px; padding: 0; font-size: 11px; }
.dock-icon-button { width: 30px; height: 30px; padding: 0; font-size: 16px; }

.dock-quiet {
  display: grid;
  grid-template-rows: 52px minmax(0, 1fr) 42px;
  place-items: center;
  border-radius: 24px;
  padding: 8px 0;
  position: relative;
}

.quiet-logo, .quiet-expand { display: grid; place-items: center; width: 36px; height: 36px; padding: 0; }
.quiet-popover {
  position: absolute;
  right: 58px;
  top: 50%;
  transform: translateY(-50%);
  width: 190px;
  padding: 12px;
  border: 1px solid var(--cc-border-soft);
  border-radius: 16px;
  background: var(--cc-surface);
  box-shadow: var(--cc-shadow-popover);
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--cc-duration-fast) var(--cc-ease-standard);
}
.dock-quiet:hover .quiet-popover { opacity: 1; }
.quiet-popover strong, .quiet-popover span { display: block; }
.quiet-popover span { margin-top: 5px; color: var(--cc-text-muted); font-size: 12px; }

.dock-calm { display: flex; flex-direction: column; border-radius: 26px; }
.dock-focus { display: flex; flex-direction: column; border-radius: 28px; }

.dock-summary-card, .dock-empty-card, .dock-session-card, .dock-attention, .dock-action-grid, .dock-quick-prompt {
  margin: 10px;
  padding: 12px;
  border: 1px solid var(--cc-border-soft);
  border-radius: 18px;
  background: color-mix(in srgb, var(--cc-surface-solid) 82%, transparent);
}

.dock-summary-card p, .dock-empty-card span, .dock-session-card span, .session-tail, .dock-mini-empty, .attention-row span {
  color: var(--cc-text-muted);
  font-size: 12px;
  line-height: 1.45;
}

.dock-status-lights { display: flex; align-items: center; gap: 8px; }
.dock-status-lights.compact { flex-direction: column; gap: 12px; }
.dock-status-light { display: inline-flex; align-items: center; gap: 5px; }
.dock-status-light span { width: 10px; height: 10px; border-radius: 999px; background: var(--cc-text-soft); }
.dock-status-light small { color: var(--cc-text-muted); font-size: 11px; }

.state-ready span, .state-ready { background: var(--cc-green); }
.state-running span, .state-running { background: var(--cc-blue); }
.state-waiting span, .state-waiting { background: var(--cc-amber); }
.state-risk span, .state-risk { background: var(--cc-red); }
.state-error span, .state-error { background: var(--cc-red); }
.state-idle span, .state-unknown span, .state-unavailable span { background: var(--cc-text-soft); }
.state-running span, .state-waiting span { animation: dock-soft-pulse 1.8s ease-in-out infinite; }

@keyframes dock-soft-pulse {
  0%, 100% { opacity: 0.55; transform: scale(0.96); }
  50% { opacity: 1; transform: scale(1.06); }
}

.dock-session-card { display: grid; gap: 10px; }
.dock-session-card.compact { margin: 10px; }
.dock-session-card header { display: flex; justify-content: space-between; gap: 10px; }
.dock-session-card strong { display: block; font-size: 13px; }
.dock-session-card i.session-state { width: 11px; height: 11px; flex: 0 0 auto; border-radius: 999px; margin-top: 4px; }
.session-tail { padding: 8px; border-radius: 12px; background: var(--cc-surface-muted); font-family: "JetBrains Mono", "Cascadia Code", monospace; max-height: 56px; overflow: hidden; }
.session-meta { display: flex; flex-wrap: wrap; gap: 6px; }
.session-meta span { padding: 4px 7px; border-radius: 999px; background: var(--cc-surface-muted); }
.dock-session-card footer { display: flex; flex-wrap: wrap; gap: 6px; }
.dock-session-card footer button { padding: 7px 8px; font-size: 12px; }
.dock-session-card footer button.danger { background: var(--cc-red-soft); color: var(--cc-red); }

.dock-attention header { display: flex; justify-content: space-between; align-items: center; }
.dock-attention-list { display: grid; gap: 7px; margin-top: 8px; }
.attention-row { display: block; width: 100%; text-align: left; padding: 9px; }
.attention-row strong { display: block; font-size: 12px; }
.severity-high, .severity-critical { border-color: color-mix(in srgb, var(--cc-red) 45%, var(--cc-border-soft)); }

.focus-grid { display: grid; grid-template-columns: minmax(0, 1fr) 190px; gap: 10px; min-height: 0; padding: 10px; flex: 1; }
.focus-main, .focus-side { min-height: 0; overflow: auto; }
.focus-section-header { display: flex; justify-content: space-between; padding: 4px 4px 8px; }
.focus-session-list { display: grid; gap: 8px; }
.focus-session-list > button { display: block; border: 0; padding: 0; background: transparent; text-align: left; border-radius: 18px; }
.focus-session-list > button.selected { outline: 2px solid color-mix(in srgb, var(--cc-brand) 70%, transparent); }

.dock-action-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
.dock-action-grid.compact { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.dock-action-grid button { padding: 9px 6px; font-size: 12px; }

.dock-quick-prompt { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; margin-top: auto; }
.dock-quick-prompt textarea {
  min-height: 48px;
  resize: none;
  border: 1px solid var(--cc-border-soft);
  border-radius: 14px;
  background: var(--cc-surface-solid);
  color: var(--cc-text);
  padding: 9px;
  font: inherit;
}
.dock-quick-prompt button { padding: 0 12px; }
```

---

## 16. 主 App 集成

在主窗口 App 初始化处加入：

```ts
import { installDockSnapshotPublisher } from "./features/dock/services/dockSnapshotPublisher";
import { installDockActionBridge } from "./features/dock/services/dockActionBridge";

useEffect(() => {
  const cleanupPublisher = installDockSnapshotPublisher(() => {
    return (document.documentElement.dataset.theme as any) || "warm-sand";
  });

  let cleanupAction: undefined | (() => void);
  installDockActionBridge().then((fn) => {
    cleanupAction = fn;
  });

  return () => {
    cleanupPublisher();
    cleanupAction?.();
  };
}, []);
```

在 Console / Settings / Command Center 中增加入口：

```ts
import { showDock } from "./features/dock/services/dockWindowService";

await showDock("calm");
```

---

## 17. 与 Workspace/Chat 的完整连接

### 打开 Workspace

```text
Dock -> emitTo main dock.action(open-workspace)
Main -> consoleOpenWorkspaceSession(sessionId)
Main -> openExistingSessionInWorkspace(session)
Workspace -> TerminalView(session.ptySessionId)
Workspace -> ChatComposer(session.ptySessionId)
```

### Quick Prompt

```text
DockQuickPrompt
  -> dock.action(send-prompt)
  -> main DockActionBridge
  -> writeToPty(session.ptySessionId, prompt + "\r")
  -> Claude Code CLI receives input in same PTY
```

禁止：

```text
DockQuickPrompt -> claude -p
DockQuickPrompt -> fake Chat
DockQuickPrompt -> new hidden session
```

### Ctrl+C

```text
Dock Ctrl+C
  -> dock.action(send-ctrl-c)
  -> main consoleSendCtrlC(sessionId)
  -> confirm
  -> writeToPty(ptySessionId, "\x03")
  -> AuditLog
```

### Stop

```text
Dock Stop
  -> dock.action(stop-session)
  -> main consoleStopSession(sessionId)
  -> confirm
  -> pty_kill(ptySessionId)
  -> pty.exit
  -> session.status = stopped
  -> AuditLog
```

---

## 18. 与其他 Surface 的连接

```text
Dock -> Console: open-console
Dock -> Projects: open-project(projectId)
Dock -> Resources: open-resources(projectId, scope)
Dock -> GitHub: open-github(projectId)
Dock -> Diagnostics: open-diagnostics(projectId)
Settings -> Dock: show/hide, Quiet/Calm/Focus, theme follow/independent, always-on-top
Command Center -> Dock: show, hide, switch mode, open settings, stop current session, Ctrl+C current session
Notifications -> Dock: permission/risk/runtime/git attention item
```

---

## 19. AuditLog 规则

必须写 AuditLog 的操作：

```text
Dock send Ctrl+C
Dock stop session
Dock send prompt
Dock pause AutoTrust
Dock export session log
Dock open replay
Dock high-risk attention click
```

P0 若 AuditLog 未实现，先添加 TODO 和 console.warn，不得静默执行危险操作。

---

## 20. P0 执行顺序

严格按顺序执行：

```text
1. 添加 Rust dock_window.rs commands。
2. main.rs 注册 dock_show / dock_hide / dock_reposition / dock_set_always_on_top。
3. 创建 dockTypes。
4. 创建 dockStore。
5. 创建 dockWindowService。
6. 创建 dockSnapshotBuilder。
7. 创建 dockSnapshotPublisher，并在主 App 安装。
8. 创建 dockActionBridge，并在主 App 安装。
9. 创建 AIDockSurface route/window label 判断。
10. 创建 Quiet/Calm/Focus UI。
11. 创建 DockSessionCard / DockQuickPrompt / DockAttentionQueue / DockActionGrid。
12. 创建 dock.css。
13. Settings 增加 AIDockSettingsPanel。
14. Console/Command Center 增加 showDock("calm") 入口。
15. 测试 Dock 显示、模式切换、状态同步、打开 Workspace、发送 Prompt、Ctrl+C、Stop。
```

---

## 21. P1/P2/P3 后续增强

### P1：持久化与通知

```text
1. Dock settings 持久化到 settingsStore / SQLite。
2. Dock show/hide 与托盘菜单连接。
3. System notification 与 Dock attention 队列连接。
4. AuditLog 真实写入。
5. Export raw log。
```

### P2：Telemetry

```text
1. statusLine snapshot 接入 Dock。
2. hook events 接入 attention。
3. token/cost/model/context 显示真实数据。
4. Agent/MCP/Hook 状态加入 Focus mode。
```

### P3：Replay / Remote

```text
1. Terminal Replay 打开。
2. Semantic Replay 打开。
3. Remote approval POC。
4. Multi-monitor 选择 Dock 所在屏幕。
```

---

## 22. 验收标准

```text
[ ] AI Dock 是独立 Tauri window，不嵌在主窗口里。
[ ] Dock 固定贴附屏幕右侧中间。
[ ] Dock 支持 Quiet / Calm / Focus 三模式。
[ ] Dock 默认跟随主程序主题。
[ ] Dock 可以在 Settings 中切换为独立主题。
[ ] Dock 读取真实 PTY session 状态，而不是 mock running。
[ ] Dock 显示 active PTY / waiting / risk / Claude health 状态灯。
[ ] Dock 可以打开当前会话的 Workspace。
[ ] Dock Quick Prompt 写入当前真实 PTY stdin。
[ ] Dock Quick Prompt 不调用 claude -p 假装当前会话。
[ ] Dock Ctrl+C 调用 pty_write("\x03")。
[ ] Dock Stop 调用 pty_kill。
[ ] Ctrl+C / Stop 有确认。
[ ] Dock 可以跳转 Console / Projects / Resources / GitHub / Diagnostics。
[ ] Dock 不自动放行高风险。
[ ] 缺失 token/cost/model 显示 Unavailable。
[ ] Dock 不复制完整 Terminal。
[ ] Dock 视觉与四主题统一。
[ ] npm run typecheck 通过。
[ ] npm run build 通过。
[ ] cargo check --manifest-path src-tauri/Cargo.toml 通过。
```

---

## 23. 人工测试脚本

```text
1. 启动 Ctrl-CC。
2. 在 Console 点击“显示 AI 工作坞”。
3. AI Dock 应出现在屏幕右侧中间，默认 Calm。
4. 切换 Quiet / Calm / Focus，窗口尺寸应同步变化并保持右侧居中。
5. 从 Projects 或 Console 启动一个 Claude 会话。
6. Workspace 中应出现真实 Claude Code CLI。
7. Dock 中应出现该 PTY 会话。
8. 点击 Dock SessionCard 的 Workspace，应打开同一个 Workspace session。
9. 在 Dock Focus 的 Quick Prompt 输入“请解释当前项目结构”，发送。
10. 该文本必须进入 Workspace Terminal 中同一个 Claude 会话。
11. 点击 Dock Ctrl+C，应弹确认并向 PTY 发送 Ctrl+C。
12. 点击 Dock Stop，应弹确认并停止真实 PTY。
13. 切换主程序主题 warm-sand/light/dark/pale-blue，Dock 应同步变化。
14. 在 Settings 中关闭“跟随主程序主题”，选择 dark，Dock 应独立变为 dark。
15. 点击 Dock Resources/GitHub/Diagnostics，应跳转主程序对应 Surface。
```

---

## 24. 直接发送给 Claude CLI 的执行 Prompt

```text
请执行 Ctrl-CC AI Dock × Workspace × Chat × Claude Code CLI 一体化重构。

目标：
AI Dock 不再是孤立悬浮 UI，而是独立 Tauri window 的全局轻量控制器。它必须读取真实 PTY Session 状态，控制真实 Workspace/Chat/Claude Code CLI 会话，并连接 Console、Projects、Resources、GitHub、Diagnostics、Settings、Command Center。

固定技术路线：
1. Tauri 2 独立 ai-dock window。
2. Rust commands: dock_show, dock_hide, dock_reposition, dock_set_always_on_top。
3. Dock 不直接读主窗口 Zustand store；主窗口通过 DockSnapshotPublisher emitTo("ai-dock", "dock.snapshot") 推送状态。
4. Dock 操作通过 emitTo("main", "dock.action") 回主窗口执行。
5. Main DockActionBridge 调用真实 Runtime / Workspace / Navigation actions。
6. Dock Quick Prompt 必须写入当前真实 PTY stdin。
7. Dock 不调用 claude -p 冒充当前 interactive session。

需要实现：
- src-tauri/src/commands/dock_window.rs
- src/features/dock/types/dockTypes.ts
- src/features/dock/stores/dockStore.ts
- src/features/dock/services/dockWindowService.ts
- src/features/dock/services/dockSnapshotBuilder.ts
- src/features/dock/services/dockSnapshotPublisher.ts
- src/features/dock/services/dockActionBridge.ts
- src/features/dock/pages/AIDockSurface.tsx
- src/features/dock/components/DockRoot.tsx
- src/features/dock/components/DockHeader.tsx
- src/features/dock/components/DockQuietMode.tsx
- src/features/dock/components/DockCalmMode.tsx
- src/features/dock/components/DockFocusMode.tsx
- src/features/dock/components/DockStatusLights.tsx
- src/features/dock/components/DockSessionCard.tsx
- src/features/dock/components/DockAttentionQueue.tsx
- src/features/dock/components/DockQuickPrompt.tsx
- src/features/dock/components/DockActionGrid.tsx
- src/features/dock/styles/dock.css
- src/features/settings/components/AIDockSettingsPanel.tsx

功能要求：
1. showDock("calm") 后 Dock 出现在屏幕右侧中间。
2. Dock 支持 Quiet / Calm / Focus。
3. Dock 显示真实 running PTY、waiting、risk、Claude/PTY/Git 状态。
4. Dock 能打开当前 session 的 Workspace。
5. Dock Quick Prompt 写入当前 session 的 ptySessionId。
6. Dock Ctrl+C 调用 pty_write("\x03")。
7. Dock Stop 调用 pty_kill。
8. Dock 能跳转 Console / Projects / Resources / GitHub / Diagnostics。
9. 高风险操作不自动放行。
10. 没有 token/cost/model 数据时显示 Unavailable，不伪造。

视觉要求：
1. Neo Calm Industrial。
2. 四主题兼容：light / dark / pale-blue / warm-sand。
3. Dock 默认跟随主程序主题。
4. Dock 可独立切换主题。
5. Quiet 极窄，Calm 温和，Focus 专业但不压迫。
6. 状态灯动画克制，不高频闪烁。

执行顺序：
1. 搜索现有 dock/runtime/workspace/project/settings 实现，不要猜接口。
2. 输出当前实现现状。
3. 按本计划创建/修改文件。
4. 运行 npm run typecheck。
5. 运行 npm run build。
6. 运行 cargo check --manifest-path src-tauri/Cargo.toml。
7. 输出修改文件清单、验证结果、未接入数据源、下一步建议。
```

---

## 25. 最终效果

完成后，AI Dock 应成为：

```text
Ctrl-CC 的常驻 AI 工作状态入口
Claude Code PTY Runtime 的轻量控制器
Workspace/Chat 的快捷遥控器
Console/Projects/Resources/GitHub/Diagnostics 的全局入口
风险、权限、异常和通知的即时提醒面板
与主程序视觉完全统一、可独立主题化的高级悬浮工作坞
```
