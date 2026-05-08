import { create } from 'zustand';
import type { SurfaceId } from '../types';

interface SurfaceState {
  activeSurface: SurfaceId;
  navigateTo: (surface: SurfaceId) => void;
}

export const useSurfaceStore = create<SurfaceState>((set) => ({
  activeSurface: 'console',
  navigateTo: (surface) => set({ activeSurface: surface }),
}));
