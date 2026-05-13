// v10.0 CtrlCcAction — universal action contract for all surfaces
// Every user action carries traceId, source, target, status, and audit trail.

import type { TraceId, UiSessionId, PtySessionId } from '../../runtime/types/runtimeTypes';

export interface CtrlCcAction {
  id: string;
  traceId: TraceId;
  sourceSurface: 'console' | 'projects' | 'workspace' | 'resources' | 'dock' | 'github' | 'diagnostics';
  type: string;
  target: {
    projectId?: string;
    uiSessionId?: UiSessionId;
    ptySessionId?: PtySessionId;
    resourceId?: string;
  };
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'blocked';
  createdAt: string;
  updatedAt: string;
  error?: string | null;
}

export function createAction(
  sourceSurface: CtrlCcAction['sourceSurface'],
  type: string,
  target: CtrlCcAction['target'],
  traceId?: string,
): CtrlCcAction {
  const now = new Date().toISOString();
  return {
    id: `act-${Date.now()}`,
    traceId: traceId || `trace-${crypto.randomUUID()}`,
    sourceSurface,
    type,
    target,
    status: 'queued',
    createdAt: now,
    updatedAt: now,
  };
}
