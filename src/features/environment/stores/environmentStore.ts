import { create } from 'zustand';
import { invokeCommand } from '../../../services/invokeCommand';

export interface Capability {
  version: string | null;
  exists: boolean;
  authStatus: string | null;
  supportsStreamJson: boolean;
  supportsMCP?: boolean;
  supportsAgents?: boolean;
  checkedAt: string;
  errors: string[];
}

export interface ClaudeJsCandidate {
  path: string;
  exists: boolean;
  source: string;
}

export interface LaunchPlan {
  id: string;
  label?: string;
  program: string;
  argsPrefix?: string[];
  args_prefix?: string[];
  canaryOk?: boolean;
  versionOk?: boolean;
  versionText?: string | null;
  selected?: boolean;
  error?: string | null;
}

export interface EnvironmentSnapshot {
  capability: Capability | null;
  launchPlans: LaunchPlan[];
  jsCandidates: ClaudeJsCandidate[];
  generatedAt: string;
  source: 'cache' | 'manual-refresh' | 'unknown';
}

interface EnvironmentState {
  snapshot: EnvironmentSnapshot | null;
  loading: boolean;
  error: string | null;

  loadCached: () => void;
  refresh: () => Promise<void>;
  clear: () => void;
}

const CACHE_KEY = 'ctrl-cc-environment-snapshot';

function readCache(): EnvironmentSnapshot | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as EnvironmentSnapshot;
  } catch {
    return null;
  }
}

function writeCache(snapshot: EnvironmentSnapshot) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(snapshot));
  localStorage.setItem('ctrl-cc-capability', JSON.stringify({
    data: snapshot.capability,
    checkedAt: snapshot.generatedAt,
  }));
}

export const useEnvironmentStore = create<EnvironmentState>((set) => ({
  snapshot: readCache(),
  loading: false,
  error: null,

  loadCached: () => {
    const cached = readCache();
    set({ snapshot: cached, loading: false, error: null });
  },

  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const [capability, discovery, jsCandidates] = await Promise.all([
        invokeCommand<Capability>('claude_check_capability').catch((err) => ({
          version: null,
          exists: false,
          authStatus: null,
          supportsStreamJson: false,
          supportsMCP: false,
          supportsAgents: false,
          checkedAt: new Date().toISOString(),
          errors: [String(err)],
        })),
        invokeCommand<{ plans?: LaunchPlan[] }>('runtime_discover_claude_v2').catch(() => ({ plans: [] })),
        invokeCommand<ClaudeJsCandidate[]>('runtime_find_claude_js_candidates').catch(() => []),
      ]);

      const snapshot: EnvironmentSnapshot = {
        capability,
        launchPlans: discovery.plans ?? [],
        jsCandidates,
        generatedAt: new Date().toISOString(),
        source: 'manual-refresh',
      };

      writeCache(snapshot);
      set({ snapshot, loading: false, error: null });
    } catch (error) {
      set({ loading: false, error: String(error) });
    }
  },

  clear: () => {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem('ctrl-cc-capability');
    set({ snapshot: null, loading: false, error: null });
  },
}));
