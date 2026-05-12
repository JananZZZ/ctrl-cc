/** AI Dock → RuntimeBridge. Displays session status and quick actions. */

import { useRuntimeStore } from '../../runtime/stores/runtimeStore';
import { stopInteractiveSession } from '../../runtime/services/runtimeBridge';

export function getActiveSessions() {
  return Object.values(useRuntimeStore.getState().sessions);
}

export async function killSession(sessionId: string) {
  await stopInteractiveSession(sessionId);
}
