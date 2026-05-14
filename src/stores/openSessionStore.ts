// OpenSessionStore — React #185 fix: openSessionTab idempotent (no-op when same tab already active)
import { create } from 'zustand';
import type { OpenSessionTab } from '../types';

interface OpenSessionState {
  tabs: OpenSessionTab[];
  activeTabId: string | null;
  openSession: (tab: OpenSessionTab) => void;
  closeTab: (sessionId: string) => void;
  setActiveTab: (sessionId: string | null) => void;
  pinTab: (sessionId: string) => void;
  patchTab: (sessionId: string, patch: Partial<OpenSessionTab>) => void;
}

export const useOpenSessionStore = create<OpenSessionState>((set) => ({
  tabs: [],
  activeTabId: null,
  openSession: (tab) =>
    set((state) => {
      // Idempotent guard: if same tab already active, return unchanged state
      const existing = state.tabs.find((t) => t.sessionId === tab.sessionId);
      const alreadyActive = existing && state.activeTabId === tab.sessionId;
      if (alreadyActive) return state;

      if (existing) {
        return {
          activeTabId: tab.sessionId,
          tabs: state.tabs.map((t) => ({ ...t, active: t.sessionId === tab.sessionId })),
        };
      }
      return {
        tabs: [...state.tabs.map((t) => ({ ...t, active: false })), { ...tab, active: true }],
        activeTabId: tab.sessionId,
      };
    }),
  closeTab: (sessionId) =>
    set((s) => {
      const remaining = s.tabs.filter((t) => t.sessionId !== sessionId);
      return {
        tabs: remaining,
        activeTabId: s.activeTabId === sessionId ? (remaining[0]?.sessionId ?? null) : s.activeTabId,
      };
    }),
  setActiveTab: (id) =>
    set((state) => {
      if (state.activeTabId === id) return state; // idempotent guard
      return { activeTabId: id };
    }),
  pinTab: (sessionId) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.sessionId === sessionId ? { ...t, isPinned: !t.isPinned } : t)),
    })),
  patchTab: (sessionId, patch) =>
    set((state) => ({
      tabs: state.tabs.map((t) => (t.sessionId === sessionId ? { ...t, ...patch } : t)),
    })),
}));
