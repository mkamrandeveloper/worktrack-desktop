import { getApiService } from './ApiService';
import { ActivityMonitor } from '../activity/ActivityMonitor';
import { TimerEngine } from '../timer/TimerEngine';
import { HeartbeatPayload } from '../../shared/types';
import { API_ENDPOINTS } from '../../shared/constants/events';
import { OfflineQueue } from '../sync/OfflineQueue';
import { createLogger } from '../logger/Logger';

const log = createLogger('HeartbeatService');

const DEFAULT_INTERVAL_SECONDS = parseInt(
  process.env.HEARTBEAT_INTERVAL_SECONDS ?? '60',
  10
);

/**
 * Sends periodic heartbeat to the backend with the current employee status.
 * Queues to the offline store if the request fails.
 */
export class HeartbeatService {
  private timer: NodeJS.Timeout | null = null;
  private activityMonitor: ActivityMonitor;
  private timerEngine: TimerEngine;
  private offlineQueue: OfflineQueue;
  private userId: string | null = null;
  private intervalSeconds: number;

  constructor(
    activityMonitor: ActivityMonitor,
    timerEngine: TimerEngine,
    offlineQueue: OfflineQueue
  ) {
    this.activityMonitor = activityMonitor;
    this.timerEngine = timerEngine;
    this.offlineQueue = offlineQueue;
    this.intervalSeconds = DEFAULT_INTERVAL_SECONDS;
  }

  start(userId: string): void {
    this.userId = userId;
    this._stopTimer();
    this.timer = setInterval(() => {
      this._send().catch((err) => {
        log.debug('Heartbeat failed — queuing for later', { error: err.message });
      });
    }, this.intervalSeconds * 1000);

    // Send immediately on start
    this._send().catch(() => {});
    log.info(`Heartbeat service started — interval: ${this.intervalSeconds}s`);
  }

  stop(): void {
    this._stopTimer();
    this.userId = null;
    log.info('Heartbeat service stopped');
  }

  private async _send(): Promise<void> {
    if (!this.userId) return;

    const timerState = this.timerEngine.getState();
    const activityStatus = this.activityMonitor.getStatus();

    const payload: HeartbeatPayload = {
      userId: this.userId,
      sessionId: timerState.sessionId,
      status: activityStatus,
      timerStatus: timerState.status,
      idleSeconds: this.activityMonitor.getIdleSeconds(),
      timestamp: new Date().toISOString(),
      platform: process.platform,
      appVersion: process.env.npm_package_version ?? '1.0.0',
    };

    try {
      const api = getApiService();
      await api.post(API_ENDPOINTS.ACTIVITY.HEARTBEAT, payload);
      log.debug(`Heartbeat sent — status: ${activityStatus}`);
    } catch {
      // Queue for replay when online
      this.offlineQueue.enqueue({
        url: API_ENDPOINTS.ACTIVITY.HEARTBEAT,
        method: 'POST',
        data: payload,
      });
    }
  }

  private _stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
