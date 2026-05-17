import { create } from 'zustand';
import i18n from '../../i18n';

export type CtrlCcTheme = 'light' | 'dark' | 'pale-blue' | 'warm-sand';
export type CtrlCcLanguage = 'zh' | 'en';

interface AppearanceState {
  theme: CtrlCcTheme;
  fontScale: number;
  language: CtrlCcLanguage;
  hydrated: boolean;
  hydrate: () => void;
  setTheme: (theme: CtrlCcTheme) => void;
  setFontScale: (scale: number) => void;
  setLanguage: (lang: CtrlCcLanguage) => void;
}

function applyTheme(theme: CtrlCcTheme) {
  document.documentElement.dataset.theme = theme;
}

function applyFontScale(scale: number) {
  const safe = Math.max(0.9, Math.min(1.25, scale));
  document.documentElement.style.setProperty('--cc-user-font-scale', String(safe));
}

export const useAppearanceStore = create<AppearanceState>((set) => ({
  theme: 'light', // v29: default is light, not warm-sand
  fontScale: 1,
  language: 'zh',
  hydrated: false,

  hydrate: () => {
    const theme = (localStorage.getItem('ctrl-cc-theme') as CtrlCcTheme) || 'light';
    const fontScale = Math.max(0.9, Math.min(1.25, parseFloat(localStorage.getItem('ctrl-cc-font-scale') || '1')));
    const language = (localStorage.getItem('ctrlcc_lang') as CtrlCcLanguage) || 'zh';
    applyTheme(theme);
    applyFontScale(fontScale);
    if (i18n.language !== language) {
      void i18n.changeLanguage(language);
    }
    set({ theme, fontScale, language, hydrated: true });
  },

  setTheme: (theme) => {
    localStorage.setItem('ctrl-cc-theme', theme);
    applyTheme(theme);
    set({ theme });
  },

  setFontScale: (scale) => {
    const clamped = Math.max(0.9, Math.min(1.25, scale));
    localStorage.setItem('ctrl-cc-font-scale', String(clamped));
    applyFontScale(clamped);
    set({ fontScale: clamped });
  },

  setLanguage: (language) => {
    localStorage.setItem('ctrlcc_lang', language);
    void i18n.changeLanguage(language);
    set({ language });
  },
}));
