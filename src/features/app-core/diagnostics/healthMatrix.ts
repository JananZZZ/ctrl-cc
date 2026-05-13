// v10.0 HealthMatrix — comprehensive system health assessment
import { useRuntimeStore } from '../../runtime/stores/runtimeStore';
import { useRuntimeTraceStore } from '../../runtime/stores/runtimeTraceStore';
import { useSessionStore } from '../../../stores/sessionStore';

export interface HealthComponent {
  id: string;
  name: string;
  layer: 'runtime' | 'bridge' | 'pty' | 'claude' | 'storage' | 'ui' | 'git' | 'watchdog';
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  detail: string;
  lastChecked: string;
}

export interface HealthMatrix {
  generatedAt: string;
  overallStatus: 'healthy' | 'degraded' | 'unhealthy';
  components: HealthComponent[];
  activeWarnings: string[];
  activeErrors: string[];
  recommendations: string[];
}

export function buildHealthMatrix(): HealthMatrix {
  const runtimeSessions = useRuntimeStore.getState().sessions;
  const traceEvents = useRuntimeTraceStore.getState().events;
  const sessions = useSessionStore.getState().sessions;

  const components: HealthComponent[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  const recommendations: string[] = [];

  const now = new Date().toISOString();
  const runtimeValues = Object.values(runtimeSessions);

  // Runtime Bridge
  const bridgeSessions = runtimeValues.filter(s => s.ptySessionId);
  components.push({
    id: 'runtime-bridge', name: 'RuntimeBridge', layer: 'bridge',
    status: bridgeSessions.length > 0 ? 'healthy' : 'unknown',
    detail: bridgeSessions.length > 0
      ? `${bridgeSessions.length} active session(s)`
      : 'No active RuntimeBridge sessions',
    lastChecked: now,
  });

  // PTY Kernel
  const ptyActive = runtimeValues.filter(s => s.ptySessionId && s.status !== 'killed' && s.status !== 'exited');
  components.push({
    id: 'pty-kernel', name: 'PTY Kernel', layer: 'pty',
    status: ptyActive.length > 0 ? 'healthy' : 'degraded',
    detail: `${ptyActive.length} PTY session(s) running`,
    lastChecked: now,
  });

  // Claude CLI
  const claudeActive = runtimeValues.filter(s => s.status === 'claude-active');
  components.push({
    id: 'claude-cli', name: 'Claude CLI', layer: 'claude',
    status: claudeActive.length > 0 ? 'healthy' : 'unknown',
    detail: claudeActive.length > 0
      ? `${claudeActive.length} Claude session(s) active`
      : 'No active Claude sessions',
    lastChecked: now,
  });

  // Error check
  const recentErrors = traceEvents.filter(e => e.level === 'error').slice(-20);
  if (recentErrors.length > 0) {
    errors.push(...recentErrors.map(e => e.message));
    components.push({
      id: 'error-log', name: 'Error Log', layer: 'runtime',
      status: recentErrors.length > 5 ? 'unhealthy' : 'degraded',
      detail: `${recentErrors.length} recent error(s)`,
      lastChecked: now,
    });
    if (recentErrors.length > 5) {
      recommendations.push('Open Diagnostics to review error log');
    }
  }

  // Sessions health
  const failedSessions = sessions.filter(s => s.status === 'failed');
  if (failedSessions.length > 0) {
    warnings.push(`${failedSessions.length} failed session(s)`);
    components.push({
      id: 'sessions', name: 'Sessions', layer: 'ui',
      status: 'degraded',
      detail: `${failedSessions.length} failed session(s) out of ${sessions.length}`,
      lastChecked: now,
    });
    recommendations.push('Review failed sessions in Console or Diagnostics');
  }

  // Legacy sessions health
  const runningLegacy = sessions.filter(s => s.status === 'running' || s.status === 'starting');
  components.push({
    id: 'legacy-sessions', name: 'Session Store', layer: 'ui',
    status: runningLegacy.length > 0 ? 'healthy' : 'degraded',
    detail: `${runningLegacy.length} running session(s)`,
    lastChecked: now,
  });

  // Overall
  const hasUnhealthy = components.some(c => c.status === 'unhealthy');
  const hasDegraded = components.some(c => c.status === 'degraded');

  return {
    generatedAt: now,
    overallStatus: hasUnhealthy ? 'unhealthy' : hasDegraded ? 'degraded' : 'healthy',
    components,
    activeWarnings: warnings,
    activeErrors: errors,
    recommendations,
  };
}
