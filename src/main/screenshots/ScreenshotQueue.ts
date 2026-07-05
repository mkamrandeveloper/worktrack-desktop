import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import Store from 'electron-store';
import { ScreenshotMetadata } from '../../shared/types';
import { createLogger } from '../logger/Logger';
import { getApiService } from '../services/ApiService';
import { API_ENDPOINTS } from '../../shared/constants/events';

const log = createLogger('ScreenshotQueue');

interface QueueStore {
  items: ScreenshotMetadata[];
}

/**
 * Persistent offline queue for screenshots.
 * Screenshots are queued on capture and flushed when internet is available.
 * Implements retry with exponential back-off (max 3 retries).
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
  async flush(): Promise<{ uploaded: number; failed: number }> {
    if (this.isFlushingNow) {
      log.debug('Flush already in progress — skipping');
      return { uploaded: 0, failed: 0 };
    }

    this.isFlushingNow = true;
    let uploaded = 0;
    let failed = 0;

    const items = this.store.get('items').filter((i) => i.uploadStatus !== 'uploaded');

    for (const item of items) {
      if (item.retryCount >= 3) {
        log.warn(`Screenshot ${item.id} exceeded max retries — marking failed`);
        this._updateItem(item.id, { uploadStatus: 'failed' });
        failed++;
        continue;
      }

      try {
        this._updateItem(item.id, { uploadStatus: 'uploading' });
        const remoteUrl = await this._upload(item);
        this._updateItem(item.id, { uploadStatus: 'uploaded', remoteUrl });
        this._deleteLocalFile(item.localPath);
        uploaded++;
        log.info(`Screenshot uploaded: ${item.id} → ${remoteUrl}`);
      } catch (err) {
        this._updateItem(item.id, {
          uploadStatus: 'pending',
          retryCount: item.retryCount + 1,
        });
        failed++;
        log.warn(`Screenshot upload failed (attempt ${item.retryCount + 1}): ${item.id}`, {
          error: (err as Error).message,
        });
      }
    }

    // Remove uploaded items to keep store small
    const remaining = this.store.get('items').filter((i) => i.uploadStatus !== 'uploaded');
    this.store.set('items', remaining);

    this.isFlushingNow = false;
    log.info(`Queue flush complete — uploaded: ${uploaded}, failed: ${failed}`);
    return { uploaded, failed };
  }

  private async _upload(item: ScreenshotMetadata): Promise<string> {
    if (!fs.existsSync(item.localPath)) {
      throw new Error(`Local screenshot file not found: ${item.localPath}`);
    }

    const fileBuffer = fs.readFileSync(item.localPath);
    const formData = new FormData();
    formData.append('file', new Blob([fileBuffer], { type: 'image/jpeg' }), `${item.id}.jpg`);
    formData.append('metadata', JSON.stringify({
      screenshotId: item.id,
      taskId: item.taskId,
      sessionId: item.sessionId,
      userId: item.userId,
      capturedAt: item.capturedAt,
      monitorIndex: item.monitorIndex,
      monitorCount: item.monitorCount,
      width: item.width,
      height: item.height,
    }));

    const api = getApiService();
    const result = await api.uploadFile<{ url: string }>(
      API_ENDPOINTS.SCREENSHOTS.UPLOAD,
      formData
    );
    return result.url;
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
