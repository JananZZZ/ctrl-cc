import { create } from 'zustand';

type ThemeId = 'light' | 'dark' | 'pale-blue' | 'warm-sand';

interface AppearanceState {
  theme: ThemeId;
  fontScale: number;
  language: 'zh' | 'en';
  hydrated: boolean;
  hydrate: () => void;
  setTheme: (theme: ThemeId) => void;
  setFontScale: (scale: number) => void;
  setLanguage: (lang: 'zh' | 'en') => void;
}

export const useAppearanceStore = create<AppearanceState>((set) => ({
  theme: 'light', // v29: default is light, not warm-sand
  fontScale: 1,
  language: 'zh',
  hydrated: false,

  hydrate: () => {
    const theme = (localStorage.getItem('ctrl-cc-theme') as ThemeId) || 'light';
    const fontScale = parseFloat(localStorage.getItem('ctrl-cc-font-scale') || '1');
    const language = (localStorage.getItem('ctrlcc_lang') as 'zh' | 'en') || 'zh';
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.setProperty('--cc-font-scale', String(fontScale));
    set({ theme, fontScale, language, hydrated: true });
  },

  setTheme: (theme) => {
    localStorage.setItem('ctrl-cc-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    set({ theme });
  },

  setFontScale: (scale) => {
    localStorage.setItem('ctrl-cc-font-scale', String(scale));
    document.documentElement.style.setProperty('--cc-font-scale', String(scale));
    set({ fontScale: scale });
  },

  setLanguage: (language) => {
    localStorage.setItem('ctrlcc_lang', language);
    set({ language });
  },
}));
