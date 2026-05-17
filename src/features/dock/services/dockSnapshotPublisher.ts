// v29: DockSnapshotPublisher — 事件驱动，不使用 setInterval 轮询
import { buildDockSnapshot, type AIDockSnapshot } from '../../../features/app-core/snapshots/dockSnapshot';

type SnapshotListener = (snapshot: AIDockSnapshot) => void;

const listeners = new Set<SnapshotListener>();
let lastSnapshot: AIDockSnapshot | null = null;

export const DockSnapshotPublisher = {
  /** 发布快照给所有订阅者。应在状态变更时主动调用，而非定时轮询。 */
  publish(): void {
    const snapshot = buildDockSnapshot();
    lastSnapshot = snapshot;
    for (const listener of listeners) {
      try { listener(snapshot); } catch { /* listener error — don't break others */ }
    }
  },

  /** 获取最近一次快照，无快照时立即构建一个。 */
  getLatest(): AIDockSnapshot {
    return lastSnapshot ?? buildDockSnapshot();
  },

  /** 订阅快照更新。返回取消订阅函数。 */
  subscribe(listener: SnapshotListener): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
};
