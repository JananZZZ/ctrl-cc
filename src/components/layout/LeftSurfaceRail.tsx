import { useSurfaceStore } from '../../stores/surfaceStore';
import type { SurfaceId } from '../../types';

const navItems: { id: SurfaceId; label: string; icon: string }[] = [
  { id: 'console', label: '控制台', icon: '🏠' },
  { id: 'projects', label: '项目管理', icon: '📁' },
  { id: 'workspace', label: '工作区', icon: '💬' },
  { id: 'resources', label: '资源区', icon: '📦' },
  { id: 'canvas', label: '无限画布', icon: '🎨' },
  { id: 'github', label: 'GitHub', icon: '🔗' },
  { id: 'settings', label: '设置', icon: '⚙️' },
];

export function LeftSurfaceRail() {
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
      <div style={{ fontSize: 20, marginBottom: 8, marginTop: 4, cursor: 'pointer' }} onClick={() => navigateTo('console')}>
        🐱
      </div>
      {navItems.map((item) => {
        const isActive = activeSurface === item.id;
        return (
          <button
            key={item.id}
            data-testid={`nav-${item.id}`}
            onClick={() => navigateTo(item.id)}
            title={item.label}
            style={{
              width: 40, height: 40,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18,
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
