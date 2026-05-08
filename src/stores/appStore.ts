import { create } from 'zustand';
import type { AppSettings } from '../types';

interface AppState {
  booted: boolean;
  settings: AppSettings;
  setBooted: (v: boolean) => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
}

const defaultSettings: AppSettings = {
  language: 'zh-CN',
  theme: 'light',
  startupView: 'console',
  defaultModel: 'sonnet',
  defaultEffort: 'medium',
  defaultPermissionMode: 'default',
  defaultRuntimeMode: 'pty-interactive',
  autoTrustLevel: 0,
  firstRunCompleted: false,
  terminalFontSize: 13,
  terminalFontFamily: 'var(--cc-font-mono)',
  rawLogRetentionDays: 30,
};

export const useAppStore = create<AppState>((set) => ({
  booted: false,
  settings: defaultSettings,
  setBooted: (v) => set({ booted: v }),
  updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
}));
