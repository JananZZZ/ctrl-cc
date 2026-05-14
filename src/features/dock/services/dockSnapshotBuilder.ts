import { useRuntimeStore } from '../../runtime/stores/runtimeStore';
import { useSessionStore } from '../../../stores/sessionStore';
import { useRuntimeTraceStore } from '../../runtime/stores/runtimeTraceStore';
import type { DockSnapshot } from '../types/dockTypes';

export function buildDockSnapshot(): DockSnapshot {
  const runtimeSessions = Object.values(useRuntimeStore.getState().sessions);
  const sessions = useSessionStore.getState().sessions;
  const traces = useRuntimeTraceStore.getState().events;

  const active = runtimeSessions.find((s) =>
    ['pty-ready', 'claude-active', 'idle', 'waiting-permission'].includes(s.status)
  );

  return {
    generatedAt: new Date().toISOString(),
    mode: 'quiet',
    runtime: {
      activeSessionCount: runtimeSessions.length,
      runningCount: runtimeSessions.filter((s) =>
        ['pty-ready', 'claude-active', 'idle', 'waiting-permission'].includes(s.status)
      ).length,
      errorCount: traces.filter((t) => t.level === 'error').length,
      warningCount: traces.filter((t) => t.level === 'warning').length,
    },
    activeSession: active
      ? { id: active.id, title: active.name, status: active.status, cwd: active.cwd }
      : sessions[0]
        ? { id: sessions[0].id, title: sessions[0].title, status: sessions[0].status, cwd: sessions[0].cwd }
        : null,
  };
}
