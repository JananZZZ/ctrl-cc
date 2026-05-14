import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { useSessionStore } from '../../stores/sessionStore';
import { useOpenSessionStore } from '../../stores/openSessionStore';
import { RuntimeFabricBridge } from '../../features/runtime-fabric/services/runtimeFabricBridge';
import { useRuntimeFabricStore } from '../../features/runtime-fabric/stores/runtimeFabricStore';
import { StreamCoalescer } from '../../features/chat/StreamCoalescer';
import { useRenderLoopGuard } from '../../debug/useRenderLoopGuard';
import { CcEmptyState } from '../../components/ui/CcEmptyState';
import { CcButton } from '../../components/ui/CcButton';
import { OpenSessionTabs } from './OpenSessionTabs';
import { ChatView } from './ChatView';
import { TerminalView } from './TerminalView';
import { ComposerBar, type SendResult } from './ComposerBar';
import { SessionInspector } from './SessionInspector';
import { NewSessionDialog } from './NewSessionDialog';
import { NewProjectDialog } from '../projects/NewProjectDialog';
import { useProjectStore } from '../../stores/projectStore';
import { useErrorStore } from '../../stores/errorStore';
import type { RuntimeEvent, Session } from '../../types';

type ViewMode = 'chat' | 'terminal' | 'split';

