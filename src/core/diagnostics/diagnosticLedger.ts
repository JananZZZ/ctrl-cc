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
