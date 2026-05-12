// WorkspaceStore — React #185 fix: all actions idempotent
import { create } from 'zustand';

export interface WorkspaceTab {
  id: string; sessionId: string; projectId: string; title: string; active: boolean;
}

interface WorkspaceState {
  tabs: WorkspaceTab[];
  activeSessionId: string | null;
  composerDrafts: Record<string, string>;
  openSessionTab: (tab: Omit<WorkspaceTab, 'active'> & { active?: boolean }) => void;
  focusSession: (sessionId: string) => void;
  setComposerDraft: (sessionId: string, value: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  tabs: [], activeSessionId: null, composerDrafts: {},

  openSessionTab: (tab) =>
    set((state) => {
      const existing = state.tabs.find((t) => t.sessionId === tab.sessionId);
      const alreadyActive = existing && state.activeSessionId === tab.sessionId;
      if (alreadyActive) return state; // idempotent guard

      if (existing) {
        return {
          activeSessionId: tab.sessionId,
          tabs: state.tabs.map((t) => ({ ...t, active: t.sessionId === tab.sessionId })),
        };
      }
      return {
        tabs: [...state.tabs.map((t) => ({ ...t, active: false })), { ...tab, active: true }],
        activeSessionId: tab.sessionId,
      };
    }),

  focusSession: (sessionId) =>
    set((state) => {
      if (state.activeSessionId === sessionId) return state; // idempotent guard
      return {
        tabs: state.tabs.map((t) => ({ ...t, active: t.sessionId === sessionId })),
        activeSessionId: sessionId,
      };
    }),

  setComposerDraft: (sessionId, value) =>
    set((state) => {
      if (state.composerDrafts[sessionId] === value) return state;
      return { composerDrafts: { ...state.composerDrafts, [sessionId]: value } };
    }),
}));
