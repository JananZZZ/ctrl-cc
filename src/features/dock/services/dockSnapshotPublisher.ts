// v10.0 DockSnapshotPublisher — publishes snapshots from main window to dock window
import { buildDockSnapshot, type AIDockSnapshot } from '../../../features/app-core/snapshots/dockSnapshot';

type SnapshotListener = (snapshot: AIDockSnapshot) => void;

const listeners = new Set<SnapshotListener>();
let intervalId: ReturnType<typeof setInterval> | null = null;
let lastSnapshot: AIDockSnapshot | null = null;

export const DockSnapshotPublisher = {
  /** Start publishing snapshots at the given interval (ms). Minimum 500ms. */
  start(intervalMs: number = 1000): void {
    if (intervalId) return;
    const ms = Math.max(500, intervalMs);
    intervalId = setInterval(() => {
      const snapshot = buildDockSnapshot();
      lastSnapshot = snapshot;
      for (const listener of listeners) {
        try { listener(snapshot); } catch { /* listener error — don't break others */ }
      }
    }, ms);
  },

  /** Stop publishing. */
  stop(): void {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  },

  /** Get the most recent snapshot, or build one now. */
  getLatest(): AIDockSnapshot {
    return lastSnapshot ?? buildDockSnapshot();
  },

  /** Subscribe to snapshot updates. Returns unsubscribe function. */
  subscribe(listener: SnapshotListener): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
};
