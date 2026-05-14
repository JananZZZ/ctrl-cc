import type { CSSProperties, ReactNode } from 'react';

interface SurfacePageProps {
  children: ReactNode;
  variant?: 'dashboard' | 'management' | 'workspace' | 'diagnostics';
  style?: CSSProperties;
  testId?: string;
}

const maxWidthMap = {
  dashboard: 1420,
  management: 1500,
  workspace: 'none',
  diagnostics: 1360,
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
          padding: 'clamp(18px, 2.2vw, 34px)',
          boxSizing: 'border-box',
          ...style,
        }}
      >
        {children}
      </div>
    </div>
  );
}
