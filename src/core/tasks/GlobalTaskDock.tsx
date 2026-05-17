import { useMemo } from 'react';
import { useTaskStore } from './taskStore';
import { TaskBridge } from './taskBridge';

/** v29: 全局任务坞组件 — 在任意页面显示活跃任务状态 */
export function GlobalTaskDock() {
  const tasks = useTaskStore((s) => s.tasks);
  const activeTasks = useMemo(
    () => Object.values(tasks).filter((t) =>
      ['queued', 'running', 'paused'].includes(t.status)
    ),
    [tasks],
  );
  if (activeTasks.length === 0) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 16, right: 16, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 320,
    }}>
      {activeTasks.map((task) => (
        <div key={task.taskId} className="cc-card cc-card-compact" style={{
          display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--cc-font-xs)',
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
            background: task.status === 'running' ? 'var(--cc-green)' :
              task.status === 'paused' ? 'var(--cc-amber)' : 'var(--cc-text-muted)',
          }} />
          <span style={{ flex: 1, color: 'var(--cc-text)' }}>{task.title}</span>
          <span style={{ color: 'var(--cc-text-muted)' }}>{task.currentStepLabel || task.status}</span>
          {task.canPause && task.status === 'running' && (
            <button onClick={() => TaskBridge.pause(task.taskId)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cc-amber)', fontSize: 'var(--cc-font-xs)' }}>⏸</button>
          )}
          {task.canCancel && (
            <button onClick={() => TaskBridge.cancel(task.taskId)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cc-red)', fontSize: 'var(--cc-font-xs)' }}>✕</button>
          )}
        </div>
      ))}
    </div>
  );
}
