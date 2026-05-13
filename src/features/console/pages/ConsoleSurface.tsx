// v12.0 Console Mission Control
import { useMemo, useCallback } from 'react';
import { WelcomeMissionHero } from '../components/WelcomeMissionHero';
import { QuickStartDeck } from '../components/QuickStartDeck';
import { ActiveWorkBoard } from '../components/ActiveWorkBoard';
import { NeedAttentionQueue } from '../components/NeedAttentionQueue';
import { RuntimeBridge } from '../../runtime/services/runtimeBridge';
import { useRuntimeStore } from '../../runtime/stores/runtimeStore';
import { useRuntimeTraceStore } from '../../runtime/stores/runtimeTraceStore';
import { useSurfaceStore } from '../../../stores/surfaceStore';

export function ConsoleSurface() {
  const rtSessions = useRuntimeStore(s => s.sessions);
  const traceEvents = useRuntimeTraceStore(s => s.events);
  const runtimeValues = Object.values(rtSessions);
  const hasClaudeActive = runtimeValues.some(s => s.status === 'claude-active');

  const handleNewSession = useCallback(() => {
    RuntimeBridge.startInteractiveSession({ projectId: 'default', projectName: 'Default', cwd: '.', mode: 'new' });
  }, []);

  const cards = useMemo(() => [
    { id: 'new', label: 'New Claude Session', description: 'Start a new interactive Claude session', enabled: true, onClick: handleNewSession },
    { id: 'workspace', label: 'Open Workspace', description: 'Go to active workspace', enabled: hasClaudeActive, disabledReason: hasClaudeActive ? undefined : 'No active session', onClick: () => useSurfaceStore.getState().navigateTo('workspace') },
    { id: 'projects', label: 'Projects', description: 'Browse and manage projects', enabled: true, onClick: () => useSurfaceStore.getState().navigateTo('projects') },
    { id: 'resources', label: 'Resources', description: 'Skills, agents, rules, memory', enabled: true, onClick: () => useSurfaceStore.getState().navigateTo('resources') },
    { id: 'settings', label: 'Settings', description: 'Configure Ctrl-CC', enabled: true, onClick: () => useSurfaceStore.getState().navigateTo('settings') },
    { id: 'diag', label: 'Diagnostics', description: 'System health check', enabled: true, onClick: () => useSurfaceStore.getState().navigateTo('console') },
  ], [handleNewSession, hasClaudeActive]);

  const attentionItems = useMemo(() =>
    traceEvents.filter(e => e.level === 'error' || e.level === 'warning').slice(-10).map(e => ({
      id: e.id, type: (e.level === 'error' ? 'error' : 'risk') as 'error' | 'risk',
      uiSessionId: e.uiSessionId ?? undefined, message: e.message, timestamp: e.ts,
    })), [traceEvents]);

  return (
    <div style={{ padding: 'var(--cc-space-md)', overflowY: 'auto', height: '100%', fontFamily: 'var(--cc-font-sans)', color: 'var(--cc-text)' }}>
      <WelcomeMissionHero runtimeReady={hasClaudeActive} onNewSession={handleNewSession} />
      <QuickStartDeck cards={cards} />
      <ActiveWorkBoard
        sessions={runtimeValues.map(s => ({
          uiSessionId: s.id, projectName: s.projectName, status: s.status,
          ptyAlive: !!s.ptySessionId && s.status !== 'killed', claudeActive: s.status === 'claude-active',
          waitingPermission: s.status === 'waiting-permission', riskCount: 0,
        }))}
        onOpenWorkspace={() => useSurfaceStore.getState().navigateTo('workspace')}
        onStop={(id) => RuntimeBridge.stop(id).catch(() => {})}
        onOpenDiagnostics={() => {}}
      />
      <NeedAttentionQueue items={attentionItems} />
    </div>
  );
}
