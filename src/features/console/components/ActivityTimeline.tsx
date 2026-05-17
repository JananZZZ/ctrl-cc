import { useMemo } from 'react';
import { useDiagnosticLedger } from '../../../core/diagnostics/diagnosticLedger';
import { useTaskStore } from '../../../core/tasks/taskStore';

const SEVERITY_COLORS: Record<string, string> = {
  info: 'var(--cc-blue)',
  warning: 'var(--cc-amber)',
  error: 'var(--cc-red)',
  critical: 'var(--cc-red)',
};

/**
 * 活动时间线组件。
 * 显示最近的诊断事件和任务完成记录。
 */
export function ActivityTimeline() {
  const rawEvents = useDiagnosticLedger((s) => s.events);
  const events = useMemo(() => rawEvents.slice(0, 8), [rawEvents]);
  const taskMap = useTaskStore((s) => s.tasks);
  const tasks = useMemo(
    () => Object.values(taskMap).filter(
      (t) => t.status === 'success' || t.status === 'error' || t.status === 'warning'
    ).slice(0, 4),
    [taskMap],
  );

  if (events.length === 0 && tasks.length === 0) {
    return (
      <div className="cc-card cc-card-pad" style={{ textAlign: 'center', padding: '32px 20px' }}>
        <p style={{ color: 'var(--cc-text-muted)', fontSize: 'var(--cc-font-sm)' }}>
          暂无活动记录。开始使用 Ctrl-CC 后，这里会显示最近的诊断事件和任务记录。
        </p>
      </div>
    );
  }

  return (
    <div className="cc-card cc-card-pad">
      <h3 style={{ fontSize: 'var(--cc-font-md)', fontWeight: 600, marginBottom: 12, color: 'var(--cc-text)' }}>
        活动时间线
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tasks.map((task) => (
          <div key={task.taskId} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 12px', borderRadius: 'var(--cc-radius-sm)',
            background: 'var(--cc-bg-subtle)', fontSize: 'var(--cc-font-sm)',
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
              background: task.status === 'success' ? 'var(--cc-green)' :
                task.status === 'warning' ? 'var(--cc-amber)' : 'var(--cc-red)',
            }} />
            <span style={{ fontWeight: 500, color: 'var(--cc-text)' }}>{task.title}</span>
            <span style={{ color: 'var(--cc-text-muted)', marginLeft: 'auto', fontSize: 'var(--cc-font-xs)' }}>
              {task.status === 'success' ? '已完成' : task.status === 'warning' ? '需关注' : '失败'}
            </span>
          </div>
        ))}
        {events.slice(0, 6 - tasks.length).map((event) => (
          <div key={event.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 12px', borderRadius: 'var(--cc-radius-sm)',
            background: 'var(--cc-bg-subtle)', fontSize: 'var(--cc-font-sm)',
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
              background: SEVERITY_COLORS[event.severity] || 'var(--cc-text-muted)',
            }} />
            <span style={{ fontWeight: 500, color: 'var(--cc-text)' }}>{event.title}</span>
            <span style={{ color: 'var(--cc-text-muted)', marginLeft: 'auto', fontSize: 'var(--cc-font-xs)' }}>
              {event.source}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
