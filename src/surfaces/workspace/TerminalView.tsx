import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { usePtyTerminal } from '../../features/terminal/usePtyTerminal';
import { useRuntimeKernelStore } from '../../runtime-kernel/runtimeKernelStore';
import { CcEmptyState } from '../../components/ui/CcEmptyState';
interface Props {
  sessionId: string | null;
  /** v28: buffer prop received from RuntimeKernel terminalBuffers.
   *  Terminal writes are handled by usePtyTerminal via runtime-kernel://event.
   *  The buffer prop is available for reference/snapshot purposes. */
  buffer?: string;
  onSend?: (data: string) => void;
}

function parseRuntimeStartupHint(error?: string | null) {
  if (!error) return null;

  if (error.includes('CTRL_CC_CLAUDE_JS') || error.includes('No policy-allowed runnable')) {
    return {
      title: 'Claude Runtime Startup Failed',
      summary: 'Ctrl-CC did not find a direct Node.js Claude CLI entry. Shell wrappers are blocked to avoid cmd/powershell startup crashes.',
      actions: [
        'Open Settings → Diagnostics → Claude JS Candidates.',
        'If no existing JS candidate is found, set CTRL_CC_CLAUDE_JS to the real Claude CLI JS entry.',
        'Temporary fallback only: set CTRL_CC_ALLOW_SHELL_WRAPPER=1.',
      ],
    };
  }

  return {
    title: 'Claude Runtime Startup Failed',
    summary: error,
    actions: ['Open diagnostics.', 'Copy diagnostic bundle.', 'Start a new session after fixing Runtime.'],
  };
}

export function TerminalView({ sessionId }: Props) {
  const { t } = useTranslation();
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const containerCb = useCallback((node: HTMLDivElement | null) => setContainer(node), []);
  const handle = usePtyTerminal(sessionId, container);
  const runtimeSession = useRuntimeKernelStore((s) => (sessionId ? s.sessions[sessionId] : null));
  const runtimeFailed = runtimeSession?.status === 'failed' || runtimeSession?.status === 'exited' || runtimeSession?.status === 'stopped';
  const fitFnRef = useRef<(() => void) | null>(null);
  fitFnRef.current = handle?.fit ?? null;

  useEffect(() => {
    if (container) {
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
          {runtimeSession?.hasWriter && runtimeSession?.readerAlive ? '●' : runtimeFailed ? '×' : '○'} {runtimeSession?.status ?? handle?.status ?? 'idle'}{runtimeSession?.pid ? ` · PID ${runtimeSession.pid}` : ''}
        </span>
      </div>
      {runtimeFailed && (() => {
        const hint = parseRuntimeStartupHint(runtimeSession?.lastError);
        if (!hint) return null;
        return (
          <div className="runtime-startup-failure" style={{
            borderBottom: '1px solid var(--cc-border)',
            fontSize: 'var(--cc-font-xs)', lineHeight: 1.55,
          }}>
            <div style={{ fontWeight: 700, color: 'var(--cc-red)', marginBottom: 4 }}>
              {hint.title}
            </div>
            <div style={{ color: 'var(--cc-text-muted)', wordBreak: 'break-word', marginBottom: 4 }}>
              {hint.summary}
            </div>
            {hint.actions.length > 0 && (
              <ul style={{ margin: '4px 0 8px 16px', padding: 0, color: 'var(--cc-text-soft)' }}>
                {hint.actions.map((a, i) => <li key={i} style={{ marginBottom: 2 }}>{a}</li>)}
              </ul>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => navigator.clipboard.writeText(runtimeSession?.lastError || '')} style={{
                padding: '4px 10px', border: '1px solid var(--cc-border)',
                borderRadius: 'var(--cc-radius-sm)', background: 'transparent',
                color: 'var(--cc-text-muted)', cursor: 'pointer',
                fontSize: 'var(--cc-font-xs)', fontFamily: 'var(--cc-font-sans)',
              }}>
                Copy Error
              </button>
            </div>
          </div>
        );
      })()}
      <div ref={containerCb} data-testid="terminal-xterm-root" style={{ flex: 1, overflow: 'hidden', padding: 2, opacity: runtimeFailed ? 0.55 : 1 }} />
    </div>
  );
}

function ToolBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={title} style={{ width: 24, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: '1px solid var(--cc-border-strong)', borderRadius: 4, color: 'var(--cc-text-soft)', cursor: 'pointer', fontSize: 'var(--cc-font-xs)' }}>{children}</button>
  );
}
