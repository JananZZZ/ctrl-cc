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
    const fontScale = Math.max(0.9, Math.min(1.25, parseFloat(localStorage.getItem('ctrl-cc-font-scale') || '1')));
    const language = (localStorage.getItem('ctrlcc_lang') as 'zh' | 'en') || 'zh';
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.setProperty('--cc-font-scale', String(fontScale));
    // v29: 通知 i18next 语言切换, 确保首次加载时语言生效
    try { import('../../i18n').then(m => { if (m.default.language !== language) m.default.changeLanguage(language); }).catch(() => {}); } catch {}
    set({ theme, fontScale, language, hydrated: true });
  },

  setTheme: (theme) => {
    localStorage.setItem('ctrl-cc-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    set({ theme });
  },

  setFontScale: (scale) => {
    const clamped = Math.max(0.9, Math.min(1.25, scale));
    localStorage.setItem('ctrl-cc-font-scale', String(clamped));
    document.documentElement.style.setProperty('--cc-font-scale', String(clamped));
    set({ fontScale: clamped });
  },

  setLanguage: (language) => {
    localStorage.setItem('ctrlcc_lang', language);
    try { import('../../i18n').then(m => { if (m.default.language !== language) m.default.changeLanguage(language); }).catch(() => {}); } catch {}
    set({ language });
  },
}));
