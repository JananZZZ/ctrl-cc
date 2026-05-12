import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProjectStore } from '../../stores/projectStore';
import { useSessionStore } from '../../stores/sessionStore';
import { useOpenSessionStore } from '../../stores/openSessionStore';
import { useSurfaceStore } from '../../stores/surfaceStore';
import { useErrorStore } from '../../stores/errorStore';
import { invokeCommand } from '../../services/invokeCommand';
import { startPtyV2ClaudeSession } from '../../features/runtime/services/interactionAdapter';
import { useRenderLoopGuard } from '../../debug/useRenderLoopGuard';
import { ProjectsTopBar } from './ProjectsTopBar';
import { ProjectManagementRail } from './ProjectManagementRail';
import { SessionManagementRail } from './SessionManagementRail';
import { ProjectDetailPanel } from './ProjectDetailPanel';
import { ImportSessionDialog } from './ImportSessionDialog';
import { NewProjectDialog } from './NewProjectDialog';

export function ProjectsSurface() {
  useRenderLoopGuard('ProjectsSurface');
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'running' | 'risk' | 'archived'>('all');
  const [projectRailCollapsed, setProjectRailCollapsed] = useState(false);
  const [sessionRailCollapsed, setSessionRailCollapsed] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [scannedSessions, setScannedSessions] = useState<any[]>([]);
  const [scanning, setScanning] = useState(false);
  const { selectProject, addProject } = useProjectStore();
  const sessions = useSessionStore((s) => s.sessions);
  const addSession = useSessionStore((s) => s.addSession);
  const { openSession } = useOpenSessionStore();
  const { navigateTo } = useSurfaceStore();

  const handleSelectProject = (id: string | null) => {
    setSelectedProjectId(id);
    setSelectedSessionId(null);
    selectProject(id);
  };

  const handleImportSessions = () => {
    setScanning(true);
    setShowImportDialog(true);
    invokeCommand<any[]>('scan_claude_sessions')
      .then(setScannedSessions)
      .catch(() => setScannedSessions([]))
      .finally(() => setScanning(false));
  };

  const handleImportSelected = (sessions: any[]) => {
    sessions.forEach((s) => {
      addSession({
        id: s.id, projectId: s.projectId || 'default', title: s.title || t('common.import'),
        runtimeMode: s.runtimeMode || 'pty-interactive', status: s.status || 'completed',
        model: s.model || 'sonnet', permissionMode: s.permissionMode || 'default',
        claudeSessionId: s.claudeSessionId, summary: s.summary,
        cwd: s.cwd || '.', inputTokens: s.inputTokens || 0, outputTokens: s.outputTokens || 0,
        totalCostUsd: s.totalCostUsd || 0, fileChangeCount: s.fileChangeCount || 0,
        riskCount: s.riskCount || 0, auditCount: s.auditCount || 0, isPinned: false,
        createdAt: s.createdAt || new Date().toISOString(),
        updatedAt: s.updatedAt || new Date().toISOString(),
      });
    });
  };

  const handleCreateProject = () => {
    setShowNewProjectDialog(true);
  };

  const handleConfirmNewProject = (name: string, path: string, gitBranch?: string) => {
    const id = `proj-${Date.now()}`;
    const proj = {
      id, workspaceRootId: '', name, path,
      gitBranch,
      isFavorite: false, isArchived: false, activeSessionCount: 0, totalSessionCount: 0,
      pendingPermissionCount: 0, riskCount: 0,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    addProject(proj);
    invokeCommand('save_project_to_db', { project: proj }).catch((e) => console.warn('save_project failed:', e));
    setShowNewProjectDialog(false);
    handleSelectProject(id);
  };

  const [creatingSession, setCreatingSession] = useState(false);

  const handleCreateSession = (projectId: string) => {
    if (creatingSession) return;
    setCreatingSession(true);
    const proj = useProjectStore.getState().projects.find((p) => p.id === projectId);
    const sessionId = `ses-${Date.now()}`;
    const cwd = proj?.path || '.';
    const title = cwd.split(/[/\\]/).pop() || t('workspace.startSession');

    // Step 1: Create session record immediately (no await on PTY)
    const newSes = {
      id: sessionId, projectId, title,
      runtimeMode: 'pty-interactive' as const, status: 'starting' as const, model: 'sonnet',
      permissionMode: 'default' as const, cwd,
      inputTokens: 0, outputTokens: 0, totalCostUsd: 0,
      fileChangeCount: 0, riskCount: 0, auditCount: 0, isPinned: false,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), startedAt: new Date().toISOString(),
    };
    addSession(newSes);
    invokeCommand('save_session_to_db', { session: newSes }).catch((e) => console.warn('save_session failed:', e));

    // Step 2: Open workspace tab + navigate immediately
    openSession({ sessionId, projectId, projectName: proj?.name || t('workspace.project'), title, status: 'starting', viewMode: 'terminal', pendingConfirms: 0, riskCount: 0, isPinned: false });
    navigateTo('workspace');

    // Step 3: Background PTY start — does NOT block UI
    startPtyV2ClaudeSession({
      sessionId, projectId, cwd, cliPath: 'claude', extraArgs: [],
    }).then((info) => {
      if (info?.sessionId) {
        try { useSessionStore.getState().updateSession(sessionId, { status: 'running' as const }); } catch {}
      }
    }).catch((e) => {
      try {
        useErrorStore.getState().addError({ severity: 'error', source: 'session', title: t('error.createSessionFailed'), detail: String(e) });
        useSessionStore.getState().updateSession(sessionId, { status: 'failed' as const });
      } catch {}
    }).finally(() => setCreatingSession(false));
  };

  const handleResumeSession = (sessionId: string) => {
    const ses = sessions.find((s) => s.id === sessionId);
    if (!ses) return;
    const newId = `resume-${Date.now()}`;
    // Step 1: Create record + navigate immediately
    addSession({ ...ses, id: newId, status: 'starting', startedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    openSession({ sessionId: newId, projectId: ses.projectId, projectName: ses.title, title: ses.title + ' (Resume)', status: 'starting', viewMode: 'terminal', pendingConfirms: 0, riskCount: ses.riskCount, isPinned: false });
    navigateTo('workspace');
    // Step 2: Background PTY
    startPtyV2ClaudeSession({
      sessionId: newId, projectId: ses.projectId, cwd: ses.cwd, cliPath: 'claude', extraArgs: ses.claudeSessionId ? ['--resume', ses.claudeSessionId] : [],
    }).then(() => {
      try { useSessionStore.getState().updateSession(newId, { status: 'running' as const }); } catch {}
    }).catch((e) => {
      try { useErrorStore.getState().addError({ severity: 'error', source: 'session', title: t('error.resumeSessionFailed'), detail: String(e) }); } catch {}
    });
  };

  return (
    <div data-testid="surface-projects" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <ProjectsTopBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onCreateProject={handleCreateProject}
        onImportProject={handleImportSessions}
        onContinueLatest={() => {
          const latest = sessions.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
          if (latest) {
            openSession({ sessionId: latest.id, projectId: latest.projectId, projectName: latest.title, title: latest.title, status: latest.status, viewMode: 'chat', pendingConfirms: 0, riskCount: latest.riskCount, isPinned: false });
            navigateTo('workspace');
          }
        }}
        filterMode={filterMode}
        onFilterChange={setFilterMode}
      />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <ProjectManagementRail
          collapsed={projectRailCollapsed}
          onToggleCollapse={() => setProjectRailCollapsed((v) => !v)}
          selectedProjectId={selectedProjectId}
          onSelectProject={handleSelectProject}
          searchQuery={searchQuery}
        />
        <SessionManagementRail
          collapsed={sessionRailCollapsed}
          onToggleCollapse={() => setSessionRailCollapsed((v) => !v)}
          projectId={selectedProjectId}
          selectedSessionId={selectedSessionId}
          onSelectSession={setSelectedSessionId}
          onResume={(ses) => handleResumeSession(ses.id)}
          onFork={(ses) => handleCreateSession(ses.projectId || 'default')}
        />
        <ProjectDetailPanel
          selectedProjectId={selectedProjectId}
          selectedSessionId={selectedSessionId}
          onSelectSession={setSelectedSessionId}
          onCreateSession={() => selectedProjectId && handleCreateSession(selectedProjectId)}
        />
      </div>
      <NewProjectDialog
        open={showNewProjectDialog}
        onClose={() => setShowNewProjectDialog(false)}
        onConfirm={handleConfirmNewProject}
      />
      <ImportSessionDialog
        open={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        onImport={handleImportSelected}
        sessions={scannedSessions}
        scanning={scanning}
      />
    </div>
  );
}
