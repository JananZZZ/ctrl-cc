// NavigationBus — singleton navigation coordinator
//
// Responsibilities:
//  1. Primary entry point for all surface navigation (NavigationBus.navigateTo)
//  2. Drives the NavigationStore for current-surface tracking + stack history
//  3. Synchronizes with the legacy SurfaceStore for backward compatibility
//  4. Emits window-level custom events for cross-window / plugin communication
//
// Usage:
//   import { NavigationBus } from '../../features/app-core/navigation/navigationBus';
//   NavigationBus.navigateTo('workspace', { uiSessionId: 'ses-xxx' });

import type { SurfaceTarget, NavigationContext } from './navigationTypes';
import { useNavigationStore } from './navigationStore';
import { useSurfaceStore } from '../../../stores/surfaceStore';
import type { SurfaceId } from '../../../types';

/**
 * Surfaces that exist in both SurfaceTarget and the legacy SurfaceId type.
 * Used to selectively sync navigation to the legacy SurfaceStore.
 */
const LEGACY_SURFACE_IDS: ReadonlySet<string> = new Set<SurfaceId>([
  'console',
  'projects',
  'workspace',
  'resources',
  'canvas',
  'github',
  'settings',
]);

/**
 * Returns true if the target is a legacy SurfaceId recognized by SurfaceStore.
 */
function isLegacySurface(target: SurfaceTarget): target is SurfaceId {
  return LEGACY_SURFACE_IDS.has(target);
}

export class NavigationBus {
  /**
   * Navigate to a target surface with optional context.
   *
   * This is the single entry point for all navigation in the app.
   * It updates:
   *   - NavigationStore (current surface, stack, last intent)
   *   - SurfaceStore (for backward compatibility with legacy surfaces)
   *   - window.dispatchEvent('ctrlcc:navigate') for cross-window listeners
   */
  static navigateTo(target: SurfaceTarget, context?: NavigationContext): void {
    // 1. Update the navigation store (primary state)
    useNavigationStore.getState().navigateTo(target, context);

    // 2. Sync to legacy SurfaceStore for backward compatibility.
    //    Only surfaces present in the legacy SurfaceId type are forwarded.
    if (isLegacySurface(target)) {
      useSurfaceStore.getState().navigateTo(target);
    }

    // 3. Emit custom event for cross-window / plugin communication
    const intent = useNavigationStore.getState().lastNavigation;
    if (typeof window !== 'undefined' && intent) {
      window.dispatchEvent(
        new CustomEvent('ctrlcc:navigate', {
          detail: {
            id: intent.id,
            target: intent.target,
            context: intent.context ?? null,
            source: intent.source,
            timestamp: intent.timestamp,
          },
        }),
      );
    }
  }

  /** Convenience: navigate to the console (home) surface */
  static goHome(): void {
    NavigationBus.navigateTo('console');
  }

  /** Convenience: navigate to workspace and open a specific session */
  static openSession(uiSessionId: string): void {
    NavigationBus.navigateTo('workspace', { uiSessionId });
  }

  /** Convenience: navigate to projects and focus a specific project */
  static openProject(projectId: string): void {
    NavigationBus.navigateTo('projects', { projectId });
  }

  /** Convenience: navigate to diagnostics with an optional subsection */
  static openDiagnostics(section?: string): void {
    NavigationBus.navigateTo('diagnostics', { diagnosticSection: section });
  }
}
