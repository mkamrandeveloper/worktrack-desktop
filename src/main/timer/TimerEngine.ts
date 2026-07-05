import { EventEmitter } from 'events';
import { TimerState, TimerEvent } from '../../shared/types';
import { createLogger } from '../logger/Logger';
import Store from 'electron-store';

const log = createLogger('TimerEngine');

const TICK_INTERVAL_MS = 1000; // 1-second resolution
const DRIFT_THRESHOLD_MS = 50; // drift correction trigger

/**
 * High-accuracy timer engine using setTimeout with drift correction.
 * Persists state to electron-store so the timer survives app restarts.
 *
 * Events emitted:
 *   'state-changed' (state: TimerState)
 *   'tick'          (state: TimerState)
 *   'timer-event'   (event: TimerEvent)
 */
export class TimerEngine extends EventEmitter {
  private state: TimerState;
  private store: Store<{ timerState: TimerState }>;
  private tickTimeout: NodeJS.Timeout | null = null;
  private nextTickAt = 0;

  constructor(encryptionKey: string) {
    super();

    this.store = new Store<{ timerState: TimerState }>({
      name: 'timer-state',
      encryptionKey,
      clearInvalidConfig: true,
      defaults: {
        timerState: TimerEngine.createInitialState(),
      },
    });

    // Restore persisted state on startup
    const persisted = this.store.get('timerState');
    this.state = this._reconcilePersistedState(persisted);
    log.info(`Timer engine initialized — status: ${this.state.status}`);
  }

  static createInitialState(): TimerState {
    return {
      status: 'idle',
      taskId: null,
      sessionId: null,
      startedAt: null,
      pausedAt: null,
      breakStartedAt: null,
      elapsedSeconds: 0,
      breakSeconds: 0,
      todaySeconds: 0,
      weekSeconds: 0,
    };
  }

  getState(): TimerState {
    return { ...this.state };
  }

  /** Start a new timer session for the given task */
  start(taskId: string, sessionId: string): void {
    if (this.state.status !== 'idle' && this.state.status !== 'stopped') {
      log.warn(`Cannot start timer in status: ${this.state.status}`);
      return;
    }

    this.state = {
      ...TimerEngine.createInitialState(),
      status: 'running',
      taskId,
      sessionId,
      startedAt: Date.now(),
    };

    this._emitEvent('start', taskId, sessionId);
    this._startTicking();
    this._persist();
    log.info(`Timer started for task: ${taskId}`);
  }

  pause(): void {
    if (this.state.status !== 'running') return;

    this._stopTicking();
    this.state.status = 'paused';
    this.state.pausedAt = Date.now();

    this._emitEvent('pause');
    this._persist();
    log.info('Timer paused');
  }

  resume(): void {
    if (this.state.status !== 'paused') return;

    this.state.status = 'running';
    this.state.pausedAt = null;

    this._emitEvent('resume');
    this._startTicking();
    this._persist();
    log.info('Timer resumed');
  }

  startBreak(): void {
    if (this.state.status !== 'running') return;

    this._stopTicking();
    this.state.status = 'on_break';
    this.state.breakStartedAt = Date.now();

    this._emitEvent('break_start');
    this._persist();
    log.info('Break started');
  }

  endBreak(): void {
    if (this.state.status !== 'on_break') return;

    const breakDuration = this.state.breakStartedAt
      ? Math.floor((Date.now() - this.state.breakStartedAt) / 1000)
      : 0;

    this.state.breakSeconds += breakDuration;
    this.state.breakStartedAt = null;
    this.state.status = 'running';

    this._emitEvent('break_end');
    this._startTicking();
    this._persist();
    log.info(`Break ended — duration: ${breakDuration}s`);
  }

