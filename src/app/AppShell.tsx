import { useState } from 'react';
import { LeftSurfaceRail } from '../components/layout/LeftSurfaceRail';
import { SurfaceHost } from './SurfaceHost';
import { ErrorToast, ErrorModal, ErrorLogPanel } from '../components/error';
import { useRenderLoopGuard } from '../debug/useRenderLoopGuard';

export function AppShell() {
  useRenderLoopGuard('AppShell');
  const [showLogPanel, setShowLogPanel] = useState(false);

  return (
    <div
      data-testid="app-shell"
      style={{
        display: 'flex',
        height: '100%',
        width: '100%',
        minWidth: 0,
        overflow: 'hidden',
        background: 'var(--cc-bg)',
      }}
    >
      <LeftSurfaceRail />
      <div
        style={{
          flex: 1,
          minWidth: 0,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: 'var(--cc-bg)',
        }}
      >
        <SurfaceHost />
      </div>

      <ErrorToast onOpenLog={() => setShowLogPanel(true)} />
      <ErrorModal />
      <ErrorLogPanel open={showLogPanel} onClose={() => setShowLogPanel(false)} />
    </div>
  );
}
