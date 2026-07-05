import { EventEmitter } from 'events';
import { powerMonitor } from 'electron';
import { createLogger } from '../logger/Logger';


const log = createLogger('IdleDetector');

/**
 * Detects employee idle state using Electron's built-in powerMonitor API.
 *
 * The powerMonitor.getSystemIdleTime() method returns system-wide idle time
 * in seconds (no keyboard/mouse activity) — reliable and cross-platform.
 *
 * This is the first production-grade implementation.
 * Advanced global hook-based monitoring will be added as a plugin.
 *
 * Events:
 *   'idle'   (idleSeconds: number)
 *   'active' ()
 */
export class IdleDetector extends EventEmitter {
  private idleThresholdSeconds: number;
  private pollIntervalMs: number;
  private pollTimer: NodeJS.Timeout | null = null;
  private isIdle = false;

  constructor(idleThresholdSeconds: number = 300, pollIntervalMs: number = 5000) {
    super();
    this.idleThresholdSeconds = idleThresholdSeconds;
    this.pollIntervalMs = pollIntervalMs;
  }

  updateThreshold(thresholdSeconds: number): void {
    this.idleThresholdSeconds = thresholdSeconds;
    log.info(`Idle threshold updated to ${thresholdSeconds}s`);
  }

  start(): void {
    if (this.pollTimer) return;

    this.pollTimer = setInterval(() => {
      this._check();
    }, this.pollIntervalMs);

    // Also listen to system suspend/resume for accurate state
    powerMonitor.on('suspend', () => {
      log.info('System suspended — marking idle');
      this._onSuspend();
    });
    powerMonitor.on('resume', () => {
      log.info('System resumed');
      this._onResume();
    });
    powerMonitor.on('lock-screen', () => {
      log.info('Screen locked — marking idle');
      this._onSuspend();
    });
    powerMonitor.on('unlock-screen', () => {
      log.info('Screen unlocked');
      this._onResume();
    });

    log.info(`Idle detector started — threshold: ${this.idleThresholdSeconds}s`);
  }

  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }
    powerMonitor.removeAllListeners('suspend');
    powerMonitor.removeAllListeners('resume');
    powerMonitor.removeAllListeners('lock-screen');
    powerMonitor.removeAllListeners('unlock-screen');
    log.info('Idle detector stopped');
  }

  /** Returns current idle time in seconds (delegates to Electron's native API) */
  getIdleSeconds(): number {
    return powerMonitor.getSystemIdleTime();
  }

  isCurrentlyIdle(): boolean {
    return this.isIdle;
  }

  private _check(): void {
    const idleSeconds = powerMonitor.getSystemIdleTime();

    const shouldBeIdle = idleSeconds >= this.idleThresholdSeconds;

    if (shouldBeIdle && !this.isIdle) {
      this.isIdle = true;
      log.info(`Employee idle detected — idle time: ${idleSeconds}s`);
      this.emit('idle', idleSeconds);
    } else if (!shouldBeIdle && this.isIdle) {
      this.isIdle = false;
      log.info('Employee activity resumed');
      this.emit('active');
    }
  }

  private _onSuspend(): void {
    if (!this.isIdle) {
      this.isIdle = true;
      this.emit('idle', this.idleThresholdSeconds);
    }
  }

  private _onResume(): void {
    if (this.isIdle) {
      this.isIdle = false;
      this.emit('active');
    }
  }

  dispose(): void {
    this.stop();
    this.removeAllListeners();
  }
}
