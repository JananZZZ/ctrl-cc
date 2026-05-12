/** Central session registry — tracks all RuntimeSession across the app. */

import { useRuntimeStore } from '../stores/runtimeStore';
import type { RuntimeSession, RuntimeSessionStatus } from '../types/runtimeTypes';

export function getSession(sessionId: string): RuntimeSession | null {
  return useRuntimeStore.getState().sessions[sessionId] ?? null;
}

export function getActiveSessionId(): string | null {
  return useRuntimeStore.getState().activeSessionId;
}

export function updateSessionStatus(sessionId: string, status: RuntimeSessionStatus, error?: string | null) {
  useRuntimeStore.getState().patchSession(sessionId, { status, error: error ?? null });
}
