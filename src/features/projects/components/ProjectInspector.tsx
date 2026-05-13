import React from 'react';

interface InspectorTab {
  id: string;
  label: string;
  count?: number;
}

interface ProjectInspectorProps {
  tabs: InspectorTab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  children?: React.ReactNode;
  collapsed?: boolean;
  onToggle?: () => void;
}

export const ProjectInspector: React.FC<ProjectInspectorProps> = ({
  tabs, activeTab, onTabChange, children, collapsed = false, onToggle,
}) => {
  return (
    <div style={{
      width: collapsed ? 32 : 420, flexShrink: 0, overflowY: 'auto',
      borderLeft: '1px solid var(--cc-border-soft)',
      background: 'var(--cc-bg)', fontFamily: 'var(--cc-font-sans)',
      transition: 'width 180ms var(--cc-ease-standard)',
    }}>
      {onToggle && (
        <button onClick={onToggle} style={{
          width: '100%', padding: 'var(--cc-space-sm)', border: 'none',
          background: 'var(--cc-surface)', color: 'var(--cc-text-muted)',
          cursor: 'pointer', fontSize: '12px', fontFamily: 'var(--cc-font-sans)',
          borderBottom: '1px solid var(--cc-border-soft)',
        }}>
          {collapsed ? '>' : '<'} Inspector
        </button>
      )}
      {!collapsed && (
        <>
          <div style={{
            display: 'flex', borderBottom: '1px solid var(--cc-border-soft)',
            overflowX: 'auto', background: 'var(--cc-surface)',
          }}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                style={{
                  padding: 'var(--cc-space-sm) var(--cc-space-md)',
                  border: 'none', borderBottom: activeTab === tab.id ? '2px solid var(--cc-brand)' : '2px solid transparent',
                  background: 'transparent', cursor: 'pointer', whiteSpace: 'nowrap',
                  color: activeTab === tab.id ? 'var(--cc-text)' : 'var(--cc-text-muted)',
                  fontSize: '12px', fontWeight: activeTab === tab.id ? 600 : 400,
                  fontFamily: 'var(--cc-font-sans)',
                  transition: 'color 120ms var(--cc-ease-standard)',
                }}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span style={{
                    marginLeft: '4px', fontSize: '10px', padding: '1px 5px',
                    borderRadius: '8px', background: 'var(--cc-surface-muted)',
                    color: 'var(--cc-text-muted)',
                  }}>{tab.count}</span>
                )}
              </button>
            ))}
          </div>
          <div style={{ padding: 'var(--cc-space-md)' }}>
            {children}
          </div>
        </>
      )}
    </div>
  );
};
