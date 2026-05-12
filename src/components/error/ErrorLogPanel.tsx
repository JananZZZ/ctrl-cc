import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useErrorStore, type ErrorSeverity } from '../../stores/errorStore';
import { useRuntimeTraceStore } from '../../features/runtime/stores/runtimeTraceStore';
import { useRenderLoopGuard } from '../../debug/useRenderLoopGuard';

const SEVERITIES: ErrorSeverity[] = ['critical', 'error', 'warning', 'info'];
const SEVERITY_COLORS: Record<string, string> = { critical: 'var(--cc-red)', error: 'var(--cc-red-soft)', warning: 'var(--cc-amber)', info: 'var(--cc-blue)' };

interface Props { open: boolean; onClose: () => void; }

export function ErrorLogPanel({ open: isOpen, onClose }: Props) {
  useRenderLoopGuard('ErrorLogPanel');
  const { t } = useTranslation();
  const errors = useErrorStore((s) => s.errors);
  const traceEvents = useRuntimeTraceStore((s) => s.events);
  const clearAll = useErrorStore((s) => s.clearAll);
  const clearTraces = useRuntimeTraceStore((s) => s.clear);
  const dismissError = useErrorStore((s) => s.dismissError);
  const [filterSeverity, setFilterSeverity] = useState<ErrorSeverity | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [tab, setTab] = useState<'errors' | 'traces'>('errors');

  if (!isOpen) return null;

  const filtered = filterSeverity === 'all'
    ? errors
    : errors.filter((e) => e.severity === filterSeverity);

  function handleExport() {
    const json = JSON.stringify(errors, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `ctrlcc-error-log-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: 420, maxWidth: '92vw',
      background: 'var(--cc-surface-solid)', borderLeft: '1px solid var(--cc-border)',
      boxShadow: 'var(--cc-shadow-floating)', zIndex: 8000,
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--cc-border)' }}>
        <h2 style={{ fontSize: 'var(--cc-font-lg)', fontWeight: 600, color: 'var(--cc-text)' }}>{t('errorLog.title')} ({tab === 'errors' ? errors.length : traceEvents.length})</h2>
        <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 'var(--cc-font-lg)', color: 'var(--cc-text-muted)' }}>×</button>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--cc-border)' }}>
        {(['errors', 'traces'] as const).map((tabId) => (
          <button key={tabId} onClick={() => setTab(tabId)} style={{ flex: 1, padding: '6px 12px', border: 'none', background: tab === tabId ? 'var(--cc-brand-soft)' : 'transparent', color: tab === tabId ? 'var(--cc-brand-strong)' : 'var(--cc-text-muted)', fontWeight: tab === tabId ? 600 : 400, fontSize: 'var(--cc-font-xs)', cursor: 'pointer', borderBottom: tab === tabId ? '2px solid var(--cc-brand)' : '2px solid transparent' }}>
            {tabId === 'errors' ? `${t('errorLog.title')} (${errors.length})` : `RuntimeTrace (${traceEvents.length})`}
          </button>
        ))}
      </div>

      {tab === 'errors' ? (<>
      <div style={{ display: 'flex', gap: 4, padding: '8px 16px', borderBottom: '1px solid var(--cc-border-soft)', flexWrap: 'wrap' }}>
        <FilterBtn active={filterSeverity === 'all'} onClick={() => setFilterSeverity('all')} label={t('errorLog.all')} />
        {SEVERITIES.map((s) => (
          <FilterBtn key={s} active={filterSeverity === s} onClick={() => setFilterSeverity(s)} label={t(`errorLog.severity`, { context: s }) || s} color={SEVERITY_COLORS[s]} />
        ))}
        <div style={{ flex: 1 }} />
        <button onClick={handleExport} style={actionBtn}>{t('common.export')}</button>
        <button onClick={clearAll} style={{ ...actionBtn, color: 'var(--cc-red)' }}>{t('common.clear')}</button>
      </div>
      </>) : (
      <div style={{ display: 'flex', gap: 4, padding: '8px 16px', borderBottom: '1px solid var(--cc-border-soft)' }}>
        <span style={{ fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-muted)' }}>{traceEvents.length} events (capped at 200)</span>
        <div style={{ flex: 1 }} />
        <button onClick={clearTraces} style={{ ...actionBtn, color: 'var(--cc-red)' }}>{t('common.clear')}</button>
      </div>
      )}

      <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--cc-text-muted)', fontSize: 'var(--cc-font-sm)' }}>{t('errorLog.empty')}</div>
        ) : (
          filtered.map((e) => (
            <div key={e.id} style={{
              padding: '8px 12px', marginBottom: 4,
              borderRadius: 'var(--cc-radius-sm)', cursor: 'pointer',
              background: expandedId === e.id ? 'var(--cc-bg-subtle)' : 'transparent',
              border: e.dismissed ? 'none' : `1px solid ${SEVERITY_COLORS[e.severity] || 'var(--cc-border-soft)'}`,
              opacity: e.dismissed ? 0.5 : 1,
            }} onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: SEVERITY_COLORS[e.severity] || 'gray', flexShrink: 0 }} />
                <span style={{ fontSize: 'var(--cc-font-xs)', fontWeight: 600, color: 'var(--cc-text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</span>
                <span style={{ fontSize: 'var(--cc-font-3xs)', color: 'var(--cc-text-soft)' }}>{new Date(e.timestamp).toLocaleTimeString()}</span>
              </div>
              {expandedId === e.id && (
                <div style={{ marginTop: 6, fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-muted)' }}>
                  <div>{t('common.source')}: {e.source} | {t('common.severity')}: {e.severity}</div>
                  {e.detail && <div style={{ marginTop: 4, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{e.detail}</div>}
                  {e.rawError && <pre style={{ marginTop: 4, fontSize: 'var(--cc-font-2xs)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', background: 'var(--cc-bg-subtle)', padding: 4, borderRadius: 4, maxHeight: 120, overflow: 'auto' }}>{e.rawError}</pre>}
                  <button onClick={(ev) => { ev.stopPropagation(); dismissError(e.id); }} style={{ marginTop: 4, border: 'none', background: 'transparent', color: 'var(--cc-text-soft)', fontSize: 'var(--cc-font-xs)', cursor: 'pointer', padding: 0 }}>{t('errorLog.markRead')}</button>
                </div>
              )}
            </div>
          ))
        )}
        {tab === 'traces' && (
          <div style={{ maxHeight: 500, overflow: 'auto' }}>
            {traceEvents.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--cc-text-muted)', fontSize: 'var(--cc-font-sm)' }}>No trace events yet — create a session or send a message</div>
            ) : (
              traceEvents.map((e) => (
                <div key={e.id} style={{ padding: '3px 12px', marginBottom: 1, borderLeft: `3px solid ${e.level === 'error' ? 'var(--cc-red)' : e.level === 'warning' ? 'var(--cc-amber)' : 'var(--cc-border-soft)'}`, fontSize: 'var(--cc-font-2xs)', fontFamily: 'var(--cc-font-mono)', background: e.level === 'error' ? 'var(--cc-red-soft)' : 'transparent' }}>
                  <span style={{ color: 'var(--cc-text-soft)' }}>{e.ts.slice(11, 19)}</span>
                  <span style={{ marginLeft: 4, color: 'var(--cc-text-muted)' }}>[{e.source}]</span>
                  <span style={{ marginLeft: 4, fontWeight: 600 }}>{e.type}</span>
                  <span style={{ marginLeft: 4, color: 'var(--cc-text-soft)' }}>{e.message}</span>
                  {(e.uiSessionId || e.ptySessionId) && <span style={{ marginLeft: 6, color: 'var(--cc-blue)', fontSize: 'var(--cc-font-3xs)' }}>ui:{e.uiSessionId?.slice(0,10) ?? '-'} pty:{e.ptySessionId?.slice(0,10) ?? '-'}</span>}
                  <span style={{ marginLeft: 6, color: 'var(--cc-text-muted)', fontSize: 'var(--cc-font-3xs)' }}>trace:{e.traceId.slice(0,12)}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterBtn({ active, onClick, label, color }: { active: boolean; onClick: () => void; label: string; color?: string }) {
  return (
    <button onClick={onClick} style={{
      padding: '2px 8px', fontSize: 'var(--cc-font-xs)', borderRadius: 'var(--cc-radius-xs)',
      border: active ? `1px solid ${color || 'var(--cc-border-strong)'}` : '1px solid var(--cc-border-soft)',
      background: active ? 'var(--cc-bg-subtle)' : 'transparent',
      color: active ? (color || 'var(--cc-text)') : 'var(--cc-text-muted)',
      cursor: 'pointer', fontWeight: active ? 600 : 400,
    }}>{label}</button>
  );
}

const actionBtn: React.CSSProperties = {
  border: '1px solid var(--cc-border)', borderRadius: 'var(--cc-radius-xs)',
  background: 'transparent', padding: '2px 8px', fontSize: 'var(--cc-font-xs)',
  color: 'var(--cc-text-muted)', cursor: 'pointer',
};
