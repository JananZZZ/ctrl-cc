# Ctrl-CC v29.9 Ultimate Commercial Rebuild Plan

> 版本：v29.9 Ultimate  
> 目标仓库：`https://github.com/JananZZZ/ctrl-cc`  
> 目标分支：请从 `master` 新建 `v29-ultimate-commercial-rebuild`  
> 适用对象：Claude CLI / Claude Code / Codex / 人类工程师  
> 核心目标：一口气完成底层架构、首次启动引导、环境检测、Runtime 会话、Chat/Terminal 同步、全局任务系统、全局打断系统、GitHub 内嵌浏览器、四主题视觉系统、字体系统、全局错误系统、性能系统、所有页面商业级 UI 的终极重构。  
> 强制要求：所有新增代码块必须保留中文注释，所有核心逻辑必须可长期维护，所有复杂流程必须可诊断、可测试、可回滚。

---

# 0. 执行总原则

## 0.1 本文档不是建议稿，而是执行稿

本文件中的每一节都必须被严格执行。  
不要只挑某一两个 bug 修；不要只改表面 UI；不要继续叠加临时桥接层。  
本轮的目标不是“看起来能跑”，而是把 Ctrl-CC 改成可持续迭代的商用级桌面应用架构。

## 0.2 三条最高优先级

1. **应用绝不能轻易未响应。**  
   所有耗时操作必须进入后台任务系统，UI 只订阅状态，不等待阻塞。

2. **一个 GUI 会话必须绑定一个真实长期存活的 Runtime 会话。**  
   Chat、Terminal、Split 三种视图只是同一个 Runtime 的不同投影。发送一条消息绝不能新建一个后台 Claude CLI 进程。

3. **所有环境检测、Runtime 状态、错误日志、设置数据必须统一来源。**  
   不允许 Console 一套、Setting 一套、首次引导一套、诊断页一套。

## 0.3 禁止事项

以下实现全部禁止：

```txt
1. 点击按钮后直接 await 一个长命令，导致窗口未响应。
2. 检测环境只显示“检测中...”，没有当前检测项、进度、暂停、继续、终止、重试。
3. 检测失败后只显示“检测失败，请重试”，但没有可操作按钮、没有错误明细、没有诊断包。
4. 发送 Chat 消息时隐式启动新 Claude CLI 进程。
5. Terminal 输入走 submitUserMessage，污染 Chat 消息。
6. GitHub 页面使用 iframe 嵌入 github.com。
7. GitHub 页面使用 window.open 当作主要功能。
8. 默认主题仍是 warm-sand。
9. 生产环境中 useRenderLoopGuard 抛出错误导致 React 崩溃。
10. UI 里出现 8px、10px、11px 作为常规文字。
11. 每个页面各自定义一套按钮、卡片、字体、颜色。
12. 多套环境检测结果互相不同步。
13. 后端外部命令弹出 cmd / powershell / node 黑窗口。
14. React render 阶段写 localStorage、写 store、invoke 后端命令。
15. 用 setInterval 高频轮询代替事件驱动。
16. 关闭会话标签页默认杀死后台 Runtime。
17. 没有用户确认就打断可能破坏状态的后台任务。
```

---

# 1. 当前仓库关键问题定位

## 1.1 首次启动引导与环境检测

当前问题：

```txt
1. FirstRunSetupWizard 仍然偏“流程占位”，不是完整产品引导。
2. 环境检测没有逐项实时进度。
3. setup_detect_all 与 setup_detect_all_v2 并存，数据来源未统一。
4. setup_detect_all_v2 只发 start 和 complete，不是真正的 progressive detection。
5. setupStore 虽然有 tasks，但没有完整 pause/resume/cancel/terminate。
6. 检测失败时用户不知道失败在哪一项。
7. 检测失败后没有清晰的重新检测、继续、退出、复制诊断、打开日志功能。
8. 首次启动没有完整引导语言、主题、字体、Chat、AI Dock、权限、GitHub。
```

## 1.2 Runtime / Chat / Terminal

当前问题：

```txt
1. GUI session、open tab、runtime kernel session、Claude session 的边界不够清晰。
2. Chat 和 Terminal 不是同一个持续 Runtime 的两个视图投影。
3. Terminal 输入仍有可能走 submitUserMessage，导致 Chat 重复消息或状态污染。
4. Runtime 状态容易变成 missing / exited / failed，但 UI 还允许用户继续发消息。
5. 发送消息后可能提示 session not found。
6. 一些 UI 点击会隐式启动 Runtime，用户不知情。
7. Reader 退出、writer 失效、child 进程退出的状态没有统一生命周期。
8. Claude CLI 的原始输出、状态词、thinking、token、权限请求等信息没有完整保留和结构化。
```

## 1.3 React #185

React #185 对应生产环境的最大更新深度/更新循环问题。当前高风险点：

```txt
1. useRenderLoopGuard 在生产环境抛错，扩大了崩溃影响。
2. WorkspaceSurface 内 effect 可能根据 tabs 引用变化重复 setViewMode。
3. 某些 selector 每次返回新数组/新对象，导致组件重复渲染。
4. 事件流大量进入 store 时，store 更新颗粒度不够。
5. ErrorBoundary 捕获后如果继续触发同一状态写入，会形成二次循环。
```

## 1.4 视觉系统

当前问题：

```txt
1. 各页字体大小不统一。
2. 8px/11px 等过小字号影响小白用户体验。
3. Console、Project、Chat、Resources、Canvas、GitHub、Settings 页面视觉差异不大，缺少层次。
4. 小窗口和全屏窗口没有真正响应式策略。
5. 卡片内容空洞，视觉焦点不集中。
6. 四主题配色还不够统一、耐看、商业化。
7. 动效很少，而且没有形成统一 motion token。
```

---

# 2. 新架构总览

## 2.1 最终模块结构

目标结构如下：

```txt
src/
  app/
    App.tsx
    AppShell.tsx
    SurfaceHost.tsx
  core/
    lifecycle/
      appLifecycleStore.ts
    settings/
      appearanceStore.ts
      appSettingsStore.ts
    tasks/
      taskTypes.ts
      taskStore.ts
      taskBridge.ts
      taskActions.ts
      NavigationGuardModal.tsx
      GlobalTaskDock.tsx
    diagnostics/
      diagnosticTypes.ts
      diagnosticLedger.ts
      ErrorBoundary.tsx
      ErrorToast.tsx
      ErrorLogPanel.tsx
  runtime-kernel/
    runtimeKernelBridge.ts
    runtimeKernelStore.ts
    runtimeSessionTypes.ts
    parsers/
      ansiParser.ts
      claudeOutputParser.ts
      chatProjection.ts
      terminalProjection.ts
  features/
    setup/
      components/
        FirstRunSetupWizard.tsx
        SetupLiveProgress.tsx
        SetupAppearanceStep.tsx
        SetupProductTourStep.tsx
        SetupRuntimeIntroStep.tsx
        SetupProviderConfigStep.tsx
        SetupChatDockPermissionStep.tsx
        SetupFinalVerifyStep.tsx
      stores/
        setupStore.ts
      styles/
        first-run-setup.css
    runtime/
      components/
        RuntimeStatusStrip.tsx
        RuntimeDiagnosticsPanel.tsx
    github/
      GitHubBrowserSurface.tsx
  surfaces/
    console/
    workspace/
    projects/
    resources/
    canvas/
    github/
    settings/
  styles/
    tokens.css
    global.css
    surfaces.css
    motion.css
```

后端结构：

```txt
src-tauri/src/
  lib.rs
  task_control/
    mod.rs
    types.rs
    manager.rs
    commands.rs
  setup/
    mod.rs
    detector.rs
    commands.rs
    subprocess_runner.rs
    installer.rs
    path_helper.rs
    types.rs
  runtime_kernel/
    mod.rs
    types.rs
    manager.rs
    commands.rs
    claude_process.rs
    output_classifier.rs
  diagnostics/
    mod.rs
    types.rs
    commands.rs
```

---

# 3. 工程记忆文件

## 3.1 覆盖 `CLAUDE.md`

请在仓库根目录写入：

```md
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
```

---

# 4. 全局任务系统

## 4.1 新建 `src/core/tasks/taskTypes.ts`

```ts
/**
 * 全局任务状态。
 * 任何可能持续超过 300ms 的操作，都应该进入任务系统。
 * 这样 UI 可以显示进度，也可以暂停、取消或终止任务。
 */
export type TaskStatus =
  | 'queued'      // 任务已创建，等待执行
  | 'running'     // 任务正在执行
  | 'paused'      // 任务已暂停，等待继续
  | 'success'     // 任务成功完成
  | 'warning'     // 任务完成，但存在非致命问题
  | 'error'       // 任务失败
  | 'cancelled';  // 用户取消了任务

/**
 * 任务被页面切换或其他操作打断时的策略。
 * 这个字段用于 NavigationGuard 判断是否需要提醒用户。
 */
export type TaskInterruptPolicy =
  | 'safe-background'          // 可以安全后台继续
  | 'confirm-on-leave'         // 离开页面前提醒用户
  | 'cancel-on-leave'          // 离开页面时建议取消
  | 'critical-noninterruptible'// 关键任务，不建议取消
  | 'destructive-confirm';     // 破坏性任务，必须二次确认

/**
 * 全局任务进度结构。
 * 前端和后端都必须尽可能保持字段一致。
 */
export interface TaskProgress {
  /** 任务唯一 ID */
  taskId: string;

  /** 任务类型，例如 setup.detect / runtime.start / diagnostics.export */
  kind: string;

  /** 用户可读标题，例如 环境检测 */
  title: string;

  /** 当前任务状态 */
  status: TaskStatus;

  /** 打断策略 */
  interruptPolicy: TaskInterruptPolicy;

  /** 当前步骤 ID，例如 nodejs / npm / claudeCode */
  currentStepId?: string;

  /** 当前步骤中文名称，例如 正在检测 Node.js */
  currentStepLabel?: string;

  /** 当前状态说明，用于广播条或状态栏 */
  message?: string;

  /** 0 到 1 的进度 */
  progress: number;

  /** 开始时间 */
  startedAt: string;

  /** 更新时间 */
  updatedAt: string;

  /** 结束时间 */
  endedAt?: string;

  /** 是否允许暂停 */
  canPause: boolean;

  /** 是否允许继续 */
  canResume: boolean;

  /** 是否允许取消 */
  canCancel: boolean;

  /** 是否允许强制终止 */
  canTerminate: boolean;

  /** 错误文本 */
  error?: string;
}
```

## 4.2 新建 `src/core/tasks/taskStore.ts`

```ts
import { create } from 'zustand';
import type { TaskProgress } from './taskTypes';

/**
 * 全局任务 Store。
 * 设计目标：
 * 1. 所有页面共享同一份后台任务状态。
 * 2. 页面切换时可以判断是否存在阻塞任务。
 * 3. UI 可以在任意页面显示任务进度。
 */
interface TaskStore {
  /** 所有任务，按 taskId 索引 */
  tasks: Record<string, TaskProgress>;

  /** 当前最活跃任务 ID，用于顶部状态条或广播条 */
  activeTaskId: string | null;

  /** 新增或更新一个任务 */
  upsertTask: (task: TaskProgress) => void;

  /** 删除一个任务，一般用于任务完成后一段时间清理 */
  removeTask: (taskId: string) => void;

  /** 获取仍在活动中的任务 */
  activeTasks: () => TaskProgress[];

  /** 获取切换页面前需要提醒的任务 */
  blockingTasks: () => TaskProgress[];
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: {},
  activeTaskId: null,

  upsertTask: (task) => {
    set((state) => {
      const isActive = ['queued', 'running', 'paused'].includes(task.status);

      return {
        tasks: {
          ...state.tasks,
          [task.taskId]: task,
        },
        activeTaskId: isActive
          ? task.taskId
          : state.activeTaskId === task.taskId
            ? null
            : state.activeTaskId,
      };
    });
  },

  removeTask: (taskId) => {
    set((state) => {
      const next = { ...state.tasks };
      delete next[taskId];

      return {
        tasks: next,
        activeTaskId: state.activeTaskId === taskId ? null : state.activeTaskId,
      };
    });
  },

  activeTasks: () => {
    return Object.values(get().tasks).filter((task) =>
      ['queued', 'running', 'paused'].includes(task.status)
    );
  },

  blockingTasks: () => {
    return Object.values(get().tasks).filter((task) => {
      const active = ['queued', 'running', 'paused'].includes(task.status);
      const safe = task.interruptPolicy === 'safe-background';
      return active && !safe;
    });
  },
}));
```

