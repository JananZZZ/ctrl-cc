// SurfaceStore — React #185 fix: navigateTo idempotent (no-op when same surface)
import { create } from 'zustand';
import type { SurfaceId } from '../types';

interface SurfaceState {
  activeSurface: SurfaceId;
  navigateTo: (surface: SurfaceId) => void;
}

export const useSurfaceStore = create<SurfaceState>((set) => ({
  activeSurface: 'console',
  navigateTo: (surface) =>
    set((state) => {
      if (state.activeSurface === surface) return state; // idempotent guard
      return { activeSurface: surface };
    }),
}));
