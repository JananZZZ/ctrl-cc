import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { useTaskStore } from './taskStore';
import type { TaskProgress } from './taskTypes';

let installed = false;

export const TaskBridge = {
  async install(): Promise<UnlistenFn | undefined> {
    if (installed) return undefined;
    installed = true;
    const unlisten = await listen<TaskProgress>('task://progress', (event) => {
      useTaskStore.getState().upsertTask(event.payload);
    });
    return () => { installed = false; unlisten(); };
  },
  pause(taskId: string) { return invoke('task_pause', { taskId }); },
  resume(taskId: string) { return invoke('task_resume', { taskId }); },
  cancel(taskId: string) { return invoke('task_cancel', { taskId }); },
  terminate(taskId: string) { return invoke('task_terminate', { taskId }); },
};
