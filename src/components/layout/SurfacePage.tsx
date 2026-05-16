import type { CSSProperties, ReactNode } from 'react';

interface SurfacePageProps {
  children: ReactNode;
  variant?: 'dashboard' | 'management' | 'workspace' | 'diagnostics';
  style?: CSSProperties;
  testId?: string;
}

const maxWidthMap = {
  dashboard: 'min(1480px, calc(100vw - 64px))',
  management: 'min(1680px, calc(100vw - 48px))',
  workspace: 'none',
  diagnostics: 'min(1560px, calc(100vw - 48px))',
};

export function SurfacePage({ children, variant = 'dashboard', style, testId }: SurfacePageProps) {
  const maxWidth = maxWidthMap[variant];

  return (
    <div
      data-testid={testId}
      style={{
        height: '100%',
        width: '100%',
        overflow: 'auto',
        background: 'var(--cc-bg)',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth,
          minWidth: 0,
          margin: variant === 'workspace' ? 0 : '0 auto',
          padding: 'clamp(18px, 2.2vw, 36px)',
          boxSizing: 'border-box',
          ...style,
        }}
      >
        {children}
      </div>
    </div>
  );
}
