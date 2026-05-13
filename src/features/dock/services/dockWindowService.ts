// v10.0 DockWindowService — manages the AI Dock as an independent Tauri window
// P0: DockLauncher badge (main window). P1: independent ai-dock window.

export type DockMode = 'quiet' | 'calm' | 'focus';

export interface DockWindowConfig {
  mode: DockMode;
  visible: boolean;
}

const DOCK_WINDOW_LABEL = 'ai-dock';

const modeDimensions: Record<DockMode, { width: number; height: number }> = {
  quiet: { width: 220, height: 52 },
  calm: { width: 320, height: 460 },
  focus: { width: 520, height: 680 },
};

let currentConfig: DockWindowConfig = { mode: 'calm', visible: false };

export const DockWindowService = {
  getConfig(): DockWindowConfig {
    return { ...currentConfig };
  },

  setMode(mode: DockMode): void {
    currentConfig.mode = mode;
    if (currentConfig.visible) {
      void this.updateWindow();
    }
  },

  /** Toggle dock visibility. P0: manages a CSS class on a badge. P1: creates independent window. */
  toggle(): void {
    currentConfig.visible = !currentConfig.visible;
    if (currentConfig.visible) {
      void this.show();
    } else {
      void this.hide();
    }
  },

  async show(): Promise<void> {
    currentConfig.visible = true;
    // P1: Use Tauri multiwindow API
    // await invoke('create_dock_window', { mode: currentConfig.mode });
  },

  async hide(): Promise<void> {
    currentConfig.visible = false;
    // P1: await invoke('destroy_dock_window');
  },

  async updateWindow(): Promise<void> {
    if (!currentConfig.visible) return;
    const dims = modeDimensions[currentConfig.mode];
    // P1: await invoke('resize_dock_window', dims);
    void dims; // suppress unused warning for P0
  },

  getLabel(): string {
    return DOCK_WINDOW_LABEL;
  },

  isVisible(): boolean {
    return currentConfig.visible;
  },
};
