import type { CtrlCcTheme, ThemeMeta } from './theme-types';

export const CTRL_CC_THEMES: ThemeMeta[] = [
  {
    id: "warm-sand",
    label: "暖沙 Claude",
    labelEn: "Warm Sand",
    description: "温暖、亲切、高级纸张感 — Ctrl-CC 品牌默认主题",
    descriptionEn: "Warm, inviting, premium paper feel — the Ctrl-CC signature default",
    previewColors: { bg: "#FAF8F2", surface: "#F3ECE0", brand: "#B88352", text: "#736B5E" },
  },
  {
    id: "light",
    label: "浅色",
    labelEn: "Light",
    description: "干净、通透、轻盈 — 适合日常办公环境",
    descriptionEn: "Clean, airy, lightweight — ideal for everyday office use",
    previewColors: { bg: "#F9F9F8", surface: "#F5F5F3", brand: "#2563EB", text: "#6E6D68" },
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

export const DEFAULT_THEME: CtrlCcTheme = "warm-sand";

export const THEME_LABELS: Record<CtrlCcTheme, string> = {
  "warm-sand": "暖沙 Claude",
  light: "浅色",
  "pale-blue": "浅蓝",
  dark: "深色",
};
