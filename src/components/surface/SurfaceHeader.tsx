import React from 'react';

interface SurfaceHeaderProps {
  surface: string;
  title: string;
  subtitle?: string;
  status?: 'ready' | 'warning' | 'error' | 'idle';
}

const statusColor: Record<NonNullable<SurfaceHeaderProps['status']>, string> = {
  ready: 'var(--cc-green)',
  warning: 'var(--cc-amber)',
  error: 'var(--cc-red)',
  idle: 'var(--cc-text-muted)',
};

export function SurfaceHeader({ surface, title, subtitle, status }: SurfaceHeaderProps) {
  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 'var(--cc-space-3) var(--cc-space-4)',
    borderBottom: '1px solid var(--cc-border)',
    background: 'var(--cc-surface-solid)',
    flexShrink: 0,
    minHeight: 48,
  };

  return (
    <header data-testid={`surface-header-${surface}`} style={headerStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--cc-space-3)', minWidth: 0 }}>
        <span
          aria-hidden
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            borderRadius: 'var(--cc-radius-sm)',
            background: 'var(--cc-surface-muted)',
            fontSize: 'var(--cc-font-md)',
            color: 'var(--cc-text-muted)',
            flexShrink: 0,
          }}
        >
          {surface.slice(0, 2).toUpperCase()}
        </span>

        <div style={{ minWidth: 0 }}>
          <h1
            style={{
              fontSize: 'var(--cc-font-lg)',
              fontWeight: 600,
              margin: 0,
              color: 'var(--cc-text)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              style={{
                fontSize: 'var(--cc-font-xs)',
                color: 'var(--cc-text-muted)',
                margin: '2px 0 0 0',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {status && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0,
            marginLeft: 'var(--cc-space-3)',
          }}
        >
          <span
            data-testid={`surface-header-status-${status}`}
            title={status}
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: 'var(--cc-radius-full)',
              background: statusColor[status],
              transition: 'background var(--cc-duration-fast) var(--cc-ease-standard)',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: 'var(--cc-font-xs)',
              color: 'var(--cc-text-muted)',
              textTransform: 'capitalize',
            }}
          >
            {status}
          </span>
        </div>
      )}
    </header>
  );
}
