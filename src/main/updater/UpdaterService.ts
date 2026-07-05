import { autoUpdater, UpdateInfo } from 'electron-updater';
import { app, BrowserWindow } from 'electron';
import { NotificationService } from '../notifications/NotificationService';
import { createLogger } from '../logger/Logger';
import { IPC } from '../../shared/constants/ipcChannels';

const log = createLogger('UpdaterService');

const RECHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // re-check every 4 hours for long-running sessions

/**
 * Manages application auto-updates using electron-updater.
 *
 * Fully quiet: updates are checked for periodically, downloaded in the
 * background with no user interaction, and installed automatically the
 * next time the app quits and relaunches (autoInstallOnAppQuit) — no
 * restart-now dialog interrupts the current session.
 */
export class UpdaterService {
  private windows: Set<BrowserWindow> = new Set();
  private notificationService: NotificationService;
  private recheckTimer: ReturnType<typeof setInterval> | null = null;

  constructor(notificationService: NotificationService) {
    this.notificationService = notificationService;
    this._configure();
  }

  private _configure(): void {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.logger = {
      info: (msg: string) => log.info(msg),
      warn: (msg: string) => log.warn(msg),
      error: (msg: string) => log.error(msg),
      debug: (msg: string) => log.debug(msg),
      transports: {},
    } as never;

    autoUpdater.on('checking-for-update', () => {
      log.info('Checking for updates...');
    });

    autoUpdater.on('update-available', (info: UpdateInfo) => {
      log.info(`Update available: v${info.version}`);
      this.notificationService.updateAvailable(info.version);
      this._broadcast(IPC.SYSTEM.UPDATE_AVAILABLE, { version: info.version });
    });

    autoUpdater.on('update-not-available', () => {
      log.info('Application is up to date');
    });

    autoUpdater.on('download-progress', (progress) => {
      log.debug(`Update download: ${Math.round(progress.percent)}%`);
    });

    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      log.info(`Update downloaded: v${info.version} — will install on next quit`);
      this.notificationService.updateReadyToInstall(info.version);
      this._broadcast(IPC.SYSTEM.UPDATE_DOWNLOADED, { version: info.version });
    });

    autoUpdater.on('error', (err: Error) => {
      log.error('Auto updater error', { message: err.message });
    });
  }

  checkForUpdates(): void {
    // app.isPackaged is the authoritative signal — a packaged install never has
    // NODE_ENV set, which would otherwise skip update checks for real users.
    if (!app.isPackaged) {
      log.debug('Skipping update check in development mode');
      return;
    }
    autoUpdater.checkForUpdates().catch((err) => {
      log.error('Update check failed', { error: err.message });
    });
  }

  /** Checks immediately, then re-checks on an interval for long-running sessions. */
  startPeriodicChecks(intervalMs: number = RECHECK_INTERVAL_MS): void {
    this.checkForUpdates();
    if (this.recheckTimer) clearInterval(this.recheckTimer);
    this.recheckTimer = setInterval(() => this.checkForUpdates(), intervalMs);
  }

  stopPeriodicChecks(): void {
    if (this.recheckTimer) {
      clearInterval(this.recheckTimer);
      this.recheckTimer = null;
    }
  }

  /** Manual install trigger (e.g. from a tray/menu action), still user-initiated only. */
  installUpdateAndRestart(): void {
    autoUpdater.quitAndInstall(false, true);
  }

  registerWindow(win: BrowserWindow): void {
    this.windows.add(win);
    win.on('closed', () => this.windows.delete(win));
  }

  private _broadcast(channel: string, data: unknown): void {
    for (const win of this.windows) {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, data);
      }
    }
  }
}
