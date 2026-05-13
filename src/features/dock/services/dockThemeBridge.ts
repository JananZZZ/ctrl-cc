// v10.0 DockThemeBridge — ensures dock window follows main window theme
import { ThemeBridge } from '../../app-core/theme/themeBridge';

export const DockThemeBridge = {
  getTheme: () => ThemeBridge.getActiveTheme(),
  setTheme: (theme: Parameters<typeof ThemeBridge.setActiveTheme>[0]) => ThemeBridge.setActiveTheme(theme),
  subscribe: ThemeBridge.onThemeChange,
};
