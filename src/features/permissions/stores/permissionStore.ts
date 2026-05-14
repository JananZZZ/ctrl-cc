import { create } from 'zustand';
import { invokeCommand } from '../../../services/invokeCommand';

export interface PermissionRule {
  id?: string;
  kind?: 'allow' | 'deny';
  pattern?: string;
  tool?: string;
  value?: string;
  createdAt?: string;
}

interface PermissionState {
  rules: PermissionRule[];
  loading: boolean;
  error: string | null;
  autoTrust: number;

  refresh: () => Promise<void>;
  setAutoTrust: (level: number) => Promise<void>;
  addAllowTool: (tool: string) => Promise<void>;
  addDenyPattern: (pattern: string) => Promise<void>;
  check: (tool: string, input?: unknown) => Promise<unknown>;
}

export const usePermissionStore = create<PermissionState>((set, get) => ({
  rules: [],
  loading: false,
  error: null,
  autoTrust: Number(localStorage.getItem('ctrl-cc-autoTrust') ?? 0),

  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const rules = await invokeCommand<PermissionRule[]>('list_permission_rules').catch(() => []);
      set({ rules, loading: false });
    } catch (error) {
      set({ error: String(error), loading: false });
    }
  },

  setAutoTrust: async (level) => {
    localStorage.setItem('ctrl-cc-autoTrust', String(level));
    set({ autoTrust: level });
    await invokeCommand('set_auto_trust_level', { level }).catch(() => {});
  },

  addAllowTool: async (tool) => {
    if (!tool.trim()) return;
    await invokeCommand('add_allow_tool', { tool: tool.trim() });
    await get().refresh();
  },

  addDenyPattern: async (pattern) => {
    if (!pattern.trim()) return;
    await invokeCommand('add_deny_pattern', { pattern: pattern.trim() });
    await get().refresh();
  },

  check: async (tool, input) => {
    return invokeCommand('check_permission', { tool, input: input ?? null });
  },
}));
