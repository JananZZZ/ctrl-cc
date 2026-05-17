import { useEffect, useState } from 'react';
import { useErrorStore, type ErrorEntry } from '../../stores/errorStore';

const SEVERITY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  info: { bg: 'var(--cc-blue-soft)', border: 'var(--cc-blue)', text: 'var(--cc-blue)' },
  warning: { bg: 'var(--cc-amber-soft)', border: 'var(--cc-amber)', text: 'var(--cc-amber)' },
  error: { bg: 'var(--cc-red-soft)', border: 'var(--cc-red)', text: 'var(--cc-red)' },
  critical: { bg: 'var(--cc-red-soft)', border: 'var(--cc-red)', text: 'var(--cc-red)' },
};
const SEVERITY_ICONS: Record<string, string> = { info: 'ℹ️', warning: '⚠️', error: '❌', critical: '🚨' };
const AUTO_DISMISS_MS: Record<string, number> = { info: 3000, warning: 3000, error: 6000, critical: 0 };
const MAX_VISIBLE = 3;

interface ErrorToastProps { onOpenLog?: () => void; }

export function ErrorToast({ onOpenLog }: ErrorToastProps) {
  const errors = useErrorStore((s) => s.errors);
  const dismissError = useErrorStore((s) => s.dismissError);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const visible = errors.filter((e) => !e.dismissed);
  const shown = visible.slice(0, MAX_VISIBLE);

  return (
    <div
      style={{
        position: 'fixed', top: 8, right: 8, zIndex: 10000,
        display: 'flex', flexDirection: 'column', gap: 6,
        maxWidth: 380, pointerEvents: 'auto',
      }}
    >
      {shown.map((e) => (
        <ToastItem
          key={e.id}
          entry={e}
          expanded={expandedId === e.id}
          onExpand={() => { setExpandedId(expandedId === e.id ? null : e.id); if (onOpenLog) onOpenLog(); }}
          onDismiss={() => { dismissError(e.id); setExpandedId(null); }}
        />
      ))}
    </div>
  );
}

function ToastItem({ entry, expanded, onExpand, onDismiss }: { entry: ErrorEntry; expanded: boolean; onExpand: () => void; onDismiss: () => void }) {
  const colors = SEVERITY_COLORS[entry.severity] || SEVERITY_COLORS.error;
  const icon = SEVERITY_ICONS[entry.severity] || '❌';
  const autoDismiss = AUTO_DISMISS_MS[entry.severity] || 0;

  useEffect(() => {
    if (autoDismiss <= 0) return;
    const t = setTimeout(onDismiss, autoDismiss);
    return () => clearTimeout(t);
  }, [autoDismiss, onDismiss]);

  return (
    <div
      onClick={onExpand}
      style={{
        background: colors.bg, border: `1px solid ${colors.border}`,
        borderRadius: 'var(--cc-radius-sm)', padding: '8px 12px',
        cursor: 'pointer', boxShadow: 'var(--cc-shadow-popover)',
        animation: 'cc-fade-in 0.2s ease-out',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>{icon}</span>
        <span style={{ flex: 1, fontSize: 'var(--cc-font-sm)', fontWeight: 600, color: colors.text }}>{entry.title}</span>
        <span style={{ fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-soft)', background: 'var(--cc-surface-solid)', padding: '1px 6px', borderRadius: 8 }}>{entry.source}</span>
        <button onClick={(e) => { e.stopPropagation(); onDismiss(); }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 'var(--cc-font-sm)', color: 'var(--cc-text-muted)' }}>×</button>
      </div>
      {expanded && entry.detail && (
        <div style={{ marginTop: 6, fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-muted)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 160, overflow: 'auto' }}>
          {entry.detail}
        </div>
      )}
    </div>
  );
}
