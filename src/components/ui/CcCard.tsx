import type { HTMLAttributes, ReactNode } from 'react';

interface Props extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padding?: string;
}

export function CcCard({ children, padding = '16px', style, ...rest }: Props) {
  return (
    <div
      style={{
        background: 'var(--cc-surface-solid)',
        borderRadius: 'var(--cc-radius-lg)',
        border: '1px solid var(--cc-border)',
        boxShadow: 'var(--cc-shadow-card)',
        padding,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
