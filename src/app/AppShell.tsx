import { LeftSurfaceRail } from '../components/layout/LeftSurfaceRail';
import { SurfaceHost } from './SurfaceHost';

export function AppShell() {
  return (
    <div data-testid="app-shell" style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <LeftSurfaceRail />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--cc-bg)' }}>
        <SurfaceHost />
      </div>
    </div>
  );
}
