import React from 'react';
import type { DockAttentionItem } from '../../app-core/snapshots/dockSnapshot';

interface DockAttentionQueueProps {
  items: DockAttentionItem[];
  onItemClick?: (item: DockAttentionItem) => void;
}

const typeIcon: Record<string, string> = {
  permission: 'perm',
  error: 'ERR',
  risk: 'RSK',
  'discovery-failure': 'DSC',
};

export const DockAttentionQueue: React.FC<DockAttentionQueueProps> = ({ items, onItemClick }) => {
  if (items.length === 0) return null;

  return (
    <div style={{
      padding: 'var(--cc-space-sm)', borderTop: '1px solid var(--cc-border-soft)',
      fontFamily: 'var(--cc-font-sans)',
    }}>
      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--cc-text-muted)', marginBottom: 'var(--cc-space-xs)' }}>
        Needs Attention ({items.length})
      </div>
      {items.slice(0, 5).map(item => (
        <div
          key={item.id}
          onClick={() => onItemClick?.(item)}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '4px 0', cursor: onItemClick ? 'pointer' : 'default',
            fontSize: '11px', color: 'var(--cc-text)',
          }}
        >
          <span style={{
            fontSize: '9px', fontWeight: 700, padding: '1px 4px',
            borderRadius: '2px', background: 'var(--cc-surface-muted)',
            color: item.type === 'error' ? 'var(--cc-red)' : 'var(--cc-amber)',
            flexShrink: 0,
          }}>
            {typeIcon[item.type] || '?'}
          </span>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.message}
          </span>
        </div>
      ))}
    </div>
  );
};
