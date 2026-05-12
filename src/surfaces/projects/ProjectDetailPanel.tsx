import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useProjectStore } from '../../stores/projectStore';
import { useSessionStore } from '../../stores/sessionStore';
import { invokeCommand } from '../../services/invokeCommand';
import { useSurfaceStore } from '../../stores/surfaceStore';
import { useOpenSessionStore } from '../../stores/openSessionStore';
import { useErrorStore } from '../../stores/errorStore';
import { CcCard } from '../../components/ui/CcCard';
import { CcBadge } from '../../components/ui/CcBadge';
import { CcStatusDot } from '../../components/ui/CcStatusDot';
import { CcButton } from '../../components/ui/CcButton';
import { CcEmptyState } from '../../components/ui/CcEmptyState';
import type { SessionStatus } from '../../types';

interface Props {
  selectedProjectId: string | null;
  selectedSessionId: string | null;
  onSelectSession: (id: string) => void;
  onCreateSession: () => void;
}

export function ProjectDetailPanel({ selectedProjectId, selectedSessionId, onSelectSession, onCreateSession }: Props) {
  const { t } = useTranslation();
  if (selectedSessionId) {
    return <SessionDetail sessionId={selectedSessionId} />;
  }
  if (selectedProjectId) {
    return <ProjectDetail projectId={selectedProjectId} onSelectSession={onSelectSession} onCreateSession={onCreateSession} />;
  }
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cc-bg)' }}>
      <CcEmptyState icon="📁" title={t('projects.selectProject')} description={t('projects.detailDesc')} />
    </div>
  );
}