  stop(): void {
    if (this.state.status === 'idle' || this.state.status === 'stopped') return;

    this._stopTicking();

    // Flush any active break duration
    if (this.state.status === 'on_break' && this.state.breakStartedAt) {
      this.state.breakSeconds += Math.floor((Date.now() - this.state.breakStartedAt) / 1000);
      this.state.breakStartedAt = null;
    }

    this.state.status = 'stopped';

    this._emitEvent('stop');
    this._persist();
    log.info(`Timer stopped — working: ${this.state.elapsedSeconds}s, breaks: ${this.state.breakSeconds}s`);
  }

  reset(): void {
    this._stopTicking();
    this.state = TimerEngine.createInitialState();
    this._persist();
    this._emitStateChange();
  }

  /** Drift-corrected tick loop using recursive setTimeout */
  private _startTicking(): void {
    this._stopTicking();
    this.nextTickAt = Date.now() + TICK_INTERVAL_MS;
    this._tick();
  }

  private _tick(): void {
    const now = Date.now();
    const drift = now - this.nextTickAt;

    if (this.state.status === 'running') {
      this.state.elapsedSeconds += 1;
      this.state.todaySeconds += 1;
      this.state.weekSeconds += 1;
    }

    this.emit('tick', this.getState());
    this._emitStateChange();

    // Adjust next tick to compensate for drift
    const nextDelay = Math.max(TICK_INTERVAL_MS - drift, 0);
    this.nextTickAt += TICK_INTERVAL_MS;

    if (drift > DRIFT_THRESHOLD_MS) {
      log.debug(`Timer drift detected: ${drift}ms`);
    }

    this.tickTimeout = setTimeout(() => this._tick(), nextDelay);
  }

  private _stopTicking(): void {
    if (this.tickTimeout) {
      clearTimeout(this.tickTimeout);
      this.tickTimeout = null;
    }
  }

  private _emitEvent(type: TimerEvent['type'], taskId?: string, sessionId?: string): void {
    const event: TimerEvent = {
      type,
      taskId: taskId ?? this.state.taskId ?? undefined,
      sessionId: sessionId ?? this.state.sessionId ?? undefined,
      timestamp: Date.now(),
    };
    this.emit('timer-event', event);
    this._emitStateChange();
  }

  private _emitStateChange(): void {
    this.emit('state-changed', this.getState());
  }

  private _persist(): void {
    this.store.set('timerState', this.state);
  }

  /**
   * After an app restart, reconcile the persisted timer state.
   * If the timer was running when the app crashed, compute elapsed time from timestamps.
   */
  private _reconcilePersistedState(persisted: TimerState): TimerState {
    if (persisted.status === 'running' && persisted.startedAt) {
      // App crashed while timer was running — compute elapsed from timestamps
      const rawElapsed = Math.floor((Date.now() - persisted.startedAt) / 1000);
      const breaks = persisted.breakSeconds;
      persisted.elapsedSeconds = Math.max(rawElapsed - breaks, 0);
      log.info(`Recovered running timer — computed elapsed: ${persisted.elapsedSeconds}s`);
    } else if (persisted.status === 'on_break') {
      // Crashed during break — resume paused state
      persisted.status = 'paused';
      persisted.breakStartedAt = null;
    }
    return persisted;
  }

  /** Get formatted time breakdown */
  getTimeBreakdown(): {
    working: string;
    breaks: string;
    total: string;
    overtime: string;
  } {
    const toHHMMSS = (s: number) => {
      const h = Math.floor(s / 3600).toString().padStart(2, '0');
      const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
      const sec = (s % 60).toString().padStart(2, '0');
      return `${h}:${m}:${sec}`;
    };

    const total = this.state.elapsedSeconds + this.state.breakSeconds;
    const standardWorkday = 8 * 3600;
    const overtime = Math.max(this.state.elapsedSeconds - standardWorkday, 0);

    return {
      working: toHHMMSS(this.state.elapsedSeconds),
      breaks: toHHMMSS(this.state.breakSeconds),
      total: toHHMMSS(total),
      overtime: toHHMMSS(overtime),
    };
  }

  dispose(): void {
    this._stopTicking();
    this.removeAllListeners();
    log.info('Timer engine disposed');
  }
}
