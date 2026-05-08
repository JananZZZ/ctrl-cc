import { useRef, useEffect } from 'react';
import { usePtyTerminal } from '../../features/terminal/usePtyTerminal';
import { CcEmptyState } from '../../components/ui/CcEmptyState';
interface Props {
  sessionId: string | null;
}

export function TerminalView({ sessionId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const handle = usePtyTerminal(sessionId, containerRef.current);

  useEffect(() => {
    if (handle) handle.fit();
  }, [handle]);

  if (!sessionId) {
    return (
      <div data-testid="terminal-view" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1b1e' }}>
        <CcEmptyState icon="⌨️" title="终端就绪" description="新建 PTY 会话后，Claude Code CLI 将在此显示" />
      </div>
    );
  }

  return (
    <div data-testid="terminal-view" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#1a1b1e' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4, padding: '2px 6px',
        borderBottom: '1px solid #333', background: '#222',
        flexShrink: 0, minHeight: 28,
      }}>
        <ToolBtn onClick={() => handle?.sendCtrlC()} title="Ctrl+C">⏹</ToolBtn>
        <ToolBtn onClick={() => handle?.sendCtrlD()} title="Ctrl+D">⏏</ToolBtn>
        <ToolBtn onClick={() => handle?.clear()} title="清除">⌧</ToolBtn>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: '#888' }}>
          {handle?.status === 'running' ? '●' : handle?.status === 'starting' ? '◐' : '○'} {handle?.status ?? 'idle'}
        </span>
      </div>
      {/* xterm container */}
      <div ref={containerRef} data-testid="terminal-xterm-root" style={{ flex: 1, overflow: 'hidden', padding: 2 }} />
    </div>
  );
}

function ToolBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={title} style={{
      width: 24, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'transparent', border: '1px solid #444', borderRadius: 4,
      color: '#ccc', cursor: 'pointer', fontSize: 11,
    }}>{children}</button>
  );
}