## 4.3 新建 `src/core/tasks/taskBridge.ts`

```ts
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { useTaskStore } from './taskStore';
import type { TaskProgress } from './taskTypes';

/**
 * 前后端任务事件桥。
 * 后端所有后台任务都通过 task://progress 推送状态。
 * 前端不轮询任务状态，而是订阅事件。
 */
let installed = false;

export const TaskBridge = {
  /**
   * 安装全局任务事件监听器。
   * App 启动时调用一次即可。
   */
  async install(): Promise<UnlistenFn | undefined> {
    if (installed) return undefined;
    installed = true;

    const unlisten = await listen<TaskProgress>('task://progress', (event) => {
      useTaskStore.getState().upsertTask(event.payload);
    });

    return () => {
      installed = false;
      unlisten();
    };
  },

  /** 暂停任务。暂停是协作式暂停，只在后端步骤边界生效。 */
  pause(taskId: string) {
    return invoke('task_pause', { taskId });
  },

  /** 继续任务。 */
  resume(taskId: string) {
    return invoke('task_resume', { taskId });
  },

  /** 取消任务。取消是协作式取消，当前子进程会尽量优雅退出。 */
  cancel(taskId: string) {
    return invoke('task_cancel', { taskId });
  },

  /** 强制终止任务。用于用户明确要求中断或进程卡死。 */
  terminate(taskId: string) {
    return invoke('task_terminate', { taskId });
  },
};
```

## 4.4 修改 `src/app/App.tsx`

增加 import：

```ts
import { TaskBridge } from '../core/tasks/taskBridge';
import { useAppearanceStore } from '../core/settings/appearanceStore';
import { useDiagnosticLedger } from '../core/diagnostics/diagnosticLedger';
```

在 `App()` 内增加：

```ts
/**
 * 应用启动时恢复外观设置。
 * 注意：默认语言是中文，默认主题是浅色。
 * 这里不要散落到各个页面，否则会造成设置不同步。
 */
const hydrateAppearance = useAppearanceStore((s) => s.hydrate);

useEffect(() => {
  hydrateAppearance();
}, [hydrateAppearance]);

/**
 * 安装全局任务桥。
 * 所有后台任务统一通过 task://progress 进入前端。
 */
useEffect(() => {
  let cleanup: undefined | (() => void);

  TaskBridge.install()
    .then((fn) => {
      cleanup = fn;
    })
    .catch((err) => {
      useDiagnosticLedger.getState().append({
        source: 'TaskBridge',
        severity: 'error',
        title: '任务事件桥安装失败',
        detail: String(err),
      });
    });

  return () => cleanup?.();
}, []);
```

替换未处理异步错误：

```ts
useEffect(() => {
  const handler = (event: PromiseRejectionEvent) => {
    const detail = String(event.reason);

    useDiagnosticLedger.getState().append({
      source: 'window.unhandledrejection',
      severity: 'error',
      title: '未处理的异步错误',
      detail,
      raw: event.reason,
    });

    try {
      useErrorStore.getState().addError({
        severity: 'error',
        source: 'unknown',
        title: t('error.unhandledRejection'),
        detail,
        rawError: detail,
      });
    } catch {}
  };

  window.addEventListener('unhandledrejection', handler);
  return () => window.removeEventListener('unhandledrejection', handler);
}, [t]);
```

---

# 5. 后端任务控制器

## 5.1 新建 `src-tauri/src/task_control/types.rs`

```rust
use serde::{Deserialize, Serialize};

/// 后台任务状态。
/// 这些状态会被序列化到前端 task://progress 事件。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum TaskStatus {
    Queued,
    Running,
    Paused,
    Success,
    Warning,
    Error,
    Cancelled,
}

/// 页面切换或用户执行其他操作时，任务如何被打断。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum TaskInterruptPolicy {
    SafeBackground,
    ConfirmOnLeave,
    CancelOnLeave,
    CriticalNoninterruptible,
    DestructiveConfirm,
}

/// 后端推送给前端的任务进度。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskProgress {
    /// 任务唯一 ID
    pub task_id: String,

    /// 任务类型，例如 setup.detect
    pub kind: String,

    /// 用户可见标题，例如 环境检测
    pub title: String,

    /// 当前任务状态
    pub status: TaskStatus,

    /// 打断策略
    pub interrupt_policy: TaskInterruptPolicy,

    /// 当前步骤 ID
    pub current_step_id: Option<String>,

    /// 当前步骤中文名
    pub current_step_label: Option<String>,

    /// 当前说明文字
    pub message: Option<String>,

    /// 0 到 1 的进度
    pub progress: f64,

    /// 开始时间
    pub started_at: String,

    /// 更新时间
    pub updated_at: String,

    /// 结束时间
    pub ended_at: Option<String>,

    /// 是否可暂停
    pub can_pause: bool,

    /// 是否可继续
    pub can_resume: bool,

    /// 是否可取消
    pub can_cancel: bool,

    /// 是否可强制终止
    pub can_terminate: bool,

    /// 错误详情
    pub error: Option<String>,
}
```

## 5.2 新建 `src-tauri/src/task_control/manager.rs`

```rust
use std::collections::HashMap;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::thread;
use std::time::Duration;

use tauri::{AppHandle, Emitter};

use super::types::TaskProgress;

/// 全局任务控制器。
/// 每个后台任务都会注册一个 TaskControlToken。
/// UI 发起 pause/resume/cancel/terminate 时，通过这里修改 token 状态。
#[derive(Clone, Default)]
pub struct TaskControlManager {
    inner: Arc<Mutex<HashMap<String, Arc<TaskControlToken>>>>,
}

/// 单个任务的控制令牌。
/// 这里使用 AtomicBool，避免后台线程读取控制状态时长期持锁。
pub struct TaskControlToken {
    pub task_id: String,
    paused: AtomicBool,
    cancelled: AtomicBool,
    terminated: AtomicBool,
}

impl TaskControlToken {
    /// 创建一个新的任务控制令牌。
    pub fn new(task_id: String) -> Self {
        Self {
            task_id,
            paused: AtomicBool::new(false),
            cancelled: AtomicBool::new(false),
            terminated: AtomicBool::new(false),
        }
    }

    /// 判断任务是否已经被取消或强制终止。
    pub fn is_cancelled(&self) -> bool {
        self.cancelled.load(Ordering::SeqCst) || self.terminated.load(Ordering::SeqCst)
    }

    /// 判断任务是否强制终止。
    pub fn is_terminated(&self) -> bool {
        self.terminated.load(Ordering::SeqCst)
    }

    /// 如果任务处于暂停状态，则在步骤边界等待。
    /// 注意：这是协作式暂停，不会强行中断正在运行的外部命令。
    pub fn wait_if_paused(&self) -> Result<(), String> {
        while self.paused.load(Ordering::SeqCst) {
            if self.is_cancelled() {
                return Err("任务已取消".to_string());
            }

            thread::sleep(Duration::from_millis(80));
        }

        Ok(())
    }

    /// 暂停任务。
    pub fn pause(&self) {
        self.paused.store(true, Ordering::SeqCst);
    }

    /// 继续任务。
    pub fn resume(&self) {
        self.paused.store(false, Ordering::SeqCst);
    }

    /// 取消任务。
    pub fn cancel(&self) {
        self.cancelled.store(true, Ordering::SeqCst);
        self.paused.store(false, Ordering::SeqCst);
    }

    /// 强制终止任务。
    pub fn terminate(&self) {
        self.terminated.store(true, Ordering::SeqCst);
        self.cancelled.store(true, Ordering::SeqCst);
        self.paused.store(false, Ordering::SeqCst);
    }
}

impl TaskControlManager {
    /// 注册一个新任务。
    pub fn create(&self, task_id: String) -> Arc<TaskControlToken> {
        let token = Arc::new(TaskControlToken::new(task_id.clone()));
        self.inner.lock().unwrap().insert(task_id, token.clone());
        token
    }

    /// 获取任务控制令牌。
    pub fn get(&self, task_id: &str) -> Option<Arc<TaskControlToken>> {
        self.inner.lock().unwrap().get(task_id).cloned()
    }

    /// 移除任务控制令牌。
    pub fn remove(&self, task_id: &str) {
        self.inner.lock().unwrap().remove(task_id);
    }

    /// 暂停指定任务。
    pub fn pause(&self, task_id: &str) -> Result<(), String> {
        self.get(task_id)
            .ok_or_else(|| "任务不存在".to_string())?
            .pause();

        Ok(())
    }

    /// 继续指定任务。
    pub fn resume(&self, task_id: &str) -> Result<(), String> {
        self.get(task_id)
            .ok_or_else(|| "任务不存在".to_string())?
            .resume();

        Ok(())
    }

    /// 取消指定任务。
    pub fn cancel(&self, task_id: &str) -> Result<(), String> {
        self.get(task_id)
            .ok_or_else(|| "任务不存在".to_string())?
            .cancel();

        Ok(())
    }

    /// 强制终止指定任务。
    pub fn terminate(&self, task_id: &str) -> Result<(), String> {
        self.get(task_id)
            .ok_or_else(|| "任务不存在".to_string())?
            .terminate();

        Ok(())
    }
}

/// 发送任务进度到前端。
pub fn emit_task(app: &AppHandle, progress: TaskProgress) {
    let _ = app.emit("task://progress", progress);
}

/// 当前 UTC 时间字符串。
pub fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339()
}
```

## 5.3 新建 `src-tauri/src/task_control/commands.rs`

```rust
use tauri::State;

use super::manager::TaskControlManager;

/// 暂停后台任务。
#[tauri::command]
pub fn task_pause(
    task_id: String,
    tasks: State<'_, TaskControlManager>,
) -> Result<(), String> {
    tasks.pause(&task_id)
}

/// 继续后台任务。
#[tauri::command]
pub fn task_resume(
    task_id: String,
    tasks: State<'_, TaskControlManager>,
) -> Result<(), String> {
    tasks.resume(&task_id)
}

/// 取消后台任务。
#[tauri::command]
pub fn task_cancel(
    task_id: String,
    tasks: State<'_, TaskControlManager>,
) -> Result<(), String> {
    tasks.cancel(&task_id)
}

/// 强制终止后台任务。
#[tauri::command]
pub fn task_terminate(
    task_id: String,
    tasks: State<'_, TaskControlManager>,
) -> Result<(), String> {
    tasks.terminate(&task_id)
}
```

## 5.4 新建 `src-tauri/src/task_control/mod.rs`

```rust
pub mod commands;
pub mod manager;
pub mod types;

pub use manager::TaskControlManager;
```

## 5.5 注册到 Tauri

在 `src-tauri/src/lib.rs` 或实际主入口中加入：

```rust
mod task_control;
```

在 builder 中加入：

```rust
.manage(crate::task_control::TaskControlManager::default())
```

在 invoke handler 中加入：

```rust
crate::task_control::commands::task_pause,
crate::task_control::commands::task_resume,
crate::task_control::commands::task_cancel,
crate::task_control::commands::task_terminate,
```

---

# 6. 后端静默子进程与外部命令执行

## 6.1 修改 `src-tauri/src/setup/subprocess_runner.rs`

目标：

```txt
1. 所有检测命令隐藏窗口。
2. stdout/stderr 异步读取，避免管道填满导致死锁。
3. 支持 timeout。
4. 支持 cancellation token。
5. 失败时返回结构化错误，而不是只返回字符串。
```

请将文件升级为以下结构：

