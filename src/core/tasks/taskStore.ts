import { create } from 'zustand';
import type { TaskProgress } from './taskTypes';

interface TaskStore {
  tasks: Record<string, TaskProgress>;
  activeTaskId: string | null;
  upsertTask: (task: TaskProgress) => void;
  removeTask: (taskId: string) => void;
  activeTasks: () => TaskProgress[];
  blockingTasks: () => TaskProgress[];
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: {},
  activeTaskId: null,

  upsertTask: (task) => {
    set((state) => {
      const isActive = ['queued', 'running', 'paused'].includes(task.status);
      return {
        tasks: { ...state.tasks, [task.taskId]: task },
        activeTaskId: isActive ? task.taskId
          : state.activeTaskId === task.taskId ? null : state.activeTaskId,
      };
    });
  },

  removeTask: (taskId) => {
    set((state) => {
      const next = { ...state.tasks };
      delete next[taskId];
      return {
        tasks: next,
        activeTaskId: state.activeTaskId === taskId ? null : state.activeTaskId,
      };
    });
  },

  activeTasks: () => {
    return Object.values(get().tasks).filter((task) =>
      ['queued', 'running', 'paused'].includes(task.status)
    );
  },

  blockingTasks: () => {
    return Object.values(get().tasks).filter((task) => {
      const active = ['queued', 'running', 'paused'].includes(task.status);
      const safe = task.interruptPolicy === 'safe-background';
      return active && !safe;
    });
  },
}));
