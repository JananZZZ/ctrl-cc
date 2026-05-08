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
  setSessions: (sessions) => set({ sessions }),
  addSession: (session) => set((s) => ({ sessions: [...s.sessions, session] })),
  updateSession: (id, patch) =>
    set((s) => ({
      sessions: s.sessions.map((ss) => (ss.id === id ? { ...ss, ...patch } : ss)),
    })),
  removeSession: (id) => set((s) => ({ sessions: s.sessions.filter((ss) => ss.id !== id) })),
  getByProject: (projectId) => get().sessions.filter((s) => s.projectId === projectId),
}));
