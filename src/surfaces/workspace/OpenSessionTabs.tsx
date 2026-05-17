import { useTranslation } from 'react-i18next';
import type { OpenSessionTab } from '../../types';
import { CcStatusDot } from '../../components/ui/CcStatusDot';

interface Props {
  tabs: OpenSessionTab[];
  activeTabId: string | null;
  onSelectTab: (sessionId: string) => void;
  onCloseTab: (sessionId: string) => void;
}

export function OpenSessionTabs({ tabs, activeTabId, onSelectTab, onCloseTab }: Props) {
  const { t } = useTranslation();
  if (tabs.length === 0) return null;

  return (
    <div data-testid="open-session-tabs" style={{
      display: 'flex', alignItems: 'center', gap: 0,
      borderBottom: '1px solid var(--cc-border)', background: 'var(--cc-surface-muted)',
      overflowX: 'auto', flexShrink: 0, minHeight: 36,
    }}>
      {tabs.map((tab) => {
        const isActive = tab.sessionId === activeTabId;
        const st: 'running' | 'waiting' | 'error' | 'done' | 'idle' =
          tab.status === 'running' ? 'running' : tab.status === 'waiting' ? 'waiting' : 'idle';
        return (
          <div
            key={tab.sessionId}
            data-testid={`tab-${tab.sessionId}`}
            onClick={() => onSelectTab(tab.sessionId)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px',
              cursor: 'pointer', fontSize: 'var(--cc-font-xs)', fontWeight: isActive ? 600 : 400,
              color: isActive ? 'var(--cc-text)' : 'var(--cc-text-muted)',
              background: isActive ? 'var(--cc-surface-solid)' : 'transparent',
              borderRight: '1px solid var(--cc-border)',
              borderBottom: isActive ? '2px solid var(--cc-navy)' : '2px solid transparent',
              whiteSpace: 'nowrap', userSelect: 'none',
            }}
          >
            <CcStatusDot status={st} size={6} pulse={tab.status === 'running'} />
            <span>{tab.projectName}</span>
            <span style={{ color: 'var(--cc-text-soft)' }}>/</span>
            <span>{tab.title}</span>
            {tab.pendingConfirms > 0 && (
              <span style={{ fontSize: 'var(--cc-font-xs)', padding: '0 4px', borderRadius: 'var(--cc-radius-full)', background: 'var(--cc-amber-soft)', color: 'var(--cc-amber)' }}>{tab.pendingConfirms}</span>
            )}
            {tab.riskCount > 0 && (
              <span style={{ fontSize: 'var(--cc-font-xs)', padding: '0 4px', borderRadius: 'var(--cc-radius-full)', background: 'var(--cc-red-soft)', color: 'var(--cc-red)' }}>{tab.riskCount}</span>
            )}
            {tab.isPinned && <span style={{ fontSize: 'var(--cc-font-xs)' }}>📌</span>}
            <button
              onClick={(e) => { e.stopPropagation(); onCloseTab(tab.sessionId); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-muted)', padding: 0, lineHeight: 1 }}
              title={t('common.close')}
            >×</button>
          </div>
        );
      })}
    </div>
  );
}
