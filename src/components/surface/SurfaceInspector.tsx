import React from 'react';

interface SurfaceInspectorProps {
  title: string;
  children: React.ReactNode;
  width?: number;
  collapsed?: boolean;
  onToggle?: () => void;
}

export function SurfaceInspector({
  title,
  children,
  width = 420,
  collapsed = false,
  onToggle,
}: SurfaceInspectorProps) {
  return (
    <aside
      data-testid="surface-inspector"
      style={{
        width: collapsed ? 0 : width,
        minWidth: collapsed ? 0 : undefined,
        display: 'flex',
        flexDirection: 'column',
        borderLeft: collapsed ? 'none' : '1px solid var(--cc-border)',
        background: 'var(--cc-surface)',
        overflow: 'hidden',
        transition: `width var(--cc-duration-normal) var(--cc-ease-standard)`,
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--cc-space-2) var(--cc-space-3)',
          borderBottom: '1px solid var(--cc-border-soft)',
          background: 'var(--cc-surface-solid)',
          flexShrink: 0,
          minHeight: 36,
        }}
      >
        <h2
          style={{
            fontSize: 'var(--cc-font-sm)',
            fontWeight: 600,
            color: 'var(--cc-text-muted)',
            margin: 0,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </h2>

        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            data-testid="surface-inspector-toggle"
            aria-label={collapsed ? 'Expand inspector' : 'Collapse inspector'}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              padding: 0,
              border: 'none',
              borderRadius: 'var(--cc-radius-sm)',
              background: 'transparent',
              color: 'var(--cc-text-muted)',
              cursor: 'pointer',
              fontSize: 'var(--cc-font-md)',
              transition: 'background var(--cc-duration-fast) var(--cc-ease-standard)',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--cc-surface-muted)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            {collapsed ? '◀' : '▶'}
          </button>
        )}
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: 'var(--cc-space-3)',
          opacity: collapsed ? 0 : 1,
          transition: `opacity var(--cc-duration-fast) var(--cc-ease-standard)`,
        }}
      >
        {children}
      </div>
    </aside>
  );
}
