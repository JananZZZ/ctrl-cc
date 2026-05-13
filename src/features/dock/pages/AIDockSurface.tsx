// v12.0 AI Dock Resident Runtime Controller
import { useEffect, useMemo, useCallback } from 'react';
import { useDockStore } from '../stores/dockStore';
import { DockSnapshotPublisher } from '../services/dockSnapshotPublisher';
import { DockActionBridge, type DockAction } from '../services/dockActionBridge';
import { DockStatusLights } from '../components/DockStatusLights';
import { DockQuickPrompt } from '../components/DockQuickPrompt';
import { DockActionGrid } from '../components/DockActionGrid';

export function AIDockSurface() {
  const store = useDockStore();
  const snapshot = store.snapshot;

  useEffect(() => {
    DockSnapshotPublisher.start(2000);
    const unsub = DockSnapshotPublisher.subscribe(snap => useDockStore.getState().updateSnapshot(snap));
    return () => { DockSnapshotPublisher.stop(); unsub(); };
  }, []);

  const execute = useCallback((action: DockAction) => { DockActionBridge.execute(action); }, []);
  const handlePrompt = useCallback(async (prompt: string) => {
    if (!snapshot?.activeSession?.uiSessionId) return false;
    const r = await DockActionBridge.execute({ type: 'send-prompt', uiSessionId: snapshot.activeSession.uiSessionId, prompt });
    return r.ok;
  }, [snapshot?.activeSession?.uiSessionId]);

  const gridActions = useMemo(() => [
    { id: 'console', label: 'Console', icon: 'CC', onClick: () => execute({ type: 'open-console' }), enabled: true },
    { id: 'projects', label: 'Projects', icon: 'PJ', onClick: () => execute({ type: 'open-project' }), enabled: true },
    { id: 'workspace', label: 'Workspace', icon: 'WS', onClick: () => { if (snapshot?.activeSession?.uiSessionId) execute({ type: 'open-workspace', uiSessionId: snapshot.activeSession.uiSessionId }); }, enabled: !!snapshot?.activeSession?.uiSessionId, disabledReason: 'No active session' },
    { id: 'ctrlc', label: 'Ctrl+C', icon: 'CC', onClick: () => { if (snapshot?.activeSession?.uiSessionId) execute({ type: 'send-ctrl-c', uiSessionId: snapshot.activeSession.uiSessionId }); }, enabled: !!snapshot?.activeSession?.uiSessionId, disabledReason: 'No active session' },
    { id: 'stop', label: 'Stop', icon: 'ST', onClick: () => { if (snapshot?.activeSession?.uiSessionId) execute({ type: 'stop-session', uiSessionId: snapshot.activeSession.uiSessionId }); }, enabled: !!snapshot?.activeSession?.uiSessionId, disabledReason: 'No active session' },
    { id: 'hide', label: 'Hide', icon: '--', onClick: () => store.setVisible(false), enabled: true },
  ], [execute, snapshot?.activeSession?.uiSessionId, store]);

  return (
    <div style={{ fontFamily: 'var(--cc-font-sans)', color: 'var(--cc-text)', height: '100%', overflowY: 'auto', background: 'var(--cc-bg)' }}>
      {snapshot && <DockStatusLights items={[snapshot.runtime.claude, snapshot.runtime.pty, snapshot.runtime.runtimeBridge, snapshot.runtime.diagnostics]} />}
      <DockQuickPrompt disabled={!snapshot?.activeSession} disabledReason={!snapshot?.activeSession ? 'No active session' : undefined} onSubmit={handlePrompt} />
      <DockActionGrid actions={gridActions} />
    </div>
  );
}
