import React from 'react';

interface SurfaceToolbarProps {
  children: React.ReactNode;
  align?: 'left' | 'right' | 'spread';
}

const alignMap: Record<NonNullable<SurfaceToolbarProps['align']>, React.CSSProperties['justifyContent']> = {
  left: 'flex-start',
  right: 'flex-end',
  spread: 'space-between',
};

export function SurfaceToolbar({ children, align = 'left' }: SurfaceToolbarProps) {
  return (
    <nav
      data-testid="surface-toolbar"
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: alignMap[align],
        gap: 'var(--cc-space-3)',
        padding: 'var(--cc-space-2) var(--cc-space-4)',
        borderBottom: '1px solid var(--cc-border-soft)',
        background: 'var(--cc-surface-solid)',
        flexShrink: 0,
        minHeight: 40,
        flexWrap: 'wrap',
      }}
    >
      {children}
    </nav>
  );
}
