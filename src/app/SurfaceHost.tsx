import { useSurfaceStore } from '../stores/surfaceStore';
import { ErrorBoundary } from '../components/error/ErrorBoundary';

import { ConsoleSurface } from '../surfaces/console/ConsoleSurface';
import { ProjectsSurface } from '../surfaces/projects/ProjectsSurface';
import { WorkspaceSurface } from '../surfaces/workspace/WorkspaceSurface';
import { ResourcesSurface } from '../surfaces/resources/ResourcesSurface';
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
    <div style={{ flex: 1, overflow: 'hidden' }}>
      <ErrorBoundary key={activeSurface}>
        <Component />
      </ErrorBoundary>
    </div>
  );
}
