/** Console Surface → RuntimeBridge. Read-only: queries session stats, never creates sessions. */

import { useRuntimeStore } from '../../runtime/stores/runtimeStore';

export function getActiveSessionCount(): number {
  return Object.keys(useRuntimeStore.getState().sessions).length;
}

export function getSessionEvents(limit = 10) {
  return useRuntimeStore.getState().events.slice(0, limit);
}
