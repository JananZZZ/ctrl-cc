/**
 * 全局任务状态。
 * 任何可能持续超过 300ms 的操作，都应该进入任务系统。
 */
export type TaskStatus =
  | 'queued' | 'running' | 'paused'
  | 'success' | 'warning' | 'error' | 'cancelled';

export type TaskInterruptPolicy =
  | 'safe-background' | 'confirm-on-leave' | 'cancel-on-leave'
  | 'critical-noninterruptible' | 'destructive-confirm';

export interface TaskProgress {
  taskId: string;
  kind: string;
  title: string;
  status: TaskStatus;
  interruptPolicy: TaskInterruptPolicy;
  currentStepId?: string;
  currentStepLabel?: string;
  message?: string;
  progress: number;
  startedAt: string;
  updatedAt: string;
  endedAt?: string;
  canPause: boolean;
  canResume: boolean;
  canCancel: boolean;
  canTerminate: boolean;
  error?: string;
}