```rust
use std::io::Read;
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

/// 子进程执行结果。
#[derive(Debug, Clone)]
pub struct CmdResult {
    /// 命令是否成功退出
    pub success: bool,

    /// 标准输出
    pub stdout: String,

    /// 标准错误
    pub stderr: String,

    /// 退出码
    pub code: Option<i32>,

    /// 是否超时
    pub timed_out: bool,

    /// 执行耗时
    pub duration_ms: u128,
}

impl CmdResult {
    /// 生成超时结果。
    pub fn timeout(program: &str, timeout: Duration) -> Self {
        Self {
            success: false,
            stdout: String::new(),
            stderr: format!("命令 `{}` 执行超过 {}ms，已终止", program, timeout.as_millis()),
            code: None,
            timed_out: true,
            duration_ms: timeout.as_millis(),
        }
    }

    /// 生成错误结果。
    pub fn error(err: impl ToString, elapsed: Duration) -> Self {
        Self {
            success: false,
            stdout: String::new(),
            stderr: err.to_string(),
            code: None,
            timed_out: false,
            duration_ms: elapsed.as_millis(),
        }
    }
}

/// 默认检测命令超时。
pub fn default_timeout() -> Duration {
    Duration::from_secs(5)
}

/// 较重检测命令超时。
pub fn heavy_timeout() -> Duration {
    Duration::from_secs(30)
}

/// 安装命令超时。
pub fn install_timeout() -> Duration {
    Duration::from_secs(600)
}

/// 创建隐藏窗口的 Command。
/// Windows 下必须设置 CREATE_NO_WINDOW，否则会弹出 cmd/powershell/node 黑窗口。
fn build_hidden_command(program: &str) -> Command {
    let mut cmd = Command::new(program);

    #[cfg(windows)]
    {
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    cmd
}

/// 执行普通命令。
pub fn run_cmd(program: &str, args: &[&str]) -> CmdResult {
    run_cmd_timeout(program, args, default_timeout())
}

/// 执行带超时的命令。
pub fn run_cmd_timeout(program: &str, args: &[&str], timeout: Duration) -> CmdResult {
    let start = Instant::now();

    let mut child = match build_hidden_command(program)
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
    {
        Ok(child) => child,
        Err(e) => return CmdResult::error(e, start.elapsed()),
    };

    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                let mut stdout = String::new();
                let mut stderr = String::new();

                if let Some(mut out) = child.stdout.take() {
                    let _ = out.read_to_string(&mut stdout);
                }

                if let Some(mut err) = child.stderr.take() {
                    let _ = err.read_to_string(&mut stderr);
                }

                return CmdResult {
                    success: status.success(),
                    stdout: stdout.trim().to_string(),
                    stderr: stderr.trim().to_string(),
                    code: status.code(),
                    timed_out: false,
                    duration_ms: start.elapsed().as_millis(),
                };
            }

            Ok(None) => {
                if start.elapsed() >= timeout {
                    let _ = child.kill();
                    let _ = child.wait();
                    return CmdResult::timeout(program, timeout);
                }

                thread::sleep(Duration::from_millis(30));
            }

            Err(e) => {
                let _ = child.kill();
                return CmdResult::error(e, start.elapsed());
            }
        }
    }
}

/// 通过 cmd.exe /d /s /c 静默执行命令。
/// 注意：只用于检测普通命令，不用于交互式 Claude Runtime。
pub fn run_cmd_shell(command: &str) -> CmdResult {
    run_cmd_timeout("cmd.exe", &["/d", "/s", "/c", command], default_timeout())
}

/// 较重的 shell 命令。
pub fn run_cmd_shell_heavy(command: &str) -> CmdResult {
    run_cmd_timeout("cmd.exe", &["/d", "/s", "/c", command], heavy_timeout())
}

/// 安装型 shell 命令。
pub fn run_cmd_shell_install(command: &str) -> CmdResult {
    run_cmd_timeout("cmd.exe", &["/d", "/s", "/c", command], install_timeout())
}

/// 静默执行 PowerShell。
pub fn run_powershell(script: &str) -> CmdResult {
    run_cmd_timeout(
        "powershell.exe",
        &[
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            script,
        ],
        default_timeout(),
    )
}

/// 静默执行较重 PowerShell。
pub fn run_powershell_heavy(script: &str) -> CmdResult {
    run_cmd_timeout(
        "powershell.exe",
        &[
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            script,
        ],
        heavy_timeout(),
    )
}
```

---

# 7. 环境检测逐项进度化

## 7.1 修改 `src-tauri/src/setup/commands.rs`

将 `setup_detect_all_v2` 替换为：

```rust
use crate::task_control::manager::TaskControlManager;

/// 新版环境检测命令。
/// 这个命令不会阻塞 UI，并且会通过 task://progress 推送逐项检测进度。
#[tauri::command]
pub async fn setup_detect_all_v2(
    app: tauri::AppHandle,
    tasks: State<'_, TaskControlManager>,
) -> Result<SetupSnapshot, String> {
    let task_id = format!("setup-detect-{}", chrono::Utc::now().timestamp_millis());

    // 创建任务控制令牌，前端可以通过 task_pause/task_resume/task_cancel 控制它。
    let token = tasks.create(task_id.clone());
    let tasks2 = (*tasks).clone();

    tauri::async_runtime::spawn_blocking(move || {
        let result = crate::setup::detector::detect_all_setup_progressive(
            app.clone(),
            task_id.clone(),
            token.clone(),
        );

        // 任务完成后移除控制令牌，避免长期堆积。
        tasks2.remove(&task_id);

        result
    })
    .await
    .map_err(|e| format!("setup_detect_all_v2 worker failed: {}", e))?
}
```

保留旧 `setup_detect_all` 只给兼容测试使用，但前端不再调用它。

## 7.2 修改 `src-tauri/src/setup/detector.rs`

在文件顶部加入：

```rust
use crate::task_control::manager::{emit_task, now_iso, TaskControlToken};
use crate::task_control::types::{TaskInterruptPolicy, TaskProgress, TaskStatus};
use std::sync::Arc;
```

新增辅助函数：

```rust
/// 向前端推送环境检测进度。
/// 这里统一所有检测项的 UI 文案和任务状态。
fn emit_detect_progress(
    app: &tauri::AppHandle,
    task_id: &str,
    status: TaskStatus,
    step_id: &str,
    label: &str,
    progress: f64,
    message: impl Into<String>,
    error: Option<String>,
) {
    emit_task(
        app,
        TaskProgress {
            task_id: task_id.to_string(),
            kind: "setup.detect".to_string(),
            title: "环境检测".to_string(),
            status,
            interrupt_policy: TaskInterruptPolicy::ConfirmOnLeave,
            current_step_id: Some(step_id.to_string()),
            current_step_label: Some(label.to_string()),
            message: Some(message.into()),
            progress,
            started_at: now_iso(),
            updated_at: now_iso(),
            ended_at: None,
            can_pause: true,
            can_resume: true,
            can_cancel: true,
            can_terminate: true,
            error,
        },
    );
}
```

抽离汇总逻辑：

```rust
/// 根据所有检测项构建最终 SetupSnapshot。
/// 这个函数同时供旧检测和新版 progressive 检测复用，避免 Console / Setting / FirstRun 得到不同结果。
fn build_snapshot_from_checks(
    checks: HashMap<String, SetupCheckResult>,
) -> SetupSnapshot {
    let required_ok = checks
        .values()
        .filter(|c| c.required)
        .all(|c| c.ok);

    let any_error = checks.values().any(|c| !c.ok && c.required);

    let severity = if required_ok {
        "ok"
    } else if any_error {
        "error"
    } else {
        "warning"
    };

    let missing_required: Vec<&str> = checks
        .values()
        .filter(|c| c.required && !c.ok)
        .map(|c| c.label.as_str())
        .collect();

    let summary = if required_ok {
        "环境检测通过，所有必需组件已就绪。".to_string()
    } else {
        format!(
            "环境未完成：缺少 {} 个必需组件 ({})",
            missing_required.len(),
            missing_required.join(", ")
        )
    };

    let claude_commands =
        crate::runtime_v2::claude_command_resolver::discover_claude_commands();

    let chat_cmd = crate::runtime_v2::claude_command_resolver::select_for_chat().ok();
    let term_cmd = crate::runtime_v2::claude_command_resolver::select_for_terminal().ok();

    let claude_code_ok = checks.get("claudeCode").map(|c| c.ok).unwrap_or(false);
    let claude_auth_ok = checks.get("claudeAuth").map(|c| c.ok).unwrap_or(false);
    let claude_config_ok = checks.get("claudeConfig").map(|c| c.ok).unwrap_or(false);
    let api_provider_ok = checks.get("apiProvider").map(|c| c.ok).unwrap_or(false);
    let workspace_ok = checks.get("workspace").map(|c| c.ok).unwrap_or(false);

    let ready_for_chat = chat_cmd.is_some() && claude_code_ok && (claude_auth_ok || claude_config_ok);
    let ready_for_terminal = term_cmd.is_some();
    let ready_for_api = claude_auth_ok || api_provider_ok;
    let ready_for_project = workspace_ok;

    SetupSnapshot {
        generated_at: chrono::Utc::now().to_rfc3339(),
        ready: required_ok,
        severity: severity.to_string(),
        summary,
        ready_for_chat,
        ready_for_terminal,
        ready_for_api,
        ready_for_project,
        checks,
        claude_commands,
        selected_chat_command_id: chat_cmd.map(|c| c.id),
        selected_terminal_command_id: term_cmd.map(|c| c.id),
    }
}
```

新增 progressive 检测函数：

```rust
/// 新版逐项环境检测。
/// 每个检测项都会推送进度。
/// 暂停/取消只在步骤边界生效，避免破坏正在运行的系统命令。
pub fn detect_all_setup_progressive(
    app: tauri::AppHandle,
    task_id: String,
    token: Arc<TaskControlToken>,
) -> Result<SetupSnapshot, String> {
    let mut checks: HashMap<String, SetupCheckResult> = HashMap::new();

    let total = 15.0;
    let mut index = 0.0;

    macro_rules! run_check {
        ($step_id:expr, $label:expr, $check_fn:expr) => {{
            // 如果用户暂停检测，则在这里等待。
            token.wait_if_paused()?;

            // 如果用户取消或终止检测，则停止后续检测。
            if token.is_cancelled() {
                emit_detect_progress(
                    &app,
                    &task_id,
                    TaskStatus::Cancelled,
                    $step_id,
                    $label,
                    index / total,
                    "检测已终止",
                    None,
                );

                return Err("环境检测已被用户终止".to_string());
            }

            // 推送“正在检测某项”的状态。
            emit_detect_progress(
                &app,
                &task_id,
                TaskStatus::Running,
                $step_id,
                $label,
                index / total,
                format!("正在检测：{}", $label),
                None,
            );

            // 执行真实检测函数。
            let result = $check_fn();

            index += 1.0;

            // 推送检测结果。
            emit_detect_progress(
                &app,
                &task_id,
                if result.ok { TaskStatus::Running } else { TaskStatus::Warning },
                $step_id,
                $label,
                index / total,
                if result.ok {
                    format!("{} 检测通过", $label)
                } else {
                    format!("{} 需要关注", $label)
                },
                result.error.clone(),
            );

            checks.insert(result.id.clone(), result);
        }};
    }

    run_check!("nodejs", "Node.js", check_nodejs);
    run_check!("npm", "npm", check_npm);
    run_check!("git", "Git", check_git);
    run_check!("gitBash", "Git Bash", check_git_bash);
    run_check!("claudeCode", "Claude Code CLI", check_claude_code);
    run_check!("claudeCommand", "Claude 命令入口", check_claude_command);
    run_check!("claudeAuth", "Claude 认证状态", check_claude_auth);
    run_check!("claudeConfig", "Claude 配置文件", check_claude_config);
    run_check!("windowsTerminal", "Windows Terminal", check_windows_terminal);
    run_check!("powershellPolicy", "PowerShell 执行策略", check_powershell_policy);
    run_check!("npmRegistry", "npm Registry", check_npm_registry);
    run_check!("pathEnv", "PATH 环境", check_path_env);
    run_check!("pathIssues", "路径问题", check_path_issues);
    run_check!("workspace", "工作目录", check_workspace);
    run_check!("apiProvider", "API Provider", check_api_provider);

    let snapshot = build_snapshot_from_checks(checks);

    emit_detect_progress(
        &app,
        &task_id,
        if snapshot.ready { TaskStatus::Success } else { TaskStatus::Warning },
        "done",
        "检测完成",
        1.0,
        snapshot.summary.clone(),
        None,
    );

    Ok(snapshot)
}
```