export function WorkspaceSurface() {
  useRenderLoopGuard('WorkspaceSurface');
  const { t } = useTranslation();
  const tabs = useOpenSessionStore((s) => s.tabs);
  const activeTabId = useOpenSessionStore((s) => s.activeTabId);
  const setActiveTab = useOpenSessionStore((s) => s.setActiveTab);
  const closeTab = useOpenSessionStore((s) => s.closeTab);
  const [viewMode, setViewMode] = useState<ViewMode>('chat');
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [inspectorExpanded, setInspectorExpanded] = useState(false);
  const [rawEvents, setRawEvents] = useState<RuntimeEvent[]>([]);
  const [starting, setStarting] = useState(false);
  const [showNewSessionDialog, setShowNewSessionDialog] = useState(false);
  const [showNewProjectFromSession, setShowNewProjectFromSession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessions = useSessionStore((s) => s.sessions);
  const addProject = useProjectStore((s) => s.addProject);
  const projects = useProjectStore((s) => s.projects);
  const unlistenRef = useRef<UnlistenFn | null>(null);
  const coalescerRef = useRef(new StreamCoalescer());

  const activeSession: Session | null = activeTabId ? sessions.find((s) => s.id === activeTabId) ?? null : null;

  const isComposerEnabled = useCallback((sessionId: string | null): boolean => {
    if (!sessionId) return false;
    const fabric = useRuntimeFabricStore.getState().sessions[sessionId];
    if (!fabric) return true;
    return fabric.status !== 'failed';
  }, []);

  const events = useMemo(() => {
    const result: RuntimeEvent[] = [];
    const seenIds = new Set<string>();
    for (const evt of rawEvents) {
      const coalesced = coalescerRef.current.feed(evt);
      if (coalesced) {
        if (evt.type === 'assistant_delta') {
          const filtered = result.filter(r => !(r.id === coalesced.id && r.type === 'assistant_message'));
          result.length = 0;
          result.push(...filtered);
        }
        if (!seenIds.has(coalesced.id)) {
          seenIds.add(coalesced.id);
          result.push(coalesced);
        }
      }
    }
    return result;
  }, [rawEvents]);

  useEffect(() => {
    const tab = tabs.find((t) => t.sessionId === activeTabId);
    if (tab?.viewMode) setViewMode(tab.viewMode);
  }, [activeTabId, tabs]);

  useEffect(() => {
    listen<RuntimeEvent>('runtime:event', (e) => {
      if (activeTabId && e.payload.sessionId === activeTabId) {
        setRawEvents((prev) => {
          const next = [...prev, e.payload];
          return next.length > 500 ? next.slice(-200) : next; // cap at 200-500 to prevent memory leak
        });
      }
    }).then((fn) => { unlistenRef.current = fn; });
    return () => { unlistenRef.current?.(); };
  }, [activeTabId]);

  const handleSend = useCallback(async (
    text: string,
    config: { model: string; effort: string; permissionMode: string; runtimeMode: string }
  ): Promise<SendResult> => {
    if (!activeTabId) return { ok: false, error: 'No active session' };

    const userEvent: RuntimeEvent = {
      id: `usr-${Date.now()}`,
      sessionId: activeTabId,
      projectId: activeSession?.projectId ?? '',
      type: 'user_message',
      content: text,
      severity: 'low',
      createdAt: new Date().toISOString(),
    };
    setRawEvents((prev) => [...prev, userEvent]);

    try {
      await RuntimeFabricBridge.sendChatMessage(activeTabId, text, {
        model: config.model,
        permissionMode: config.permissionMode,
        effort: config.effort,
        cwd: activeSession?.cwd,
        projectId: activeSession?.projectId,
      } as any);
      return { ok: true };
    } catch (err) {
      const msg = String(err);
      setError(`${t('workspace.sendFailed')}: ${msg}`);
      setRawEvents((prev) => [...prev, {
        id: `sys-${Date.now()}`,
        sessionId: activeTabId,
        projectId: activeSession?.projectId ?? '',
        type: 'system',
        content: `Chat Runtime failed: ${msg}`,
        severity: 'medium',
        createdAt: new Date().toISOString(),
      } as unknown as RuntimeEvent]);
      try {
        useErrorStore.getState().addError({
          severity: 'error',
          source: 'session',
          title: 'Chat failed',
          detail: msg,
        });
      } catch {}
      return { ok: false, error: msg };
    }
  }, [activeTabId, activeSession, t]);

  // v20.0: Session creation via RuntimeFabricBridge — does NOT auto-start PTY.
  const startSessionWithProject = useCallback((projectId: string, projectPath?: string) => {
    setError(null);
    let cwd = projectPath || '.';
    if (cwd === '.') {
      const proj = projects.find((p) => p.id === projectId);
      if (proj?.path) cwd = proj.path;
    }
    const proj = projects.find((p) => p.id === projectId);
    const projName = proj?.name || t('workspace.project');

    setShowNewSessionDialog(false);
    setShowNewProjectFromSession(false);
    setStarting(true);

    try {
      const session = RuntimeFabricBridge.createCtrlCcSession({
        projectId, projectName: projName, cwd,
        title: cwd.split(/[/\\]/).pop() || undefined,
      });
      try { useErrorStore.getState().addError({ severity: 'info', source: 'session', title: `Session created: ${session.id.slice(0, 8)}...`, detail: `CWD: ${cwd}` }); } catch {}
    } catch (err) {
      setError(`${t('workspace.startFailed')}: ${String(err)}`);
      try { useErrorStore.getState().addError({ severity: 'error', source: 'session', title: t('error.ptySessionFailed'), detail: `CWD: ${cwd}, Error: ${String(err)}` }); } catch {}
    } finally {
      setStarting(false);
    }
  }, [projects, t]);

  const handleCloseTab = useCallback((sessionId: string) => {
    closeTab(sessionId);
  }, [closeTab]);

  const handleStartPtySession = useCallback(() => {
    setShowNewSessionDialog(true);
  }, []);

  const handleSelectProject = useCallback((projectId: string) => {
    startSessionWithProject(projectId);
  }, [startSessionWithProject]);

  const handleCreateNewProject = useCallback(() => {
    setShowNewSessionDialog(false);
    setShowNewProjectFromSession(true);
  }, []);

  const handleConfirmNewProject = useCallback((name: string, path: string, gitBranch?: string) => {
    const id = `proj-${Date.now()}`;
    addProject({
      id, workspaceRootId: '', name, path, gitBranch,
      isFavorite: false, isArchived: false, activeSessionCount: 0, totalSessionCount: 0,
      pendingPermissionCount: 0, riskCount: 0,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    setShowNewProjectFromSession(false);
    startSessionWithProject(id, path);
  }, [addProject, startSessionWithProject]);

  const viewModeLabels: Record<ViewMode, string> = {
    chat: `💬 ${t('workspace.chat')}`,
    terminal: `⌨️ ${t('workspace.terminal')}`,
    split: `📐 ${t('workspace.split')}`,
  };

  return (
    <div data-testid="surface-workspace" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {tabs.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
          <CcEmptyState icon="💬" title={t('workspace.title')} description={t('workspace.noSessionDesc')} />
          <CcButton variant="primary" onClick={handleStartPtySession} disabled={starting}>{starting ? t('workspace.starting') : t('workspace.newSession')}</CcButton>
          {error && <div style={{ color: 'var(--cc-red)', fontSize: 'var(--cc-font-xs)' }}>{error}</div>}
        </div>
      ) : (
        <>
          <OpenSessionTabs tabs={tabs} activeTabId={activeTabId} onSelectTab={setActiveTab} onCloseTab={handleCloseTab} />
          <div style={{ display: 'flex', alignItems: 'center', padding: '0 8px', borderBottom: '1px solid var(--cc-border)', background: 'var(--cc-bg-muted)', flexShrink: 0, gap: 0 }}>
            {(['chat', 'terminal', 'split'] as ViewMode[]).map((mode) => {
              const a = viewMode === mode;
              return <button
                key={mode}
                onClick={() => {
                  setViewMode(mode);
                  if ((mode === 'terminal' || mode === 'split') && activeTabId) {
                    const fabric = useRuntimeFabricStore.getState().sessions[activeTabId];
                    if (fabric && !fabric.terminalChannelId) {
                      RuntimeFabricBridge.startTerminalChannel(activeTabId).catch((e) => {
                        const msg = String(e);
                        setError(`Terminal start failed: ${msg}`);
                        try {
                          useErrorStore.getState().addError({
                            severity: 'error',
                            source: 'pty',
                            title: 'Terminal start failed',
                            detail: msg,
                          });
                        } catch {}
                      });
                    }
                  }
                }}
                style={{ padding: '4px 14px', fontSize: 'var(--cc-font-xs)', fontWeight: a ? 600 : 400, border: 'none', borderBottom: a ? '2px solid var(--cc-navy)' : '2px solid transparent', background: a ? 'var(--cc-surface-solid)' : 'transparent', color: a ? 'var(--cc-text)' : 'var(--cc-text-muted)', cursor: 'pointer' }}>{viewModeLabels[mode]}</button>;
            })}
            <CcButton variant="ghost" size="sm" onClick={handleStartPtySession} disabled={starting}>{starting ? t('workspace.starting') : `+ ${t('workspace.newSession')}`}</CcButton>
            {error && <span style={{ marginLeft: 12, fontSize: 'var(--cc-font-xs)', color: 'var(--cc-red)' }}>{error}</span>}
          </div>
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {viewMode === 'chat' && <><ChatView events={events} /><ComposerBar viewMode="chat" sessionRuntimeMode={activeSession?.runtimeMode} disabled={!isComposerEnabled(activeTabId)} onSend={handleSend} /></>}
              {viewMode === 'terminal' && <TerminalView sessionId={activeTabId} />}
              {viewMode === 'split' && (<div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}><div style={{ flex: '0 0 50%', borderRight: '1px solid var(--cc-border-strong)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}><TerminalView sessionId={activeTabId} /></div><div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}><ChatView events={events} /><ComposerBar viewMode="split" sessionRuntimeMode={activeSession?.runtimeMode} disabled={!isComposerEnabled(activeTabId)} onSend={handleSend} /></div></div>)}
            </div>
            <SessionInspector session={activeSession} events={rawEvents.slice(0, 200)} collapsed={inspectorCollapsed} expanded={inspectorExpanded} onToggleCollapse={() => setInspectorCollapsed((v) => !v)} onToggleExpand={() => setInspectorExpanded((v) => !v)} />
          </div>
        </>
      )}

      {/* Dialogs ALWAYS rendered — regardless of tabs.length state */}
      <NewSessionDialog open={showNewSessionDialog} onClose={() => setShowNewSessionDialog(false)} onSelectProject={handleSelectProject} onCreateNew={handleCreateNewProject} />
      <NewProjectDialog open={showNewProjectFromSession} onClose={() => setShowNewProjectFromSession(false)} onConfirm={handleConfirmNewProject} />
    </div>
  );
}
