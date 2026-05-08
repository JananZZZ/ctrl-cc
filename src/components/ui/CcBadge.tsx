import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  dot?: boolean;
}

const variantColors: Record<string, { bg: string; color: string }> = {
  default: { bg: 'var(--cc-bg-muted)', color: 'var(--cc-text-muted)' },
  success: { bg: 'var(--cc-green-soft)', color: 'var(--cc-green)' },
  warning: { bg: 'var(--cc-amber-soft)', color: 'var(--cc-amber)' },
  danger: { bg: 'var(--cc-red-soft)', color: 'var(--cc-red)' },
  info: { bg: 'var(--cc-blue-soft)', color: 'var(--cc-blue)' },
};

export function CcBadge({ children, variant = 'default', dot }: Props) {
  const c = variantColors[variant];
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: dot ? '2px' : '2px 8px',
        borderRadius: 'var(--cc-radius-full)',
        fontSize: 'var(--cc-font-xs)', fontWeight: 500,
        background: c.bg, color: c.color,
        lineHeight: '16px',
      }}
    >
      {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.color }} />}
      {children}
    </span>
  );
}
