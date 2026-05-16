import type { TaskProgress } from './taskTypes';
import { TaskBridge } from './taskBridge';

/**
 * 页面切换保护弹窗。
 * 当用户切换页面时，如果存在不能静默后台继续的任务，就显示这个弹窗。
 */
interface Props {
  open: boolean;
  targetLabel?: string;
  tasks: TaskProgress[];
  onContinue: () => void;
  onStay: () => void;
}

export function NavigationGuardModal({
  open,
  targetLabel,
  tasks,
  onContinue,
  onStay,
}: Props) {
  if (!open) return null;

  const canCancelAll = tasks.every((task) => task.canCancel);

  return (
    <div className="cc-modal-backdrop">
      <div className="cc-modal-card">
        <h2>当前还有任务正在运行</h2>

        <p className="cc-body-sm">
          为了避免破坏正在进行的操作，切换到「{targetLabel || '其他页面'}」前需要确认。
        </p>
        <div className="cc-task-list">
          {tasks.map((task) => (
            <div key={task.taskId} className="cc-task-row">
              <strong>{task.title}</strong>
              <span>{task.currentStepLabel || task.message || task.status}</span>
            </div>
          ))}
        </div>
        <div className="cc-action-row">
          <button className="cc-btn cc-btn-soft" onClick={onStay}>留在当前页面</button>
          {canCancelAll && (
            <button className="cc-btn cc-btn-danger" onClick={async () => {
              for (const task of tasks) { await TaskBridge.cancel(task.taskId); }
              onContinue();
            }}>取消任务并切换</button>
          )}
          <button className="cc-btn cc-btn-primary" onClick={onContinue}>后台继续并切换</button>
        </div>
      </div>
    </div>
  );
}