最后把原来的 `detect_all_setup()` 改成调用同一个汇总函数：

```rust
pub fn detect_all_setup() -> SetupSnapshot {
    let mut checks: HashMap<String, SetupCheckResult> = HashMap::new();

    let items: Vec<SetupCheckResult> = vec![
        check_nodejs(),
        check_npm(),
        check_git(),
        check_git_bash(),
        check_claude_code(),
        check_claude_command(),
        check_claude_auth(),
        check_claude_config(),
        check_windows_terminal(),
        check_powershell_policy(),
        check_npm_registry(),
        check_path_env(),
        check_path_issues(),
        check_workspace(),
        check_api_provider(),
    ];

    for item in items {
        checks.insert(item.id.clone(), item);
    }

    build_snapshot_from_checks(checks)
}
```

---

# 8. setupStore 统一数据来源

## 8.1 修改 `src/features/setup/stores/setupStore.ts`

新增字段：

```ts
currentTaskId: string | null;
currentStepLabel: string | null;
currentMessage: string | null;
progress: number;
paused: boolean;
```

新增 actions：

```ts
pauseDetection: () => Promise<void>;
resumeDetection: () => Promise<void>;
cancelDetection: () => Promise<void>;
restartDetection: () => Promise<void>;
exitApp: () => Promise<void>;
```

增加 import：

```ts
import { invoke } from '@tauri-apps/api/core';
```

把 `detectAll` 的命令从：

```ts
'setup_detect_all'
```

改为：

```ts
'setup_detect_all_v2'
```

完整替换 detectAll：

```ts
detectAll: async () => {
  set({
    runState: 'running',
    checking: true,
    paused: false,
    error: null,
    currentStepLabel: '准备检测',
    currentMessage: '正在启动环境检测...',
    progress: 0,
  });

  try {
    const snapshot = await invokeCommand<SetupSnapshot>(
      'setup_detect_all_v2',
      undefined,
      {
        timeoutMs: 180_000,
        source: 'setup',
        title: '环境检测失败',
      },
    );

    localStorage.setItem(SETUP_CACHE_KEY, JSON.stringify(snapshot));

    const hasCriticalFailure = Object.values(snapshot.checks ?? {}).some(
      (check) => check.required && !check.ok,
    );

    set({
      snapshot,
      checking: false,
      paused: false,
      runState: hasCriticalFailure ? 'partial' : 'success',
      error: hasCriticalFailure ? '部分必需组件未通过检测' : null,
      lastCheckedAt: new Date().toISOString(),
      currentStepLabel: '检测完成',
      currentMessage: snapshot.summary,
      progress: 1,
    });

    return snapshot;
  } catch (err) {
    const message = String(err);

    set({
      checking: false,
      paused: false,
      runState: 'failed',
      error: message,
      lastCheckedAt: new Date().toISOString(),
      currentStepLabel: '检测失败',
      currentMessage: message,
    });

    return null;
  }
},
```

新增控制 action：

```ts
pauseDetection: async () => {
  const taskId = get().currentTaskId;
  if (!taskId) return;

  await invoke('task_pause', { taskId });

  set({
    paused: true,
    checking: true,
    currentMessage: '检测已暂停。你可以继续检测、重新检测，或退出软件。',
  });
},

resumeDetection: async () => {
  const taskId = get().currentTaskId;
  if (!taskId) return;

  await invoke('task_resume', { taskId });

  set({
    paused: false,
    checking: true,
    currentMessage: '正在继续检测...',
  });
},

cancelDetection: async () => {
  const taskId = get().currentTaskId;
  if (!taskId) return;

  await invoke('task_cancel', { taskId });

  set({
    paused: false,
    checking: false,
    runState: 'failed',
    error: '检测已终止',
    currentStepLabel: '检测已终止',
    currentMessage: '你已经终止本次检测，可以重新检测或退出软件。',
  });
},

restartDetection: async () => {
  const taskId = get().currentTaskId;

  if (taskId) {
    try {
      await invoke('task_cancel', { taskId });
    } catch {
      // 如果旧任务已经结束，忽略取消失败。
    }
  }

  return get().detectAll();
},

exitApp: async () => {
  try {
    await invoke('app_exit');
  } catch {
    window.close();
  }
},
```

监听 task progress：

```ts
installListeners: async () => {
  const unlisteners: UnlistenFn[] = [];

  unlisteners.push(
    await listen<any>('task://progress', (event) => {
      const task = event.payload;

      if (task.kind !== 'setup.detect') return;

      set((state) => ({
        currentTaskId: task.taskId,
        currentStepLabel: task.currentStepLabel ?? state.currentStepLabel,
        currentMessage: task.message ?? state.currentMessage,
        progress: typeof task.progress === 'number' ? task.progress : state.progress,
        paused: task.status === 'paused',
        checking: task.status === 'running' || task.status === 'paused',
        tasks: {
          ...state.tasks,
          [task.taskId]: task,
        },
      }));
    }),
  );

  return () => unlisteners.forEach((fn) => fn());
},
```

---

# 9. 首次启动引导页重构

## 9.1 替换步骤结构

修改 `src/features/setup/components/FirstRunSetupWizard.tsx` 的 Step：

```ts
type Step =
  | 'welcome'
  | 'language'
  | 'appearance'
  | 'font'
  | 'runtimeIntro'
  | 'check'
  | 'repair'
  | 'api'
  | 'chat'
  | 'dock'
  | 'permissions'
  | 'github'
  | 'verify'
  | 'done';
```

替换 STEPS：

```ts
const STEPS: { id: Step; label: string; icon: string }[] = [
  { id: 'welcome', label: '欢迎', icon: '👋' },
  { id: 'language', label: '语言', icon: '🌐' },
  { id: 'appearance', label: '主题', icon: '🎨' },
  { id: 'font', label: '字体', icon: '🔠' },
  { id: 'runtimeIntro', label: '工作方式', icon: '🧭' },
  { id: 'check', label: '环境检测', icon: '🔍' },
  { id: 'repair', label: '修复依赖', icon: '🛠️' },
  { id: 'api', label: 'API 配置', icon: '🔑' },
  { id: 'chat', label: '聊天设置', icon: '💬' },
  { id: 'dock', label: 'AI 工作坞', icon: '🛟' },
  { id: 'permissions', label: '安全权限', icon: '🛡️' },
  { id: 'github', label: 'GitHub', icon: '🐙' },
  { id: 'verify', label: '最终验证', icon: '✅' },
  { id: 'done', label: '完成', icon: '🚀' },
];
```

## 9.2 新建 `SetupLiveProgress.tsx`

路径：`src/features/setup/components/SetupLiveProgress.tsx`

```tsx
import { useSetupStore } from '../stores/setupStore';

/**
 * 环境检测实时进度组件。
 * 这个组件只订阅 setupStore，不直接调用后端事件。
 * 所有检测进度都由后端 task://progress 推送，再由 setupStore 汇总。
 */
export function SetupLiveProgress() {
  const checking = useSetupStore((s) => s.checking);
  const paused = useSetupStore((s) => s.paused);
  const progress = useSetupStore((s) => s.progress);
  const currentStepLabel = useSetupStore((s) => s.currentStepLabel);
  const currentMessage = useSetupStore((s) => s.currentMessage);
  const detectAll = useSetupStore((s) => s.detectAll);
  const pauseDetection = useSetupStore((s) => s.pauseDetection);
  const resumeDetection = useSetupStore((s) => s.resumeDetection);
  const cancelDetection = useSetupStore((s) => s.cancelDetection);
  const restartDetection = useSetupStore((s) => s.restartDetection);
  const exitApp = useSetupStore((s) => s.exitApp);

  const percent = Math.round(Math.max(0, Math.min(1, progress || 0)) * 100);

  return (
    <div className="setup-live-card">
      <div className="setup-live-header">
        <div>
          <div className={checking && !paused ? 'setup-live-title is-running' : 'setup-live-title'}>
            {paused
              ? '检测已暂停'
              : checking
                ? `正在检测：${currentStepLabel || '准备中'}`
                : currentStepLabel || '环境检测'}
          </div>

          <div className="setup-live-message">
            {currentMessage || '我们会逐项检查你的电脑环境，并在发现问题时给出清晰的修复建议。'}
          </div>
        </div>

        <div className="setup-live-percent">{percent}%</div>
      </div>

      <div className="setup-progress-track">
        <div className="setup-progress-fill" style={{ width: `${percent}%` }} />
      </div>

      <div className="setup-broadcast-bar">
        <span className="setup-broadcast-dot" />
        <span>
          {paused
            ? '检测已暂停。你可以继续检测、重新检测，或者先退出软件。'
            : currentMessage || '正在准备检测任务...'}
        </span>
      </div>

      <div className="setup-live-actions">
        {checking && !paused && (
          <button className="cc-btn cc-btn-soft" onClick={() => void pauseDetection()}>
            暂停检测
          </button>
        )}

        {checking && paused && (
          <button className="cc-btn cc-btn-primary" onClick={() => void resumeDetection()}>
            继续检测
          </button>
        )}

        {checking && (
          <button className="cc-btn cc-btn-danger" onClick={() => void cancelDetection()}>
            终止检测
          </button>
        )}

        {!checking && (
          <button className="cc-btn cc-btn-primary" onClick={() => void detectAll()}>
            重新检测
          </button>
        )}

        {paused && (
          <>
            <button className="cc-btn cc-btn-soft" onClick={() => void restartDetection()}>
              重新检测
            </button>
            <button className="cc-btn cc-btn-ghost" onClick={() => void exitApp()}>
              退出软件
            </button>
          </>
        )}
      </div>
    </div>
  );
}
```

## 9.3 新建 `SetupAppearanceStep.tsx`

```tsx
import { useAppearanceStore, type CtrlCcTheme } from '../../../core/settings/appearanceStore';

/**
 * 首次启动外观设置步骤。
 * 默认中文 + 默认浅色，但允许用户立刻切换。
 */
const THEMES: { id: CtrlCcTheme; name: string; desc: string; colors: string[] }[] = [
  {
    id: 'light',
    name: '浅色',
    desc: '清爽、明亮、适合日常办公和长时间使用。',
    colors: ['#F7F8FA', '#FFFFFF', '#2563EB', '#111827'],
  },
  {
    id: 'dark',
    name: '深色',
    desc: '沉稳、低光、适合夜间工作和沉浸式代码任务。',
    colors: ['#0B0E14', '#151B26', '#8B5CF6', '#F3F6FB'],
  },
  {
    id: 'pale-blue',
    name: '浅蓝',
    desc: '清澈、理性、科技感更强，适合仪表盘和项目管理。',
    colors: ['#F2F7FD', '#FFFFFF', '#2F80ED', '#142033'],
  },
  {
    id: 'warm-sand',
    name: '暖沙',
    desc: '温和、纸张感、适合长时间阅读和舒缓工作。',
    colors: ['#FAF6EF', '#FFFDF8', '#B77945', '#241A10'],
  },
];

export function SetupAppearanceStep() {
  const theme = useAppearanceStore((s) => s.theme);
  const setTheme = useAppearanceStore((s) => s.setTheme);
  const language = useAppearanceStore((s) => s.language);
  const setLanguage = useAppearanceStore((s) => s.setLanguage);
  const fontScale = useAppearanceStore((s) => s.fontScale);
  const setFontScale = useAppearanceStore((s) => s.setFontScale);

  return (
    <div className="setup-step-panel">
      <h1>先把界面调成你喜欢的样子</h1>
      <p className="cc-body-sm">
        Ctrl-CC 默认使用中文和浅色主题。你可以现在修改，也可以以后在设置页随时修改。
      </p>

      <section className="setup-option-section">
        <h3>语言</h3>
        <div className="setup-button-row">
          <button
            className={language === 'zh' ? 'cc-btn cc-btn-primary' : 'cc-btn cc-btn-soft'}
            onClick={() => setLanguage('zh')}
          >
            中文
          </button>

          <button
            className={language === 'en' ? 'cc-btn cc-btn-primary' : 'cc-btn cc-btn-soft'}
            onClick={() => setLanguage('en')}
          >
            English
          </button>
        </div>
      </section>

      <section className="setup-option-section">
        <h3>主题配色</h3>

        <div className="setup-theme-grid">
          {THEMES.map((item) => (
            <button
              key={item.id}
              className={theme === item.id ? 'setup-theme-card is-selected' : 'setup-theme-card'}
              onClick={() => setTheme(item.id)}
            >
              <div className="setup-theme-swatches">
                {item.colors.map((color) => (
                  <span key={color} style={{ background: color }} />
                ))}
              </div>

              <strong>{item.name}</strong>
              <p>{item.desc}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="setup-option-section">
        <h3>字体大小</h3>
        <p className="cc-body-sm">
          建议保持默认。如果你觉得文字偏小，可以稍微调大。我们会把字体大小应用到整个软件。
        </p>

        <input
          type="range"
          min={0.9}
          max={1.25}
          step={0.05}
          value={fontScale}
          onChange={(event) => setFontScale(Number(event.target.value))}
        />

        <div className="setup-font-preview">
          当前字号预览：你好，欢迎使用 Ctrl-CC。这里是正文、按钮、说明文字的综合效果。
        </div>
      </section>
    </div>
  );
}
```

