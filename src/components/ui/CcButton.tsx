import { type ButtonHTMLAttributes } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

const variants: Record<string, React.CSSProperties> = {
  primary: { background: 'var(--cc-navy)', color: 'var(--cc-text-on-accent)', border: 'none' },
  secondary: { background: 'var(--cc-surface-solid)', color: 'var(--cc-text)', border: '1px solid var(--cc-border)' },
  ghost: { background: 'transparent', color: 'var(--cc-text-muted)', border: 'none' },
  danger: { background: 'var(--cc-red)', color: 'var(--cc-text-on-accent)', border: 'none' },
};
const sizes: Record<string, React.CSSProperties> = {
  sm: { minHeight: 28, padding: '4px 10px', fontSize: 'var(--cc-font-xs)', borderRadius: 'var(--cc-radius-xs)' },
  md: { minHeight: 34, padding: '5px 14px', fontSize: 'var(--cc-font-sm)', borderRadius: 'var(--cc-radius-sm)' },
  lg: { minHeight: 40, padding: '6px 18px', fontSize: 'var(--cc-font-md)', borderRadius: 'var(--cc-radius-sm)' },
};

export function CcButton({ variant = 'secondary', size = 'md', style, children, ...rest }: Props) {
  return (
    <button
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        fontWeight: 500, cursor: 'pointer', transition: 'opacity var(--cc-duration-fast)',
        ...variants[variant], ...sizes[size], ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
