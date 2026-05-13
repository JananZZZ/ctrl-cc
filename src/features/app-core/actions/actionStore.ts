// v10.0 ActionStore — bounded action journal with idempotent writes
// Max 200 actions. Every write is guarded against no-op updates.
// Query methods use get() for zero-rerender reads.

import { create } from 'zustand';
import type { CtrlCcAction } from './actionTypes';

const MAX_ACTIONS = 200;

type ActionPatch = Partial<Pick<CtrlCcAction, 'status' | 'error'>>;

export interface ActionState {
  /** Bounded journal — newest first, max 200 entries. */
  actions: CtrlCcAction[];

  /** Push an action onto the journal. No-op if an action with the same id already exists.
   *  Automatically trims to MAX_ACTIONS. */
  addAction: (action: CtrlCcAction) => void;

  /** Update an existing action's status and/or error. No-op if nothing changed. */
  patchAction: (id: string, patch: ActionPatch) => void;

  /** Filter actions originating from a specific surface. */
  getActionsBySurface: (surface: CtrlCcAction['sourceSurface']) => CtrlCcAction[];

  /** Filter actions targeting a specific UI session. */
  getActionsBySession: (uiSessionId: string) => CtrlCcAction[];

  /** Return the most recent N actions. Default 20. */
  getRecentActions: (limit?: number) => CtrlCcAction[];
}

export const useActionStore = create<ActionState>((set, get) => ({
  actions: [],

  addAction: (action) =>
    set((s) => {
      // Idempotent guard — skip if this action id already exists in the journal
      if (s.actions.some((a) => a.id === action.id)) return s;
      return { actions: [action, ...s.actions].slice(0, MAX_ACTIONS) };
    }),

  patchAction: (id, patch) =>
    set((s) => {
      const existing = s.actions.find((a) => a.id === id);
      if (!existing) return s;

      // Idempotent guard — skip update if no values actually changed
      let changed = false;
      if (patch.status !== undefined && existing.status !== patch.status) {
        changed = true;
      }
      if (patch.error !== undefined && existing.error !== patch.error) {
        changed = true;
      }
      if (!changed) return s;

      return {
        actions: s.actions.map((a) =>
          a.id === id
            ? { ...a, ...patch, updatedAt: new Date().toISOString() }
            : a,
        ),
      };
    }),

  getActionsBySurface: (surface) =>
    get().actions.filter((a) => a.sourceSurface === surface),

  getActionsBySession: (uiSessionId) =>
    get().actions.filter((a) => a.target.uiSessionId === uiSessionId),

  getRecentActions: (limit = 20) =>
    get().actions.slice(0, limit),
}));