## 9.4 新建 `SetupProductTourStep.tsx`

```tsx
/**
 * 首次启动产品介绍步骤。
 * 文案必须面向小白用户，避免过度技术化。
 */
export function SetupProductTourStep() {
  return (
    <div className="setup-step-panel">
      <h1>Ctrl-CC 是怎么工作的？</h1>

      <p className="cc-body-sm">
        你可以把 Ctrl-CC 理解成 Claude Code CLI 的图形化控制台。它会在后台启动 Claude Code CLI，
        然后把聊天、终端、项目、资源、GitHub、AI 工作坞统一连接起来。
      </p>

      <div className="setup-tour-grid">
        <div className="cc-card setup-tour-card">
          <span>💬</span>
          <h3>Chat 聊天</h3>
          <p>适合新手，像普通聊天软件一样发送问题、查看回复。</p>
        </div>

        <div className="cc-card setup-tour-card">
          <span>⌨️</span>
          <h3>Terminal 终端</h3>
          <p>适合高级用户，查看 Claude Code CLI 的完整原始输出。</p>
        </div>

        <div className="cc-card setup-tour-card">
          <span>📁</span>
          <h3>Projects 项目</h3>
          <p>把每个代码项目、会话、路径、Git 状态统一管理。</p>
        </div>

        <div className="cc-card setup-tour-card">
          <span>🛟</span>
          <h3>AI 工作坞</h3>
          <p>在屏幕侧边显示后台任务、审批、风险和提醒。</p>
        </div>
      </div>
    </div>
  );
}
```

## 9.5 新建 `SetupChatDockPermissionStep.tsx`

```tsx
/**
 * 首次启动 Chat / Dock / 权限设置。
 * 这些设置先保存在 localStorage，后续可迁移到数据库。
 */
export function SetupChatDockPermissionStep() {
  return (
    <div className="setup-step-panel">
      <h1>选择你的默认工作方式</h1>

      <p className="cc-body-sm">
        这些选项会影响新建会话时的默认体验。你以后可以在设置页随时修改。
      </p>

      <div className="setup-config-grid">
        <label className="setup-field">
          <span>默认打开视图</span>
          <select
            defaultValue={localStorage.getItem('ctrlcc.defaultViewMode') || 'chat'}
            onChange={(event) => localStorage.setItem('ctrlcc.defaultViewMode', event.target.value)}
          >
            <option value="chat">Chat 气泡聊天（推荐）</option>
            <option value="split">Chat + Terminal 分屏</option>
            <option value="terminal">Terminal 终端</option>
          </select>
        </label>

        <label className="setup-field">
          <span>默认模型</span>
          <select
            defaultValue={localStorage.getItem('ctrl-cc-model') || 'sonnet'}
            onChange={(event) => localStorage.setItem('ctrl-cc-model', event.target.value)}
          >
            <option value="sonnet">Sonnet（推荐）</option>
            <option value="opus">Opus</option>
            <option value="haiku">Haiku</option>
          </select>
        </label>

        <label className="setup-field">
          <span>默认权限策略</span>
          <select
            defaultValue={localStorage.getItem('ctrl-cc-permMode') || 'default'}
            onChange={(event) => localStorage.setItem('ctrl-cc-permMode', event.target.value)}
          >
            <option value="default">默认：危险操作前询问</option>
            <option value="plan">计划模式：先规划再执行</option>
            <option value="acceptEdits">自动接受编辑</option>
          </select>
        </label>

        <label className="setup-field">
          <span>AI 工作坞</span>
          <select
            defaultValue={localStorage.getItem('ctrlcc.aiDock.mode') || 'focus'}
            onChange={(event) => localStorage.setItem('ctrlcc.aiDock.mode', event.target.value)}
          >
            <option value="focus">聚焦模式：完整显示任务与审批</option>
            <option value="calm">舒缓模式：只显示关键提醒</option>
            <option value="quiet">安静模式：仅显示边缘状态条</option>
            <option value="disabled">暂不启用</option>
          </select>
        </label>
      </div>

      <div className="setup-friendly-note">
        如果你不确定怎么选，保持默认即可。默认配置会尽量安全、稳定、适合新手。
      </div>
    </div>
  );
}
```

---

# 10. 外观 Store 与默认浅色主题

## 10.1 新建 `src/core/settings/appearanceStore.ts`

```ts
import { create } from 'zustand';
import i18n from '../../i18n';

/**
 * Ctrl-CC 支持的四个主题。
 * id 必须与 CSS 的 [data-theme] 完全一致。
 */
export type CtrlCcTheme = 'light' | 'dark' | 'pale-blue' | 'warm-sand';

/**
 * 当前支持中文和英文。
 * 默认中文。
 */
export type CtrlCcLanguage = 'zh' | 'en';

const THEME_KEY = 'ctrl-cc-theme';
const FONT_SCALE_KEY = 'ctrl-cc-font-scale';
const LANG_KEY = 'ctrlcc_lang';

interface AppearanceState {
  theme: CtrlCcTheme;
  language: CtrlCcLanguage;
  fontScale: number;

  hydrate: () => void;
  setTheme: (theme: CtrlCcTheme) => void;
  setLanguage: (language: CtrlCcLanguage) => void;
  setFontScale: (scale: number) => void;
}

/**
 * 应用主题到 html 根节点。
 */
function applyTheme(theme: CtrlCcTheme) {
  document.documentElement.dataset.theme = theme;
}

/**
 * 应用字体缩放。
 * 用户可调范围限制在 90% 到 125%，避免 UI 被极端字号破坏。
 */
function applyFontScale(scale: number) {
  const safe = Math.max(0.9, Math.min(1.25, scale));
  document.documentElement.style.setProperty('--cc-user-font-scale', String(safe));
}

export const useAppearanceStore = create<AppearanceState>((set) => ({
  theme: 'light',
  language: 'zh',
  fontScale: 1,

  hydrate: () => {
    const theme = (localStorage.getItem(THEME_KEY) as CtrlCcTheme) || 'light';
    const language = (localStorage.getItem(LANG_KEY) as CtrlCcLanguage) || 'zh';
    const fontScale = parseFloat(localStorage.getItem(FONT_SCALE_KEY) || '1');

    applyTheme(theme);
    applyFontScale(fontScale);

    if (i18n.language !== language) {
      void i18n.changeLanguage(language);
    }

    set({ theme, language, fontScale });
  },

  setTheme: (theme) => {
    localStorage.setItem(THEME_KEY, theme);
    applyTheme(theme);
    set({ theme });
  },

  setLanguage: (language) => {
    localStorage.setItem(LANG_KEY, language);
    void i18n.changeLanguage(language);
    set({ language });
  },

  setFontScale: (fontScale) => {
    const safe = Math.max(0.9, Math.min(1.25, fontScale));
    localStorage.setItem(FONT_SCALE_KEY, String(safe));
    applyFontScale(safe);
    set({ fontScale: safe });
  },
}));
```

## 10.2 修改 `App.tsx`

删除旧代码：

```ts
const savedTheme = localStorage.getItem('ctrl-cc-theme') || 'warm-sand';
document.documentElement.setAttribute('data-theme', savedTheme);
```

改由 `appearanceStore.hydrate()` 统一处理。

---

# 11. 字体与四主题 tokens

## 11.1 修改 `src/styles/tokens.css` 字体部分

替换原 typography：

```css
:root {
  --cc-font-sans: Inter, "Noto Sans SC", "Microsoft YaHei UI", "PingFang SC", system-ui, sans-serif;
  --cc-font-mono: "JetBrains Mono", "Cascadia Code", "Sarasa Mono SC", Consolas, monospace;

  --cc-user-font-scale: 1;
  --cc-density-scale: 1;
  --cc-font-scale: clamp(0.90, calc(var(--cc-user-font-scale) * var(--cc-density-scale)), 1.25);

  --cc-font-xs: calc(12px * var(--cc-font-scale));
  --cc-font-sm: calc(13px * var(--cc-font-scale));
  --cc-font-md: calc(14px * var(--cc-font-scale));
  --cc-font-body: calc(15px * var(--cc-font-scale));
  --cc-font-lg: calc(17px * var(--cc-font-scale));
  --cc-font-xl: calc(21px * var(--cc-font-scale));
  --cc-font-2xl: calc(28px * var(--cc-font-scale));
  --cc-font-3xl: calc(36px * var(--cc-font-scale));

  --cc-leading-tight: 1.25;
  --cc-leading-normal: 1.55;
  --cc-leading-relaxed: 1.75;

  --cc-font-normal: 400;
  --cc-font-medium: 500;
  --cc-font-semibold: 600;
  --cc-font-bold: 700;
}
```

## 11.2 禁用过小字号

全库替换：

```txt
--cc-font-3xs -> --cc-font-xs
--cc-font-2xs -> --cc-font-xs
font-size: 8px -> var(--cc-font-xs)
font-size: 10px -> var(--cc-font-xs)
font-size: 11px -> var(--cc-font-xs)
```

## 11.3 替换四主题色板

保留主题名，替换为新色板。

### light

```css
[data-theme="light"] {
  --cc-bg: #F7F8FA;
  --cc-bg-subtle: #F1F4F8;
  --cc-bg-elevated: #FFFFFF;
  --cc-surface: rgba(255,255,255,.92);
  --cc-surface-solid: #FFFFFF;
  --cc-surface-muted: #F3F5F8;
  --cc-surface-hover: #F9FBFF;
  --cc-border: #E1E6EF;
  --cc-border-soft: rgba(225,230,239,.65);
  --cc-border-strong: #C7D0DF;
  --cc-text: #111827;
  --cc-text-muted: #5B6472;
  --cc-text-soft: #8A94A6;
  --cc-text-inverse: #FFFFFF;
  --cc-brand: #2563EB;
  --cc-brand-soft: #E8F0FF;
  --cc-brand-strong: #1D4ED8;
  --cc-green: #16A34A;
  --cc-green-soft: #E8F7EE;
  --cc-blue: #3B82F6;
  --cc-blue-soft: #EAF2FF;
  --cc-amber: #D97706;
  --cc-amber-soft: #FFF4E5;
  --cc-red: #DC2626;
  --cc-red-soft: #FEECEC;
  --cc-purple: #7C3AED;
  --cc-purple-soft: #F1EAFF;
  --cc-shadow-card: 0 1px 2px rgba(15,23,42,.04), 0 10px 30px rgba(15,23,42,.06);
  --cc-shadow-popover: 0 16px 40px rgba(15,23,42,.12);
  --cc-shadow-floating: 0 24px 70px rgba(15,23,42,.16);
  --cc-overlay: rgba(15,23,42,.42);
}
```

