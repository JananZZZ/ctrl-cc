import React from 'react';

interface AttentionItem {
  id: string;
  type: 'error' | 'permission' | 'risk' | 'discovery-failure';
  uiSessionId?: string;
  projectName?: string;
  message: string;
  timestamp: string;
}

interface NeedAttentionQueueProps {
  items: AttentionItem[];
  onOpenWorkspace?: (uiSessionId: string) => void;
  onOpenDiagnostics?: () => void;
}

const typeConfig: Record<
  AttentionItem['type'],
  { icon: string; label: string; badgeClass: string; color: string }
> = {
  error: {
    icon: '⚠️',
    label: '错误',
    badgeClass: 'cc-badge cc-badge-danger',
    color: 'var(--cc-red)',
  },
  permission: {
    icon: '🔐',
    label: '权限',
    badgeClass: 'cc-badge cc-badge-purple',
    color: 'var(--cc-purple)',
  },
  risk: {
    icon: '⚡',
    label: '风险',
    badgeClass: 'cc-badge cc-badge-warning',
    color: 'var(--cc-amber)',
  },
  'discovery-failure': {
    icon: '🔍',
    label: '发现失败',
    badgeClass: 'cc-badge cc-badge-info',
    color: 'var(--cc-blue)',
  },
};

function hasHighSeverity(items: AttentionItem[]): boolean {
  return items.some((i) => i.type === 'error' || i.type === 'risk');
}

const emptyContainerStyle: React.CSSProperties = {
  padding: 'var(--cc-space-8) var(--cc-space-6)',
  textAlign: 'center',
  fontFamily: 'var(--cc-font-sans)',
  fontSize: 'var(--cc-font-md)',
  color: 'var(--cc-green)',
};

/**
 * Format a timestamp string for compact display.
 * Expects ISO 8601 strings; falls back to displaying as-is.
 */
function formatTime(ts: string): string {
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
    return d.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return ts;
  }
}

export function NeedAttentionQueue({
  items,
  onOpenWorkspace,
  onOpenDiagnostics,
}: NeedAttentionQueueProps) {
  const highSev = hasHighSeverity(items);

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
          需要关注
        </h3>
        <span
          className={
            highSev ? 'cc-badge cc-badge-danger' : 'cc-badge cc-badge-warning'
          }
          style={{
            fontSize: 'var(--cc-font-xs)',
          }}
        >
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <div style={emptyContainerStyle}>一切正常</div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--cc-space-2)',
          }}
        >
          {items.map((item) => {
            const cfg = typeConfig[item.type];

            return (
              <div
                key={item.id}
                className="cc-card"
                data-interactive="false"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--cc-space-3)',
                  padding: 'var(--cc-space-3) var(--cc-space-4)',
                  borderLeft: `3px solid ${cfg.color}`,
                }}
              >
                {/* Type icon */}
                <span
                  style={{
                    fontSize: 'var(--cc-font-lg)',
                    lineHeight: 1,
                    flexShrink: 0,
                  }}
                  title={cfg.label}
                >
                  {cfg.icon}
                </span>

                {/* Content */}
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--cc-font-sans)',
                      fontSize: 'var(--cc-font-sm)',
                      fontWeight: 'var(--cc-font-medium)',
                      color: 'var(--cc-text)',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {item.message}
                  </span>
                  <div
                    style={{
                      display: 'flex',
                      gap: 'var(--cc-space-3)',
                      fontFamily: 'var(--cc-font-mono)',
                      fontSize: 'var(--cc-font-xs)',
                      color: 'var(--cc-text-soft)',
                    }}
                  >
                    {item.projectName && (
                      <span>{item.projectName}</span>
                    )}
                    <span>{formatTime(item.timestamp)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div
                  style={{
                    display: 'flex',
                    gap: 'var(--cc-space-1)',
                    flexShrink: 0,
                  }}
                >
                  {item.uiSessionId && onOpenWorkspace && (
                    <button
                      className="cc-button cc-button-sm cc-button-soft"
                      onClick={() => onOpenWorkspace(item.uiSessionId!)}
                    >
                      打开
                    </button>
                  )}
                  {onOpenDiagnostics && (
                    <button
                      className="cc-button cc-button-sm cc-button-ghost"
                      onClick={onOpenDiagnostics}
                    >
                      诊断
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
