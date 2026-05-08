import { useProjectStore } from '../../stores/projectStore';
import { useSessionStore } from '../../stores/sessionStore';
import { useSurfaceStore } from '../../stores/surfaceStore';
import { useOpenSessionStore } from '../../stores/openSessionStore';
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
  if (selectedSessionId) {
    return <SessionDetail sessionId={selectedSessionId} />;
  }
  if (selectedProjectId) {
    return <ProjectDetail projectId={selectedProjectId} onSelectSession={onSelectSession} onCreateSession={onCreateSession} />;
  }
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cc-bg)' }}>
      <CcEmptyState icon="📁" title="选择一个项目" description="从左侧项目栏选择项目查看详情，或新建项目开始" />
    </div>
  );
}

function ProjectDetail({ projectId, onSelectSession, onCreateSession }: { projectId: string; onSelectSession: (id: string) => void; onCreateSession: () => void }) {
  const project = useProjectStore((s) => s.projects.find((p) => p.id === projectId));
  const sessions = useSessionStore((s) => s.sessions.filter((ss) => ss.projectId === projectId));
  const { navigateTo } = useSurfaceStore();
  const { openSession } = useOpenSessionStore();
  if (!project) return <CcEmptyState icon="❓" title="项目未找到" />;

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
          <CcButton size="sm" variant="primary" onClick={onCreateSession} data-testid="create-session-button">+ 新建会话</CcButton>
          {hasRunning && <CcButton size="sm" onClick={() => { const runningSession = sessions.find(s => s.status === 'running'); if (runningSession) { openSession({ sessionId: runningSession.id, projectId: runningSession.projectId, projectName: project.name, title: runningSession.title, status: 'running', viewMode: 'chat', pendingConfirms: 0, riskCount: 0, isPinned: false }); } navigateTo('workspace'); }}>打开工作区</CcButton>}
        </div>
      </div>

      {project.gitBranch && (
        <div style={{ marginBottom: 16 }}>
          <CcBadge variant="default">🌿 {project.gitBranch}</CcBadge>
          {project.isFavorite && <span style={{ marginLeft: 6 }}><CcBadge variant="warning">⭐ 收藏</CcBadge></span>}
          {project.isArchived && <span style={{ marginLeft: 6 }}><CcBadge variant="default">📦 已归档</CcBadge></span>}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
        <MiniStat label="活跃会话" value={project.activeSessionCount} color="var(--cc-green)" />
        <MiniStat label="总会话" value={project.totalSessionCount} color="var(--cc-text)" />
        <MiniStat label="待确认" value={project.pendingPermissionCount} color="var(--cc-amber)" />
        <MiniStat label="风险" value={project.riskCount} color="var(--cc-red)" />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <CcButton size="sm" variant="ghost" onClick={onCreateSession}>新建 Claude 会话</CcButton>
        {hasRunning && <CcButton size="sm" variant="ghost" onClick={() => navigateTo('workspace')}>打开工作区</CcButton>}
        <CcButton size="sm" variant="ghost" onClick={() => {}}>刷新 Git 状态</CcButton>
        <CcButton size="sm" variant="ghost" onClick={() => {}}>扫描资源</CcButton>
      </div>

      <h3 style={{ fontSize: 'var(--cc-font-md)', fontWeight: 600, color: 'var(--cc-text)', marginBottom: 12 }}>最近会话</h3>
      {recentSessions.length === 0 ? (
        <CcCard style={{ textAlign: 'center', padding: 24 }}>
          <CcEmptyState icon="💬" title="暂无会话" description="点击「新建会话」开始使用 Claude Code" />
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
                {s.model} · {fmtDate(s.updatedAt)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SessionDetail({ sessionId }: { sessionId: string }) {
  const session = useSessionStore((s) => s.sessions.find((ss) => ss.id === sessionId));
  const { navigateTo } = useSurfaceStore();
  const { openSession } = useOpenSessionStore();
  if (!session) return <CcEmptyState icon="❓" title="会话未找到" />;

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
          {isRunning && <CcButton size="sm" variant="primary" onClick={handleOpenWorkspace}>打开工作区</CcButton>}
          {canResume && <CcButton size="sm" onClick={handleOpenWorkspace}>Resume</CcButton>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        <CcBadge variant="info">{session.runtimeMode}</CcBadge>
        <CcBadge variant="default">{session.model}</CcBadge>
        {session.effort && <CcBadge variant="default">{session.effort}</CcBadge>}
        <CcBadge variant="default">{session.permissionMode}</CcBadge>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10, marginBottom: 20 }}>
        <MiniStat label="输入 Tokens" value={fmtNum(session.inputTokens)} color="var(--cc-blue)" />
        <MiniStat label="输出 Tokens" value={fmtNum(session.outputTokens)} color="var(--cc-green)" />
        <MiniStat label="费用" value={`$${session.totalCostUsd.toFixed(4)}`} color="var(--cc-text)" />
        <MiniStat label="文件变更" value={session.fileChangeCount} color="var(--cc-purple)" />
        <MiniStat label="风险" value={session.riskCount} color="var(--cc-red)" />
        <MiniStat label="审计" value={session.auditCount} color="var(--cc-text-muted)" />
      </div>

      {session.summary && (
        <CcCard style={{ marginBottom: 16, background: 'var(--cc-bg-muted)' }}>
          <h4 style={{ fontSize: 'var(--cc-font-sm)', fontWeight: 600, color: 'var(--cc-text)', marginBottom: 6 }}>摘要</h4>
          <p style={{ fontSize: 'var(--cc-font-sm)', color: 'var(--cc-text-muted)', lineHeight: 1.6 }}>{session.summary}</p>
        </CcCard>
      )}

      <div style={{ marginBottom: 20 }}>
        <h4 style={{ fontSize: 'var(--cc-font-sm)', fontWeight: 600, color: 'var(--cc-text)', marginBottom: 6 }}>详细信息</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: 'var(--cc-font-sm)' }}>
          <InfoRow label="创建时间" value={fmtDate(session.createdAt)} />
          {session.startedAt && <InfoRow label="启动时间" value={fmtDate(session.startedAt)} />}
          {session.endedAt && <InfoRow label="结束时间" value={fmtDate(session.endedAt)} />}
          {session.claudeSessionId && <InfoRow label="Claude Session ID" value={session.claudeSessionId} mono />}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid var(--cc-border)', paddingTop: 16 }}>
        {isRunning && <CcButton size="sm" variant="primary" onClick={handleOpenWorkspace}>打开工作区</CcButton>}
        {canResume && <CcButton size="sm" onClick={handleOpenWorkspace}>Resume</CcButton>}
        <CcButton size="sm" variant="ghost" onClick={() => {}}>Fork 新会话</CcButton>
        <CcButton size="sm" variant="ghost" onClick={() => {}}>导出 Bundle</CcButton>
        <CcButton size="sm" variant="ghost" onClick={() => {}}>归档</CcButton>
        <CcButton size="sm" variant="danger" onClick={() => {}}>删除记录</CcButton>
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

function fmtDate(iso: string) { try { return new Date(iso).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return iso; } }
function fmtNum(n: number) { return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n); }

const sessionRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '8px 14px', borderRadius: 'var(--cc-radius-sm)',
  background: 'var(--cc-surface-solid)', border: '1px solid var(--cc-border)',
  cursor: 'pointer',
};
