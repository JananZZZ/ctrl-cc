import { create } from 'zustand';
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

interface TaskProgressPayload {
  taskId: string;
  kind?: string;
  title: string;
  status?: string;
  currentStepId?: string;
  currentStepLabel?: string;
  message?: string;
  progress: number;
  canPause: boolean;
  canResume: boolean;
  canCancel: boolean;
  canTerminate: boolean;
  error?: string;
}

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
  restartDetection: () => Promise<void>;
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
      currentTaskId: null,
      currentStepLabel: null,
      currentMessage: null,
      progress: 0,
      paused: false,
    });

    try {
      const snapshot = await invokeCommand<SetupSnapshot>(
        'setup_detect_all_v2',
        undefined,
        { timeoutMs: 180_000, source: 'setup', title: 'Environment detection failed' }
      );

      localStorage.setItem(SETUP_CACHE_KEY, JSON.stringify(snapshot));

      const hasCriticalFailure = Object.values(snapshot.checks ?? {}).some(
        (c) => c.required && !c.ok
      );

      set({
        snapshot,
        checking: false,
        runState: hasCriticalFailure ? 'partial' : 'success',
        error: hasCriticalFailure ? 'Some required checks failed' : null,
        lastCheckedAt: new Date().toISOString(),
        currentTaskId: null,
        currentStepLabel: null,
        currentMessage: null,
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
        currentTaskId: null,
        currentStepLabel: null,
        currentMessage: null,
        progress: 0,
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
      await listen<TaskProgressPayload>('task://progress', (event) => {
        const p = event.payload;
        // 只处理环境检测类任务
        if (p.kind !== 'setup.detect') return;

        set((state) => ({
          currentTaskId: p.taskId,
          currentStepLabel: p.currentStepLabel ?? state.currentStepLabel,
          currentMessage: p.message ?? state.currentMessage,
          progress: typeof p.progress === 'number' ? p.progress : state.progress,
          checking: p.status === 'running' || p.status === 'paused',
          paused: p.status === 'paused',
          tasks: { ...state.tasks, [p.taskId]: p as any },
        }));
        if (p.error) {
          set({ error: p.error });
        }
      })
    );

    return () => unlisteners.forEach((fn) => fn());
  },

  /** v29: 暂停当前检测任务 */
  pauseDetection: async () => {
    const { currentTaskId } = get();
    if (!currentTaskId) return;
    try {
      await invokeCommand('task_pause', { taskId: currentTaskId });
      set({ paused: true, checking: true, currentMessage: '检测已暂停。你可以继续检测、重新检测，或退出软件。' });
    } catch (err) {
      set({ error: String(err) });
    }
  },

  /** v29: 恢复已暂停的检测任务 */
  resumeDetection: async () => {
    const { currentTaskId } = get();
    if (!currentTaskId) return;
    try {
      await invokeCommand('task_resume', { taskId: currentTaskId });
      set({ paused: false, checking: true, currentMessage: '正在继续检测...' });
    } catch (err) {
      set({ error: String(err) });
    }
  },

  /** v29: 取消当前检测任务 */
  cancelDetection: async () => {
    const { currentTaskId } = get();
    if (!currentTaskId) return;
    try {
      await invokeCommand('task_cancel', { taskId: currentTaskId });
      set({
        paused: false,
        checking: false,
        runState: 'failed',
        error: '检测已终止',
        currentTaskId: null,
        currentStepLabel: '检测已终止',
        currentMessage: '你已经终止本次检测，可以重新检测或退出软件。',
        progress: 0,
      });
    } catch (err) {
      set({ error: String(err) });
    }
  },

  /** v29: 重新运行检测 */
  restartDetection: async () => {
    const { currentTaskId } = get();
    if (currentTaskId) {
      try { await invokeCommand('task_cancel', { taskId: currentTaskId }); } catch {}
    }
    await get().detectAll();
  },

  /** v29: 退出应用 */
  exitApp: async () => {
    try {
      await invokeCommand('plugin:process|exit');
    } catch {
      // Best effort — if the command fails the user can close the window manually
    }
  },
}));
