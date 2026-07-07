import path from 'path';
import fs from 'fs';
import { EventEmitter } from 'events';
import screenshot from 'screenshot-desktop';
import sharp from 'sharp';
import crypto from 'crypto';
import { ScreenshotMetadata, Organization, TimerState } from '../../shared/types';
import { ScreenshotQueue } from './ScreenshotQueue';
import { createLogger } from '../logger/Logger';

const log = createLogger('ScreenshotService');

interface ScreenshotServiceConfig {
  intervalMinutes: number;
  captureMonitors: 'primary' | 'all';
  maxDimension: number;
  jpegQuality: number;
}

/**
 * Manages scheduled screenshot capture, compression, and queuing.
 * Only captures while the timer is actively running (not on break, not idle).
 *
 * Events:
 *   'captured' (metadata: ScreenshotMetadata)
 *   'error'    (error: Error)
 */
export class ScreenshotService extends EventEmitter {
  private config: ScreenshotServiceConfig;
  private queue: ScreenshotQueue;
  private captureTimer: NodeJS.Timeout | null = null;
  private isCapturing = false;
  private currentTaskId: string | null = null;
  private currentSessionId: string | null = null;
  private currentUserId: string | null = null;
  private readonly screenshotsDir: string;

  constructor(queue: ScreenshotQueue, organization: Pick<Organization, 'screenshotInterval' | 'screenshotMonitors'>) {
    super();
    this.queue = queue;
    this.screenshotsDir = queue.getScreenshotsDir();

    this.config = {
      intervalMinutes: ScreenshotService._safeInterval(organization.screenshotInterval),
      captureMonitors: organization.screenshotMonitors === 'all' ? 'all' : 'primary',
      maxDimension: parseInt(process.env.SCREENSHOT_MAX_DIMENSION ?? '1920', 10),
      jpegQuality: parseInt(process.env.SCREENSHOT_JPEG_QUALITY ?? '75', 10),
    };

    log.info(`Screenshot service initialized — interval: ${this.config.intervalMinutes}min`);
  }

  // A missing/invalid interval must never reach setInterval() as NaN/0 — Node
  // treats those as "fire almost immediately, repeatedly", which would hammer
  // the machine and the upload queue with continuous captures. This has been
  // a live risk: the backend's login/signup response didn't even include
  // screenshotInterval until this was fixed, so this constructed with
  // `undefined` in every real session prior to that fix.
  private static _safeInterval(minutes: unknown): number {
    const n = Number(minutes);
    return Number.isFinite(n) && n > 0 ? n : 1;
  }

  updateConfig(org: Partial<Pick<Organization, 'screenshotInterval' | 'screenshotMonitors'>>): void {
    if (org.screenshotInterval) this.config.intervalMinutes = ScreenshotService._safeInterval(org.screenshotInterval);
    if (org.screenshotMonitors) this.config.captureMonitors = org.screenshotMonitors === 'all' ? 'all' : 'primary';

    // Restart timer with new interval if currently running
    if (this.captureTimer) {
      this._stopCapturing();
      this._startCapturing();
    }

    log.info(`Screenshot config updated — interval: ${this.config.intervalMinutes}min`);
  }

  /** Called when the timer transitions to 'running' */
  onTimerStateChanged(timerState: TimerState, userId: string): void {
    this.currentTaskId = timerState.taskId;
    this.currentSessionId = timerState.sessionId;
    this.currentUserId = userId;

    if (timerState.status === 'running') {
      if (!this.captureTimer) {
        this._startCapturing();
      }
    } else {
      // Pause, break, stopped — stop captures
      if (this.captureTimer) {
        this._stopCapturing();
      }
    }
  }

  private _startCapturing(): void {
    const intervalMs = this.config.intervalMinutes * 60 * 1000;
    log.info(`Starting screenshot captures every ${this.config.intervalMinutes} minute(s)`);

    this.captureTimer = setInterval(() => {
      this._captureAll().catch((err) => {
        log.error('Screenshot capture failed', { error: err.message });
        this.emit('error', err);
      });
    }, intervalMs);
  }

  private _stopCapturing(): void {
    if (this.captureTimer) {
      clearInterval(this.captureTimer);
      this.captureTimer = null;
      log.info('Screenshot captures stopped');
    }
  }

