import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { invokeCommand } from '../../../services/invokeCommand';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type {
  SetupSnapshot,
  SetupTaskProgress,
} from '../types/setupTypes';

const ONBOARDING_KEY = 'ctrl-cc-onboarding-completed';
const DISMISS_KEY = 'ctrlcc.setup.dismissedUntil';
const SETUP_CACHE_KEY = 'ctrlcc.setup.snapshot.v2';

type SetupRunState = 'idle' | 'running' | 'success' | 'partial' | 'failed';

interface SetupState {
  snapshot: SetupSnapshot | null;
  checking: boolean;
  error: string | null;
  lastCheckedAt: string | null;
  runState: SetupRunState;
  tasks: Record<string, SetupTaskProgress>;
  onboardingCompleted: boolean;
  dismissedUntil: number | null;
  hydrated: boolean;

  /** v29: progressive detection fields */
  currentTaskId: string | null;
  currentStepLabel: string | null;
  currentMessage: string | null;
  progress: number;
  paused: boolean;

  hydrate: () => void;
  loadCached: () => void;
  detectAll: () => Promise<SetupSnapshot | null>;
  detectAllSafe: () => Promise<SetupSnapshot | null>;
  clearCache: () => void;
  installClaudeCodeCli: () => Promise<string>;
  fixPowershellPolicy: () => Promise<string>;
  setNpmMirror: () => Promise<string>;
  writeProviderConfig: (req: {
    provider: string;
    apiKey: string;
    baseUrl?: string;
    haikuModel?: string;
    sonnetModel?: string;
    opusModel?: string;
  }) => Promise<void>;
  readProviderConfigSafe: () => Promise<{
    configured: boolean;
    provider: string;
    baseUrl: string;
    apiKeyMasked: string;
  }>;
  markOnboardingCompleted: () => void;
  resetOnboarding: () => void;
  dismissBanner: () => void;
  installListeners: () => Promise<() => void>;

  /** v29: task control actions */
  pauseDetection: () => Promise<void>;
  resumeDetection: () => Promise<void>;
  cancelDetection: () => Promise<void>;
  restartDetection: () => Promise<SetupSnapshot | null>;
  exitApp: () => Promise<void>;
}

function readOnboarding(): boolean {
  return localStorage.getItem(ONBOARDING_KEY) === 'true';
}

function readDismissed(): number | null {
  const raw = localStorage.getItem(DISMISS_KEY);
  return raw ? parseInt(raw, 10) : null;
}

