// v10.0 DiagnosticBundleBuilder — collects all diagnostic info into a single bundle
import { useRuntimeStore } from '../../runtime/stores/runtimeStore';
import { useRuntimeTraceStore } from '../../runtime/stores/runtimeTraceStore';
import { useSessionStore } from '../../../stores/sessionStore';
import { buildHealthMatrix } from './healthMatrix';

export interface DiagnosticBundle {
  generatedAt: string;
  appVersion: string;
  healthMatrix: ReturnType<typeof buildHealthMatrix>;
  sessions: {
    total: number;
    running: number;
    failed: number;
    runtimeSessions: number;
    ptyActive: number;
  };
  errors: {
    recent: Array<{ message: string; timestamp: string; traceId?: string }>;
    total: number;
  };
  ptyRegistry: Array<{
    uiSessionId: string;
    ptySessionId: string | null;
    status: string;
    projectId: string;
    hasWriter: boolean;
  }>;
  orphans: string[];
  memory: {
    runtimeEvents: number;
    traceEvents: number;
    sessionCount: number;
  };
  react: {
    lastError: string | null;
    renderLoopDetected: boolean;
  };
}

export function collectDiagnosticBundle(): DiagnosticBundle {
  const runtimeSessions = useRuntimeStore.getState().sessions;
  const traceEvents = useRuntimeTraceStore.getState().events;
  const sessions = useSessionStore.getState().sessions;

  const runtimeValues = Object.values(runtimeSessions);
  const recentErrors = traceEvents.filter(e => e.level === 'error').slice(-20);

  const reactLastError = typeof localStorage !== 'undefined'
    ? localStorage.getItem('ctrlcc:last-react-error')
    : null;
  const renderLoopDetected = typeof localStorage !== 'undefined'
    ? localStorage.getItem('ctrlcc:render-loop') === 'true'
    : false;

  return {
    generatedAt: new Date().toISOString(),
    appVersion: 'v9.0.0',
    healthMatrix: buildHealthMatrix(),
    sessions: {
      total: sessions.length,
      running: sessions.filter(s => s.status === 'running' || s.status === 'starting').length,
      failed: sessions.filter(s => s.status === 'failed').length,
      runtimeSessions: runtimeValues.length,
      ptyActive: runtimeValues.filter(s => s.ptySessionId && s.status !== 'killed' && s.status !== 'exited').length,
    },
    errors: {
      recent: recentErrors.map(e => ({
        message: e.message,
        timestamp: e.ts,
        traceId: e.traceId,
      })),
      total: traceEvents.filter(e => e.level === 'error').length,
    },
    ptyRegistry: runtimeValues.map(s => ({
      uiSessionId: s.id,
      ptySessionId: s.ptySessionId,
      status: s.status,
      projectId: s.projectId,
      hasWriter: !!s.ptySessionId && s.status !== 'killed' && s.status !== 'exited',
    })),
    orphans: [],
    memory: {
      runtimeEvents: runtimeValues.length,
      traceEvents: traceEvents.length,
      sessionCount: sessions.length,
    },
    react: {
      lastError: reactLastError,
      renderLoopDetected,
    },
  };
}
