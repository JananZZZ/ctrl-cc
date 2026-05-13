import React from 'react';
import type { DockHealthItem } from '../../app-core/snapshots/dockSnapshot';

interface DockStatusLightsProps {
  items: DockHealthItem[];
  onItemClick?: (id: string) => void;
}

const statusColor: Record<string, string> = {
  ready: 'var(--cc-green)',
  warning: 'var(--cc-amber)',
  error: 'var(--cc-red)',
  unavailable: 'var(--cc-text-muted)',
};

export const DockStatusLights: React.FC<DockStatusLightsProps> = ({ items, onItemClick }) => {
  return (
    <div style={{ display: 'flex', gap: 'var(--cc-space-sm)', padding: 'var(--cc-space-sm)', flexWrap: 'wrap' }}>
      {items.map(item => (
        <button
          key={item.id}
          onClick={() => onItemClick?.(item.id)}
          title={item.detail ?? item.status}
          style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            padding: '2px 8px', borderRadius: 'var(--cc-radius-sm)',
            border: '1px solid var(--cc-border-soft)', background: 'var(--cc-surface)',
            cursor: onItemClick ? 'pointer' : 'default', fontSize: '11px',
            fontFamily: 'var(--cc-font-sans)', color: 'var(--cc-text)',
            transition: 'background 120ms var(--cc-ease-standard)',
          }}
        >
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: statusColor[item.status] || 'var(--cc-text-muted)',
            display: 'inline-block', flexShrink: 0,
          }} />
          {item.label}
        </button>
      ))}
    </div>
  );
};
