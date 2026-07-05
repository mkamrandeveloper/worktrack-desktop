import { EventEmitter } from 'events';
import { BrowserWindow } from 'electron';
import { io, Socket } from 'socket.io-client';
import { OfflineQueue } from './OfflineQueue';
import { IPC } from '../../shared/constants/ipcChannels';
import { SOCKET_EVENTS } from '../../shared/constants/events';
import {
  TaskAssignedEvent,
  IntervalChangedEvent,
  NotificationPayload,
  Task,
  OrgPresenceEvent,
  OrgTimerActivityEvent,
} from '../../shared/types';
import { createLogger } from '../logger/Logger';

const log = createLogger('SyncService');

export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

export type SyncEventHandlers = {
  onTaskAssigned: (task: Task) => void;
  onIntervalChanged: (event: IntervalChangedEvent) => void;
  onNotification: (notification: NotificationPayload) => void;
  onForceTimerStop: () => void;
};

/**
 * Manages the Socket.io WebSocket connection to the WorkTrack backend.
 * Handles automatic reconnection with exponential back-off,
 * broadcasts server events to the renderer, and integrates the OfflineQueue.
 */
export class SyncService extends EventEmitter {
  private socket: Socket | null = null;
  private status: ConnectionStatus = 'disconnected';
  private offlineQueue: OfflineQueue;
  private windows: Set<BrowserWindow> = new Set();
  private handlers?: SyncEventHandlers;
  private userId: string | null = null;
  private organizationId: string | null = null;
  private tokenProvider: () => string | null = () => null;

  constructor(offlineQueue: OfflineQueue) {
    super();
    this.offlineQueue = offlineQueue;
  }

  setTokenProvider(provider: () => string | null): void {
    this.tokenProvider = provider;
  }

  setEventHandlers(handlers: SyncEventHandlers): void {
    this.handlers = handlers;
  }

  connect(wsUrl: string, userId: string, organizationId?: string): void {
    if (this.socket?.connected) {
      log.debug('Already connected');
      return;
    }

    this.userId = userId;
    this.organizationId = organizationId ?? null;
    this._setStatus('connecting');
    log.info(`Connecting to WebSocket: ${wsUrl}`);

    this.socket = io(wsUrl, {
      auth: { token: this.tokenProvider() },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30_000,
      randomizationFactor: 0.5,
      transports: ['websocket'],
    });

    this._registerSocketListeners();
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this._setStatus('disconnected');
    log.info('WebSocket disconnected');
  }

  sendToSocket(event: string, data: unknown): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      log.debug(`Socket not connected — event '${event}' dropped`);
    }
  }

  registerWindow(win: BrowserWindow): void {
    this.windows.add(win);
    win.on('closed', () => this.windows.delete(win));
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  private _registerSocketListeners(): void {
    if (!this.socket) return;

    this.socket.on(SOCKET_EVENTS.ON.CONNECT, () => {
      log.info('WebSocket connected');
      this._setStatus('connected');

      // Join the user's room + the org-wide room (for presence/timer broadcasts)
      this.socket!.emit(SOCKET_EVENTS.EMIT.JOIN_ROOM, {
        userId: this.userId,
        organizationId: this.organizationId,
      });

      // Flush any offline-queued requests
      this.offlineQueue.flush().catch((err) => {
        log.error('Offline queue flush failed', { error: err.message });
      });
    });

    this.socket.on(SOCKET_EVENTS.ON.DISCONNECT, (reason: string) => {
      log.warn(`WebSocket disconnected — reason: ${reason}`);
      this._setStatus('disconnected');
    });

    this.socket.on(SOCKET_EVENTS.ON.CONNECT_ERROR, (err: Error) => {
      log.error('WebSocket connection error', { message: err.message });
      this._setStatus('error');
    });

    this.socket.on(SOCKET_EVENTS.ON.TASK_ASSIGNED, (payload: TaskAssignedEvent) => {
      log.info(`Task assigned: ${payload.task.id}`);
      this.handlers?.onTaskAssigned(payload.task);
      this._broadcast(IPC.TASKS.UPDATED, payload);
    });

    this.socket.on(SOCKET_EVENTS.ON.TASK_UPDATED, (payload: { task: Task }) => {
      this.handlers?.onTaskAssigned(payload.task);
      this._broadcast(IPC.TASKS.UPDATED, payload);
    });

    this.socket.on(SOCKET_EVENTS.ON.SCREENSHOT_INTERVAL_CHANGED, (payload: IntervalChangedEvent) => {
      log.info(`Screenshot interval changed to ${payload.screenshotInterval}min`);
      this.handlers?.onIntervalChanged(payload);
      this._broadcast(IPC.SCREENSHOTS.SETTINGS_CHANGED, payload);
    });

    this.socket.on(SOCKET_EVENTS.ON.NOTIFICATION, (payload: NotificationPayload) => {
      log.info(`Notification received: ${payload.title}`);
      this.handlers?.onNotification(payload);
      this._broadcast(IPC.NOTIFICATIONS.RECEIVED, payload);
    });

    this.socket.on(SOCKET_EVENTS.ON.FORCE_TIMER_STOP, () => {
      log.warn('Force timer stop received from server');
      this.handlers?.onForceTimerStop();
    });

    this.socket.on(SOCKET_EVENTS.ON.SESSION_EXPIRED, () => {
      log.warn('Session expired signal from server');
      this._setStatus('error');
    });

    this.socket.on(SOCKET_EVENTS.ON.ORG_PRESENCE, (payload: OrgPresenceEvent) => {
      this._broadcast(IPC.SYNC.PRESENCE_CHANGED, payload);
    });

    this.socket.on(SOCKET_EVENTS.ON.ORG_TIMER_ACTIVITY, (payload: OrgTimerActivityEvent) => {
      this._broadcast(IPC.SYNC.TIMER_ACTIVITY, payload);
    });
  }

  private _setStatus(status: ConnectionStatus): void {
    this.status = status;
    this._broadcast(IPC.SYNC.STATUS_CHANGED, { status });
    super.emit('status-changed', status);
  }

  private _broadcast(channel: string, data: unknown): void {
    for (const win of this.windows) {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, data);
      }
    }
  }
}
