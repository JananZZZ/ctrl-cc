import { create } from 'zustand';
import { invokeCommand } from '../../../services/invokeCommand';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type {
  SetupSnapshot,
  SetupTaskProgress,
} from '../types/setupTypes';

const ONBOARDING_KEY = 'ctrl-cc-onboarding-completed';
const DISMISS_KEY = 'ctrlcc.setup.dismissedUntil';

interface SetupState {
  snapshot: SetupSnapshot | null;
  checking: boolean;
  error: string | null;
  lastCheckedAt: string | null;
  tasks: Record<string, SetupTaskProgress>;
  onboardingCompleted: boolean;
  dismissedUntil: number | null;

  loadCached: () => void;
  detectAll: () => Promise<SetupSnapshot>;
  detectAllSafe: () => Promise<SetupSnapshot | null>;
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
  tasks: {},
  onboardingCompleted: readOnboarding(),
  dismissedUntil: readDismissed(),

  loadCached: () => {
    try {
      const raw = localStorage.getItem('ctrl-cc-setup-snapshot');
      if (raw) {
        set({ snapshot: JSON.parse(raw) as SetupSnapshot });
      }
    } catch {}
  },

  detectAll: async () => {
    set({ checking: true, error: null });
    try {
      const snapshot = await invokeCommand<SetupSnapshot>(
        'setup_detect_all',
        undefined,
        { timeoutMs: 180_000, source: 'setup', title: 'Environment detection failed' }
      );
      localStorage.setItem('ctrl-cc-setup-snapshot', JSON.stringify(snapshot));
      set({ snapshot, checking: false, error: null, lastCheckedAt: new Date().toISOString() });
      return snapshot;
    } catch (err) {
      const msg = String(err);
      set({ checking: false, error: msg, lastCheckedAt: new Date().toISOString() });
      throw err;
    }
  },

  detectAllSafe: async () => {
    try { return await get().detectAll(); }
    catch { return null; }
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
    unlisteners.push(
      await listen<SetupTaskProgress>('setup://task-progress', (event) => {
        const p = event.payload;
        set((state) => ({
          tasks: { ...state.tasks, [p.taskId]: p },
        }));
      })
    );
    return () => unlisteners.forEach((fn) => fn());
  },
}));
