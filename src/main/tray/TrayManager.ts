import { Tray, Menu, BrowserWindow, nativeImage } from 'electron';
import path from 'path';
import { TimerState, ActivityStatus } from '../../shared/types';
import { createLogger } from '../logger/Logger';

const log = createLogger('TrayManager');

type TrayActionHandler = {
  onOpenDashboard: () => void;
  onStartTimer: () => void;
  onPauseTimer: () => void;
  onResumeTimer: () => void;
  onStartBreak: () => void;
  onEndBreak: () => void;
  onStopTimer: () => void;
  onQuit: () => void;
};

/**
 * Manages the system tray icon, tooltip, and context menu.
 * Updates dynamically based on timer state and connection status.
 */
export class TrayManager {
  private tray: Tray | null = null;
  private handlers: TrayActionHandler;
  private timerState: TimerState | null = null;
  private syncStatus: string = 'disconnected';
  private activityStatus: ActivityStatus = 'offline';

  constructor(handlers: TrayActionHandler) {
    this.handlers = handlers;
  }

  create(_mainWindow: BrowserWindow): void {

    const iconPath = this._getIconPath();
    const icon = nativeImage.createFromPath(iconPath);

    this.tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon.resize({ width: 16, height: 16 }));
    this.tray.setToolTip('WorkTrack — Not tracking');

    this.tray.on('click', () => {
      this.handlers.onOpenDashboard();
    });

    this._rebuildMenu();
    log.info('System tray created');
  }

  updateTimerState(state: TimerState): void {
    this.timerState = state;
    this._updateTooltip();
    this._rebuildMenu();
  }

  updateSyncStatus(status: string): void {
    this.syncStatus = status;
    this._rebuildMenu();
  }

  updateActivityStatus(status: ActivityStatus): void {
    this.activityStatus = status;
    this._rebuildMenu();
  }

  destroy(): void {
    this.tray?.destroy();
    this.tray = null;
  }

  private _updateTooltip(): void {
    if (!this.tray || this.tray.isDestroyed()) return;

    const status = this.timerState?.status ?? 'idle';
    const elapsed = this.timerState?.elapsedSeconds ?? 0;
    const h = Math.floor(elapsed / 3600).toString().padStart(2, '0');
    const m = Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0');
    const s = (elapsed % 60).toString().padStart(2, '0');

    const statusLabels: Record<string, string> = {
      running: `Working — ${h}:${m}:${s}`,
      paused: `Paused — ${h}:${m}:${s}`,
      on_break: 'On Break',
      stopped: 'Stopped',
      idle: 'Not tracking',
    };

    this.tray.setToolTip(`WorkTrack — ${statusLabels[status] ?? 'Not tracking'}`);
  }

  private _rebuildMenu(): void {
    if (!this.tray || this.tray.isDestroyed()) return;

    const timerStatus = this.timerState?.status ?? 'idle';

    const syncStatusLabel = {
      connected: '🟢 Connected',
      disconnected: '🔴 Disconnected',
      connecting: '🟡 Connecting',
      error: '🔴 Connection Error',
    }[this.syncStatus] ?? '⚫ Unknown';

    const activityLabel = {
      active: '🟢 Active',
      idle: '🟡 Idle',
      on_break: '☕ On Break',
      offline: '⚫ Offline',
    }[this.activityStatus] ?? '⚫ Offline';

    const menu = Menu.buildFromTemplate([
      {
        label: 'Open Dashboard',
        click: this.handlers.onOpenDashboard,
      },
      { type: 'separator' },
      {
        label: '▶ Start Timer',
        enabled: timerStatus === 'idle' || timerStatus === 'stopped',
        click: this.handlers.onStartTimer,
      },
      {
        label: '⏸ Pause Timer',
        enabled: timerStatus === 'running',
        click: this.handlers.onPauseTimer,
      },
      {
        label: '▶ Resume Timer',
        enabled: timerStatus === 'paused',
        click: this.handlers.onResumeTimer,
      },
      {
        label: '☕ Start Break',
        enabled: timerStatus === 'running',
        click: this.handlers.onStartBreak,
      },
      {
        label: '↩ End Break',
        enabled: timerStatus === 'on_break',
        click: this.handlers.onEndBreak,
      },
      {
        label: '⏹ Stop Timer',
        enabled: timerStatus === 'running' || timerStatus === 'paused' || timerStatus === 'on_break',
        click: this.handlers.onStopTimer,
      },
      { type: 'separator' },
      { label: syncStatusLabel, enabled: false },
      { label: activityLabel, enabled: false },
      { type: 'separator' },
      {
        label: 'Quit WorkTrack',
        click: this.handlers.onQuit,
      },
    ]);

    this.tray.setContextMenu(menu);
  }

  private _getIconPath(): string {
    const platform = process.platform;
    const ext = platform === 'win32' ? 'ico' : platform === 'darwin' ? 'icns' : 'png';
    return path.join(__dirname, `../../../../assets/icons/icon.${ext}`);
  }
}