function ProjectDetail({ projectId, onSelectSession, onCreateSession }: { projectId: string; onSelectSession: (id: string) => void; onCreateSession: () => void }) {
  const { t } = useTranslation();
  const project = useProjectStore((s) => s.projects.find((p) => p.id === projectId));
  const allSessions = useSessionStore((s) => s.sessions);
  const sessions = useMemo(() => allSessions.filter((ss) => ss.projectId === projectId), [allSessions, projectId]);
  const { navigateTo } = useSurfaceStore();
  const { openSession } = useOpenSessionStore();
  if (!project) return <CcEmptyState icon="❓" title={t('projects.projectNotFound')} />;

  const recentSessions = sessions.slice(0, 5);
  const hasRunning = project.activeSessionCount > 0;

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 24, background: 'var(--cc-bg)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 'var(--cc-font-xl)', fontWeight: 600, color: 'var(--cc-text)', marginBottom: 4 }}>{project.name}</h2>
          <p style={{ fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-muted)', fontFamily: 'var(--cc-font-mono)' }}>{project.path}</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <CcButton size="sm" variant="primary" onClick={onCreateSession} data-testid="create-session-button">+ {t('projects.newSession')}</CcButton>
          {hasRunning && <CcButton size="sm" onClick={() => { const runningSession = sessions.find(s => s.status === 'running'); if (runningSession) { openSession({ sessionId: runningSession.id, projectId: runningSession.projectId, projectName: project.name, title: runningSession.title, status: 'running', viewMode: 'chat', pendingConfirms: 0, riskCount: 0, isPinned: false }); } navigateTo('workspace'); }}>{t('projects.openWorkspace')}</CcButton>}
        </div>
      </div>

      {project.gitBranch && (
        <div style={{ marginBottom: 16 }}>
          <CcBadge variant="default">🌿 {project.gitBranch}</CcBadge>
          {project.isFavorite && <span style={{ marginLeft: 6 }}><CcBadge variant="warning">⭐ {t('projects.favorite')}</CcBadge></span>}
          {project.isArchived && <span style={{ marginLeft: 6 }}><CcBadge variant="default">📦 {t('projects.archived')}</CcBadge></span>}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
        <MiniStat label={t('projects.activeSessions')} value={project.activeSessionCount} color="var(--cc-green)" />
        <MiniStat label={t('projects.totalSessions')} value={project.totalSessionCount} color="var(--cc-text)" />
        <MiniStat label={t('projects.pendingConfirm')} value={project.pendingPermissionCount} color="var(--cc-amber)" />
        <MiniStat label={t('projects.risks')} value={project.riskCount} color="var(--cc-red)" />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <CcButton size="sm" variant="ghost" onClick={onCreateSession}>{t('projects.newClaudeSession')}</CcButton>
        {hasRunning && <CcButton size="sm" variant="ghost" onClick={() => navigateTo('workspace')}>{t('projects.openWorkspace')}</CcButton>}
        <CcButton size="sm" variant="ghost" onClick={() => { invokeCommand("detect_git_info", { path: project.path }).then((info: any) => { useErrorStore.getState().addError({ severity: 'info', source: 'git', title: 'Git', detail: (info && info.isRepo) ? "Branch: " + (info.branch || "main") : "Not a git repository" }); }).catch(() => useErrorStore.getState().addError({ severity: 'error', source: 'git', title: 'Git', detail: 'Detection failed' })); }}>{t('projects.refreshGitStatus')}</CcButton>
        <CcButton size="sm" variant="ghost" onClick={() => { invokeCommand<any[]>("list_directory", { path: project.path, maxDepth: 1 }).then((items: any[]) => useErrorStore.getState().addError({ severity: 'info', source: 'fs', title: 'Scan', detail: `Found ${items ? items.length : 0} items` })).catch(() => useErrorStore.getState().addError({ severity: 'error', source: 'fs', title: 'Scan', detail: 'Failed' })); }}>{t('projects.scanResources')}</CcButton>
      </div>

      <h3 style={{ fontSize: 'var(--cc-font-md)', fontWeight: 600, color: 'var(--cc-text)', marginBottom: 12 }}>{t('projects.recentSessions')}</h3>
      {recentSessions.length === 0 ? (
        <CcCard style={{ textAlign: 'center', padding: 24 }}>
          <CcEmptyState icon="💬" title={t('projects.noSessions')} description={t('newSessionDialog.desc')} />
        </CcCard>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {recentSessions.map((s) => (
            <div
              key={s.id}
              onClick={() => onSelectSession(s.id)}
              style={sessionRowStyle}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                <CcStatusDot status={statusDot(s.status)} size={7} pulse={s.status === 'running'} />
                <span style={{ fontWeight: 500, fontSize: 'var(--cc-font-sm)', color: 'var(--cc-text)' }}>{s.title}</span>
                <CcBadge variant={s.runtimeMode === 'pty-interactive' ? 'info' : 'default'}>{s.runtimeMode === 'pty-interactive' ? 'PTY' : 'CLI'}</CcBadge>
              </div>
              <div style={{ fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-muted)' }}>
                {s.model} &middot; {fmtDate(s.updatedAt)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SessionDetail({ sessionId }: { sessionId: string }) {
  const { t } = useTranslation();
  const session = useSessionStore((s) => s.sessions.find((ss) => ss.id === sessionId));
  const addSession = useSessionStore((s) => s.addSession);
  const updateSession = useSessionStore((s) => s.updateSession);
  const removeSession = useSessionStore((s) => s.removeSession);
  const { navigateTo } = useSurfaceStore();
  const { openSession } = useOpenSessionStore();
  if (!session) return <CcEmptyState icon="❓" title={t('session.notFound')} />;

  const isRunning = session.status === 'running' || session.status === 'starting';
  const canResume = session.claudeSessionId != null && !isRunning;

  const handleOpenWorkspace = () => {
    openSession({
      sessionId: session.id, projectId: session.projectId,
      projectName: session.title, title: session.title,
      status: session.status, viewMode: session.viewMode ?? 'chat',
      pendingConfirms: 0, riskCount: session.riskCount, isPinned: false,
    });
    navigateTo('workspace');
  };

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 24, background: 'var(--cc-bg)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <CcStatusDot status={statusDot(session.status)} size={9} pulse={isRunning} />
            <h2 style={{ fontSize: 'var(--cc-font-xl)', fontWeight: 600, color: 'var(--cc-text)' }}>{session.title}</h2>
            <CcBadge variant={isRunning ? 'success' : 'default'}>{session.status}</CcBadge>
          </div>
          <p style={{ fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-muted)', fontFamily: 'var(--cc-font-mono)' }}>{session.cwd}</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {isRunning && <CcButton size="sm" variant="primary" onClick={handleOpenWorkspace}>{t('session.openWorkspace')}</CcButton>}
          {canResume && <CcButton size="sm" onClick={handleOpenWorkspace}>{t('session.resumeSession')}</CcButton>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        <CcBadge variant="info">{session.runtimeMode}</CcBadge>
        <CcBadge variant="default">{session.model}</CcBadge>
        {session.effort && <CcBadge variant="default">{session.effort}</CcBadge>}
        <CcBadge variant="default">{session.permissionMode}</CcBadge>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10, marginBottom: 20 }}>
        <MiniStat label={t('session.inputTokens')} value={fmtNum(session.inputTokens)} color="var(--cc-blue)" />
        <MiniStat label={t('session.outputTokens')} value={fmtNum(session.outputTokens)} color="var(--cc-green)" />
        <MiniStat label={t('session.cost')} value={`$${session.totalCostUsd.toFixed(4)}`} color="var(--cc-text)" />
        <MiniStat label={t('session.files')} value={session.fileChangeCount} color="var(--cc-purple)" />
        <MiniStat label={t('session.risks')} value={session.riskCount} color="var(--cc-red)" />
        <MiniStat label={t('session.audits')} value={session.auditCount} color="var(--cc-text-muted)" />
      </div>

      {session.summary && (
        <CcCard style={{ marginBottom: 16, background: 'var(--cc-bg-muted)' }}>
          <h4 style={{ fontSize: 'var(--cc-font-sm)', fontWeight: 600, color: 'var(--cc-text)', marginBottom: 6 }}>{t('session.summary')}</h4>
          <p style={{ fontSize: 'var(--cc-font-sm)', color: 'var(--cc-text-muted)', lineHeight: 1.6 }}>{session.summary}</p>
        </CcCard>
      )}

      <div style={{ marginBottom: 20 }}>
        <h4 style={{ fontSize: 'var(--cc-font-sm)', fontWeight: 600, color: 'var(--cc-text)', marginBottom: 6 }}>{t('projects.details')}</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: 'var(--cc-font-sm)' }}>
          <InfoRow label={t('session.createdAt')} value={fmtDate(session.createdAt)} />
          {session.startedAt && <InfoRow label={t('session.startedAt')} value={fmtDate(session.startedAt)} />}
          {session.endedAt && <InfoRow label={t('session.endedAt')} value={fmtDate(session.endedAt)} />}
          {session.claudeSessionId && <InfoRow label="Claude Session ID" value={session.claudeSessionId} mono />}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid var(--cc-border)', paddingTop: 16 }}>
        {isRunning && <CcButton size="sm" variant="primary" onClick={handleOpenWorkspace}>{t('session.openWorkspace')}</CcButton>}
        {canResume && <CcButton size="sm" onClick={handleOpenWorkspace}>{t('session.resumeSession')}</CcButton>}
        <CcButton size="sm" variant="ghost" onClick={() => { const newId = "ses-" + Date.now(); addSession({ id: newId, projectId: session.projectId, title: session.title + " (Fork)", runtimeMode: session.runtimeMode, status: "created", model: session.model, permissionMode: session.permissionMode, cwd: session.cwd, inputTokens: 0, outputTokens: 0, totalCostUsd: 0, fileChangeCount: 0, riskCount: 0, auditCount: 0, isPinned: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }); }}>{t('session.createFork')} {t('projects.newSession')}</CcButton>
        <CcButton size="sm" variant="ghost" onClick={() => { invokeCommand("export_session_bundle", { sessionId: session.id }).then((r: any) => useErrorStore.getState().addError({ severity: 'info', source: 'session', title: 'Export', detail: String(r) })).catch((e: any) => useErrorStore.getState().addError({ severity: 'error', source: 'session', title: 'Export', detail: String(e) })); }}>{t('session.exportBundle')}</CcButton>
        <CcButton size="sm" variant="ghost" onClick={() => { updateSession(session.id, { status: "archived" }); }}>{t('session.archive')}</CcButton>
        <CcButton size="sm" variant="danger" onClick={() => { removeSession(session.id); }}>{t('session.deleteRecord')}</CcButton>
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{ padding: '10px 14px', borderRadius: 'var(--cc-radius-md)', background: 'var(--cc-surface-solid)', border: '1px solid var(--cc-border)' }}>
      <div style={{ fontSize: 'var(--cc-font-xl)', fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-muted)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ padding: '2px 0' }}>
      <span style={{ color: 'var(--cc-text-soft)', fontSize: 'var(--cc-font-xs)' }}>{label}</span>
      <span style={{ marginLeft: 8, color: 'var(--cc-text)', fontFamily: mono ? 'var(--cc-font-mono)' : undefined }}>{value}</span>
    </div>
  );
}

function statusDot(status: SessionStatus): 'running' | 'waiting' | 'error' | 'done' | 'idle' {
  const m: Record<string, 'running' | 'waiting' | 'error' | 'done' | 'idle'> = {
    running: 'running', waiting: 'waiting', created: 'idle', starting: 'running',
    paused: 'idle', completed: 'done', failed: 'error', stopped: 'idle', archived: 'idle',
  };
  return m[status] ?? 'idle';
}

function fmtDate(iso: string) { try { return new Date(iso).toLocaleString(navigator.language, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return iso; } }
function fmtNum(n: number) { return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n); }

const sessionRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '8px 14px', borderRadius: 'var(--cc-radius-sm)',
  background: 'var(--cc-surface-solid)', border: '1px solid var(--cc-border)',
  cursor: 'pointer',
};
