// SurfaceStore — React #185 fix: navigateTo idempotent (no-op when same surface)
import { create } from 'zustand';
import type { SurfaceId } from '../types';
import { useTaskStore } from '../core/tasks/taskStore';

interface SurfaceState {
  activeSurface: SurfaceId;
  pendingSurface: SurfaceId | null;
  guardOpen: boolean;
  navigateTo: (surface: SurfaceId) => void;
  /** v29: 检查阻塞任务后再导航，有阻塞任务时打开NavigationGuard */
  requestNavigate: (surface: SurfaceId) => void;
  setGuardOpen: (open: boolean) => void;
  confirmNavigate: () => void;
}

export const useSurfaceStore = create<SurfaceState>((set, get) => ({
  activeSurface: 'console',
  pendingSurface: null,
  guardOpen: false,
  navigateTo: (surface) =>
    set((state) => {
      if (state.activeSurface === surface) return state; // idempotent guard
      return { activeSurface: surface, pendingSurface: null, guardOpen: false };
    }),
  requestNavigate: (surface) => {
    const blocking = useTaskStore.getState().blockingTasks();
    if (blocking.length > 0) {
      set({ pendingSurface: surface, guardOpen: true });
      return;
    }
    get().navigateTo(surface);
  },
  setGuardOpen: (open) => set({ guardOpen: open }),
  confirmNavigate: () => {
    const { pendingSurface } = get();
    if (pendingSurface) {
      get().navigateTo(pendingSurface);
    } else {
      set({ guardOpen: false });
    }
  },
}));
