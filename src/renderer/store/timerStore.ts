import { create } from 'zustand';
import { TimerState, TimerStatus } from '@shared/types';

interface TimerStore extends TimerState {
  setTimerState: (state: TimerState) => void;
  startTimer: (taskId: string) => Promise<boolean>;
  pauseTimer: () => Promise<void>;
  resumeTimer: () => Promise<void>;
  startBreak: () => Promise<void>;
  endBreak: () => Promise<void>;
  stopTimer: () => Promise<void>;
  isLoading: boolean;
}

export const useTimerStore = create<TimerStore>((set) => ({
  status: 'idle' as TimerStatus,
  taskId: null,
  sessionId: null,
  startedAt: null,
  pausedAt: null,
  breakStartedAt: null,
  elapsedSeconds: 0,
  breakSeconds: 0,
  todaySeconds: 0,
  weekSeconds: 0,
  isLoading: false,

  setTimerState: (state: TimerState) => set({ ...state }),

  startTimer: async (taskId: string) => {
    set({ isLoading: true });
    const result = await window.worktrack.timer.start({ taskId });
    set({ isLoading: false });
    if (result.success && result.data) {
      set({ ...result.data });
      return true;
    }
    return false;
  },

  pauseTimer: async () => {
    const result = await window.worktrack.timer.pause();
    if (result.success && result.data) set({ ...result.data });
  },

  resumeTimer: async () => {
    const result = await window.worktrack.timer.resume();
    if (result.success && result.data) set({ ...result.data });
  },

  startBreak: async () => {
    const result = await window.worktrack.timer.breakStart();
    if (result.success && result.data) set({ ...result.data });
  },

  endBreak: async () => {
    const result = await window.worktrack.timer.breakEnd();
    if (result.success && result.data) set({ ...result.data });
  },

  stopTimer: async () => {
    const result = await window.worktrack.timer.stop();
    if (result.success && result.data) set({ ...result.data });
  },
}));
