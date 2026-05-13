import { useSurfaceStore } from '../stores/surfaceStore';
import { ErrorBoundary } from '../components/error/ErrorBoundary';
// v12.0: Feature pages (active)
import { ConsoleSurface } from '../features/console/pages/ConsoleSurface';
import { ProjectsSurface } from '../features/projects/pages/ProjectsSurface';
import { ResourcesSurface } from '../features/resources/pages/ResourcesSurface';
// Legacy (workspace/canvas/github/settings until migration)
import { WorkspaceSurface } from '../surfaces/workspace/WorkspaceSurface';
import { CanvasSurface } from '../surfaces/canvas/CanvasSurface';
import { GitHubSurface } from '../surfaces/github/GitHubSurface';
import { SettingsSurface } from '../surfaces/settings/SettingsSurface';

const surfaces = {
  console: ConsoleSurface,
  projects: ProjectsSurface,
  workspace: WorkspaceSurface,
  resources: ResourcesSurface,
  canvas: CanvasSurface,
  github: GitHubSurface,
  settings: SettingsSurface,
};

export function SurfaceHost() {
  const activeSurface = useSurfaceStore((s) => s.activeSurface);
  const Component = surfaces[activeSurface] ?? ConsoleSurface;

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <ErrorBoundary key={activeSurface}>
        <Component />
      </ErrorBoundary>
    </div>
  );
}
