/** Resources Surface → RuntimeBridge. Provides resource context for active sessions. */

import { useRuntimeStore } from '../../runtime/stores/runtimeStore';
import { getRuntimeSession } from '../../runtime/services/runtimeBridge';

export function getActiveSessionCwd(): string | null {
  const { activeSessionId, sessions } = useRuntimeStore.getState();
  if (!activeSessionId) return null;
  return sessions[activeSessionId]?.cwd ?? null;
}

export { getRuntimeSession as getSessionContext };
