import { useErrorStore } from '../../stores/errorStore';
import { useTranslation } from 'react-i18next';

export function ErrorModal() {
  const { t } = useTranslation();
  const errors = useErrorStore((s) => s.errors);
  const dismissError = useErrorStore((s) => s.dismissError);
  const critical = errors.filter((e) => !e.dismissed && e.severity === 'critical');

  if (critical.length === 0) return null;
  const entry = critical[0];

  function handleCopy() {
    const text = `[${entry.severity.toUpperCase()}] ${entry.title}\nSource: ${entry.source}\nTime: ${entry.timestamp}\nDetail: ${entry.detail || 'N/A'}\nRaw: ${entry.rawError || 'N/A'}`;
    navigator.clipboard.writeText(text).catch((e) => console.warn('clipboard write failed:', e));
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'var(--cc-overlay, rgba(0,0,0,0.6))', zIndex: 9000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--cc-surface-solid)', borderRadius: 'var(--cc-radius-lg)',
        border: '2px solid var(--cc-red)', padding: 24, maxWidth: 520, width: '90%',
        boxShadow: 'var(--cc-shadow-floating)',
      }}>
        <h2 style={{ fontSize: 'var(--cc-font-lg)', fontWeight: 700, color: 'var(--cc-red)', marginBottom: 12 }}>
          🚨 {entry.title}
        </h2>
        <p style={{ fontSize: 'var(--cc-font-sm)', color: 'var(--cc-text-muted)', marginBottom: 12 }}>
          {entry.detail}
        </p>
        {entry.rawError && (
          <pre style={{
            fontSize: 'var(--cc-font-xs)', fontFamily: 'var(--cc-font-mono)', whiteSpace: 'pre-wrap',
            background: 'var(--cc-bg-subtle)', padding: 8, borderRadius: 'var(--cc-radius-sm)',
            color: 'var(--cc-text)', maxHeight: 180, overflow: 'auto', marginBottom: 12,
          }}>
            {entry.rawError}
          </pre>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={handleCopy} style={btn(false)}>{t('common.copy')}</button>
          <button onClick={() => dismissError(entry.id)} style={btn(true)}>{t('common.close')}</button>
        </div>
      </div>
    </div>
  );
}

const btn = (primary: boolean): React.CSSProperties => ({
  padding: '8px 20px', borderRadius: 'var(--cc-radius-sm)', border: primary ? 'none' : '1px solid var(--cc-border)',
  background: primary ? 'var(--cc-red)' : 'var(--cc-surface-solid)',
  color: primary ? 'var(--cc-text-on-accent)' : 'var(--cc-text)', cursor: 'pointer', fontSize: 'var(--cc-font-sm)', fontWeight: 600,
});
