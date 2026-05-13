// v10.0 DockSnapshot — stable derived view for AI Dock
import { useSessionStore } from '../../../stores/sessionStore';
import { useRuntimeStore } from '../../runtime/stores/runtimeStore';
import { useRuntimeTraceStore } from '../../runtime/stores/runtimeTraceStore';
import type { RuntimeTraceEvent } from '../../runtime/types/runtimeTraceTypes';

export interface DockHealthItem {
  id: string;
  label: string;
  status: 'ready' | 'warning' | 'error' | 'unavailable';
  detail?: string;
}

export interface DockSessionSummary {
  uiSessionId: string;
  title: string;
  projectName: string;
  status: string;
  ptyAlive: boolean;
  waitingPermission: boolean;
  riskCount: number;
}

export interface DockAttentionItem {
  id: string;
  type: 'permission' | 'error' | 'risk' | 'discovery-failure';
  uiSessionId?: string;
  message: string;
  timestamp: string;
}

export interface AIDockSnapshot {
  generatedAt: string;
  runtime: {
    claude: DockHealthItem;
    pty: DockHealthItem;
    runtimeBridge: DockHealthItem;
    diagnostics: DockHealthItem;
  };
  activeSession: DockSessionSummary | null;
  runningSessions: DockSessionSummary[];
  attention: DockAttentionItem[];
  resources: {
    activeForCurrentSession: number;
    warnings: number;
    errors: number;
  };
  recentEvents: Array<{
    type: string;
    message: string;
    level: string;
    timestamp: string;
  }>;
}

function toAttentionItems(events: RuntimeTraceEvent[]): DockAttentionItem[] {
  return events
    .filter(e => e.level === 'error' || e.level === 'warning')
    .slice(-8)
    .map((e): DockAttentionItem => ({
      id: e.ts + (e.uiSessionId ?? ''),
      type: e.level === 'error' ? 'error' : 'risk',
      uiSessionId: e.uiSessionId ?? undefined,
      message: e.message,
      timestamp: e.ts,
    }));
}

export function buildDockSnapshot(): AIDockSnapshot {
  const sessions = useSessionStore.getState().sessions;
  const runtimeSessions = useRuntimeStore.getState().sessions;
  const traceEvents = useRuntimeTraceStore.getState().events;

  const runtimeValues = Object.values(runtimeSessions);
  const hasActivePty = runtimeValues.some(s => s.ptySessionId && s.status !== 'killed' && s.status !== 'exited');
  const hasClaudeActive = runtimeValues.some(s => s.status === 'claude-active');
  const hasErrors = traceEvents.some(e => e.level === 'error');

  let activeSession: DockSessionSummary | null = null;
  const running: DockSessionSummary[] = [];

  for (const s of runtimeValues) {
    const legacy = sessions.find(ls => ls.id === s.id);
    const summary: DockSessionSummary = {
      uiSessionId: s.id,
      title: s.name,
      projectName: s.projectName,
      status: s.status,
      ptyAlive: !!s.ptySessionId && s.status !== 'killed' && s.status !== 'exited',
      waitingPermission: s.status === 'waiting-permission',
      riskCount: legacy?.riskCount ?? 0,
    };
    if (s.status === 'claude-active' || s.status === 'pty-ready') {
      activeSession = summary;
    }
    if (s.ptySessionId && s.status !== 'killed' && s.status !== 'exited') {
      running.push(summary);
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    runtime: {
      claude: { id: 'claude', label: 'Claude CLI', status: hasClaudeActive ? 'ready' : hasErrors ? 'error' : 'unavailable' },
      pty: { id: 'pty', label: 'PTY Kernel', status: hasActivePty ? 'ready' : 'unavailable' },
      runtimeBridge: { id: 'runtime-bridge', label: 'RuntimeBridge', status: runtimeValues.length > 0 ? 'ready' : 'unavailable' },
      diagnostics: { id: 'diagnostics', label: 'Diagnostics', status: hasErrors ? 'warning' : 'ready' },
    },
    activeSession,
    runningSessions: running,
    attention: toAttentionItems(traceEvents),
    resources: { activeForCurrentSession: 0, warnings: 0, errors: 0 },
    recentEvents: traceEvents.slice(-10).map(e => ({
      type: e.type,
      message: e.message,
      level: e.level,
      timestamp: e.ts,
    })),
  };
}
