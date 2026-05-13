// NavigationStore — Zustand store for surface navigation state
// Stores current surface, navigation stack (max 50), and last navigation intent.
// All actions are idempotent per React Stability rules.

import { create } from 'zustand';
import type { SurfaceTarget, NavigationContext, NavigationIntent } from './navigationTypes';
import { createNavigationId, NAVIGATION_STACK_MAX } from './navigationTypes';

interface NavigationState {
  /** Currently active surface */
  currentSurface: SurfaceTarget;
  /** Ordered history of navigations (most recent first) */
  navigationStack: NavigationIntent[];
  /** The most recent navigation intent, or null if no navigation has occurred */
  lastNavigation: NavigationIntent | null;

  /**
   * Navigate to a target surface with optional context.
   * Records a NavigationIntent in the stack and updates currentSurface.
   * Idempotent: no-op if navigating to the same surface with identical context.
   */
  navigateTo: (target: SurfaceTarget, context?: NavigationContext) => void;

  /**
   * Navigate back to the previous surface in the stack.
   * Pops the current intent and restores the one beneath it.
   * No-op if the stack has fewer than 2 entries.
   */
  goBack: () => void;

  /** Clear the entire navigation stack, resetting to the console surface */
  clearStack: () => void;
}

export const useNavigationStore = create<NavigationState>((set, get) => ({
  currentSurface: 'console',
  navigationStack: [],
  lastNavigation: null,

  navigateTo: (target, context) => {
    set((state) => {
      // Idempotent guard: no-op if same surface and identical context
      const sameTarget = state.currentSurface === target;
      const sameContext = sameTarget
        && JSON.stringify(state.lastNavigation?.context) === JSON.stringify(context);
      if (sameTarget && sameContext) return state;

      const source = state.currentSurface;
      const intent: NavigationIntent = {
        id: createNavigationId(),
        target,
        context,
        source,
        timestamp: new Date().toISOString(),
      };

      const newStack = [intent, ...state.navigationStack].slice(0, NAVIGATION_STACK_MAX);

      return {
        currentSurface: target,
        navigationStack: newStack,
        lastNavigation: intent,
      };
    });
  },

  goBack: () => {
    const { navigationStack } = get();
    // Need at least 2 entries to go back (current + previous)
    if (navigationStack.length < 2) return;

    // Remove the current (top) entry and use the next one
    const [, previous, ...rest] = navigationStack;

    set(() => ({
      currentSurface: previous.target,
      navigationStack: [previous, ...rest],
      lastNavigation: previous,
    }));
  },

  clearStack: () =>
    set((state) => {
      if (state.navigationStack.length === 0 && state.currentSurface === 'console') return state;
      return {
        currentSurface: 'console',
        navigationStack: [],
        lastNavigation: null,
      };
    }),
}));
