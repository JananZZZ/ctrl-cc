import { create } from 'zustand';
import type { RuntimeSession, RuntimeEvent } from '../types/runtimeTypes';

interface RuntimeState {
  sessions: Record<string, RuntimeSession>;
  activeSessionId: string | null;
  ptyTail: Record<string, string>;
  events: RuntimeEvent[];

  addSession: (session: RuntimeSession) => void;
  patchSession: (sessionId: string, patch: Partial<RuntimeSession>) => void;
  setActiveSession: (sessionId: string) => void;
  appendPtyTail: (sessionId: string, chunk: string) => void;
  addEvent: (event: { type: string; sessionId?: string; message: string; level?: 'debug' | 'info' | 'warning' | 'error' }) => void;
}

export const useRuntimeStore = create<RuntimeState>((set) => ({
  sessions: {},
  activeSessionId: null,
  ptyTail: {},
  events: [],

  addSession: (session) =>
    set((state) => ({
      sessions: { ...state.sessions, [session.id]: session },
      activeSessionId: session.id,
    })),

  patchSession: (sessionId, patch) =>
    set((state) => {
      const old = state.sessions[sessionId];
      if (!old) return state;
      // Idempotent guard: skip update if no values actually changed
      const keys = Object.keys(patch) as Array<keyof typeof patch>;
      let changed = false;
      for (const k of keys) {
        if (patch[k] !== undefined && (old as unknown as Record<string, unknown>)[k as string] !== patch[k]) {
          changed = true; break;
        }
      }
      if (!changed) return state;
      return {
        sessions: {
          ...state.sessions,
          [sessionId]: { ...old, ...patch, updatedAt: new Date().toISOString() },
        },
      };
    }),

  setActiveSession: (sessionId) =>
    set((state) => {
      if (state.activeSessionId === sessionId) return state;
      return { activeSessionId: sessionId };
    }),

  appendPtyTail: (sessionId, chunk) =>
    set((state) => {
      const prev = state.ptyTail[sessionId] ?? '';
      const next = (prev + chunk).slice(-32768);
      return { ptyTail: { ...state.ptyTail, [sessionId]: next } };
    }),

  addEvent: (event) =>
    set((state) => ({
      events: [
        { id: crypto.randomUUID(), ts: new Date().toISOString(), level: 'info' as const, ...event },
        ...state.events,
      ].slice(0, 200),
    })),
}));
