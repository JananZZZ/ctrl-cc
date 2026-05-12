import { create } from 'zustand';
import type { Session } from '../types';

interface SessionState {
  sessions: Session[];
  setSessions: (sessions: Session[]) => void;
  addSession: (session: Session) => void;
  updateSession: (id: string, patch: Partial<Session>) => void;
  removeSession: (id: string) => void;
  getByProject: (projectId: string) => Session[];
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  setSessions: (sessions) =>
    set((state) => {
      if (state.sessions.length === sessions.length && state.sessions.every((s, i) => s.id === sessions[i]?.id && s.updatedAt === sessions[i]?.updatedAt)) return state;
      return { sessions };
    }),
  addSession: (session) =>
    set((s) => { if (s.sessions.some((ss) => ss.id === session.id)) return s; return { sessions: [...s.sessions, session] }; }),
  updateSession: (id, patch) =>
    set((s) => {
      const old = s.sessions.find((ss) => ss.id === id);
      if (!old) return s;
      // Idempotent guard: skip DB write if no values changed
      let changed = false;
      for (const k of Object.keys(patch) as Array<keyof typeof patch>) {
        if (patch[k] !== undefined && old[k] !== patch[k]) { changed = true; break; }
      }
      if (!changed) return s;
      const sessions = s.sessions.map((ss) => (ss.id === id ? { ...ss, ...patch } : ss));
      const updated = sessions.find((ss) => ss.id === id);
      if (updated) {
        import('../services/invokeCommand').then(({ invokeCommand }) => {
          invokeCommand('save_session_to_db', { session: updated }).catch((err) => console.warn('save_session failed:', err));
        });
      }
      return { sessions };
    }),
  removeSession: (id) => {
    import('../services/invokeCommand').then(({ invokeCommand }) => {
      invokeCommand('delete_session_from_db', { id }).catch((err) => console.warn('delete_session failed:', err));
    });
    set((s) => ({ sessions: s.sessions.filter((ss) => ss.id !== id) }));
  },
  getByProject: (projectId) => get().sessions.filter((s) => s.projectId === projectId),
}));
