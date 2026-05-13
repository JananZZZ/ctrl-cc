// v10.0 SurfaceTheme — per-surface theme overrides and status color mappings
import type { CtrlCcTheme } from './themeBridge';

export type SurfaceStatusColor = 'green' | 'amber' | 'red' | 'blue' | 'neutral';

export interface SurfaceThemeColors {
  bg: string;
  surface: string;
  border: string;
  text: string;
  textMuted: string;
  brand: string;
  statusDot: Record<string, string>;
}

/** Get CSS variable value without document access (for SSR safety). */
function cssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  return `var(${name})`;
}

export function getSurfaceThemeColors(_theme?: CtrlCcTheme): SurfaceThemeColors {
  return {
    bg: cssVar('--cc-bg', '#0F0F14'),
    surface: cssVar('--cc-surface', '#1A1A24'),
    border: cssVar('--cc-border', '#2A2A3A'),
    text: cssVar('--cc-text', '#EAEAF0'),
    textMuted: cssVar('--cc-text-muted', '#888898'),
    brand: cssVar('--cc-brand', '#D4A574'),
    statusDot: {
      ready: cssVar('--cc-green', '#22C55E'),
      warning: cssVar('--cc-amber', '#F59E0B'),
      error: cssVar('--cc-red', '#EF4444'),
      idle: cssVar('--cc-text-muted', '#888898'),
      unavailable: cssVar('--cc-text-soft', '#666678'),
      'not-scanned': cssVar('--cc-text-soft', '#666678'),
      active: cssVar('--cc-brand', '#D4A574'),
    },
  };
}

export function statusToColor(status: string): SurfaceStatusColor {
  switch (status) {
    case 'ready': case 'healthy': case 'active': case 'running': case 'claude-active': case 'pty-ready':
      return 'green';
    case 'warning': case 'degraded': case 'waiting-permission': case 'discovering': case 'pty-starting': case 'claude-launching':
      return 'amber';
    case 'error': case 'failed': case 'unhealthy': case 'killed': case 'exited': case 'disconnected': case 'discovery-failed':
      return 'red';
    case 'unavailable': case 'not-scanned': case 'not-configured': case 'missing-path':
      return 'neutral';
    default:
      return 'blue';
  }
}
