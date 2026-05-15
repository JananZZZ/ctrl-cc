import { listen } from '@tauri-apps/api/event';
import { invokeCommand } from '../../services/invokeCommand';

export interface DockStatus {
  open: boolean;
  visible?: boolean;
}

type DockListener = (status: DockStatus) => void;

const listeners = new Set<DockListener>();

export const DockEventBus = {
  subscribe(fn: DockListener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  notify(status: DockStatus) {
    for (const fn of listeners) fn(status);
  },

  open() {
    return invokeCommand('open_ai_dock');
  },

  close() {
    return invokeCommand('close_ai_dock');
  },

  toggle(): Promise<boolean> {
    return invokeCommand<boolean>('toggle_ai_dock');
  },

  getStatus(): Promise<DockStatus> {
    return invokeCommand<DockStatus>('get_dock_status');
  },

  async installListener(): Promise<() => void> {
    const unlisten = await listen<DockStatus>('dock://status', (event) => {
      DockEventBus.notify(event.payload);
    });
    return unlisten;
  },
};
