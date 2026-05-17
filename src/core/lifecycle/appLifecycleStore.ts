import { create } from 'zustand';

type LifecyclePhase = 'init' | 'loading' | 'ready' | 'error';

interface AppLifecycleState {
  phase: LifecyclePhase;
  bootError: string | null;
  setPhase: (phase: LifecyclePhase) => void;
  setBootError: (error: string | null) => void;
}

/** v29: 应用生命周期状态 — 统一管理启动阶段 */
export const useAppLifecycleStore = create<AppLifecycleState>((set) => ({
  phase: 'init',
  bootError: null,
  setPhase: (phase) => set({ phase }),
  setBootError: (bootError) => set({ bootError, phase: bootError ? 'error' : 'ready' }),
}));
