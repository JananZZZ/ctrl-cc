import React from 'react';

interface DockGridAction {
  id: string;
  label: string;
  icon: string;
  onClick: () => void;
  enabled: boolean;
  disabledReason?: string;
}

interface DockActionGridProps {
  actions: DockGridAction[];
}

export const DockActionGrid: React.FC<DockActionGridProps> = ({ actions }) => {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 'var(--cc-space-xs)', padding: 'var(--cc-space-sm)',
    }}>
      {actions.map(action => (
        <button
          key={action.id}
          onClick={action.onClick}
          disabled={!action.enabled}
          title={action.enabled ? action.label : (action.disabledReason ?? 'Unavailable')}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: '2px', padding: 'var(--cc-space-sm)',
            borderRadius: 'var(--cc-radius-md)', border: '1px solid var(--cc-border-soft)',
            background: 'var(--cc-surface)', cursor: action.enabled ? 'pointer' : 'not-allowed',
            opacity: action.enabled ? 1 : 0.4,
            transition: 'background 120ms var(--cc-ease-standard)',
            fontFamily: 'var(--cc-font-sans)',
          }}
        >
          <span style={{ fontSize: '18px' }}>{action.icon}</span>
          <span style={{ fontSize: '10px', color: 'var(--cc-text)', fontWeight: 500, textAlign: 'center' }}>
            {action.label}
          </span>
        </button>
      ))}
    </div>
  );
};
