import type { SetupTaskProgress } from '../types/setupTypes';

interface Props {
  task: SetupTaskProgress;
}

const statusColors: Record<string, string> = {
  queued: 'var(--cc-text-muted)',
  running: 'var(--cc-blue)',
  complete: 'var(--cc-green)',
  error: 'var(--cc-red)',
  cancelled: 'var(--cc-text-soft)',
};

const statusLabels: Record<string, string> = {
  queued: '排队中',
  running: '执行中',
  complete: '已完成',
  error: '失败',
  cancelled: '已取消',
};

export function TaskProgressCard({ task }: Props) {
  const color = statusColors[task.status] || 'var(--cc-text-muted)';

  return (
    <div style={{
      padding: '10px 14px', borderRadius: 'var(--cc-radius-md)',
      background: 'var(--cc-surface-solid)', border: '1px solid var(--cc-border)',
      marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{
          fontSize: 'var(--cc-font-2xs)', fontWeight: 600,
          color, padding: '1px 8px', borderRadius: 'var(--cc-radius-xs)',
          background: color === 'var(--cc-blue)' ? 'var(--cc-blue-soft)' :
                       color === 'var(--cc-green)' ? 'var(--cc-green-soft)' :
                       color === 'var(--cc-red)' ? 'var(--cc-red-soft)' :
                       'var(--cc-bg-muted)',
        }}>
          {statusLabels[task.status] || task.status}
        </span>
        <span style={{ fontSize: 'var(--cc-font-sm)', fontWeight: 500, color: 'var(--cc-text)', flex: 1 }}>
          {task.step}
        </span>
        {task.progress > 0 && task.progress < 1 && (
          <span style={{ fontSize: 'var(--cc-font-2xs)', color: 'var(--cc-text-muted)' }}>
            {Math.round(task.progress * 100)}%
          </span>
        )}
      </div>

      {task.status === 'running' && task.progress > 0 && (
        <div style={{
          height: 3, borderRadius: 2, background: 'var(--cc-bg-muted)',
          marginBottom: 4, overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', width: `${Math.round(task.progress * 100)}%`,
            background: 'var(--cc-blue)', borderRadius: 2,
            transition: 'width 0.3s ease',
          }} />
        </div>
      )}

      <p style={{ margin: 0, fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-muted)' }}>
        {task.message}
      </p>

      {task.error && (
        <div style={{
          marginTop: 6, padding: '6px 10px',
          borderRadius: 'var(--cc-radius-sm)',
          background: 'var(--cc-red-soft)',
          border: '1px solid var(--cc-red)',
          fontSize: 'var(--cc-font-xs)', color: 'var(--cc-red)',
        }}>
          {task.error}
        </div>
      )}
    </div>
  );
}
