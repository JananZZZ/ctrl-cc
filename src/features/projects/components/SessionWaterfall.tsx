import React from 'react';

interface SessionCardItem {
  id: string;
  name: string;
  status: string;
  ptyStatus: string;
  claudeSessionId?: string;
  model: string;
  cwd: string;
  tokenCount: number;
  costUsd: number;
  filesChanged: number;
  riskCount: number;
  waitingPermission: boolean;
  lastOutputTail?: string;
}

interface SessionWaterfallProps {
  sessions: SessionCardItem[];
  onOpenWorkspace: (sessionId: string) => void;
  onStop: (sessionId: string) => void;
  onFork: (sessionId: string) => void;
  onExportLog: (sessionId: string) => void;
  onOpenDiagnostics: (sessionId: string) => void;
}

const statusColor: Record<string, string> = {
  'claude-active': 'var(--cc-green)',
  'pty-ready': 'var(--cc-brand)',
  running: 'var(--cc-green)',
  starting: 'var(--cc-amber)',
  failed: 'var(--cc-red)',
  killed: 'var(--cc-red)',
  exited: 'var(--cc-text-muted)',
};

export const SessionWaterfall: React.FC<SessionWaterfallProps> = ({
  sessions, onOpenWorkspace, onStop, onFork, onExportLog, onOpenDiagnostics,
}) => {
  return (
    <div style={{ fontFamily: 'var(--cc-font-sans)' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: 'var(--cc-space-md) 0 var(--cc-space-sm)',
      }}>
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--cc-text)' }}>
          Session Timeline
        </h3>
        <span style={{ fontSize: '12px', color: 'var(--cc-text-muted)' }}>
          {sessions.length} sessions
        </span>
      </div>

      {sessions.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 'var(--cc-space-xl)',
          color: 'var(--cc-text-muted)', fontSize: '13px',
          border: '1px dashed var(--cc-border)', borderRadius: 'var(--cc-radius-md)',
        }}>
          No sessions yet. Create a Claude session to get started.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cc-space-sm)' }}>
          {sessions.map(s => (
            <div key={s.id} style={{
              display: 'flex', alignItems: 'center', gap: 'var(--cc-space-md)',
              padding: 'var(--cc-space-md)', borderRadius: 'var(--cc-radius-md)',
              border: '1px solid var(--cc-border-soft)',
              borderLeft: `3px solid ${statusColor[s.status] || 'var(--cc-text-muted)'}`,
              background: 'var(--cc-surface)',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--cc-space-sm)', marginBottom: '4px' }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: statusColor[s.status] || 'var(--cc-text-muted)',
                  }} />
                  <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--cc-text)' }}>{s.name}</span>
                  <span style={{ fontSize: '10px', color: 'var(--cc-text-muted)', padding: '1px 6px', borderRadius: '8px', background: 'var(--cc-surface-muted)' }}>
                    {s.model}
                  </span>
                  {s.claudeSessionId && (
                    <span style={{ fontSize: '9px', color: 'var(--cc-text-soft)', fontFamily: 'var(--cc-font-mono)' }}>
                      {s.claudeSessionId.slice(0, 8)}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--cc-text-muted)', fontFamily: 'var(--cc-font-mono)' }}>
                  {s.cwd}
                </div>
                <div style={{ display: 'flex', gap: 'var(--cc-space-md)', marginTop: '4px', fontSize: '11px', color: 'var(--cc-text-muted)' }}>
                  <span>PTY: {s.ptyStatus}</span>
                  <span>Tokens: {s.tokenCount.toLocaleString()}</span>
                  <span>Cost: ${s.costUsd.toFixed(2)}</span>
                  <span>Files: {s.filesChanged}</span>
                  {s.riskCount > 0 && <span style={{ color: 'var(--cc-red)' }}>Risks: {s.riskCount}</span>}
                  {s.waitingPermission && <span style={{ color: 'var(--cc-amber)' }}>Waiting permission</span>}
                </div>
                {s.lastOutputTail && (
                  <div style={{
                    marginTop: '4px', fontSize: '10px', color: 'var(--cc-text-soft)',
                    fontFamily: 'var(--cc-font-mono)', maxHeight: 18, overflow: 'hidden',
                  }}>
                    {s.lastOutputTail}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                <button onClick={() => onOpenWorkspace(s.id)} style={{
                  padding: '4px 12px', borderRadius: 'var(--cc-radius-sm)',
                  border: 'none', background: 'var(--cc-brand)', color: '#fff',
                  cursor: 'pointer', fontSize: '11px', fontFamily: 'var(--cc-font-sans)', fontWeight: 500,
                }}>Open</button>
                <button onClick={() => onFork(s.id)} style={{
                  padding: '4px 8px', borderRadius: 'var(--cc-radius-sm)',
                  border: '1px solid var(--cc-border)', background: 'transparent',
                  color: 'var(--cc-text)', cursor: 'pointer', fontSize: '11px', fontFamily: 'var(--cc-font-sans)',
                }}>Fork</button>
                <button onClick={() => onStop(s.id)} style={{
                  padding: '4px 8px', borderRadius: 'var(--cc-radius-sm)',
                  border: '1px solid var(--cc-red-soft)', background: 'transparent',
                  color: 'var(--cc-red)', cursor: 'pointer', fontSize: '11px', fontFamily: 'var(--cc-font-sans)',
                }}>Stop</button>
                <button onClick={() => onExportLog(s.id)} style={{
                  padding: '4px 8px', borderRadius: 'var(--cc-radius-sm)',
                  border: '1px solid var(--cc-border)', background: 'transparent',
                  color: 'var(--cc-text-muted)', cursor: 'pointer', fontSize: '11px', fontFamily: 'var(--cc-font-sans)',
                }}>Log</button>
                <button onClick={() => onOpenDiagnostics(s.id)} style={{
                  padding: '4px 8px', borderRadius: 'var(--cc-radius-sm)',
                  border: '1px solid var(--cc-border)', background: 'transparent',
                  color: 'var(--cc-text-muted)', cursor: 'pointer', fontSize: '11px', fontFamily: 'var(--cc-font-sans)',
                }}>Diag</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
