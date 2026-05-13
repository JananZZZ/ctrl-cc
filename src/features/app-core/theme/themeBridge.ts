// v10.0 ThemeBridge — cross-surface theme synchronization
// Ensures all surfaces (including independent windows) follow the active theme.

export type CtrlCcTheme = 'warm-sand' | 'light' | 'pale-blue' | 'dark';

const THEME_STORAGE_KEY = 'ctrlcc:active-theme';
const THEME_CHANGE_EVENT = 'ctrlcc:theme-changed';

export const ThemeBridge = {
  getActiveTheme(): CtrlCcTheme {
    if (typeof document === 'undefined') return 'dark';
    const stored = localStorage.getItem(THEME_STORAGE_KEY) as CtrlCcTheme | null;
    if (stored && ['warm-sand', 'light', 'pale-blue', 'dark'].includes(stored)) {
      return stored;
    }
    return (document.documentElement.dataset.theme as CtrlCcTheme) || 'dark';
  },

  setActiveTheme(theme: CtrlCcTheme): void {
    if (typeof document === 'undefined') return;
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: { theme } }));
  },

  onThemeChange(callback: (theme: CtrlCcTheme) => void): () => void {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { theme: CtrlCcTheme } | undefined;
      if (detail?.theme) callback(detail.theme);
    };
    window.addEventListener(THEME_CHANGE_EVENT, handler);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, handler);
  },

  getThemeTokens(): Record<string, string> {
    if (typeof document === 'undefined') return {};
    const styles = getComputedStyle(document.documentElement);
    const tokens = [
      '--cc-bg', '--cc-surface', '--cc-surface-solid', '--cc-surface-muted',
      '--cc-border', '--cc-border-soft', '--cc-text', '--cc-text-muted', '--cc-text-soft',
      '--cc-brand', '--cc-brand-soft', '--cc-green', '--cc-green-soft',
      '--cc-amber', '--cc-amber-soft', '--cc-red', '--cc-red-soft',
      '--cc-blue', '--cc-blue-soft', '--cc-shadow-floating',
      '--cc-font-sans', '--cc-font-mono',
      '--cc-radius-sm', '--cc-radius-md', '--cc-radius-lg',
      '--cc-space-xs', '--cc-space-sm', '--cc-space-md', '--cc-space-lg',
    ];
    const result: Record<string, string> = {};
    for (const t of tokens) {
      result[t] = styles.getPropertyValue(t).trim();
    }
    return result;
  },
};
