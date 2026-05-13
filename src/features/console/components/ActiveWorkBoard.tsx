import React from 'react';

interface ActiveRuntimeItem {
  uiSessionId: string;
  projectName: string;
  status: string;
  ptyAlive: boolean;
  claudeActive: boolean;
  waitingPermission: boolean;
  riskCount: number;
  lastOutputTail?: string;
}

interface ActiveWorkBoardProps {
  sessions: ActiveRuntimeItem[];
  onOpenWorkspace: (uiSessionId: string) => void;
  onStop: (uiSessionId: string) => void;
  onOpenDiagnostics: (uiSessionId: string) => void;
}

type StatusDotClass =
  | 'cc-status-running'
  | 'cc-status-waiting'
  | 'cc-status-idle'
  | 'cc-status-failed';

function statusToDotClass(status: string): StatusDotClass {
  switch (status) {
    case 'running':
    case 'active':
    case 'started':
      return 'cc-status-running';
    case 'waiting':
    case 'paused':
    case 'pending':
      return 'cc-status-waiting';
    case 'failed':
    case 'error':
    case 'stopped':
      return 'cc-status-failed';
    default:
      return 'cc-status-idle';
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'running':
      return '运行中';
    case 'waiting':
      return '等待中';
    case 'paused':
      return '已暂停';
    case 'failed':
      return '失败';
    case 'stopped':
      return '已停止';
    default:
      return status;
  }
}

const dotStyle: React.CSSProperties = {
  display: 'inline-block',
  width: '8px',
  height: '8px',
  borderRadius: 'var(--cc-radius-full)',
  marginRight: 'var(--cc-space-1)',
  flexShrink: 0,
};

const emptyContainerStyle: React.CSSProperties = {
  padding: 'var(--cc-space-12) var(--cc-space-6)',
  textAlign: 'center',
  fontFamily: 'var(--cc-font-sans)',
  fontSize: 'var(--cc-font-md)',
  color: 'var(--cc-text-soft)',
};

export function ActiveWorkBoard({
  sessions,
  onOpenWorkspace,
  onStop,
  onOpenDiagnostics,
}: ActiveWorkBoardProps) {
  return (
    <section
      style={{
        marginBottom: 'var(--cc-space-6)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--cc-space-3)',
          marginBottom: 'var(--cc-space-4)',
        }}
      >
        <h3
          style={{
            fontFamily: 'var(--cc-font-sans)',
            fontSize: 'var(--cc-font-lg)',
            fontWeight: 'var(--cc-font-semibold)',
            color: 'var(--cc-text)',
          }}
        >
          活跃工作区
        </h3>
        <span
          className="cc-badge cc-badge-info"
          style={{ fontSize: 'var(--cc-font-2xs)' }}
        >
          {sessions.length}
        </span>
      </div>

      {sessions.length === 0 ? (
        <div style={emptyContainerStyle}>没有活跃的 Claude 会话</div>
      ) : (
        <div
          style={{
            display: 'flex',
            gap: 'var(--cc-space-4)',
            overflowX: 'auto',
            paddingBottom: 'var(--cc-space-2)',
            scrollSnapType: 'x mandatory',
          }}
        >
          {sessions.slice(0, 6).map((s) => {
            const dotClass = statusToDotClass(s.status);

            return (
              <div
                key={s.uiSessionId}
                className="cc-card"
                data-interactive="false"
                style={{
                  minWidth: '260px',
                  maxWidth: '320px',
                  flexShrink: 0,
                  padding: 'var(--cc-space-4)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--cc-space-2)',
                  scrollSnapAlign: 'start',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--cc-space-2)',
                    }}
                  >
                    <span className={dotClass} style={dotStyle} />
                    <span
                      style={{
                        fontFamily: 'var(--cc-font-sans)',
                        fontSize: 'var(--cc-font-sm)',
                        fontWeight: 'var(--cc-font-semibold)',
                        color: 'var(--cc-text)',
                      }}
                    >
                      {s.projectName}
                    </span>
                  </div>
                  <span
                    style={{
                      fontFamily: 'var(--cc-font-sans)',
                      fontSize: 'var(--cc-font-2xs)',
                      color: 'var(--cc-text-soft)',
                    }}
                  >
                    {statusLabel(s.status)}
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--cc-space-3)',
                    fontFamily: 'var(--cc-font-mono)',
                    fontSize: 'var(--cc-font-2xs)',
                    color: 'var(--cc-text-muted)',
                  }}
                >
                  <span
                    style={{
                      color: s.ptyAlive
                        ? 'var(--cc-green)'
                        : 'var(--cc-text-soft)',
                    }}
                  >
                    PTY {s.ptyAlive ? '✓' : '✗'}
                  </span>
                  <span
                    style={{
                      color: s.claudeActive
                        ? 'var(--cc-green)'
                        : 'var(--cc-text-soft)',
                    }}
                  >
                    Claude {s.claudeActive ? '✓' : '✗'}
                  </span>
                  {s.waitingPermission && (
                    <span
                      style={{
                        color: 'var(--cc-amber)',
                      }}
                    >
                      🔒 等待权限
                    </span>
                  )}
                  {s.riskCount > 0 && (
                    <span
                      className="cc-badge cc-badge-warning"
                      style={{ fontSize: '10px' }}
                    >
                      ⚡ {s.riskCount}
                    </span>
                  )}
                </div>

                {s.lastOutputTail && (
                  <div
                    title={s.lastOutputTail}
                    style={{
                      fontFamily: 'var(--cc-font-mono)',
                      fontSize: 'var(--cc-font-xs)',
                      color: 'var(--cc-text-soft)',
                      lineHeight: 'var(--cc-leading-tight)',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                      background: 'var(--cc-surface-muted)',
                      borderRadius: 'var(--cc-radius-sm)',
                      padding: 'var(--cc-space-1) var(--cc-space-2)',
                      maxWidth: '100%',
                    }}
                  >
                    {s.lastOutputTail}
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    gap: 'var(--cc-space-2)',
                    marginTop: 'auto',
                    paddingTop: 'var(--cc-space-3)',
                    borderTop: '1px solid var(--cc-border-soft)',
                  }}
                >
                  <button
                    className="cc-button cc-button-sm cc-button-primary"
                    onClick={() => onOpenWorkspace(s.uiSessionId)}
                  >
                    打开
                  </button>
                  <button
                    className="cc-button cc-button-sm cc-button-ghost"
                    onClick={() => onOpenDiagnostics(s.uiSessionId)}
                  >
                    诊断
                  </button>
                  <button
                    className="cc-button cc-button-sm cc-button-ghost"
                    onClick={() => onStop(s.uiSessionId)}
                    style={{ marginLeft: 'auto', color: 'var(--cc-red)' }}
                  >
                    停止
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}