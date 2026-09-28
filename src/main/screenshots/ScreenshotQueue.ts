import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import Store from 'electron-store';
import { ScreenshotMetadata } from '../../shared/types';
import { createLogger } from '../logger/Logger';
import { getApiService, isTransientError } from '../services/ApiService';
import { API_ENDPOINTS } from '../../shared/constants/events';

const log = createLogger('ScreenshotQueue');

// Uploads the server rejects (bad file, etc.) get 3 tries. Outage-type
// failures don't count: those screenshots wait — up to a week — for the
// server to be reachable again instead of being thrown away.
const MAX_REJECTIONS = 3;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface QueueStore {
  items: ScreenshotMetadata[];
}

/**
 * Persistent offline queue for screenshots.
 * Screenshots are queued on capture and flushed when internet is available.
 * Outage-type failures are retried indefinitely (up to a week); uploads the
 * server rejects are dropped after 3 attempts.
 */
export class ScreenshotQueue {
  private store: Store<QueueStore>;
  private isFlushingNow = false;
  private readonly screenshotsDir: string;

  constructor(encryptionKey: string) {
    this.store = new Store<QueueStore>({
      name: 'screenshot-queue',
      encryptionKey,
      clearInvalidConfig: true,
      defaults: { items: [] },
    });

    this.screenshotsDir = path.join(app.getPath('userData'), 'screenshots_tmp');
    if (!fs.existsSync(this.screenshotsDir)) {
      fs.mkdirSync(this.screenshotsDir, { recursive: true });
    }

    log.info(`Screenshot queue initialized — ${this.getPendingCount()} items pending`);
  }

  enqueue(metadata: ScreenshotMetadata): void {
    const items = this.store.get('items');
    items.push(metadata);
    this.store.set('items', items);
    log.debug(`Screenshot queued: ${metadata.id}`);
  }

  getPendingCount(): number {
    return this.store.get('items').filter((i) => i.uploadStatus !== 'uploaded').length;
  }

  getAll(): ScreenshotMetadata[] {
    return this.store.get('items');
  }

  /**
   * Attempts to upload all pending screenshots.
   * Safe to call repeatedly — skips if already flushing.
   */
  /**
   * @returns uploaded — sent this flush; failed — attempts that didn't succeed
   * (will retry); lost — screenshots given up on for good this flush.
   */
  async flush(): Promise<{ uploaded: number; failed: number; lost: number }> {
    if (this.isFlushingNow) {
      log.debug('Flush already in progress — skipping');
      return { uploaded: 0, failed: 0, lost: 0 };
    }

    this.isFlushingNow = true;
    let uploaded = 0;
    let failed = 0;
    let lost = 0;
    let serverUnreachable = false;

    const items = this.store.get('items').filter((i) => i.uploadStatus !== 'uploaded' && i.uploadStatus !== 'failed');

    try {
    for (const item of items) {
      const tooOld = Date.now() - new Date(item.capturedAt).getTime() > MAX_AGE_MS;
      if (item.retryCount >= MAX_REJECTIONS || tooOld) {
        log.warn(`Screenshot ${item.id} ${tooOld ? 'older than a week' : 'rejected by the server repeatedly'} — giving up`);
        this._updateItem(item.id, { uploadStatus: 'failed' });
        this._deleteLocalFile(item.localPath);
        lost++;
        continue;
      }
      // Server unreachable — leave the rest queued for the next flush.
      if (serverUnreachable) { failed++; continue; }

      try {
        this._updateItem(item.id, { uploadStatus: 'uploading' });
        // Holds the server-side screenshot id, not an actual URL — the real
        // Drive URL lands later via the backend's own async Drive upload.
        const remoteUrl = await this._upload(item);
        this._updateItem(item.id, { uploadStatus: 'uploaded', remoteUrl });
        this._deleteLocalFile(item.localPath);
        uploaded++;
        log.info(`Screenshot uploaded: ${item.id} → server id ${remoteUrl}`);
      } catch (err) {
        const transient = isTransientError(err) && !(err as { permanent?: boolean }).permanent;
        if (transient) serverUnreachable = true;
        this._updateItem(item.id, {
          uploadStatus: 'pending',
          // Outages don't count toward giving up — only real rejections do.
          retryCount: transient ? item.retryCount : item.retryCount + 1,
        });
        failed++;
        log.warn(`Screenshot upload ${transient ? 'postponed (server unreachable)' : 'rejected'}: ${item.id}`, {
          error: (err as Error).message,
        });
      }
    }
    } finally {
      // Remove finished items to keep the store small
      const remaining = this.store.get('items').filter((i) => i.uploadStatus !== 'uploaded' && i.uploadStatus !== 'failed');
      this.store.set('items', remaining);
      this.isFlushingNow = false;
    }

    log.info(`Queue flush complete — uploaded: ${uploaded}, pending: ${failed}, lost: ${lost}`);
    return { uploaded, failed, lost };
  }

  private async _upload(item: ScreenshotMetadata): Promise<string> {
    if (!fs.existsSync(item.localPath)) {
      // Nothing to upload — retrying can never succeed.
      throw Object.assign(new Error(`Local screenshot file not found: ${item.localPath}`), { permanent: true });
    }

    const fileBuffer = fs.readFileSync(item.localPath);
    const formData = new FormData();
    // Field name and flat body fields must match the backend's
    // `upload.single('screenshot')` + `req.body.taskId/sessionId` exactly.
    formData.append('screenshot', new Blob([fileBuffer], { type: 'image/jpeg' }), `${item.id}.jpg`);
    if (item.taskId) formData.append('taskId', item.taskId);
    if (item.sessionId) formData.append('sessionId', item.sessionId);

    const api = getApiService();
    // The backend accepts the file synchronously but uploads to Drive
    // asynchronously (the real drive_file_url lands later) — it only ever
    // returns the screenshot's server-side id at this point.
    const result = await api.uploadFile<{ screenshotId: string }>(
      API_ENDPOINTS.SCREENSHOTS.UPLOAD,
      formData
    );
    return result.screenshotId;
  }

  private _updateItem(id: string, updates: Partial<ScreenshotMetadata>): void {
    const items = this.store.get('items').map((item) =>
      item.id === id ? { ...item, ...updates } : item
    );
    this.store.set('items', items);
  }

  private _deleteLocalFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      log.warn(`Failed to delete temporary screenshot: ${filePath}`, {
        error: (err as Error).message,
      });
    }
  }

  /** Get the temporary screenshots directory */
  getScreenshotsDir(): string {
    return this.screenshotsDir;
  }

  /** Remove all items (used on logout) */
  clear(): void {
    this.store.set('items', []);
    log.info('Screenshot queue cleared');
  }
}
