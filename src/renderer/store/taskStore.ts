import { create } from 'zustand';
import { Task } from '@shared/types';

interface TaskStore {
  tasks: Task[];
  selectedTaskId: string | null;
  isLoading: boolean;
  error: string | null;
  setTasks: (tasks: Task[]) => void;
  selectTask: (taskId: string | null) => void;
  fetchTasks: () => Promise<void>;
  upsertTask: (task: Task) => void;
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  selectedTaskId: null,
  isLoading: false,
  error: null,

  setTasks: (tasks) => set({ tasks }),

  selectTask: (taskId) => set({ selectedTaskId: taskId }),

  fetchTasks: async () => {
    set({ isLoading: true, error: null });
    const result = await window.worktrack.tasks.fetch();
    set({ isLoading: false });
    if (result.success && result.data) {
      set({ tasks: result.data });
    } else {
      // Fallback to cached
      const cached = await window.worktrack.tasks.getCached();
      if (cached.success && cached.data) {
        set({ tasks: cached.data });
      } else {
        set({ error: result.error ?? 'Failed to load tasks' });
      }
    }
  },

  upsertTask: (task: Task) => {
    const tasks = get().tasks;
    const index = tasks.findIndex((t) => t.id === task.id);
    if (index >= 0) {
      const updated = [...tasks];
      updated[index] = task;
      set({ tasks: updated });
    } else {
      set({ tasks: [...tasks, task] });
    }
  },
}));