### dark

```css
[data-theme="dark"] {
  --cc-bg: #0B0E14;
  --cc-bg-subtle: #10151F;
  --cc-bg-elevated: #151B26;
  --cc-surface: rgba(21,27,38,.94);
  --cc-surface-solid: #151B26;
  --cc-surface-muted: #1B2330;
  --cc-surface-hover: #202A3A;
  --cc-border: #263244;
  --cc-border-soft: rgba(38,50,68,.68);
  --cc-border-strong: #3B4A61;
  --cc-text: #F3F6FB;
  --cc-text-muted: #A9B4C5;
  --cc-text-soft: #728096;
  --cc-text-inverse: #07101F;
  --cc-brand: #8B5CF6;
  --cc-brand-soft: rgba(139,92,246,.18);
  --cc-brand-strong: #A78BFA;
  --cc-green: #34D399;
  --cc-green-soft: rgba(52,211,153,.15);
  --cc-blue: #60A5FA;
  --cc-blue-soft: rgba(96,165,250,.16);
  --cc-amber: #FBBF24;
  --cc-amber-soft: rgba(251,191,36,.16);
  --cc-red: #F87171;
  --cc-red-soft: rgba(248,113,113,.16);
  --cc-purple: #C084FC;
  --cc-purple-soft: rgba(192,132,252,.16);
  --cc-shadow-card: 0 1px 2px rgba(0,0,0,.28), 0 12px 34px rgba(0,0,0,.22);
  --cc-shadow-popover: 0 18px 50px rgba(0,0,0,.36);
  --cc-shadow-floating: 0 26px 80px rgba(0,0,0,.46);
  --cc-overlay: rgba(0,0,0,.62);
}
```

### pale-blue

```css
[data-theme="pale-blue"] {
  --cc-bg: #F2F7FD;
  --cc-bg-subtle: #EAF2FB;
  --cc-bg-elevated: #FFFFFF;
  --cc-surface: rgba(255,255,255,.9);
  --cc-surface-solid: #FFFFFF;
  --cc-surface-muted: #EDF5FD;
  --cc-surface-hover: #F8FBFF;
  --cc-border: #D7E4F3;
  --cc-border-soft: rgba(215,228,243,.70);
  --cc-border-strong: #B8CCE4;
  --cc-text: #142033;
  --cc-text-muted: #52657F;
  --cc-text-soft: #8496AF;
  --cc-text-inverse: #FFFFFF;
  --cc-brand: #2F80ED;
  --cc-brand-soft: #E2F0FF;
  --cc-brand-strong: #1C64D1;
  --cc-green: #219B72;
  --cc-green-soft: #E3F6EF;
  --cc-blue: #4BA3F2;
  --cc-blue-soft: #E8F4FF;
  --cc-amber: #E2952E;
  --cc-amber-soft: #FFF2DF;
  --cc-red: #E05252;
  --cc-red-soft: #FCEAEA;
  --cc-purple: #6D5DF2;
  --cc-purple-soft: #EFEDFF;
  --cc-shadow-card: 0 1px 3px rgba(20,32,51,.05), 0 12px 30px rgba(20,32,51,.07);
  --cc-shadow-popover: 0 16px 44px rgba(20,32,51,.13);
  --cc-shadow-floating: 0 24px 70px rgba(20,32,51,.16);
  --cc-overlay: rgba(20,32,51,.42);
}
```

### warm-sand

```css
[data-theme="warm-sand"] {
  --cc-bg: #FAF6EF;
  --cc-bg-subtle: #F2EADF;
  --cc-bg-elevated: #FFFDF8;
  --cc-surface: rgba(255,253,248,.92);
  --cc-surface-solid: #FFFDF8;
  --cc-surface-muted: #F4E9DA;
  --cc-surface-hover: #FFF8ED;
  --cc-border: #E5D5BF;
  --cc-border-soft: rgba(229,213,191,.68);
  --cc-border-strong: #CDB997;
  --cc-text: #241A10;
  --cc-text-muted: #6E6254;
  --cc-text-soft: #9B8B78;
  --cc-text-inverse: #FFFFFF;
  --cc-brand: #B77945;
  --cc-brand-soft: #F3E0CB;
  --cc-brand-strong: #965C2F;
  --cc-green: #5A9B72;
  --cc-green-soft: #E8F3EA;
  --cc-blue: #5E8EC7;
  --cc-blue-soft: #E8F0FA;
  --cc-amber: #D89136;
  --cc-amber-soft: #FAEAD2;
  --cc-red: #C96868;
  --cc-red-soft: #F8E7E5;
  --cc-purple: #8A72C8;
  --cc-purple-soft: #EFE8FA;
  --cc-shadow-card: 0 1px 2px rgba(36,26,16,.05), 0 12px 30px rgba(36,26,16,.07);
  --cc-shadow-popover: 0 16px 44px rgba(36,26,16,.12);
  --cc-shadow-floating: 0 24px 70px rgba(36,26,16,.16);
  --cc-overlay: rgba(36,26,16,.42);
}
```

---

# 12. 全局 CSS 组件升级

## 12.1 修改 `src/styles/global.css`

增加按钮统一类：

```css
.cc-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 34px;
  padding: 0 16px;
  border-radius: var(--cc-radius-full);
  border: 1px solid var(--cc-border);
  background: var(--cc-surface-solid);
  color: var(--cc-text);
  font-size: var(--cc-font-sm);
  font-weight: var(--cc-font-semibold);
  cursor: pointer;
  white-space: nowrap;
  transition:
    transform var(--cc-duration-fast) var(--cc-ease-spring),
    box-shadow var(--cc-duration-fast) var(--cc-ease-standard),
    background var(--cc-duration-fast) var(--cc-ease-standard),
    border-color var(--cc-duration-fast) var(--cc-ease-standard);
}

.cc-btn:hover {
  transform: translateY(-1px);
  box-shadow: var(--cc-shadow-card);
}

.cc-btn:active {
  transform: translateY(0);
}

.cc-btn:disabled {
  opacity: .55;
  cursor: not-allowed;
  transform: none;
}

.cc-btn-primary {
  background: var(--cc-brand);
  border-color: var(--cc-brand-strong);
  color: var(--cc-text-inverse);
}

.cc-btn-soft {
  background: var(--cc-brand-soft);
  border-color: var(--cc-border-soft);
  color: var(--cc-brand-strong);
}

.cc-btn-ghost {
  background: transparent;
  border-color: transparent;
  color: var(--cc-text-muted);
}

.cc-btn-danger {
  background: var(--cc-red-soft);
  border-color: color-mix(in srgb, var(--cc-red) 35%, transparent);
  color: var(--cc-red);
}
```

统一页面：

```css
.cc-surface-page {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  background:
    radial-gradient(circle at 10% 0%, color-mix(in srgb, var(--cc-brand-soft) 38%, transparent), transparent 34%),
    var(--cc-bg);
  color: var(--cc-text);
}

.cc-page-inner {
  width: min(100%, 1480px);
  margin: 0 auto;
  padding: clamp(16px, 2.2vw, 32px);
}

.cc-page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 18px;
}

.cc-title-xl {
  font-size: var(--cc-font-3xl);
  line-height: var(--cc-leading-tight);
  font-weight: 850;
  letter-spacing: -0.03em;
  color: var(--cc-text);
}

.cc-body-sm {
  font-size: var(--cc-font-sm);
  color: var(--cc-text-muted);
  line-height: var(--cc-leading-relaxed);
}

.cc-card {
  background: var(--cc-surface);
  border: 1px solid var(--cc-border-soft);
  border-radius: var(--cc-radius-xl);
  box-shadow: var(--cc-shadow-card);
  backdrop-filter: blur(14px);
}

.cc-card-pad {
  padding: clamp(16px, 2vw, 24px);
}

.cc-grid-auto {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(260px, 100%), 1fr));
  gap: 16px;
}

.cc-action-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}
```

---

# 13. React #185 修复

## 13.1 修改 `src/debug/useRenderLoopGuard.ts`

完整替换为：

```ts
import { useEffect, useRef } from 'react';

/**
 * 渲染循环检测器。
 * 只在开发环境启用。
 * 生产环境禁止 throw，否则会把调试保护变成用户可见崩溃。
 */
type GuardState = {
  count: number;
  start: number;
};

const states = new Map<string, GuardState>();

export function useRenderLoopGuard(name: string, limit = 120, windowMs = 1000) {
  // 生产环境直接禁用。
  if (!import.meta.env.DEV) return;

  const nameRef = useRef(name);
  const now = performance.now();
  const current = states.get(nameRef.current);

  if (!current || now - current.start > windowMs) {
    states.set(nameRef.current, { count: 1, start: now });
  } else {
    current.count += 1;

    if (current.count > limit) {
      const payload = {
        name: nameRef.current,
        count: current.count,
        windowMs,
        at: new Date().toISOString(),
      };

      queueMicrotask(() => {
        try {
          localStorage.setItem('ctrlcc:render-loop', JSON.stringify(payload));
        } catch {
          // 调试写入失败不影响主流程。
        }
      });

      throw new Error(
        `[Ctrl-CC] Render loop suspected in ${nameRef.current}: ${current.count} renders/${windowMs}ms`,
      );
    }
  }

  useEffect(() => {
    return () => {
      states.delete(nameRef.current);
    };
  }, []);
}
```

## 13.2 修改 `WorkspaceSurface.tsx`

替换 viewMode 同步 effect：

```ts
useEffect(() => {
  const tab = tabs.find((item) => item.sessionId === activeTabId);
  const nextViewMode = tab?.viewMode;

  // 必须判断不同才 setState，避免 tabs 引用变化导致重复 setViewMode。
  if (nextViewMode && nextViewMode !== viewMode) {
    setViewMode(nextViewMode);
  }
}, [activeTabId, tabs, viewMode]);
```

Terminal 输入必须改为：

```tsx
<TerminalView
  sessionId={activeTabId}
  buffer={terminalBuffer}
  onSend={(data) => {
    if (!activeTabId) return;

    // Terminal 输入是原始终端输入，不能走 submitUserMessage。
    // 否则会污染 Chat 气泡，并可能触发重复消息。
    RuntimeKernelBridge.writeTerminal({
      guiSessionId: activeTabId,
      data,
    }).catch((err) => {
      setError(`Terminal write failed: ${String(err)}`);
    });
  }}
/>
```

Chat 输入保留：

```ts
await RuntimeKernelBridge.submitUserMessage({
  guiSessionId: activeTabId,
  projectId: activeSession?.projectId ?? 'default',
  text,
});
```

---

# 14. RuntimeKernel Store 性能优化

## 14.1 修改 `runtimeKernelStore.ts`

把 `ingestEventBatch` 改成批量 mutation copy，不要循环里反复 spread 全对象。

```ts
ingestEventBatch: (events) => {
  if (events.length === 0) return;

  set((state) => {
    // 只在批处理开始时复制一次顶层对象。
    const sessions = { ...state.sessions };
    const rawEvents = { ...state.rawEvents };
    const terminalBuffers = { ...state.terminalBuffers };
    const chatBlocks = { ...state.chatBlocks };
    const activeAssistantBlockId = { ...state.activeAssistantBlockId };

    for (const evt of events) {
      const sid = evt.guiSessionId;

      rawEvents[sid] = [...(rawEvents[sid] ?? []), evt].slice(-2000);

      if (evt.channel === 'raw' && evt.data) {
        terminalBuffers[sid] = (terminalBuffers[sid] ?? '') + evt.data;

        const projected = projectRawToChat({
          sessionId: sid,
          raw: evt.data,
          existingBlocks: chatBlocks[sid] ?? [],
          activeAssistantBlockId: activeAssistantBlockId[sid] ?? null,
        });

        chatBlocks[sid] = projected.blocks;
        activeAssistantBlockId[sid] = projected.activeAssistantBlockId;
      }

      if (evt.channel === 'status' && evt.status) {
        const existing = sessions[sid];

        if (existing) {
          sessions[sid] = {
            ...existing,
            status: evt.status,
            pid: evt.pid ?? existing.pid,
            cwd: evt.cwd ?? existing.cwd,
            updatedAt: evt.createdAt,
          };
        }
      }

      if (evt.channel === 'error') {
        chatBlocks[sid] = [
          ...(chatBlocks[sid] ?? []),
          {
            id: `err-${evt.seq}-${evt.createdAt}`,
            kind: 'error',
            content: evt.data ?? 'Runtime error',
            createdAt: evt.createdAt,
          },
        ];
      }
    }

    return {
      sessions,
      rawEvents,
      terminalBuffers,
      chatBlocks,
      activeAssistantBlockId,
    };
  });
},
```

