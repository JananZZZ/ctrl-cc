import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { useRuntimeStore } from '../stores/runtimeStore';
import { useSessionStore } from '../../../stores/sessionStore';
import { useRuntimeTraceStore } from '../stores/runtimeTraceStore';
import { useErrorStore } from '../../../stores/errorStore';

interface PtyDataPayload {
  traceId?: string;
  uiSessionId?: string;
  ptySessionId?: string;
  session_id?: string;
  data?: string;
}

interface PtyExitPayload {
  traceId?: string;
  uiSessionId?: string;
  ptySessionId?: string;
  session_id?: string;
  error?: string;
}

interface PtyErrorPayload extends PtyExitPayload {
  message?: string;
}

function resolveUiSessionId(payload: PtyDataPayload): string | null {
  if (payload.uiSessionId) return payload.uiSessionId;
  if (payload.session_id) return payload.session_id;
  return null;
}

export async function installRuntimeLifecycleBridge(): Promise<() => void> {
  const unlisteners: UnlistenFn[] = [];

  unlisteners.push(await listen<PtyDataPayload>('pty://data', (event) => {
    const payload = event.payload;
    const uiSessionId = resolveUiSessionId(payload);
    if (!uiSessionId) return;

    const state = useRuntimeStore.getState();
    const session = state.sessions[uiSessionId];
    if (!session) return;

    state.appendPtyTail(uiSessionId, payload.data ?? '');

    if (session.status === 'pty-ready' || session.status === 'claude-launching' || session.status === 'pty-starting') {
      state.patchSession(uiSessionId, { status: 'claude-active', error: null });
      try { useSessionStore.getState().updateSession(uiSessionId, { status: 'running' as const }); } catch {}
    }
  }));

  const markExited = (payload: PtyExitPayload, reason: string) => {
    const uiSessionId = resolveUiSessionId(payload);
    if (!uiSessionId) return;

    const state = useRuntimeStore.getState();
    const session = state.sessions[uiSessionId];
    if (!session) return;

    state.patchSession(uiSessionId, {
      status: 'exited',
      exitedAt: new Date().toISOString(),
      error: reason,
    });

    try { useSessionStore.getState().updateSession(uiSessionId, { status: 'stopped' as const }); } catch {}

    useRuntimeTraceStore.getState().append({
      traceId: payload.traceId ?? session.traceId,
      source: 'runtime-kernel',
      level: reason === 'pty exit' ? 'warning' : 'error',
      type: reason === 'pty exit' ? 'pty.exit' : 'pty.error',
      message: reason,
      uiSessionId,
      ptySessionId: payload.ptySessionId ?? session.ptySessionId,
    });
  };

  unlisteners.push(await listen<PtyExitPayload>('pty://exit', (event) => {
    markExited(event.payload, 'pty exit');
  }));

  unlisteners.push(await listen<PtyErrorPayload>('pty://error', (event) => {
    const p = event.payload;
    markExited(p, p.message || p.error || 'pty error');
    try {
      useErrorStore.getState().addError({
        severity: 'error',
        source: 'pty',
        title: 'PTY runtime error',
        detail: p.message || p.error || JSON.stringify(p),
      });
    } catch {}
  }));

  unlisteners.push(await listen<{ traceId?: string; uiSessionId?: string; ptySessionId?: string; status?: string }>('runtime://session-status', (event) => {
    const p = event.payload;
    if (!p.uiSessionId || !p.status) return;
    const s = useRuntimeStore.getState().sessions[p.uiSessionId];
    if (!s) return;

    if (p.status === 'pty-ready' || p.status === 'reader-started') {
      useRuntimeStore.getState().patchSession(p.uiSessionId, { status: 'pty-ready' });
    }
  }));

  return () => {
    for (const fn of unlisteners) fn();
  };
}
