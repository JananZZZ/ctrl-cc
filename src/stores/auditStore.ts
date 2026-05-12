import { create } from 'zustand';

export interface AuditEntry {
  id: string;
  sessionId: string;
  timestamp: string;
  level: 'info' | 'warning' | 'critical';
  category: 'tool' | 'permission' | 'file' | 'git' | 'system';
  message: string;
  details?: string;
}

interface AuditState {
  entries: AuditEntry[];
  addEntry: (entry: AuditEntry) => void;
  addEntries: (entries: AuditEntry[]) => void;
  getBySession: (sessionId: string) => AuditEntry[];
  getRecent: (limit?: number) => AuditEntry[];
  clear: () => void;
}

export const useAuditStore = create<AuditState>((set, get) => ({
  entries: [],
  addEntry: (entry) => set((s) => ({ entries: [...s.entries, entry].slice(-1000) })),
  addEntries: (entries) => set((s) => ({ entries: [...s.entries, ...entries].slice(-1000) })),
  getBySession: (sessionId) => get().entries.filter((e) => e.sessionId === sessionId),
  getRecent: (limit = 50) => get().entries.slice(-limit).reverse(),
  clear: () => set({ entries: [] }),
}));