---

# 15. Runtime 后端生命周期修复

## 15.1 核心原则

```txt
1. startSession 只负责启动或复用 Runtime。
2. submitUserMessage 只写入现有 Runtime。
3. writeTerminal 只写入现有 Runtime。
4. stopSession 才停止 Runtime。
5. detachSession 只关闭 UI 标签，不杀后台进程。
6. reader 退出必须更新状态。
7. child 立刻退出必须标记 failed。
8. Runtime 输出必须完整进入 raw channel。
```

## 15.2 修改 `manager.rs`

启动时 status 应为 `Starting`，不是立即 Ready：

```rust
status: RuntimeStatus::Starting,
```

reader thread 首次读到数据时更新 Ready：

```rust
let mut received_any = false;

loop {
    match reader.read(&mut buf) {
        Ok(0) => break,

        Ok(n) => {
            let data = String::from_utf8_lossy(&buf[..n]).to_string();

            if !received_any {
                received_any = true;

                if let Ok(mut sessions) = inner.lock() {
                    if let Some(handle) = sessions.get_mut(&gui_session_id) {
                        handle.status = RuntimeStatus::Ready;
                        handle.updated_at = Utc::now().to_rfc3339();
                    }
                }

                emit(
                    &app2,
                    &make_event(
                        &trace_id,
                        &gui_session_id,
                        &runtime_session_id2,
                        1,
                        "runtime.ready",
                        "status",
                        Some("Claude Runtime 已连接".to_string()),
                        Some(RuntimeStatus::Ready),
                        pid,
                        Some(cwd.clone()),
                    ),
                );
            }

            // 原始输出必须完整发送到前端。
            emit(
                &app2,
                &make_event(
                    &trace_id,
                    &gui_session_id,
                    &runtime_session_id2,
                    seq,
                    "pty.data",
                    "raw",
                    Some(data),
                    None,
                    pid,
                    Some(cwd.clone()),
                ),
            );
        }

        Err(err) => {
            // reader 错误必须显式推送 error。
        }
    }
}
```

退出时区分：

```rust
if let Ok(mut sessions) = inner.lock() {
    if let Some(handle) = sessions.get_mut(&gui_session_id) {
        handle.reader_alive = false;
        handle.has_writer = false;

        if !received_any {
            handle.status = RuntimeStatus::Failed;
            handle.last_error = Some("Claude 进程启动后未产生任何输出即退出".to_string());
        } else if handle.status != RuntimeStatus::Failed {
            handle.status = RuntimeStatus::Exited;
            handle.last_error = Some("PTY reader exited".to_string());
        }

        handle.updated_at = Utc::now().to_rfc3339();
    }
}
```

---

# 16. GitHub Surface 内嵌浏览器

## 16.1 替换 `src/surfaces/github/GitHubSurface.tsx`

```tsx
import { useEffect, useRef, useState } from 'react';
import { Webview } from '@tauri-apps/api/webview';
import { Window } from '@tauri-apps/api/window';
import { CcButton } from '../../components/ui/CcButton';

const DEFAULT_HOME_KEY = 'ctrlcc.github.home';
const DEFAULT_URL = 'https://github.com';

/**
 * GitHub Surface。
 * 注意：GitHub 不允许 iframe 嵌入，所以这里使用 Tauri Webview。
 * 这不是外部浏览器，而是在应用内部创建一个子 Webview。
 */
export function GitHubSurface() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const webviewRef = useRef<Webview | null>(null);

  const [url, setUrl] = useState(() => localStorage.getItem(DEFAULT_HOME_KEY) || DEFAULT_URL);
  const [input, setInput] = useState(url);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  /**
   * 规范化用户输入 URL。
   * 用户输入 github.com 时自动补 https://。
   */
  function normalizeUrl(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) return DEFAULT_URL;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  }

  /**
   * 创建或调整内嵌 Webview。
   * Webview 的坐标必须跟随 host 容器。
   */
  async function createOrResizeWebview(nextUrl = url) {
    const host = hostRef.current;
    if (!host) return;

    const rect = host.getBoundingClientRect();

    try {
      setStatus('loading');
      setError(null);

      if (!webviewRef.current) {
        const appWindow = new Window('main');

        const webview = new Webview(appWindow, 'github-browser', {
          url: nextUrl,
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          focus: true,
        });

        webviewRef.current = webview;

        await webview.once('tauri://created', () => {
          setStatus('ready');
        });

        await webview.once('tauri://error', (event) => {
          setStatus('error');
          setError(String(event.payload));
        });
      } else {
        await webviewRef.current.setPosition({
          x: Math.round(rect.left),
          y: Math.round(rect.top),
        } as any);

        await webviewRef.current.setSize({
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        } as any);
      }
    } catch (err) {
      setStatus('error');
      setError(String(err));
    }
  }

  /**
   * 打开新 URL。
   * 为了避免旧 Webview 状态残留，这里关闭旧 Webview 后重新创建。
   */
  async function navigate(nextRaw: string) {
    const next = normalizeUrl(nextRaw);

    setUrl(next);
    setInput(next);

    await webviewRef.current?.close().catch(() => {});
    webviewRef.current = null;

    await createOrResizeWebview(next);
  }

  /**
   * 保存默认 GitHub 主页。
   */
  function saveDefault() {
    const next = normalizeUrl(input);
    localStorage.setItem(DEFAULT_HOME_KEY, next);
    setInput(next);
    setUrl(next);
  }

  useEffect(() => {
    void createOrResizeWebview(url);

    const handleResize = () => {
      void createOrResizeWebview(url);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      webviewRef.current?.close().catch(() => {});
      webviewRef.current = null;
    };
  }, []);

  return (
    <div data-testid="surface-github" className="cc-surface-page cc-github-surface">
      <div className="cc-github-toolbar">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              void navigate(input);
            }
          }}
          placeholder="https://github.com"
          className="cc-github-address"
        />

        <CcButton variant="primary" onClick={() => void navigate(input)}>
          打开
        </CcButton>

        <CcButton variant="ghost" onClick={saveDefault}>
          设为默认主页
        </CcButton>

        <CcButton variant="ghost" onClick={() => void navigate(DEFAULT_URL)}>
          GitHub 主页
        </CcButton>
      </div>

      <div className="cc-github-browser-shell">
        <div ref={hostRef} className="cc-github-webview-host" />

        {status === 'loading' && (
          <div className="cc-github-overlay">
            正在打开 GitHub...
          </div>
        )}

        {status === 'error' && (
          <div className="cc-github-overlay cc-github-error">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
```

## 16.2 新增 CSS

```css
.cc-github-surface {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.cc-github-toolbar {
  height: 56px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--cc-border);
  background: var(--cc-surface-solid);
}

.cc-github-address {
  flex: 1;
  height: 36px;
  border-radius: var(--cc-radius-full);
  border: 1px solid var(--cc-border);
  background: var(--cc-bg);
  color: var(--cc-text);
  padding: 0 14px;
  font-size: var(--cc-font-sm);
}

.cc-github-browser-shell {
  position: relative;
  flex: 1;
  min-height: 0;
  background: var(--cc-bg-subtle);
}

.cc-github-webview-host {
  position: absolute;
  inset: 0;
}

.cc-github-overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: var(--cc-text-muted);
  background: var(--cc-bg);
  z-index: 2;
}

.cc-github-error {
  color: var(--cc-red);
}
```

---

# 17. 全局打断系统

## 17.1 新建 `src/core/tasks/NavigationGuardModal.tsx`

```tsx
import type { TaskProgress } from './taskTypes';
import { TaskBridge } from './taskBridge';

/**
 * 页面切换保护弹窗。
 * 当用户切换页面时，如果存在不能静默后台继续的任务，就显示这个弹窗。
 */
interface Props {
  open: boolean;
  targetLabel?: string;
  tasks: TaskProgress[];
  onContinue: () => void;
  onStay: () => void;
}

export function NavigationGuardModal({
  open,
  targetLabel,
  tasks,
  onContinue,
  onStay,
}: Props) {
  if (!open) return null;

  const canCancelAll = tasks.every((task) => task.canCancel);

  return (
    <div className="cc-modal-backdrop">
      <div className="cc-modal-card">
        <h2>当前还有任务正在运行</h2>

        <p className="cc-body-sm">
          为了避免破坏正在进行的操作，切换到「{targetLabel || '其他页面'}」前需要确认。
        </p>

        <div className="cc-task-list">
          {tasks.map((task) => (
            <div key={task.taskId} className="cc-task-row">
              <strong>{task.title}</strong>
              <span>{task.currentStepLabel || task.message || task.status}</span>
            </div>
          ))}
        </div>

        <div className="cc-action-row">
          <button className="cc-btn cc-btn-soft" onClick={onStay}>
            留在当前页面
          </button>

          {canCancelAll && (
            <button
              className="cc-btn cc-btn-danger"
              onClick={async () => {
                for (const task of tasks) {
                  await TaskBridge.cancel(task.taskId);
                }

                onContinue();
              }}
            >
              取消任务并切换
            </button>
          )}

          <button className="cc-btn cc-btn-primary" onClick={onContinue}>
            后台继续并切换
          </button>
        </div>
      </div>
    </div>
  );
}
```

## 17.2 修改 LeftSurfaceRail

切换 surface 前必须检查：

```ts
const blockingTasks = useTaskStore((s) => s.blockingTasks());
```

伪代码：

```ts
function requestNavigate(targetSurface: SurfaceId) {
  const blocking = useTaskStore.getState().blockingTasks();

  if (blocking.length > 0) {
    setPendingTarget(targetSurface);
    setGuardOpen(true);
    return;
  }

  setSurface(targetSurface);
}
```

弹窗继续：

```ts
function continueNavigate() {
  if (!pendingTarget) return;

  setSurface(pendingTarget);
  setPendingTarget(null);
  setGuardOpen(false);
}
```

---

# 18. Diagnostic Ledger

## 18.1 新建 `src/core/diagnostics/diagnosticLedger.ts`

```ts
import { create } from 'zustand';

export type DiagnosticSeverity = 'info' | 'warning' | 'error' | 'critical';

/**
 * 诊断事件。
 * 所有未处理错误、后端任务失败、Runtime 异常、UI 崩溃都进入这里。
 */
export interface DiagnosticEvent {
  id: string;
  ts: string;
  source: string;
  severity: DiagnosticSeverity;
  title: string;
  detail?: string;
  taskId?: string;
  sessionId?: string;
  raw?: unknown;
}

interface DiagnosticLedgerState {
  events: DiagnosticEvent[];
  append: (event: Omit<DiagnosticEvent, 'id' | 'ts'>) => void;
  clear: () => void;
  exportJson: () => string;
}

export const useDiagnosticLedger = create<DiagnosticLedgerState>((set, get) => ({
  events: [],

  append: (event) => {
    const next: DiagnosticEvent = {
      id: crypto.randomUUID(),
      ts: new Date().toISOString(),
      ...event,
    };

    set((state) => ({
      events: [next, ...state.events].slice(0, 1000),
    }));
  },

  clear: () => set({ events: [] }),

  exportJson: () => JSON.stringify(get().events, null, 2),
}));
```

---

# 19. Console 页面商业级重构

## 19.1 Console 信息架构

Console 需要分成：

