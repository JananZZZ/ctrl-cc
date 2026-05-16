import { create } from 'zustand';

export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';
export type ErrorSource = 'pty' | 'db' | 'ipc' | 'claude-cli' | 'fs' | 'git' | 'settings' | 'session' | 'project' | 'setup' | 'unknown';

export interface ErrorEntry {
  id: string;
  severity: ErrorSeverity;
  source: ErrorSource;
  title: string;
  detail?: string;
  rawError?: string;
  timestamp: string;
  dismissed: boolean;
}

interface ErrorState {
  errors: ErrorEntry[];
  addError: (entry: Omit<ErrorEntry, 'id' | 'timestamp' | 'dismissed'> & { id?: string; timestamp?: string; dismissed?: boolean }) => void;
  dismissError: (id: string) => void;
  clearAll: () => void;
  getUnresolved: () => ErrorEntry[];
  getBySource: (source: ErrorSource) => ErrorEntry[];
}

export const useErrorStore = create<ErrorState>((set, get) => ({
  errors: [],
  addError: (entry) => {
    const e: ErrorEntry = {
      id: entry.id || crypto.randomUUID(),
      severity: entry.severity,
      source: entry.source,
      title: entry.title,
      detail: entry.detail,
      rawError: entry.rawError,
      timestamp: entry.timestamp || new Date().toISOString(),
      dismissed: entry.dismissed ?? false,
    };
    set((s) => {
      // Dedup: skip if same title+source already exists (idempotent guard)
      const dup = s.errors.some((ex) => ex.title === e.title && ex.source === e.source && !ex.dismissed);
      if (dup) return s;
      return { errors: [e, ...s.errors].slice(0, 200) };
    });
    // Auto-save to SQLite
    import('../services/invokeCommand').then(({ invokeCommand }) => {
      invokeCommand('save_error_log_to_db', { entry: e }).catch((err) => console.warn('save_error_log failed:', err));
    });
  },
  dismissError: (id) => set((s) => ({
    errors: s.errors.map((e) => (e.id === id ? { ...e, dismissed: true } : e)),
  })),
  clearAll: () => set({ errors: [] }),
  getUnresolved: () => get().errors.filter((e) => !e.dismissed),
  getBySource: (source) => get().errors.filter((e) => e.source === source),
}));
