import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSurfaceStore } from '../../stores/surfaceStore';
import { useTaskStore } from '../../core/tasks/taskStore';
import { NavigationGuardModal } from '../../core/tasks/NavigationGuardModal';
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
  const { activeSurface, requestNavigate, guardOpen, pendingSurface, confirmNavigate, setGuardOpen } = useSurfaceStore();
  const tasks = useTaskStore((s) => s.tasks);
  const blockingTasks = useMemo(
    () => Object.values(tasks).filter((t) => {
      const active = ['queued', 'running', 'paused'].includes(t.status);
      return active && t.interruptPolicy !== 'safe-background';
    }),
    [tasks],
  );

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
      <div style={{ fontSize: 'var(--cc-font-lg)', marginBottom: 8, marginTop: 4, cursor: 'pointer' }} onClick={() => requestNavigate('console')}>
        🐱
      </div>
      {navItems.map((item) => {
        const isActive = activeSurface === item.id;
        return (
          <button
            key={item.id}
            data-testid={`nav-${item.id}`}
            onClick={() => requestNavigate(item.id)}
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
      <NavigationGuardModal
        open={guardOpen}
        targetLabel={pendingSurface ? t(navItems.find((n) => n.id === pendingSurface)?.labelKey ?? '') : undefined}
        tasks={blockingTasks}
        onStay={() => setGuardOpen(false)}
        onContinue={confirmNavigate}
      />
    </nav>
  );
}
