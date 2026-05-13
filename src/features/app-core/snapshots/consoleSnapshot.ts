// v10.0 ConsoleSnapshot — stable derived view for Console surface
// No surface reads scattered stores directly; they read a snapshot.

import { useSessionStore } from '../../../stores/sessionStore';
import { useProjectStore } from '../../../stores/projectStore';
import { useRuntimeStore } from '../../runtime/stores/runtimeStore';
import { useRuntimeTraceStore } from '../../runtime/stores/runtimeTraceStore';

export interface ConsoleSnapshot {
  generatedAt: string;
  runningCount: number;
  totalSessions: number;
  activeProjectCount: number;
  totalProjects: number;
  costToday: number;
  totalTokens: number;
  sessionsToday: number;
  runtimeActiveCount: number;
  runtimeHealthyCount: number;
  traceErrorCount: number;
  traceWarningCount: number;
  recentSessions: Array<{
    id: string; title: string; status: string;
    runtimeMode: string; model: string; totalCostUsd: number;
    updatedAt: string;
  }>;
}

export function buildConsoleSnapshot(): ConsoleSnapshot {
  const sessions = useSessionStore.getState().sessions;
  const projects = useProjectStore.getState().projects;
  const runtimeSessions = useRuntimeStore.getState().sessions;
  const traceEvents = useRuntimeTraceStore.getState().events;

  const today = sessions.filter(s => new Date(s.createdAt).toDateString() === new Date().toDateString());

  return {
    generatedAt: new Date().toISOString(),
    runningCount: sessions.filter(s => s.status === 'running' || s.status === 'starting').length,
    totalSessions: sessions.length,
    activeProjectCount: projects.filter(p => p.activeSessionCount > 0).length,
    totalProjects: projects.length,
    costToday: today.reduce((s, v) => s + (v.totalCostUsd || 0), 0),
    totalTokens: sessions.reduce((s, v) => s + v.inputTokens + v.outputTokens, 0),
    sessionsToday: today.length,
    runtimeActiveCount: Object.values(runtimeSessions).filter(s => s.ptySessionId).length,
    runtimeHealthyCount: Object.values(runtimeSessions).filter(s => s.status === 'claude-active' || s.status === 'pty-ready').length,
    traceErrorCount: traceEvents.filter(e => e.level === 'error').length,
    traceWarningCount: traceEvents.filter(e => e.level === 'warning').length,
    recentSessions: sessions.slice(-6).reverse().map(s => ({
      id: s.id, title: s.title, status: s.status,
      runtimeMode: s.runtimeMode, model: s.model,
      totalCostUsd: s.totalCostUsd, updatedAt: s.updatedAt,
    })),
  };
}
