import React, { useState, useEffect, useRef } from 'react';

interface ProjectsTopCommandBarProps {
  onSearch?: (query: string) => void;
  onNewProject?: () => void;
  onNewSession?: () => void;
  projectCount: number;
  runningCount: number;
}

export function ProjectsTopCommandBar({
  onSearch,
  onNewProject,
  onNewSession,
  projectCount,
  runningCount,
}: ProjectsTopCommandBarProps) {
  const [rawValue, setRawValue] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      onSearch?.(rawValue.trim());
    }, 200);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [rawValue, onSearch]);

  const handleClear = () => {
    setRawValue('');
    onSearch?.('');
  };

  return (
    <div style={barStyle}>
      {/* Search */}
      <div style={searchWrapperStyle}>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={searchIconStyle}
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={rawValue}
          onChange={(e) => setRawValue(e.target.value)}
          placeholder="搜索项目、会话、路径..."
          style={searchInputStyle}
          aria-label="搜索项目"
        />
        {rawValue && (
          <button
            onClick={handleClear}
            style={clearButtonStyle}
            aria-label="清除搜索"
            tabIndex={-1}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Badges */}
      <div style={badgesGroupStyle}>
        <span style={badgeTotalStyle}>
          <span style={{ ...dotCore, background: 'var(--cc-text-muted)' }} />
          项目 {projectCount}
        </span>
        <span style={runningCount > 0 ? badgeRunningActiveStyle : badgeRunningInactiveStyle}>
          <span style={{ ...dotCore, background: runningCount > 0 ? 'var(--cc-green)' : 'var(--cc-text-soft)' }} />
          运行中 {runningCount}
        </span>
      </div>

      {/* Action buttons */}
      <div style={actionsGroupStyle}>
        <button
          onClick={onNewSession}
          style={btnPrimaryStyle}
          title="新建 Claude 会话"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          + 新建会话
        </button>
        <button
          onClick={onNewProject}
          style={btnSecondaryStyle}
          title="新建项目"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          + 新建项目
        </button>
      </div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const barStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--cc-space-3)',
  padding: 'var(--cc-space-2) var(--cc-space-4)',
  minHeight: 48,
  borderBottom: '1px solid var(--cc-border)',
  background: 'var(--cc-surface)',
  flexWrap: 'wrap',
};

const searchWrapperStyle: React.CSSProperties = {
  position: 'relative',
  flex: '1 1 200px',
  minWidth: 180,
};

const searchIconStyle: React.CSSProperties = {
  position: 'absolute',
  left: 10,
  top: '50%',
  transform: 'translateY(-50%)',
  color: 'var(--cc-text-muted)',
  pointerEvents: 'none',
};

const searchInputStyle: React.CSSProperties = {
  width: '100%',
  height: 32,
  padding: '0 32px 0 32px',
  border: '1px solid var(--cc-border)',
  borderRadius: 'var(--cc-radius-sm)',
  background: 'var(--cc-surface-solid)',
  color: 'var(--cc-text)',
  fontSize: 'var(--cc-font-sm)',
  fontFamily: 'var(--cc-font-sans)',
  outline: 'none',
};

const clearButtonStyle: React.CSSProperties = {
  position: 'absolute',
  right: 4,
  top: '50%',
  transform: 'translateY(-50%)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 24,
  height: 24,
  border: 'none',
  background: 'transparent',
  color: 'var(--cc-text-muted)',
  cursor: 'pointer',
  borderRadius: 'var(--cc-radius-xs)',
};

const badgesGroupStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--cc-space-2)',
  flexShrink: 0,
};

const dotCore: React.CSSProperties = {
  display: 'inline-block',
  width: 6,
  height: 6,
  borderRadius: '50%',
  flexShrink: 0,
};

const badgeBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '2px 10px',
  borderRadius: 'var(--cc-radius-full)',
  fontSize: 'var(--cc-font-xs)',
  fontWeight: 500,
  whiteSpace: 'nowrap',
};

const badgeTotalStyle: React.CSSProperties = {
  ...badgeBase,
  background: 'var(--cc-surface-muted)',
  color: 'var(--cc-text-muted)',
};

const badgeRunningActiveStyle: React.CSSProperties = {
  ...badgeBase,
  background: 'var(--cc-green-soft)',
  color: 'var(--cc-green)',
};

const badgeRunningInactiveStyle: React.CSSProperties = {
  ...badgeBase,
  background: 'var(--cc-surface-muted)',
  color: 'var(--cc-text-muted)',
};

const actionsGroupStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--cc-space-2)',
  flexShrink: 0,
};

const btnPrimaryStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  height: 32,
  padding: '0 12px',
  border: 'none',
  borderRadius: 'var(--cc-radius-sm)',
  background: 'var(--cc-brand)',
  color: 'var(--cc-text-inverse)',
  fontSize: 'var(--cc-font-sm)',
  fontWeight: 500,
  fontFamily: 'var(--cc-font-sans)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const btnSecondaryStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  height: 32,
  padding: '0 12px',
  border: '1px solid var(--cc-border)',
  borderRadius: 'var(--cc-radius-sm)',
  background: 'var(--cc-surface-solid)',
  color: 'var(--cc-text)',
  fontSize: 'var(--cc-font-sm)',
  fontWeight: 500,
  fontFamily: 'var(--cc-font-sans)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};
