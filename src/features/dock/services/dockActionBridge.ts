// v10.0 DockActionBridge — executes dock actions in the main window context
// Dock window sends actions here; this bridge executes them via RuntimeBridge / NavigationBus.
import { RuntimeBridge, stopInteractiveSession } from '../../../features/runtime/services/runtimeBridge';
import { useRuntimeStore } from '../../runtime/stores/runtimeStore';
import { recordRuntimeError } from '../../../features/runtime/stores/runtimeTraceStore';

export type DockMode = 'quiet' | 'calm' | 'focus';

export type DockAction =
  | { type: 'open-console' }
  | { type: 'open-project'; projectId?: string }
  | { type: 'open-workspace'; uiSessionId: string }
  | { type: 'open-resources'; projectId?: string; uiSessionId?: string }
  | { type: 'open-diagnostics'; projectId?: string; uiSessionId?: string }
  | { type: 'send-prompt'; uiSessionId: string; prompt: string }
  | { type: 'send-ctrl-c'; uiSessionId: string }
  | { type: 'stop-session'; uiSessionId: string }
  | { type: 'set-mode'; mode: DockMode }
  | { type: 'hide-dock' };

export function getActiveSessions() {
  return Object.values(useRuntimeStore.getState().sessions);
}

export async function killSession(sessionId: string) {
  await stopInteractiveSession(sessionId);
}

export const DockActionBridge = {
  async execute(action: DockAction): Promise<{ ok: boolean; error?: string }> {
    try {
      switch (action.type) {
        case 'open-console': {
          const { useSurfaceStore } = await import('../../../stores/surfaceStore');
          useSurfaceStore.getState().navigateTo('console');
          return { ok: true };
        }
        case 'open-project': {
          const { useSurfaceStore } = await import('../../../stores/surfaceStore');
          useSurfaceStore.getState().navigateTo('projects');
          return { ok: true };
        }
        case 'open-workspace': {
          const { useSurfaceStore } = await import('../../../stores/surfaceStore');
          useSurfaceStore.getState().navigateTo('workspace');
          return { ok: true };
        }
        case 'open-resources': {
          const { useSurfaceStore } = await import('../../../stores/surfaceStore');
          useSurfaceStore.getState().navigateTo('resources');
          return { ok: true };
        }
        case 'open-diagnostics': {
          const { useSurfaceStore } = await import('../../../stores/surfaceStore');
          // diagnostics is not yet a SurfaceId; use console as fallback
          useSurfaceStore.getState().navigateTo('console');
          return { ok: true };
        }
        case 'send-prompt': {
          await RuntimeBridge.write(action.uiSessionId, action.prompt + '\r');
          return { ok: true };
        }
        case 'send-ctrl-c': {
          await RuntimeBridge.ctrlC(action.uiSessionId);
          return { ok: true };
        }
        case 'stop-session': {
          await RuntimeBridge.stop(action.uiSessionId);
          return { ok: true };
        }
        case 'set-mode': case 'hide-dock': {
          return { ok: true };
        }
        default:
          return { ok: false, error: `Unknown action: ${(action as DockAction).type}` };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const sid = ('uiSessionId' in action) ? (action as { uiSessionId: string }).uiSessionId : null;
      recordRuntimeError('dock.action.failed', sid, null, msg);
      return { ok: false, error: msg };
    }
  },
};