export const useSetupStore = create<SetupState>((set, get) => ({
  snapshot: null,
  checking: false,
  error: null,
  lastCheckedAt: null,
  runState: 'idle',
  tasks: {},
  onboardingCompleted: readOnboarding(),
  dismissedUntil: readDismissed(),
  hydrated: false,

  /** v29: progressive detection fields */
  currentTaskId: null,
  currentStepLabel: null,
  currentMessage: null,
  progress: 0,
  paused: false,

  hydrate: () => {
    try {
      const raw = localStorage.getItem(SETUP_CACHE_KEY);
      if (raw) {
        set({ snapshot: JSON.parse(raw) as SetupSnapshot, hydrated: true });
        return;
      }
    } catch {}
    set({ hydrated: true });
  },

  loadCached: () => {
    try {
      const raw = localStorage.getItem(SETUP_CACHE_KEY);
      if (raw) {
        set({ snapshot: JSON.parse(raw) as SetupSnapshot });
      }
    } catch {}
  },

  detectAll: async () => {
    set({
      runState: 'running',
      checking: true,
      error: null,
      currentStepLabel: '准备检测',
      currentMessage: '正在启动环境检测...',
      progress: 0,
      paused: false,
    });

    try {
      const snapshot = await invokeCommand<SetupSnapshot>(
        'setup_detect_all_v2',
        undefined,
        { timeoutMs: 180_000, source: 'setup', title: '环境检测失败' }
      );

      localStorage.setItem(SETUP_CACHE_KEY, JSON.stringify(snapshot));

      const hasCriticalFailure = Object.values(snapshot.checks ?? {}).some(
        (c) => c.required && !c.ok
      );

      set({
        snapshot,
        checking: false,
        runState: hasCriticalFailure ? 'partial' : 'success',
        error: hasCriticalFailure ? '部分必需组件未通过检测' : null,
        lastCheckedAt: new Date().toISOString(),
        currentStepLabel: '检测完成',
        currentMessage: snapshot.summary,
        progress: 1,
        paused: false,
      });

      return snapshot;
    } catch (err) {
      const message = String(err);
      set({
        checking: false,
        runState: 'failed',
        error: message,
        lastCheckedAt: new Date().toISOString(),
        currentStepLabel: '检测失败',
        currentMessage: message,
        paused: false,
      });
      return null;
    }
  },

  detectAllSafe: async () => {
    try { return await get().detectAll(); }
    catch { return null; }
  },

  clearCache: () => {
    localStorage.removeItem(SETUP_CACHE_KEY);
    set({ snapshot: null, runState: 'idle', hydrated: true });
  },

  installClaudeCodeCli: async () => {
    set({ error: null });
    try {
      const result = await invokeCommand<string>('setup_install_claude_code_cli');
      await get().detectAll();
      return result;
    } catch (err) {
      const msg = String(err);
      set({ error: msg });
      throw err;
    }
  },

  fixPowershellPolicy: async () => {
    set({ error: null });
    try {
      const result = await invokeCommand<string>('setup_fix_powershell_policy');
      await get().detectAll();
      return result;
    } catch (err) {
      const msg = String(err);
      set({ error: msg });
      throw err;
    }
  },

  setNpmMirror: async () => {
    set({ error: null });
    try {
      const result = await invokeCommand<string>('setup_set_npm_mirror');
      await get().detectAll();
      return result;
    } catch (err) {
      const msg = String(err);
      set({ error: msg });
      throw err;
    }
  },

  writeProviderConfig: async (req) => {
    set({ error: null });
    try {
      await invokeCommand('setup_write_provider_config', { req });
      await get().detectAll();
    } catch (err) {
      const msg = String(err);
      set({ error: msg });
      throw err;
    }
  },

  readProviderConfigSafe: async () => {
    return invokeCommand<{
      configured: boolean;
      provider: string;
      baseUrl: string;
      apiKeyMasked: string;
    }>('setup_read_provider_config_safe');
  },

  markOnboardingCompleted: () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    set({ onboardingCompleted: true });
  },

  resetOnboarding: () => {
    localStorage.removeItem(ONBOARDING_KEY);
    set({ onboardingCompleted: false });
  },

  dismissBanner: () => {
    const until = Date.now() + 24 * 60 * 60 * 1000;
    localStorage.setItem(DISMISS_KEY, String(until));
    set({ dismissedUntil: until });
  },

  installListeners: async () => {
    const unlisteners: UnlistenFn[] = [];

    // 旧版 setup://task-progress 事件（安装器等兼容）
    unlisteners.push(
      await listen<SetupTaskProgress>('setup://task-progress', (event) => {
        const p = event.payload;
        set((state) => ({
          tasks: { ...state.tasks, [p.taskId]: p },
        }));
      })
    );

    // v29: 新版 task://progress 事件（逐项检测进度）
    unlisteners.push(
      await listen<any>('task://progress', (event) => {
        const task = event.payload;
        // 只处理环境检测类任务
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
      })
    );

    return () => unlisteners.forEach((fn) => fn());
  },

  /** v29: 暂停当前检测任务 */
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

  /** v29: 恢复已暂停的检测任务 */
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

  /** v29: 取消当前检测任务 */
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
      progress: 0,
    });
  },

  /** v29: 重新运行检测 */
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

  /** v29: 退出应用 */
  exitApp: async () => {
    try {
      await invoke('app_exit');
    } catch {
      window.close();
    }
  },
}));
