import { useState, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSessionStore } from '../../stores/sessionStore';
import { useOpenSessionStore } from '../../stores/openSessionStore';
import { RuntimeKernelBridge } from '../../runtime-kernel/runtimeKernelBridge';
import { useRuntimeKernelStore } from '../../runtime-kernel/runtimeKernelStore';
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
import type { Session } from '../../types';

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
  const [starting, setStarting] = useState(false);
  const [showNewSessionDialog, setShowNewSessionDialog] = useState(false);
  const [showNewProjectFromSession, setShowNewProjectFromSession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessions = useSessionStore((s) => s.sessions);
  const addProject = useProjectStore((s) => s.addProject);
  const projects = useProjectStore((s) => s.projects);

  const activeSession: Session | null = activeTabId ? sessions.find((s) => s.id === activeTabId) ?? null : null;

  const isComposerEnabled = useCallback((sessionId: string | null): boolean => {
    if (!sessionId) return false;
    const rt = useRuntimeKernelStore.getState().sessions[sessionId];
    return Boolean(rt && rt.hasWriter && rt.readerAlive && !['failed', 'exited', 'stopped'].includes(rt.status));
  }, []);

  const chatBlocks = useRuntimeKernelStore(
    useCallback((s) => (activeTabId ? (s.chatBlocks[activeTabId] ?? []) : []), [activeTabId])
  );

  const runtimeSnapshot = useRuntimeKernelStore(
    useCallback((s) => (activeTabId ? s.sessions[activeTabId] : undefined), [activeTabId])
  );

  useEffect(() => {
    const tab = tabs.find((t) => t.sessionId === activeTabId);
    if (tab?.viewMode) setViewMode(tab.viewMode);
  }, [activeTabId, tabs]);

  const handleSend = useCallback(async (
    text: string,
    _config: { model: string; effort: string; permissionMode: string; runtimeMode: string }
  ): Promise<SendResult> => {
    if (!activeTabId) return { ok: false, error: 'No active session' };

    const rt = useRuntimeKernelStore.getState().sessions[activeTabId];
    const alive = rt && rt.hasWriter && rt.readerAlive
      && !['failed', 'exited', 'stopped'].includes(String(rt.status));

    if (!alive) {
      const msg = 'Claude Runtime 尚未连接。请点击重新连接、恢复或重启 Runtime。';
      setError(msg);
      useErrorStore.getState().addError({
        severity: 'warning',
        source: 'session',
        title: 'Runtime not connected',
        detail: msg,
      });
      return { ok: false, error: msg };
    }

    try {
      await RuntimeKernelBridge.submitUserMessage({ guiSessionId: activeTabId, projectId: activeSession?.projectId ?? 'default', text });
      return { ok: true };
    } catch (err) {
      const msg = String(err);
      setError(`${t('workspace.sendFailed')}: ${msg}`);

      try {
        useErrorStore.getState().addError({
          severity: 'error',
          source: 'session',
          title: 'Runtime submit failed',
          detail: msg,
        });
      } catch {}

      return { ok: false, error: msg };
    }
  }, [activeTabId, activeSession, t]);

  // v26.0: Session creation via RuntimeKernelBridge with persistent PTY
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

    const sessionId = `ses-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const title = cwd.split(/[/\\]/).pop() || projName;

    try {
      const session = { id: sessionId, projectId, title, runtimeMode: 'pty-interactive' as const, status: 'starting' as const, model: 'sonnet', permissionMode: 'default' as const, cwd, inputTokens: 0, outputTokens: 0, totalCostUsd: 0, fileChangeCount: 0, riskCount: 0, auditCount: 0, isPinned: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as Session;
      useSessionStore.getState().addSession(session);
      useOpenSessionStore.getState().openSession({ sessionId, projectId, projectName: projName, title, status: 'starting', viewMode: 'chat', pendingConfirms: 0, riskCount: 0, isPinned: false });
      useOpenSessionStore.getState().setActiveTab(sessionId);
      RuntimeKernelBridge.startSession({ guiSessionId: sessionId, projectId, cwd, model: 'sonnet', effort: 'medium', permissionMode: 'default' }).catch((err) => {
        const msg = String(err);
        setError(`Runtime start failed: ${msg}`);
        useErrorStore.getState().addError({ severity: 'error', source: 'session', title: 'Runtime start failed', detail: msg });
      });
    } finally {
      setStarting(false);
    }
  }, [projects, t]);

  const handleCloseTab = useCallback(async (sessionId: string) => {
    // Default detach: do not kill background Claude process
    try {
      await RuntimeKernelBridge.detachSession(sessionId);
    } catch {
      // detach failure should not block UI close
    }
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

  const terminalBuffer = useRuntimeKernelStore(
    useCallback((s) => (activeTabId ? s.terminalBuffers[activeTabId] ?? '' : ''), [activeTabId])
  );

  const inspectorEvents = useMemo(() => {
    return chatBlocks.slice(-200);
  }, [chatBlocks]);

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
                }}
                style={{ padding: '4px 14px', fontSize: 'var(--cc-font-xs)', fontWeight: a ? 600 : 400, border: 'none', borderBottom: a ? '2px solid var(--cc-navy)' : '2px solid transparent', background: a ? 'var(--cc-surface-solid)' : 'transparent', color: a ? 'var(--cc-text)' : 'var(--cc-text-muted)', cursor: 'pointer' }}>{viewModeLabels[mode]}</button>;
            })}
            <CcButton variant="ghost" size="sm" onClick={handleStartPtySession} disabled={starting}>{starting ? t('workspace.starting') : `+ ${t('workspace.newSession')}`}</CcButton>
            {error && <span style={{ marginLeft: 12, fontSize: 'var(--cc-font-xs)', color: 'var(--cc-red)' }}>{error}</span>}
          </div>
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {viewMode === 'chat' && <><ChatView blocks={chatBlocks} streaming={runtimeSnapshot?.status === 'busy'} /><ComposerBar viewMode="chat" sessionRuntimeMode={activeSession?.runtimeMode} disabled={!isComposerEnabled(activeTabId)} disabledReason="runtime" onDisabledClick={() => { if (activeTabId) { RuntimeKernelBridge.startSession({ guiSessionId: activeTabId, projectId: activeSession?.projectId ?? '', cwd: activeSession?.cwd ?? '.', model: 'sonnet', effort: 'medium', permissionMode: 'default' }).catch((e) => setError(`Runtime start failed: ${String(e)}`)); } }} onSend={handleSend} /></>}
              {viewMode === 'terminal' && <TerminalView sessionId={activeTabId} buffer={terminalBuffer} onSend={(data) => { if (!activeTabId) return; RuntimeKernelBridge.submitUserMessage({ guiSessionId: activeTabId, projectId: activeSession?.projectId ?? 'default', text: data }); }} />}
              {viewMode === 'split' && (<div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}><div style={{ flex: '0 0 50%', borderRight: '1px solid var(--cc-border-strong)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}><TerminalView sessionId={activeTabId} buffer={terminalBuffer} onSend={(data) => { if (!activeTabId) return; RuntimeKernelBridge.submitUserMessage({ guiSessionId: activeTabId, projectId: activeSession?.projectId ?? 'default', text: data }); }} /></div><div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}><ChatView blocks={chatBlocks} streaming={runtimeSnapshot?.status === 'busy'} /><ComposerBar viewMode="split" sessionRuntimeMode={activeSession?.runtimeMode} disabled={!isComposerEnabled(activeTabId)} disabledReason="runtime" onDisabledClick={() => { if (activeTabId) { RuntimeKernelBridge.startSession({ guiSessionId: activeTabId, projectId: activeSession?.projectId ?? '', cwd: activeSession?.cwd ?? '.', model: 'sonnet', effort: 'medium', permissionMode: 'default' }).catch((e) => setError(`Runtime start failed: ${String(e)}`)); } }} onSend={handleSend} /></div></div>)}
            </div>
            <SessionInspector session={activeSession} events={inspectorEvents} collapsed={inspectorCollapsed} expanded={inspectorExpanded} onToggleCollapse={() => setInspectorCollapsed((v) => !v)} onToggleExpand={() => setInspectorExpanded((v) => !v)} />
          </div>
        </>
      )}

      {/* Dialogs ALWAYS rendered — regardless of tabs.length state */}
      <NewSessionDialog open={showNewSessionDialog} onClose={() => setShowNewSessionDialog(false)} onSelectProject={handleSelectProject} onCreateNew={handleCreateNewProject} />
      <NewProjectDialog open={showNewProjectFromSession} onClose={() => setShowNewProjectFromSession(false)} onConfirm={handleConfirmNewProject} />
    </div>
  );
}
