import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useRenderLoopGuard } from '../../debug/useRenderLoopGuard';
import { CcEmptyState } from '../ui/CcEmptyState';

interface SurfaceFrameProps {
  surface: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  diagnostics?: ReactNode;
  children: ReactNode;
  loading?: boolean;
  empty?: boolean;
  emptyTitle?: string;
  emptyDesc?: string;
}

export function SurfaceFrame({
  surface, title, subtitle, actions, diagnostics,
  children, loading, empty, emptyTitle, emptyDesc,
}: SurfaceFrameProps) {
  useRenderLoopGuard(`SurfaceFrame-${surface}`);
  const { t } = useTranslation();

  return (
    <div
      data-testid={`surface-${surface}`}
      style={{
        display: 'flex', flexDirection: 'column', height: '100%',
        background: 'var(--cc-bg)', color: 'var(--cc-text)',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderBottom: '1px solid var(--cc-border)',
        background: 'var(--cc-surface-solid)', flexShrink: 0,
      }}>
        <div>
          <h1 style={{ fontSize: 'var(--cc-font-lg)', fontWeight: 600, margin: 0, color: 'var(--cc-text)' }}>{title}</h1>
          {subtitle && <p style={{ fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-muted)', margin: '2px 0 0 0' }}>{subtitle}</p>}
        </div>
        {actions && <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{actions}</div>}
      </div>

      {/* Health / Diagnostics strip */}
      {diagnostics && (
        <div style={{
          padding: '4px 16px', borderBottom: '1px solid var(--cc-border-soft)',
          background: 'var(--cc-bg-muted)', flexShrink: 0,
        }}>
          {diagnostics}
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--cc-text-muted)' }}>
            {t('common.loading')}
          </div>
        ) : empty ? (
          <CcEmptyState icon="📋" title={emptyTitle || t('common.empty')} description={emptyDesc || ''} />
        ) : (
          children
        )}
      </div>
    </div>
  );
}
