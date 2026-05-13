// v10.0 ProjectsSnapshot — stable derived view for Projects surface
import { useSessionStore } from '../../../stores/sessionStore';
import { useProjectStore } from '../../../stores/projectStore';
import { useRuntimeStore } from '../../runtime/stores/runtimeStore';

export interface ProjectSummary {
  id: string;
  name: string;
  path: string;
  gitBranch: string | null;
  activeSessionCount: number;
  totalSessionCount: number;
  runningSessionCount: number;
  riskCount: number;
  lastActivity: string | null;
  status: 'active' | 'idle' | 'needs-attention' | 'archived' | 'missing-path';
}

export interface ProjectsSnapshot {
  generatedAt: string;
  favorites: ProjectSummary[];
  running: ProjectSummary[];
  needsAttention: ProjectSummary[];
  all: ProjectSummary[];
  archived: ProjectSummary[];
  missingPath: ProjectSummary[];
  totalProjects: number;
  totalRunningSessions: number;
}

export function buildProjectsSnapshot(): ProjectsSnapshot {
  const projects = useProjectStore.getState().projects;
  const sessions = useSessionStore.getState().sessions;
  const runtimeSessions = useRuntimeStore.getState().sessions;

  const summaries: ProjectSummary[] = projects.map(p => {
    const projectSessions = sessions.filter(s => s.projectId === p.id);
    const runtimeForProject = Object.values(runtimeSessions).filter(s => s.projectId === p.id);

    const s: ProjectSummary = {
      id: p.id,
      name: p.name,
      path: p.path,
      gitBranch: p.gitBranch ?? null,
      activeSessionCount: p.activeSessionCount ?? 0,
      totalSessionCount: projectSessions.length,
      runningSessionCount: runtimeForProject.filter(s =>
        s.status === 'claude-active' || s.status === 'pty-ready' || s.status === 'pty-starting'
      ).length,
      riskCount: projectSessions.reduce((sum, v) => sum + (v.riskCount || 0), 0),
      lastActivity: projectSessions[0]?.updatedAt ?? null,
      status: 'idle' as const,
    };

    if (p.isArchived) s.status = 'archived';
    else if (!p.path) s.status = 'missing-path';
    else if (projectSessions.some(ps => ps.status === 'failed')) s.status = 'needs-attention';
    else if (runtimeForProject.some(rs => rs.status === 'claude-active')) s.status = 'active';

    return s;
  }).sort((a, b) => (b.lastActivity ?? '').localeCompare(a.lastActivity ?? ''));

  return {
    generatedAt: new Date().toISOString(),
    favorites: summaries.filter(s => s.status === 'active' || s.status === 'needs-attention').slice(0, 8),
    running: summaries.filter(s => s.runningSessionCount > 0),
    needsAttention: summaries.filter(s => s.status === 'needs-attention'),
    all: summaries.filter(s => s.status !== 'archived' && s.status !== 'missing-path'),
    archived: summaries.filter(s => s.status === 'archived'),
    missingPath: summaries.filter(s => s.status === 'missing-path'),
    totalProjects: summaries.length,
    totalRunningSessions: summaries.reduce((s, v) => s + v.runningSessionCount, 0),
  };
}
