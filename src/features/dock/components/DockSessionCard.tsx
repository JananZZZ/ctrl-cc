import React from 'react';
import type { DockSessionSummary } from '../../app-core/snapshots/dockSnapshot';

interface DockSessionCardProps {
  session: DockSessionSummary;
  onOpen: (uiSessionId: string) => void;
  onStop: (uiSessionId: string) => void;
}

export const DockSessionCard: React.FC<DockSessionCardProps> = ({ session, onOpen, onStop }) => {
  const statusDotColor =
    session.status === 'claude-active' ? 'var(--cc-green)'
    : session.status === 'pty-ready' ? 'var(--cc-brand)'
    : session.status === 'failed' ? 'var(--cc-red)'
    : 'var(--cc-amber)';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 'var(--cc-space-sm)',
      padding: 'var(--cc-space-sm)', borderRadius: 'var(--cc-radius-sm)',
      background: 'var(--cc-surface)', border: '1px solid var(--cc-border-soft)',
      fontFamily: 'var(--cc-font-sans)', fontSize: '12px',
    }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusDotColor, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: 'var(--cc-text)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {session.title}
        </div>
        <div style={{ color: 'var(--cc-text-muted)', fontSize: '10px' }}>
          {session.projectName} | {session.status}
          {session.waitingPermission && ' | waiting permission'}
          {session.riskCount > 0 && ` | risk: ${session.riskCount}`}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
        <button onClick={() => onOpen(session.uiSessionId)} style={{
          padding: '2px 8px', borderRadius: 'var(--cc-radius-sm)',
          border: '1px solid var(--cc-border)', background: 'transparent',
          color: 'var(--cc-text)', cursor: 'pointer', fontSize: '10px',
          fontFamily: 'var(--cc-font-sans)',
        }}>Open</button>
        <button onClick={() => onStop(session.uiSessionId)} style={{
          padding: '2px 8px', borderRadius: 'var(--cc-radius-sm)',
          border: '1px solid var(--cc-red-soft)', background: 'transparent',
          color: 'var(--cc-red)', cursor: 'pointer', fontSize: '10px',
          fontFamily: 'var(--cc-font-sans)',
        }}>Stop</button>
      </div>
    </div>
  );
};
