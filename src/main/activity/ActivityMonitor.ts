import { EventEmitter } from 'events';
import { BrowserWindow } from 'electron';
import { IdleDetector } from './IdleDetector';
import { ActivityStatus, ActivitySnapshot, TimerStatus } from '../../shared/types';
import { IPC } from '../../shared/constants/ipcChannels';
import { createLogger } from '../logger/Logger';

const log = createLogger('ActivityMonitor');

/**
 * Aggregates activity state from IdleDetector and timer status.
 * Computes the unified ActivityStatus visible to the manager.
 *
 * Status precedence:
 *   timer on_break  → 'on_break'
 *   timer stopped/idle → 'offline'
 *   idle detector idle → 'idle'
 *   else → 'active'
 *
 * Events:
 *   'status-changed' (status: ActivityStatus)
 */
export class ActivityMonitor extends EventEmitter {
  private idleDetector: IdleDetector;
  private currentStatus: ActivityStatus = 'offline';
  private timerStatus: TimerStatus = 'idle';
  private windows: Set<BrowserWindow> = new Set();

  // Rolling counters (reset each minute)
  private activeSeconds = 0;
  private idleSeconds = 0;
  private snapshotTimer: NodeJS.Timeout | null = null;

  constructor(idleDetector: IdleDetector) {
    super();
    this.idleDetector = idleDetector;

    this.idleDetector.on('idle', (secs: number) => {
      log.debug(`Idle event received — ${secs}s`);
      this._updateStatus();
    });

    this.idleDetector.on('active', () => {
      log.debug('Active event received');
      this._updateStatus();
    });
  }

  start(): void {
    // IdleDetector.start() already no-ops on a repeat call, but snapshotTimer
    // had no equivalent guard — calling start() twice (as index.ts used to,
    // once inline for a restored session and again unconditionally right
    // after) silently overwrote the handle and leaked the first interval
    // forever, doubling _recordSnapshot()'s cadence.
    if (this.snapshotTimer) return;
    this.idleDetector.start();
    this.snapshotTimer = setInterval(() => this._recordSnapshot(), 60_000);
    log.info('Activity monitor started');
  }

  stop(): void {
    this.idleDetector.stop();
    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer);
      this.snapshotTimer = null;
    }
    log.info('Activity monitor stopped');
  }

  /** Called by the timer engine when its status changes */
  onTimerStatusChanged(status: TimerStatus): void {
    this.timerStatus = status;
    this._updateStatus();
  }

  getStatus(): ActivityStatus {
    return this.currentStatus;
  }

  getIdleSeconds(): number {
    return this.idleDetector.getIdleSeconds();
  }

  getSnapshot(): ActivitySnapshot {
    return {
      timestamp: Date.now(),
      status: this.currentStatus,
      idleSeconds: this.idleDetector.getIdleSeconds(),
      activeSeconds: this.activeSeconds,
    };
  }

  registerWindow(win: BrowserWindow): void {
    this.windows.add(win);
    win.on('closed', () => this.windows.delete(win));
  }

  private _updateStatus(): void {
    let newStatus: ActivityStatus;

    switch (this.timerStatus) {
      case 'on_break':
        newStatus = 'on_break';
        break;
      case 'idle':
      case 'stopped':
        newStatus = 'offline';
        break;
      case 'running':
        newStatus = this.idleDetector.isCurrentlyIdle() ? 'idle' : 'active';
        break;
      case 'paused':
        newStatus = 'idle';
        break;
      default:
        newStatus = 'offline';
    }

    if (newStatus !== this.currentStatus) {
      log.info(`Activity status changed: ${this.currentStatus} → ${newStatus}`);
      this.currentStatus = newStatus;
      this.emit('status-changed', newStatus);
      this._broadcast();
    }
  }

  private _broadcast(): void {
    for (const win of this.windows) {
      if (!win.isDestroyed()) {
        win.webContents.send(IPC.ACTIVITY.STATUS_CHANGED, {
          status: this.currentStatus,
          idleSeconds: this.idleDetector.getIdleSeconds(),
        });
      }
    }
  }

  private _recordSnapshot(): void {
    const isActive = this.currentStatus === 'active';
    if (isActive) {
      this.activeSeconds += 60;
    } else {
      this.idleSeconds += 60;
    }
  }

  dispose(): void {
    this.stop();
    this.removeAllListeners();
  }
}
