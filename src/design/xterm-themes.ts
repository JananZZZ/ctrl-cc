import type { CtrlCcTheme } from './theme-types';

interface XtermTheme {
  background: string;
  foreground: string;
  cursor: string;
  selectionBackground: string;
}

export const XTERM_THEMES: Record<CtrlCcTheme, XtermTheme> = {
  "warm-sand": {
    background: "#FFFEFA",
    foreground: "#1E1B15",
    cursor: "#B88352",
    selectionBackground: "#F5E4D3",
  },
  light: {
    background: "#FBFCFE",
    foreground: "#1A1A18",
    cursor: "#3B82F6",
    selectionBackground: "#E8F0FE",
  },
  "pale-blue": {
    background: "#F5F9FD",
    foreground: "#1A2338",
    cursor: "#4F8CDF",
    selectionBackground: "#E4EEFB",
  },
  dark: {
    background: "#0F0F14",
    foreground: "#ECECEE",
    cursor: "#D4A574",
    selectionBackground: "#22222E",
  },
};
