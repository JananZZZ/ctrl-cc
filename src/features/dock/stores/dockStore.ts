// v10.0 DockStore — Zustand store for AI Dock state
import { create } from 'zustand';
import type { AIDockSnapshot } from '../../app-core/snapshots/dockSnapshot';
import type { DockMode } from '../services/dockActionBridge';

interface DockState {
  mode: DockMode;
  visible: boolean;
  snapshot: AIDockSnapshot | null;
  lastUpdated: string | null;

  setMode: (mode: DockMode) => void;
  setVisible: (visible: boolean) => void;
  toggleVisible: () => void;
  updateSnapshot: (snapshot: AIDockSnapshot) => void;
}

export const useDockStore = create<DockState>((set, get) => ({
  mode: 'calm',
  visible: false,
  snapshot: null,
  lastUpdated: null,

  setMode: (mode) => { if (get().mode !== mode) set({ mode }); },
  setVisible: (visible) => { if (get().visible !== visible) set({ visible }); },
  toggleVisible: () => set({ visible: !get().visible }),
  updateSnapshot: (snapshot) => {
    const prev = get().snapshot;
    if (prev && prev.generatedAt === snapshot.generatedAt) return;
    set({ snapshot, lastUpdated: new Date().toISOString() });
  },
}));
