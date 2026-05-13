// Navigation type system — type-safe surface navigation with context
// SurfaceTarget is broader than domain SurfaceId (includes dock, diagnostics).

import type { SurfaceId } from '../../../types';

/**
 * All navigable surfaces in the app.
 * Includes surfaces not present in the legacy SurfaceId union (dock, diagnostics).
 */
export type SurfaceTarget =
  | SurfaceId
  | 'dock'
  | 'diagnostics';

/**
 * Contextual data carried alongside a navigation.
 * Allows surfaces to restore state on arrival (project, session, tab, etc.).
 */
export interface NavigationContext {
  /** Target project to focus after navigation */
  projectId?: string;
  /** Session to open in workspace surface */
  uiSessionId?: string;
  /** Resource to highlight in resources surface */
  resourceId?: string;
  /** Diagnostic subsection to scroll to (e.g. 'errors', 'traces', 'sessions') */
  diagnosticSection?: string;
  /** Tab key to activate within the target surface */
  tab?: string;
}

/**
 * A single navigation action with full traceability.
 * Recorded into the navigation stack on every navigateTo() call.
 */
export interface NavigationIntent {
  /** Unique ID for this navigation, e.g. nav-1715587200000-a1b2c3d4 */
  id: string;
  /** Target surface being navigated to */
  target: SurfaceTarget;
  /** Optional context for the target surface */
  context?: NavigationContext;
  /** Surface that initiated the navigation */
  source: SurfaceTarget;
  /** ISO-8601 timestamp of when the navigation was requested */
  timestamp: string;
}

/**
 * Maximum depth of the navigation stack.
 * Older entries are trimmed when the limit is exceeded.
 */
export const NAVIGATION_STACK_MAX = 50;

/** Generates a unique navigation intent ID */
export function createNavigationId(): string {
  return `nav-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
}
