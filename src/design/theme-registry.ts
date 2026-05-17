import type { CtrlCcTheme, ThemeMeta } from './theme-types';

export const CTRL_CC_THEMES: ThemeMeta[] = [
  {
    id: "warm-sand",
    label: "暖沙 Claude",
    labelEn: "Warm Sand",
    description: "温暖、亲切、高级纸张感",
    descriptionEn: "Warm, inviting, premium paper feel",
    previewColors: { bg: "#FAF6EF", surface: "#F4E9DA", brand: "#B77945", text: "#6E6254" },
  },
  {
    id: "light",
    label: "浅色",
    labelEn: "Light",
    description: "清爽、明亮 — Ctrl-CC 默认主题，适合日常办公",
    descriptionEn: "Clean, bright — the Ctrl-CC default, ideal for everyday use",
    previewColors: { bg: "#F7F8FA", surface: "#F3F5F8", brand: "#2563EB", text: "#5B6472" },
  },
  {
    id: "pale-blue",
    label: "浅蓝",
    labelEn: "Pale Blue",
    description: "清澈、理性、科技 — 适合仪表盘和专业监视器",
    descriptionEn: "Crisp, rational, technical — perfect for dashboards and monitoring",
    previewColors: { bg: "#F4F7FB", surface: "#EEF3FA", brand: "#3670C4", text: "#586884" },
  },
  {
    id: "dark",
    label: "深色",
    labelEn: "Dark",
    description: "沉稳、专注、低光 — 适合夜间深度工作",
    descriptionEn: "Focused, low-glare, professional — designed for night-time deep work",
    previewColors: { bg: "#0F0F14", surface: "#22222E", brand: "#E0B880", text: "#9C9CA4" },
  },
];

export const DEFAULT_THEME: CtrlCcTheme = "light";

export const THEME_LABELS: Record<CtrlCcTheme, string> = {
  "warm-sand": "暖沙 Claude",
  light: "浅色",
  "pale-blue": "浅蓝",
  dark: "深色",
};
