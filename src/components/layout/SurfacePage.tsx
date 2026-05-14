import type { CSSProperties, ReactNode } from 'react';

interface SurfacePageProps {
  children: ReactNode;
  variant?: 'dashboard' | 'management' | 'workspace' | 'diagnostics';
  style?: CSSProperties;
  testId?: string;
}

const maxWidthMap = {
  dashboard: 1320,
  management: 1440,
  workspace: 'none',
  diagnostics: 1280,
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
          padding: 'clamp(16px, 2vw, 28px)',
          boxSizing: 'border-box',
          ...style,
        }}
      >
        {children}
      </div>
    </div>
  );
}
