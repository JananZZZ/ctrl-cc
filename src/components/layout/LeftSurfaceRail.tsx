import { useTranslation } from 'react-i18next';
import { useSurfaceStore } from '../../stores/surfaceStore';
import type { SurfaceId } from '../../types';

const navItems: { id: SurfaceId; labelKey: string; icon: string }[] = [
  { id: 'console', labelKey: 'nav.console', icon: '🏠' },
  { id: 'projects', labelKey: 'nav.projects', icon: '📁' },
  { id: 'workspace', labelKey: 'nav.workspace', icon: '💬' },
  { id: 'resources', labelKey: 'nav.resources', icon: '📦' },
  { id: 'canvas', labelKey: 'nav.canvas', icon: '🎨' },
  { id: 'github', labelKey: 'nav.github', icon: '🔗' },
  { id: 'settings', labelKey: 'nav.settings', icon: '⚙️' },
];

export function LeftSurfaceRail() {
  const { t } = useTranslation();
  const { activeSurface, navigateTo } = useSurfaceStore();

  return (
    <nav
      data-testid="left-surface-rail"
      style={{
        width: 'var(--cc-rail-width)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        padding: '8px 0',
        background: 'var(--cc-surface-solid)',
        borderRight: '1px solid var(--cc-border)',
        flexShrink: 0,
      }}
    >
      <div style={{ fontSize: 'var(--cc-font-lg)', marginBottom: 8, marginTop: 4, cursor: 'pointer' }} onClick={() => navigateTo('console')}>
        🐱
      </div>
      {navItems.map((item) => {
        const isActive = activeSurface === item.id;
        return (
          <button
            key={item.id}
            data-testid={`nav-${item.id}`}
            onClick={() => navigateTo(item.id)}
            title={t(item.labelKey)}
            style={{
              width: 40, height: 40,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 'var(--cc-font-lg)',
              borderRadius: 'var(--cc-radius-sm)',
              border: 'none',
              background: isActive ? 'var(--cc-brand-soft)' : 'transparent',
              cursor: 'pointer',
              transition: 'background var(--cc-duration-fast)',
              position: 'relative',
            }}
          >
            <span>{item.icon}</span>
            {isActive && (
              <span style={{
                position: 'absolute', left: 0, width: 3, height: 20,
                borderRadius: '0 3px 3px 0',
                background: 'var(--cc-navy)',
              }} />
            )}
          </button>
        );
      })}
    </nav>
  );
}
