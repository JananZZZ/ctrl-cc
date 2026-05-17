import { create } from 'zustand';

interface AppSettingsState {
  defaultViewMode: 'chat' | 'split' | 'terminal';
  defaultModel: 'sonnet' | 'opus' | 'haiku';
  defaultEffort: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  defaultPermMode: 'default' | 'plan' | 'acceptEdits' | 'auto' | 'dontAsk';
  aiDockMode: 'focus' | 'calm' | 'quiet' | 'disabled';
  githubHome: string;
  setDefaultViewMode: (mode: 'chat' | 'split' | 'terminal') => void;
  setDefaultModel: (model: 'sonnet' | 'opus' | 'haiku') => void;
  setDefaultEffort: (effort: 'low' | 'medium' | 'high' | 'xhigh' | 'max') => void;
  setDefaultPermMode: (mode: 'default' | 'plan' | 'acceptEdits' | 'auto' | 'dontAsk') => void;
  setAiDockMode: (mode: 'focus' | 'calm' | 'quiet' | 'disabled') => void;
  setGithubHome: (url: string) => void;
}

/** v29: 应用设置统一 Store — 不再各页面私自操作 localStorage */
export const useAppSettingsStore = create<AppSettingsState>((set) => ({
  defaultViewMode: (localStorage.getItem('ctrlcc.defaultViewMode') as 'chat' | 'split' | 'terminal') || 'chat',
  defaultModel: (localStorage.getItem('ctrl-cc-model') as 'sonnet' | 'opus' | 'haiku') || 'sonnet',
  defaultEffort: (localStorage.getItem('ctrl-cc-effort') as 'low' | 'medium' | 'high' | 'xhigh' | 'max') || 'medium',
  defaultPermMode: (localStorage.getItem('ctrl-cc-permMode') as 'default' | 'plan' | 'acceptEdits' | 'auto' | 'dontAsk') || 'default',
  aiDockMode: (localStorage.getItem('ctrlcc.aiDock.mode') as 'focus' | 'calm' | 'quiet' | 'disabled') || 'focus',
  githubHome: localStorage.getItem('ctrlcc.github.home') || 'https://github.com',
  setDefaultViewMode: (mode) => { localStorage.setItem('ctrlcc.defaultViewMode', mode); set({ defaultViewMode: mode }); },
  setDefaultModel: (model) => { localStorage.setItem('ctrl-cc-model', model); set({ defaultModel: model }); },
  setDefaultEffort: (effort) => { localStorage.setItem('ctrl-cc-effort', effort); set({ defaultEffort: effort }); },
  setDefaultPermMode: (mode) => { localStorage.setItem('ctrl-cc-permMode', mode); set({ defaultPermMode: mode }); },
  setAiDockMode: (mode) => { localStorage.setItem('ctrlcc.aiDock.mode', mode); set({ aiDockMode: mode }); },
  setGithubHome: (url) => { localStorage.setItem('ctrlcc.github.home', url); set({ githubHome: url }); },
}));
