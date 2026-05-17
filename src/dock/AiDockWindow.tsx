import { useEffect, useState } from 'react';
import { useRuntimeKernelStore } from '../runtime-kernel/runtimeKernelStore';
import { useSetupStore } from '../features/setup/stores/setupStore';
import { invokeCommand } from '../services/invokeCommand';

export function AiDockWindow() {
  const [collapsed, setCollapsed] = useState(false);
  const kernelSessions = useRuntimeKernelStore((s) => s.sessions);
  const setupSnap = useSetupStore((s) => s.snapshot);

  const activeCount = Object.values(kernelSessions).filter(
    (s) => s.hasWriter && s.readerAlive,
  ).length;

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (e.clientX > window.innerWidth - 5) {
        setCollapsed(false);
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleShowMainWindow = () => {
    invokeCommand('toggle_ai_dock', { visible: true }).catch(() => {
      // Silently handle — main window is already visible or command not registered
    });
  };

  if (collapsed) {
    return (
      <div
        style={{
          position: 'fixed',
          right: 0,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 6,
          height: 80,
          borderRadius: '3px 0 0 3px',
          background: 'var(--cc-brand)',
          cursor: 'pointer',
          opacity: 0.7,
        }}
        onClick={() => setCollapsed(false)}
        title="Show AI Dock"
      />
    );
  }

  return (
    <div
      style={{
        width: 280,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--cc-surface-solid)',
        borderLeft: '1px solid var(--cc-border)',
        fontFamily: 'var(--cc-font-sans)',
        fontSize: 'var(--cc-font-xs)',
        color: 'var(--cc-text)',
        userSelect: 'none',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: '1px solid var(--cc-border)',
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 'var(--cc-font-sm)' }}>
          AI Dock
        </span>
        <button
          onClick={() => setCollapsed(true)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--cc-text-muted)',
          }}
        >
          ×
        </button>
      </div>

      {/* Runtime Status */}
      <div style={{ padding: 10, borderBottom: '1px solid var(--cc-border)' }}>
        <div
          style={{
            fontSize: 'var(--cc-font-xs)',
            color: 'var(--cc-text-muted)',
            marginBottom: 4,
          }}
        >
          Runtime Status
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background:
                activeCount > 0 ? 'var(--cc-green)' : 'var(--cc-text-muted)',
            }}
          />
          <span style={{ fontWeight: 600 }}>{activeCount} active</span>
        </div>
      </div>

      {/* Setup Status */}
      <div style={{ padding: 10, borderBottom: '1px solid var(--cc-border)' }}>
        <div
          style={{
            fontSize: 'var(--cc-font-xs)',
            color: 'var(--cc-text-muted)',
            marginBottom: 4,
          }}
        >
          Claude CLI
        </div>
        <div
          style={{
            fontWeight: 600,
            color: setupSnap?.checks?.claudeCode?.ok
              ? 'var(--cc-green)'
              : 'var(--cc-red)',
          }}
        >
          {setupSnap?.checks?.claudeCode?.ok
            ? (setupSnap?.checks?.claudeCode?.version ?? 'Ready')
            : 'Not detected'}
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ padding: 10, flex: 1 }}>
        <div
          style={{
            fontSize: 'var(--cc-font-xs)',
            color: 'var(--cc-text-muted)',
            marginBottom: 6,
          }}
        >
          Quick Actions
        </div>
        <button
          onClick={handleShowMainWindow}
          style={{
            display: 'block',
            width: '100%',
            padding: '6px 10px',
            marginBottom: 4,
            fontSize: 'var(--cc-font-xs)',
            border: '1px solid var(--cc-border)',
            borderRadius: 'var(--cc-radius-sm)',
            background: 'var(--cc-bg)',
            color: 'var(--cc-text)',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          Show Main Window
        </button>
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '6px 12px',
          borderTop: '1px solid var(--cc-border)',
          fontSize: 'var(--cc-font-xs)',
          color: 'var(--cc-text-muted)',
        }}
      >
        Ctrl-CC v28 · AI Dock
      </div>
    </div>
  );
}
