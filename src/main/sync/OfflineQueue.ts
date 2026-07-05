import Store from 'electron-store';
import { createLogger } from '../logger/Logger';
import { getApiService } from '../services/ApiService';

const log = createLogger('OfflineQueue');

interface QueuedRequest {
  id: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  data?: unknown;
  timestamp: string;
  retryCount: number;
}

interface OfflineQueueStore {
  requests: QueuedRequest[];
}

/**
 * Persists failed API calls and replays them when connectivity is restored.
 * Used for timer events, heartbeats, and activity updates.
 */
export class OfflineQueue {
  private store: Store<OfflineQueueStore>;

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
    const requests = this.store.get('requests');
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
    const requests = this.store.get('requests');
    if (requests.length === 0) return { replayed: 0, failed: 0 };

    log.info(`Flushing offline queue — ${requests.length} requests`);
    const api = getApiService();
    let replayed = 0;
    let failed = 0;
    const stillPending: QueuedRequest[] = [];

    for (const req of requests) {
      if (req.retryCount >= 5) {
        log.warn(`Dropping queued request after max retries: ${req.method} ${req.url}`);
        failed++;
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
      } catch {
        req.retryCount++;
        stillPending.push(req);
        failed++;
      }
    }

    this.store.set('requests', stillPending);
    log.info(`Offline queue flush complete — replayed: ${replayed}, failed: ${failed}`);
    return { replayed, failed };
  }

  clear(): void {
    this.store.set('requests', []);
  }
}
