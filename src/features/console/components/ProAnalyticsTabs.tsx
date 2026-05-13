import React from 'react';

interface AnalyticsTab {
  id: string;
  label: string;
  available: boolean;
  unavailableReason?: string;
}

interface ProAnalyticsTabsProps {
  tabs: AnalyticsTab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  timeRange?: 'today' | 'yesterday' | '7d' | '1m' | '6m' | '1y' | 'custom';
  onTimeRangeChange?: (range: string) => void;
  children?: React.ReactNode;
}

const TIME_RANGES: { value: string; label: string }[] = [
  { value: 'today', label: '今天' },
  { value: 'yesterday', label: '昨天' },
  { value: '7d', label: '7天' },
  { value: '1m', label: '1月' },
  { value: '6m', label: '6月' },
  { value: '1y', label: '1年' },
];

const tabBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 'var(--cc-space-4)',
};

const pillContainerStyle: React.CSSProperties = {
  display: 'flex',
  gap: '4px',
  background: 'var(--cc-surface-muted)',
  border: '1px solid var(--cc-border-soft)',
  borderRadius: 'var(--cc-radius-md)',
  padding: '4px',
};

const pillBaseStyle: React.CSSProperties = {
  fontFamily: 'var(--cc-font-sans)',
  fontSize: 'var(--cc-font-sm)',
  fontWeight: 'var(--cc-font-normal)',
  color: 'var(--cc-text-muted)',
  background: 'transparent',
  border: 'none',
  borderRadius: 'var(--cc-radius-sm)',
  padding: '6px 16px',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  transition:
    'background var(--cc-duration-fast) var(--cc-ease-standard), color var(--cc-duration-fast) var(--cc-ease-standard), box-shadow var(--cc-duration-fast) var(--cc-ease-standard)',
};

const pillActiveStyle: React.CSSProperties = {
  ...pillBaseStyle,
  background: 'var(--cc-surface-solid)',
  color: 'var(--cc-text)',
  boxShadow: 'var(--cc-shadow-card)',
  fontWeight: 'var(--cc-font-semibold)',
};

const pillDisabledStyle: React.CSSProperties = {
  ...pillBaseStyle,
  opacity: 0.4,
  cursor: 'not-allowed',
};

const timeSelectStyle: React.CSSProperties = {
  fontFamily: 'var(--cc-font-sans)',
  fontSize: 'var(--cc-font-xs)',
  color: 'var(--cc-text-muted)',
  background: 'var(--cc-surface-muted)',
  border: '1px solid var(--cc-border-soft)',
  borderRadius: 'var(--cc-radius-sm)',
  padding: '4px 12px',
  cursor: 'pointer',
  transition:
    'border-color var(--cc-duration-fast) var(--cc-ease-standard)',
  outline: 'none',
};

const contentAreaStyle: React.CSSProperties = {
  background: 'var(--cc-surface)',
  border: '1px solid var(--cc-border-soft)',
  borderRadius: 'var(--cc-radius-md)',
  padding: 'var(--cc-space-4)',
  minHeight: '120px',
};

export function ProAnalyticsTabs({
  tabs,
  activeTab,
  onTabChange,
  timeRange,
  onTimeRangeChange,
  children,
}: ProAnalyticsTabsProps) {
  return (
    <section>
      {/* Tab bar */}
      <div style={tabBarStyle}>
        <div style={pillContainerStyle}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                style={
                  !tab.available
                    ? pillDisabledStyle
                    : isActive
                      ? pillActiveStyle
                      : pillBaseStyle
                }
                disabled={!tab.available}
                title={
                  tab.available ? undefined : tab.unavailableReason
                }
                onClick={() => {
                  if (tab.available) onTabChange(tab.id);
                }}
                role="tab"
                aria-selected={isActive ? 'true' : 'false'}
                aria-disabled={tab.available ? 'false' : 'true'}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Time range selector — visible when timeRange and handler are provided */}
        {timeRange && onTimeRangeChange && (
          <select
            value={timeRange}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              onTimeRangeChange(e.target.value)
            }
            style={timeSelectStyle}
            aria-label="时间范围"
          >
            {TIME_RANGES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Content area */}
      <div style={contentAreaStyle}>
        {children}
      </div>
    </section>
  );
}
