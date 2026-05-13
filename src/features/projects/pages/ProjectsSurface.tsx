// v12.0 Projects Operations Center
import { useState, useMemo, useCallback } from 'react';
import { ProjectsTopCommandBar } from '../components/ProjectsTopCommandBar';
import { ProjectNav, type ProjectNavItem, type ProjectNavSection } from '../components/ProjectNav';
import { ProjectHero } from '../components/ProjectHero';
import { RuntimeActionRibbon } from '../components/RuntimeActionRibbon';
import { SessionWaterfall, type SessionCardItem } from '../components/SessionWaterfall';
import { ProjectInspector } from '../components/ProjectInspector';
import { RuntimeBridge } from '../../runtime/services/runtimeBridge';
import { useProjectStore } from '../../../stores/projectStore';
import { useSessionStore } from '../../../stores/sessionStore';
import { useRuntimeStore } from '../../runtime/stores/runtimeStore';

export function ProjectsSurface() {
  const projects = useProjectStore(s => s.projects);
  const sessions = useSessionStore(s => s.sessions);
  const rtSessions = useRuntimeStore(s => s.sessions);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState('overview');

  const sections: ProjectNavSection[] = [
    { id: 'running', label: 'Running', filter: p => p.runningCount > 0 },
    { id: 'needs-attention', label: 'Needs Attention', filter: p => p.status === 'needs-attention' },
    { id: 'all', label: 'All Projects', filter: () => true },
  ];

  const navItems: ProjectNavItem[] = useMemo(() => projects.map(p => {
    const rtForProject = Object.values(rtSessions).filter(s => s.projectId === p.id);
    const pathParts = p.path.split(/[/\\]/);
    return {
      id: p.id, name: p.name, pathTail: pathParts.slice(-2).join('/'),
      status: (p.isArchived ? 'archived' : rtForProject.some(s => s.status === 'failed') ? 'needs-attention' : rtForProject.some(s => s.status === 'claude-active') ? 'active' : 'idle') as ProjectNavItem['status'],
      runningCount: rtForProject.filter(s => s.ptySessionId && s.status !== 'killed').length,
      riskCount: sessions.filter(s => s.projectId === p.id).reduce((sum, v) => sum + (v.riskCount || 0), 0),
      gitBranch: p.gitBranch,
    };
  }), [projects, sessions, rtSessions]);

  const active = projects.find(p => p.id === activeId);

  const handleNewSession = useCallback(() => {
    if (!active) return;
    RuntimeBridge.startInteractiveSession({ projectId: active.id, projectName: active.name, cwd: active.path, mode: 'new' });
  }, [active]);

  const projectSessions: SessionCardItem[] = useMemo(() => {
    if (!activeId) return [];
    return sessions.filter(s => s.projectId === activeId).map(s => {
      const rt = Object.values(rtSessions).find(r => r.id === s.id);
      return {
        id: s.id, name: s.title, status: rt?.status ?? s.status,
        ptyStatus: rt?.ptySessionId ? 'active' : 'closed', claudeSessionId: s.claudeSessionId,
        model: s.model, cwd: s.cwd, tokenCount: s.inputTokens + s.outputTokens,
        costUsd: s.totalCostUsd, filesChanged: s.fileChangeCount || 0,
        riskCount: s.riskCount || 0, waitingPermission: rt?.status === 'waiting-permission',
      };
    });
  }, [activeId, sessions, rtSessions]);

  return (
    <div style={{ display: 'flex', height: '100%', fontFamily: 'var(--cc-font-sans)', color: 'var(--cc-text)' }}>
      <ProjectNav projects={navItems} activeProjectId={activeId} onSelectProject={setActiveId} sections={sections} />
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <ProjectsTopCommandBar projectCount={projects.length} runningCount={Object.values(rtSessions).filter(s => s.ptySessionId).length} />
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--cc-space-md)' }}>
          {active ? (
            <>
              <ProjectHero projectName={active.name} projectPath={active.path} gitBranch={active.gitBranch}
                gitDirty={false} claudeReady={Object.values(rtSessions).some(s => s.projectId === active.id && s.status === 'claude-active')}
                runningSessions={Object.values(rtSessions).filter(s => s.projectId === active.id && s.ptySessionId).length}
                lastActivity={active.lastActivityAt} onNewSession={handleNewSession} />
              <RuntimeActionRibbon projectId={active.id} hasActiveSession={projectSessions.length > 0} onNewSession={handleNewSession} />
              <SessionWaterfall sessions={projectSessions} onOpenWorkspace={() => {}}
                onStop={(id) => RuntimeBridge.stop(id).catch(() => {})} onFork={() => {}} onExportLog={() => {}} onOpenDiagnostics={() => {}} />
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--cc-text-muted)' }}>Select a project to view details.</div>
          )}
        </div>
      </div>
      <ProjectInspector tabs={[{ id: 'overview', label: 'Overview' }, { id: 'sessions', label: 'Sessions', count: projectSessions.length }]} activeTab={inspectorTab} onTabChange={setInspectorTab}>
        <div style={{ fontSize: '13px', color: 'var(--cc-text-muted)' }}>{active ? `Inspecting: ${active.name}` : 'Select a project.'}</div>
      </ProjectInspector>
    </div>
  );
}