  /** Capture all configured monitors and enqueue each */
  private async _captureAll(): Promise<void> {
    if (this.isCapturing) {
      log.debug('Previous capture still in progress — skipping');
      return;
    }
    if (!this.currentTaskId || !this.currentSessionId || !this.currentUserId) {
      log.debug('No active session — skipping capture');
      return;
    }

    this.isCapturing = true;
    
    try {
      const displays = await (screenshot as any).listDisplays();
      const captures = this.config.captureMonitors === 'primary'
        ? displays.filter((d: any) => d.primary)
        : displays;

      // Fallback if none flagged as primary
      const targetDisplays = captures.length > 0 ? captures : [displays[0]];

      const capturedAt = new Date().toISOString();

      for (let i = 0; i < targetDisplays.length; i++) {
        const display = targetDisplays[i];
        // Note: screenshot-desktop uses a string or number ID
        await this._captureDisplay(display.id, i, targetDisplays.length, capturedAt);
      }
    } finally {
      this.isCapturing = false;
    }
  }

  private async _captureDisplay(
    displayId: number,
    monitorIndex: number,
    monitorCount: number,
    capturedAt: string,
    testMode = false
  ): Promise<void> {
    const screenshotId = crypto.randomUUID();
    const rawPath = path.join(this.screenshotsDir, `${screenshotId}_raw.png`);
    const finalPath = path.join(this.screenshotsDir, `${screenshotId}.jpg`);

    try {
      // Capture raw screenshot
      const imgBuffer = await screenshot({ screen: displayId, format: 'png' }) as Buffer;
      fs.writeFileSync(rawPath, imgBuffer);

      // Compress with sharp
      const sharpInstance = sharp(rawPath);
      const meta = await sharpInstance.metadata();
      const width = meta.width ?? 1920;
      const height = meta.height ?? 1080;

      // Resize if too large while maintaining aspect ratio
      const needsResize = width > this.config.maxDimension || height > this.config.maxDimension;
      let pipeline = sharpInstance;
      if (needsResize) {
        pipeline = pipeline.resize(this.config.maxDimension, this.config.maxDimension, {
          fit: 'inside',
          withoutEnlargement: true,
        });
      }

      await pipeline.jpeg({ quality: this.config.jpegQuality, progressive: true }).toFile(finalPath);

      // Get final file size
      const stats = fs.statSync(finalPath);

      if (testMode) {
        // Verifies the capture mechanism (display access, sharp compression,
        // disk write) works — but there's no real task/session to attribute
        // this to, so it must never be queued for upload.
        log.info(`Test screenshot captured successfully (${Math.round(stats.size / 1024)}KB)`);
        fs.unlinkSync(finalPath);
        return;
      }

      const finalMeta = await sharp(finalPath).metadata();

      const metadata: ScreenshotMetadata = {
        id: screenshotId,
        taskId: this.currentTaskId!,
        sessionId: this.currentSessionId!,
        userId: this.currentUserId!,
        capturedAt,
        monitorIndex,
        monitorCount,
        width: finalMeta.width ?? width,
        height: finalMeta.height ?? height,
        fileSize: stats.size,
        localPath: finalPath,
        uploadStatus: 'pending',
        retryCount: 0,
      };

      this.queue.enqueue(metadata);
      this.emit('captured', metadata);

      log.debug(`Screenshot captured: ${screenshotId} (${Math.round(stats.size / 1024)}KB)`);
    } finally {
      // Clean up raw file regardless of outcome
      if (fs.existsSync(rawPath)) {
        fs.unlinkSync(rawPath);
      }
    }
  }

  /** Verifies capture works (permissions, monitor access, compression) without
   * enqueuing anything for upload — there's no real task/session to attach a
   * test capture to, so previously this used fake 'test-session'/'test-task'/
   * 'test-user' IDs that got queued and later failed against the real backend. */
  public async takeTestScreenshot(): Promise<void> {
    log.info('Manual test screenshot triggered');
    this.isCapturing = true;

    try {
      const displays = await (screenshot as any).listDisplays();
      const captures = this.config.captureMonitors === 'primary'
        ? displays.filter((d: any) => d.primary)
        : displays;

      const targetDisplays = captures.length > 0 ? captures : [displays[0]];
      const capturedAt = new Date().toISOString();

      for (let i = 0; i < targetDisplays.length; i++) {
        const display = targetDisplays[i];
        await this._captureDisplay(display.id, i, targetDisplays.length, capturedAt, /* testMode */ true);
      }
    } finally {
      this.isCapturing = false;
    }
  }

  dispose(): void {
    this._stopCapturing();
    this.removeAllListeners();
  }
}
