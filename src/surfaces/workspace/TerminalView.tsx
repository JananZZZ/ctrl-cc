import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { usePtyTerminal } from '../../features/terminal/usePtyTerminal';
import { CcEmptyState } from '../../components/ui/CcEmptyState';
interface Props { sessionId: string | null; }

export function TerminalView({ sessionId }: Props) {
  const { t } = useTranslation();
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const containerCb = useCallback((node: HTMLDivElement | null) => setContainer(node), []);
  const handle = usePtyTerminal(sessionId, container);
  const fitFnRef = useRef<(() => void) | null>(null);
  fitFnRef.current = handle?.fit ?? null;

  useEffect(() => {
    if (container) {
      // Delay fit to next frame so xterm has time to measure container
      const id = requestAnimationFrame(() => fitFnRef.current?.());
      return () => cancelAnimationFrame(id);
    }
  }, [container, sessionId]);

  if (!sessionId) {
    return (
      <div data-testid="terminal-view" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cc-bg)' }}>
        <CcEmptyState icon="⌨️" title={t('workspace.termReady')} description={t('workspace.termReadyDesc')} />
      </div>
    );
  }

  return (
    <div data-testid="terminal-view" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--cc-bg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 6px', borderBottom: '1px solid var(--cc-border)', background: 'var(--cc-surface-solid)', flexShrink: 0, minHeight: 28 }}>
        <ToolBtn onClick={() => handle?.sendCtrlC()} title="Ctrl+C">⏹</ToolBtn>
        <ToolBtn onClick={() => handle?.sendCtrlD()} title="Ctrl+D">⏏</ToolBtn>
        <ToolBtn onClick={() => handle?.clear()} title={t('common.clear')}>⌧</ToolBtn>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 'var(--cc-font-2xs)', color: 'var(--cc-text-muted)' }}>
          {handle?.status === 'running' ? '●' : handle?.status === 'starting' ? '◐' : '○'} {handle?.status ?? 'idle'}
        </span>
      </div>
      <div ref={containerCb} data-testid="terminal-xterm-root" style={{ flex: 1, overflow: 'hidden', padding: 2 }} />
    </div>
  );
}

function ToolBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={title} style={{ width: 24, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: '1px solid var(--cc-border-strong)', borderRadius: 4, color: 'var(--cc-text-soft)', cursor: 'pointer', fontSize: 'var(--cc-font-xs)' }}>{children}</button>
  );
}
