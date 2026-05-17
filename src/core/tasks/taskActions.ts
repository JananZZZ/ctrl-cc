import { TaskBridge } from './taskBridge';

/** v29: 全局任务操作快捷方法 */
export const TaskActions = {
  pause: TaskBridge.pause,
  resume: TaskBridge.resume,
  cancel: TaskBridge.cancel,
  terminate: TaskBridge.terminate,
};
