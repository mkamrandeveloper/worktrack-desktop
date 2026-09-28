import Store from 'electron-store';
import { createLogger } from '../logger/Logger';
import { getApiService, isTransientError } from '../services/ApiService';

const log = createLogger('OfflineQueue');

interface QueuedRequest {
  id: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  data?: unknown;
  timestamp: string;
  retryCount: number;
}

// Requests the server rejected outright (4xx/500) get a few more tries, then
// are dropped. Outage-type failures don't count — those requests wait for the
// connection to come back, up to MAX_AGE.
const MAX_REJECTIONS = 3;
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;
const HEARTBEAT_URL = '/api/activity/heartbeat';

interface OfflineQueueStore {
  requests: QueuedRequest[];
}

/**
 * Persists failed API calls and replays them when connectivity is restored.
 * Used for timer events, heartbeats, and activity updates.
 */
export class OfflineQueue {
  private store: Store<OfflineQueueStore>;
  private flushing = false;

  constructor(encryptionKey: string) {
    this.store = new Store<OfflineQueueStore>({
      name: 'offline-queue',
      encryptionKey,
      clearInvalidConfig: true,
      defaults: { requests: [] },
    });

    const pending = this.store.get('requests').length;
    if (pending > 0) {
      log.info(`Offline queue loaded — ${pending} requests pending`);
    }
  }

  enqueue(request: Omit<QueuedRequest, 'id' | 'timestamp' | 'retryCount'>): void {
    // The server stamps heartbeats with their arrival time, so only the latest
    // queued one is meaningful — don't let an outage pile up hundreds.
    const requests = request.url === HEARTBEAT_URL
      ? this.store.get('requests').filter((r) => r.url !== HEARTBEAT_URL)
      : this.store.get('requests');
    requests.push({
      ...request,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: new Date().toISOString(),
      retryCount: 0,
    });
    this.store.set('requests', requests);
    log.debug(`Queued offline request: ${request.method} ${request.url}`);
  }

  getPendingCount(): number {
    return this.store.get('requests').length;
  }

  async flush(): Promise<{ replayed: number; failed: number }> {
    // Triggered by both a timer and socket reconnects — never run twice at
    // once, or the same request would be sent twice.
    if (this.flushing) return { replayed: 0, failed: 0 };
    const requests = this.store.get('requests');
    if (requests.length === 0) return { replayed: 0, failed: 0 };

    this.flushing = true;
    log.info(`Flushing offline queue — ${requests.length} requests`);
    const api = getApiService();
    let replayed = 0;
    let failed = 0;
    const stillPending: QueuedRequest[] = [];
    let serverUnreachable = false;

    try {
    for (const req of requests) {
      if (Date.now() - new Date(req.timestamp).getTime() > MAX_AGE_MS) {
        log.warn(`Dropping queued request older than 3 days: ${req.method} ${req.url}`);
        failed++;
        continue;
      }
      if (req.retryCount >= MAX_REJECTIONS) {
        log.warn(`Dropping queued request the server keeps rejecting: ${req.method} ${req.url}`);
        failed++;
        continue;
      }
      // Once the server is clearly unreachable, keep the rest (in order) for
      // the next flush instead of hammering it request by request.
      if (serverUnreachable) {
        stillPending.push(req);
        continue;
      }

      try {
        switch (req.method) {
          case 'POST':
            await api.post(req.url, req.data);
            break;
          case 'PUT':
            await api.put(req.url, req.data);
            break;
          case 'PATCH':
            await api.patch(req.url, req.data);
            break;
          case 'DELETE':
            await api.delete(req.url);
            break;
          default:
            await api.get(req.url);
        }
        replayed++;
        log.debug(`Replayed: ${req.method} ${req.url}`);
      } catch (err) {
        if (isTransientError(err)) {
          serverUnreachable = true; // outage — doesn't count against the request
        } else {
          req.retryCount++;
        }
        stillPending.push(req);
        failed++;
      }
    }
    } finally {
      // Keep anything enqueued while this flush was running.
      const known = new Set(requests.map((r) => r.id));
      const added = this.store.get('requests').filter((r) => !known.has(r.id));
      this.store.set('requests', [...stillPending, ...added]);
      this.flushing = false;
    }

    log.info(`Offline queue flush complete — replayed: ${replayed}, failed: ${failed}`);
    return { replayed, failed };
  }

  clear(): void {
    this.store.set('requests', []);
  }
}
