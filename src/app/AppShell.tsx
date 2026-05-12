import { useState } from 'react';
import { LeftSurfaceRail } from '../components/layout/LeftSurfaceRail';
import { AIDock } from '../components/dock/AIDock';
import { SurfaceHost } from './SurfaceHost';
import { ErrorToast, ErrorModal, ErrorLogPanel } from '../components/error';
import { useErrorStore } from '../stores/errorStore';
import { useRenderLoopGuard } from '../debug/useRenderLoopGuard';

export function AppShell() {
  useRenderLoopGuard('AppShell');
  const [showLogPanel, setShowLogPanel] = useState(false);
  const unresolvedCount = useErrorStore((s) => s.errors.filter((e) => !e.dismissed).length);

  return (
    <div data-testid="app-shell" style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <LeftSurfaceRail />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--cc-bg)' }}>
        <SurfaceHost />
      </div>
      <AIDock onOpenErrorLog={() => setShowLogPanel(true)} errorCount={unresolvedCount} />
      <ErrorToast onOpenLog={() => setShowLogPanel(true)} />
      <ErrorModal />
      <ErrorLogPanel open={showLogPanel} onClose={() => setShowLogPanel(false)} />
    </div>
  );
}
