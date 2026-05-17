import { useRuntimeKernelStore } from '../../../runtime-kernel/runtimeKernelStore';

interface Props { sessionId?: string | null; }

/** v29: Runtime 状态条 — 显示当前会话的健康状态 */
export function RuntimeStatusStrip({ sessionId }: Props) {
  const runtime = useRuntimeKernelStore((s) => (sessionId ? s.sessions[sessionId] : undefined));
  if (!runtime) return null;

  const statusColor = runtime.status === 'ready' || runtime.status === 'busy' ? 'var(--cc-green)' :
    runtime.status === 'failed' || runtime.status === 'stopped' ? 'var(--cc-red)' :
    runtime.status === 'starting' ? 'var(--cc-amber)' : 'var(--cc-text-muted)';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px', borderRadius: 'var(--cc-radius-sm)', background: 'var(--cc-surface-solid)', border: '1px solid var(--cc-border)', fontSize: 'var(--cc-font-xs)' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor }} />
      <span style={{ color: 'var(--cc-text)' }}>Runtime: {runtime.status}</span>
      {runtime.pid && <span style={{ color: 'var(--cc-text-muted)' }}>PID {runtime.pid}</span>}
      {runtime.cwd && <span style={{ color: 'var(--cc-text-muted)' }}>{runtime.cwd}</span>}
    </div>
  );
}
