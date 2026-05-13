import React from 'react';

interface SurfaceEmptyStateAction {
  label: string;
  onClick: () => void;
}

interface SurfaceEmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: SurfaceEmptyStateAction;
}

export function SurfaceEmptyState({
  icon = '📋',
  title,
  description,
  action,
}: SurfaceEmptyStateProps) {
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'var(--cc-space-12) var(--cc-space-6)',
    gap: 'var(--cc-space-2)',
    textAlign: 'center',
    height: '100%',
    minHeight: 240,
  };

  const buttonBaseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 'var(--cc-space-2)',
    padding: '6px 16px',
    border: '1px solid var(--cc-brand-soft)',
    borderRadius: 'var(--cc-radius-full)',
    background: 'var(--cc-brand-soft)',
    color: 'var(--cc-text)',
    fontSize: 'var(--cc-font-sm)',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition:
      'filter var(--cc-duration-fast) var(--cc-ease-standard), transform var(--cc-duration-fast) var(--cc-ease-spring)',
  };

  return (
    <div data-testid="surface-empty-state" style={containerStyle}>
      <span
        aria-hidden
        style={{
          fontSize: 'var(--cc-font-2xl)',
          opacity: 0.55,
          lineHeight: 1,
        }}
      >
        {icon}
      </span>

      <h3
        style={{
          fontSize: 'var(--cc-font-md)',
          fontWeight: 500,
          color: 'var(--cc-text-muted)',
          margin: 0,
        }}
      >
        {title}
      </h3>

      {description && (
        <p
          style={{
            fontSize: 'var(--cc-font-sm)',
            color: 'var(--cc-text-soft)',
            margin: 0,
            maxWidth: 360,
            lineHeight: 'var(--cc-leading-relaxed)',
          }}
        >
          {description}
        </p>
      )}

      {action && (
        <button
          type="button"
          onClick={action.onClick}
          data-testid="surface-empty-state-action"
          style={buttonBaseStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.filter = 'brightness(0.96)';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.filter = 'brightness(1)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
