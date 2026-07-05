import { useEffect } from 'react';
import { useTimerStore } from '../store/timerStore';
import { TimerState } from '@shared/types';

/**
 * Subscribes to timer state changes from the main process
 * and keeps the Zustand store in sync.
 * Also loads the current timer state on mount.
 */
export function useTimer() {
  const store = useTimerStore();

  useEffect(() => {
    // Load initial timer state
    window.worktrack.timer.getState().then((result) => {
      if (result.success && result.data) {
        store.setTimerState(result.data as TimerState);
      }
    });

    // Subscribe to real-time state changes from the main process ticker
    const unsubscribe = window.worktrack.timer.onStateChanged((state: TimerState) => {
      store.setTimerState(state);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return store;
}
