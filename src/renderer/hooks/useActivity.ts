import { useEffect, useState } from 'react';
import { ActivityStatus } from '@shared/types';

interface ActivityState {
  status: ActivityStatus;
  idleSeconds: number;
}

/**
 * Subscribes to activity status changes from the main process.
 */
export function useActivity(): ActivityState {
  const [state, setState] = useState<ActivityState>({
    status: 'offline',
    idleSeconds: 0,
  });

  useEffect(() => {
    // Load current status
    window.worktrack.activity.getStatus().then((result) => {
      if (result.success && result.data) {
        setState({
          status: result.data.status,
          idleSeconds: result.data.idleSeconds,
        });
      }
    });

    // Subscribe to changes
    const unsubscribe = window.worktrack.activity.onStatusChanged(
      ({ status, idleSeconds }) => {
        setState({ status: status as ActivityStatus, idleSeconds });
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  return state;
}
