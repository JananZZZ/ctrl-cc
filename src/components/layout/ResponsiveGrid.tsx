import type { ReactNode } from 'react';

export function ResponsiveGrid({
  children,
  min = 280,
  gap = 16,
}: {
  children: ReactNode;
  min?: number;
  gap?: number;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fit, minmax(min(${min}px, 100%), 1fr))`,
        gap,
        alignItems: 'stretch',
      }}
    >
      {children}
    </div>
  );
}