```txt
1. 顶部 Hero：问候语 + 当前状态 + 主操作按钮
2. 全局状态条：Runtime / Setup / Task / Error
3. KPI 卡片：运行中、项目数、今日费用、Claude CLI、总 Tokens
4. 双列核心卡片：
   - Runtime Center
   - Setup Center
5. 最近会话列表
6. 活动时间线
```

## 19.2 Console 页面布局代码骨架

```tsx
/**
 * ConsoleSurface 是应用首页。
 * 它不是简单统计页，而是用户进入软件后的操作中心。
 */
export function ConsoleSurface() {
  const setupSnapshot = useSetupStore((s) => s.snapshot);
  const setupChecking = useSetupStore((s) => s.checking);
  const detectAll = useSetupStore((s) => s.detectAll);
  const activeTasks = useTaskStore((s) => s.activeTasks());
  const runtimeSessions = useRuntimeKernelStore((s) => s.sessions);

  return (
    <div data-testid="surface-console" className="cc-surface-page">
      <div className="cc-page-inner">
        <section className="console-hero">
          <div>
            <h1 className="cc-title-xl">夜深了，开发者</h1>
            <p className="cc-body-sm">
              欢迎回来。你可以从这里开始新会话、检查环境、查看任务与项目状态。
            </p>
          </div>

          <div className="cc-action-row">
            <button className="cc-btn cc-btn-primary">
              新建 Claude 会话
            </button>
            <button
              className="cc-btn cc-btn-soft"
              onClick={() => void detectAll()}
              disabled={setupChecking}
            >
              {setupChecking ? '检测中...' : setupSnapshot ? '刷新环境配置' : '检测环境配置'}
            </button>
          </div>
        </section>

        <section className="console-status-strip">
          <span>Runtime {Object.keys(runtimeSessions).length}</span>
          <span>任务 {activeTasks.length}</span>
          <span>环境 {setupSnapshot?.ready ? '就绪' : '待检测'}</span>
        </section>

        <section className="console-kpi-grid">
          {/* KPI cards */}
        </section>

        <section className="console-main-grid">
          <RuntimeCenterCard />
          <SetupCenterCard />
        </section>

        <section className="console-bottom-grid">
          <RecentSessionsCard />
          <ActivityTimelineCard />
        </section>
      </div>
    </div>
  );
}
```

---

# 20. Project 页面商业级重构

## 20.1 目标布局

```txt
左侧：项目筛选和工作区列表
中间：项目卡片网格
右侧：选中项目详情 / 最近会话 / Git 状态 / 快捷操作
```

## 20.2 交互要求

```txt
1. 新建项目后自动进入项目详情。
2. 新建 Claude 会话后默认打开 Chat。
3. 项目卡片显示：路径、会话数、最近更新时间、风险数、Git branch。
4. 小窗口时右侧详情折叠到底部抽屉。
5. 项目路径不存在时给出修复提示。
```

---

# 21. Workspace 页面商业级重构

## 21.1 目标布局

```txt
顶部：
  tab bar + session breadcrumb + runtime status + model + permission

主体：
  Chat / Terminal / Split

底部：
  Composer

右侧：
  Inspector，可折叠

状态：
  missing / starting / ready / busy / waiting-permission / failed / exited
```

## 21.2 Chat 气泡要求

```txt
1. 用户消息右侧。
2. Assistant 消息左侧。
3. System/Runtime 状态居中弱提示。
4. Thinking、tool use、permission、file change 必须作为独立卡片类型。
5. 原始输出必须可切换查看。
6. 不允许重复回复。
7. 不允许一条 Assistant 输出被拆成多个重复气泡。
```

---

# 22. Resources 页面商业级重构

## 22.1 分类

```txt
Skills
Agents
Rules
Memory
Hooks
MCP
Templates
```

## 22.2 卡片字段

```txt
名称
描述
来源
状态
绑定项目
最近更新
启用/禁用
编辑
打开位置
```

---

# 23. Canvas 页面商业级重构

## 23.1 目标

无限画布显示：

```txt
Project Node
Session Node
Runtime Node
Task Node
Resource Node
GitHub Node
Error Node
```

## 23.2 必需功能

```txt
1. zoom / pan
2. fit view
3. reset layout
4. 点击节点打开详情
5. 小白模式隐藏复杂边
6. 专业模式显示事件流和依赖边
```

---

# 24. Settings 页面商业级重构

## 24.1 分区

```txt
外观与语言
首次启动与引导
环境配置
API Provider
Runtime 默认值
Chat 默认值
AI Dock
权限中心
GitHub
诊断与日志
开发者选项
```

## 24.2 设置数据统一

所有设置最终进入：

```txt
appearanceStore
appSettingsStore
setupStore
runtimeSettingsStore
```

禁止各页面私自 localStorage key 混乱增长。

---

# 25. 验收测试

## 25.1 命令验收

```bash
npm run typecheck
npm run build
npm run lint
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
```

## 25.2 grep 验收

```bash
grep -R "setup_detect_all'" src
grep -R "setup_detect_all\"" src
```

预期：前端不能再调用旧 `setup_detect_all`。

```bash
grep -R "var(--cc-font-3xs)\|var(--cc-font-2xs)" src
```

预期：0 hits。

```bash
grep -R "font-size: 8px\|font-size: 10px\|font-size: 11px" src
```

预期：0 hits。

```bash
grep -R "window.open" src/surfaces/github
```

预期：0 hits，除非是明确的 fallback。

```bash
grep -R "RuntimeKernelBridge.submitUserMessage" src/surfaces/workspace
```

预期：只允许 Chat send 出现。Terminal 必须是 `writeTerminal`。

## 25.3 手动验收

### 首次启动

```txt
1. 清空 localStorage。
2. 启动应用。
3. 默认中文。
4. 默认浅色主题。
5. 引导页出现。
6. 可以选择语言。
7. 可以选择四主题。
8. 可以调整字体大小。
9. 可以看到工作方式介绍。
10. 环境检测显示当前检测项。
11. 当前检测项文字闪烁或呼吸。
12. 广播条实时变化。
13. 暂停检测有效。
14. 继续检测有效。
15. 终止检测有效。
16. 重新检测有效。
17. 退出软件有效。
18. 检测失败显示失败项和修复建议。
```

### Chat / Terminal

```txt
1. 新建项目会话。
2. 默认进入 Chat。
3. 发送第一条消息。
4. 记录后端 PID。
5. 发送第二条消息。
6. PID 不变。
7. 对话有上下文。
8. 切换 Terminal。
9. Terminal 显示同一个 Runtime 原始输出。
10. Terminal 输入不会生成 Chat user bubble。
11. Split 模式无重复消息。
12. Close tab 不杀 Runtime。
13. Stop Runtime 才停止进程。
```

### 性能

```txt
1. 连续切换页面 100 次无卡死。
2. 连续点击检测按钮不会并发启动多个检测任务。
3. 运行检测时页面仍可拖动、切换、响应。
4. Runtime 输出长文本时 UI 不明显掉帧。
5. Error 面板打开不造成循环报错。
```

### GitHub

```txt
1. 打开 GitHub 页面。
2. 默认加载 https://github.com。
3. 地址栏输入 repo 可跳转。
4. 设为默认主页后重启仍有效。
5. 不跳外部浏览器。
```

---

# 26. 完成报告模板

完成后必须输出：

```md
# Ctrl-CC v29.9 Ultimate Completion Report

## 分支
v29-ultimate-commercial-rebuild

## 修改文件
- ...

## Setup
- 逐项检测：完成/未完成
- 暂停/继续/终止/重新检测：完成/未完成
- 失败项展示：完成/未完成
- 诊断包：完成/未完成

## Runtime
- GUI session -> Runtime session 绑定：完成/未完成
- Chat 连续上下文：完成/未完成
- Terminal 同步：完成/未完成
- PID 连续性测试：结果
- 关闭 tab 不杀进程：结果

## UI
- 默认中文：完成/未完成
- 默认浅色：完成/未完成
- 四主题：完成/未完成
- 字体缩放：完成/未完成
- Console 重构：完成/未完成
- Project 重构：完成/未完成
- Workspace 重构：完成/未完成
- Resources 重构：完成/未完成
- Canvas 重构：完成/未完成
- GitHub 内嵌：完成/未完成
- Settings 重构：完成/未完成

## Stability
- React #185：已修复/未修复
- 未处理异步：已记录/未记录
- 后台任务未响应：已修复/未修复
- 外部命令弹窗：已修复/未修复

## Build
- npm run typecheck:
- npm run build:
- npm run lint:
- cargo check:
- cargo test:

## 截图
- 首次引导
- 环境检测中
- 环境检测暂停
- Console
- Project
- Workspace Chat
- Workspace Terminal
- GitHub
- Settings
```

---

# 27. 最终交付标准

本轮完成后，Ctrl-CC 必须达到：

```txt
1. 小白用户首次启动能被完整引导。
2. 用户知道软件正在做什么。
3. 用户可以暂停、继续、终止、重试。
4. 软件不因检测、安装、启动 Runtime 卡死。
5. Chat/Terminal 真正绑定同一 Claude CLI Runtime。
6. 每条消息不再变成新会话。
7. 原始 CLI 输出不丢失。
8. Chat 可视化只是原始输出的结构化投影。
9. GitHub 是应用内浏览器。
10. 视觉统一、字体舒适、四主题可用。
11. 错误可诊断、任务可追踪、状态可同步。
12. 后续开发人员能长期维护。
```

---

# 28. 文件级修改清单

## 28.1 必须新建的前端文件

```txt
src/core/tasks/taskTypes.ts
src/core/tasks/taskStore.ts
src/core/tasks/taskBridge.ts
src/core/tasks/NavigationGuardModal.tsx
src/core/settings/appearanceStore.ts
src/core/diagnostics/diagnosticLedger.ts
src/features/setup/components/SetupLiveProgress.tsx
src/features/setup/components/SetupAppearanceStep.tsx
src/features/setup/components/SetupProductTourStep.tsx
src/features/setup/components/SetupChatDockPermissionStep.tsx
```

## 28.2 必须新建的后端文件

```txt
src-tauri/src/task_control/mod.rs
src-tauri/src/task_control/types.rs
src-tauri/src/task_control/manager.rs
src-tauri/src/task_control/commands.rs
```

## 28.3 必须重点修改的文件

```txt
CLAUDE.md
src/app/App.tsx
src/debug/useRenderLoopGuard.ts
src/features/setup/stores/setupStore.ts
src/features/setup/components/FirstRunSetupWizard.tsx
src/features/setup/styles/first-run-setup.css
src/styles/tokens.css
src/styles/global.css
src/runtime-kernel/runtimeKernelStore.ts
src/runtime-kernel/runtimeKernelBridge.ts
src/surfaces/workspace/WorkspaceSurface.tsx
src/surfaces/github/GitHubSurface.tsx
src/surfaces/settings/SettingsSurface.tsx
src-tauri/src/lib.rs
src-tauri/src/setup/commands.rs
src-tauri/src/setup/detector.rs
src-tauri/src/setup/subprocess_runner.rs
src-tauri/src/runtime_kernel/manager.rs
src-tauri/src/runtime_kernel/commands.rs
```

## 28.4 最容易遗漏的点

```txt
1. App.tsx 默认 theme 必须从 warm-sand 改成 light。
2. SettingsSurface 默认 theme fallback 必须 light。
3. setupStore detectAll 必须调用 setup_detect_all_v2。
4. setup_detect_all_v2 必须真正逐项 emit task://progress。
5. FirstRun check 和 verify 都必须使用 SetupLiveProgress。
6. Terminal 输入必须 writeTerminal。
7. Chat 输入必须 submitUserMessage。
8. useRenderLoopGuard 生产环境必须 return。
9. GitHubSurface 不要 window.open 作为主功能。
10. 所有过小字号变量必须清掉。
11. 所有检测命令必须 CREATE_NO_WINDOW。
12. Runtime close tab 默认 detach。
13. Stop Runtime 才 kill child。
14. Error/diagnostics 必须记录 unhandledrejection。
15. 页面切换必须接入 Task Navigation Guard。
```
