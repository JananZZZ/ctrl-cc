import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSessionStore } from '../../stores/sessionStore';
import { CcStatusDot } from '../../components/ui/CcStatusDot';
import { CcBadge } from '../../components/ui/CcBadge';
import type { Session, SessionStatus } from '../../types';

interface Props {
  collapsed: boolean;
  onToggleCollapse: () => void;
  projectId: string | null;
  selectedSessionId: string | null;
  onSelectSession: (id: string) => void;
  onResume: (session: Session) => void;
  onFork: (session: Session) => void;
}

const STATUS_GROUPS: { status: SessionStatus; labelKey: string; defaultOpen: boolean }[] = [
  { status: 'running', labelKey: 'status.working', defaultOpen: true },
  { status: 'waiting', labelKey: 'status.waitingInput', defaultOpen: true },
  { status: 'paused', labelKey: 'status.paused', defaultOpen: true },
  { status: 'created', labelKey: 'status.ready', defaultOpen: false },
  { status: 'completed', labelKey: 'status.completed', defaultOpen: false },
  { status: 'failed', labelKey: 'status.failed', defaultOpen: false },
  { status: 'stopped', labelKey: 'status.stopped', defaultOpen: false },
  { status: 'archived', labelKey: 'status.archived', defaultOpen: false },
];

export function SessionManagementRail({ collapsed, onToggleCollapse, projectId, selectedSessionId, onSelectSession, onResume, onFork }: Props) {
  const { t } = useTranslation();
  const allSessions = useSessionStore((s) => s.sessions);
  const sessions = useMemo(() => projectId ? allSessions.filter((ss) => ss.projectId === projectId) : [], [allSessions, projectId]);

  if (collapsed) {
    return (
      <div style={{ width: 32, borderRight: '1px solid var(--cc-border)', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 8 }}>
        <button onClick={onToggleCollapse} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-muted)' }}>&#x25B6;</button>
      </div>
    );
  }

  if (!projectId) {
    return (
      <div className="session-management-rail" data-testid="session-management-rail" style={{ width: 280, flexShrink: 0, borderRight: '1px solid var(--cc-border)', display: 'flex', flexDirection: 'column' }}>
        <RailHeader title={t('sessionInspector.session')} onCollapse={onToggleCollapse} count={0} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <span style={{ fontSize: 'var(--cc-font-sm)', color: 'var(--cc-text-soft)' }}>{t('common.selectProject')}</span>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="session-management-rail" style={{ width: 280, flexShrink: 0, borderRight: '1px solid var(--cc-border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <RailHeader title={t('sessionInspector.session')} onCollapse={onToggleCollapse} count={sessions.length} />
      <div style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}>
        {STATUS_GROUPS.map((g) => {
          const groupSessions = sessions.filter((s) => s.status === g.status);
          if (groupSessions.length === 0) return null;
          return (
            <div key={g.status} style={{ marginBottom: 2 }}>
              <div style={{ padding: '4px 12px', fontSize: 'var(--cc-font-xs)', fontWeight: 600, color: 'var(--cc-text-soft)', cursor: 'pointer' }}>
                {t(g.labelKey)} ({groupSessions.length})
              </div>
              {groupSessions.map((s) => (
                <SessionCard key={s.id} session={s} isSelected={selectedSessionId === s.id} onSelect={() => onSelectSession(s.id)} onResume={() => onResume(s)} onFork={() => onFork(s)} t={t} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RailHeader({ title, onCollapse, count }: { title: string; onCollapse: () => void; count: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid var(--cc-border)', minHeight: 36 }}>
      <span style={{ fontSize: 'var(--cc-font-xs)', fontWeight: 600, color: 'var(--cc-text)' }}>{title}</span>
      <span style={{ fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-muted)' }}>{count}</span>
      <button onClick={onCollapse} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-muted)' }}>&#x25C0;</button>
    </div>
  );
}

function SessionCard({ session, isSelected, onSelect, onResume, onFork, t }: { session: Session; isSelected: boolean; onSelect: () => void; onResume: () => void; onFork: () => void; t: (key: string, opts?: any) => string }) {
  const statusMap: Record<SessionStatus, 'running' | 'waiting' | 'error' | 'done' | 'idle'> = {
    running: 'running', waiting: 'waiting', created: 'idle', starting: 'running',
    paused: 'idle', completed: 'done', failed: 'error', stopped: 'idle', archived: 'idle',
    disconnected: 'error',
  };
  const isRunning = session.status === 'running' || session.status === 'starting';
  const canResume = session.claudeSessionId != null && !isRunning;

  return (
    <div
      data-testid="session-node"
      onClick={onSelect}
      style={{
        padding: '6px 12px 6px 20px', cursor: 'pointer',
        background: isSelected ? 'var(--cc-brand-soft)' : 'transparent',
        borderLeft: isSelected ? '2px solid var(--cc-navy)' : '2px solid transparent',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <CcStatusDot status={statusMap[session.status]} size={7} pulse={isRunning} />
        <span style={{ fontWeight: 500, fontSize: 'var(--cc-font-sm)', color: 'var(--cc-text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.title}</span>
        <CcBadge variant={session.runtimeMode === 'pty-interactive' ? 'info' : session.runtimeMode === 'kernel-persistent' ? 'success' : 'default'}>{session.runtimeMode === 'pty-interactive' ? 'PTY' : session.runtimeMode === 'kernel-persistent' ? 'Kernel' : 'CLI'}</CcBadge>
      </div>
      <div style={{ fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-soft)', marginTop: 2 }}>
        <span style={{ marginRight: 8 }}>{session.model}</span>
        <span style={{ marginRight: 8 }}>{session.permissionMode}</span>
        {session.fileChangeCount > 0 && <span style={{ marginRight: 8 }}>{t('projects.fileCountLabel', { count: session.fileChangeCount })}</span>}
        {session.riskCount > 0 && <span style={{ color: 'var(--cc-red)' }}>{t('projects.riskCountLabel', { count: session.riskCount })}</span>}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        {canResume && <button data-testid="session-resume-button" onClick={(e) => { e.stopPropagation(); onResume(); }} style={actionBtnStyle}>Resume</button>}
        <button data-testid="session-fork-button" onClick={(e) => { e.stopPropagation(); onFork(); }} style={{ ...actionBtnStyle, color: 'var(--cc-purple)' }}>Fork</button>
      </div>
    </div>
  );
}

const actionBtnStyle: React.CSSProperties = {
  padding: '1px 8px', fontSize: 'var(--cc-font-xs)', fontWeight: 500,
  border: '1px solid var(--cc-border)', borderRadius: 'var(--cc-radius-xs)',
  background: 'var(--cc-surface-solid)', color: 'var(--cc-blue)', cursor: 'pointer',
};
