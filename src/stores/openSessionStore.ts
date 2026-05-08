import { create } from 'zustand';
import type { OpenSessionTab } from '../types';

interface OpenSessionState {
  tabs: OpenSessionTab[];
  activeTabId: string | null;
  openSession: (tab: OpenSessionTab) => void;
  closeTab: (sessionId: string) => void;
  setActiveTab: (sessionId: string | null) => void;
  pinTab: (sessionId: string) => void;
}

export const useOpenSessionStore = create<OpenSessionState>((set) => ({
  tabs: [],
  activeTabId: null,
  openSession: (tab) =>
    set((s) => {
      const exists = s.tabs.find((t) => t.sessionId === tab.sessionId);
      if (exists) return { activeTabId: tab.sessionId };
      return { tabs: [...s.tabs, tab], activeTabId: tab.sessionId };
    }),
  closeTab: (sessionId) =>
    set((s) => {
      const remaining = s.tabs.filter((t) => t.sessionId !== sessionId);
      return {
        tabs: remaining,
        activeTabId: s.activeTabId === sessionId ? (remaining[0]?.sessionId ?? null) : s.activeTabId,
      };
    }),
  setActiveTab: (id) => set({ activeTabId: id }),
  pinTab: (sessionId) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.sessionId === sessionId ? { ...t, isPinned: !t.isPinned } : t)),
    })),
}));
