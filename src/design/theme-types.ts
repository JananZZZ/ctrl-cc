export type CtrlCcTheme = "light" | "dark" | "pale-blue" | "warm-sand";

export interface ThemeMeta {
  id: CtrlCcTheme;
  label: string;
  labelEn: string;
  description: string;
  descriptionEn: string;
  previewColors: {
    bg: string;
    surface: string;
    brand: string;
    text: string;
  };
}
