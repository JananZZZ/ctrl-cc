import React from 'react';

type HealthStatus = 'ready' | 'warning' | 'error' | 'unavailable' | 'not-scanned';

interface HealthItem {
  id: string;
  label: string;
  status: HealthStatus;
  onClick?: () => void;
}

interface SurfaceHealthStripProps {
  items: HealthItem[];
}

const statusColor: Record<HealthStatus, string> = {
  ready: 'var(--cc-green)',
  warning: 'var(--cc-amber)',
  error: 'var(--cc-red)',
  unavailable: 'var(--cc-text-muted)',
  'not-scanned': 'var(--cc-text-soft)',
};

const statusLabel: Record<HealthStatus, string> = {
  ready: 'Ready',
  warning: 'Warning',
  error: 'Error',
  unavailable: 'Unavailable',
  'not-scanned': 'Not scanned',
};

function pillStyle(clickable: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '2px 10px',
    border: '1px solid var(--cc-border-soft)',
    borderRadius: 'var(--cc-radius-full)',
    background: 'var(--cc-surface-solid)',
    cursor: clickable ? 'pointer' : 'default',
    fontFamily: 'inherit',
    fontSize: 'var(--cc-font-xs)',
    color: 'var(--cc-text-muted)',
    whiteSpace: 'nowrap',
    transition:
      'border-color var(--cc-duration-fast) var(--cc-ease-standard), background var(--cc-duration-fast) var(--cc-ease-standard)',
    flexShrink: 0,
  };
}

export function SurfaceHealthStrip({ items }: SurfaceHealthStripProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div
      data-testid="surface-health-strip"
      role="status"
      aria-label="System health status"
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 'var(--cc-space-2)',
        padding: 'var(--cc-space-1) var(--cc-space-4)',
        borderBottom: '1px solid var(--cc-border-soft)',
        background: 'var(--cc-surface-muted)',
        flexShrink: 0,
        minHeight: 32,
        flexWrap: 'wrap',
        overflow: 'hidden',
      }}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          data-testid={`health-pill-${item.id}`}
          title={`${item.label}: ${statusLabel[item.status]}`}
          onClick={item.onClick}
          style={pillStyle(Boolean(item.onClick))}
          onMouseEnter={(e) => {
            if (item.onClick) {
              e.currentTarget.style.borderColor = 'var(--cc-brand)';
              e.currentTarget.style.background = 'var(--cc-surface-hover)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--cc-border-soft)';
            e.currentTarget.style.background = 'var(--cc-surface-solid)';
          }}
        >
          <span
            style={{
              display: 'inline-block',
              width: 6,
              height: 6,
              borderRadius: 'var(--cc-radius-full)',
              background: statusColor[item.status],
              animation:
                item.status === 'ready' || item.status === 'warning'
                  ? 'cc-pulse 1.5s ease-in-out infinite'
                  : undefined,
              transition: 'background var(--cc-duration-fast) var(--cc-ease-standard)',
              flexShrink: 0,
            }}
          />
          <span style={{ fontWeight: 500 }}>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
