import { autoUpdater, UpdateInfo } from 'electron-updater';
import { app, BrowserWindow, dialog } from 'electron';
import { NotificationService } from '../notifications/NotificationService';
import { createLogger } from '../logger/Logger';
import { IPC } from '../../shared/constants/ipcChannels';

const log = createLogger('UpdaterService');

/**
 * Manages application auto-updates using electron-updater.
 * Silently downloads updates and prompts the user to restart.
 */
export class UpdaterService {
  private windows: Set<BrowserWindow> = new Set();
  private notificationService: NotificationService;

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
      log.info(`Update downloaded: v${info.version}`);
      this._promptRestart(info.version);
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

  installUpdateAndRestart(): void {
    autoUpdater.quitAndInstall(false, true);
  }

  registerWindow(win: BrowserWindow): void {
    this.windows.add(win);
    win.on('closed', () => this.windows.delete(win));
  }

  private async _promptRestart(version: string): Promise<void> {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (!focusedWindow) {
      // Auto-install if no window is focused
      setTimeout(() => autoUpdater.quitAndInstall(false, true), 5000);
      return;
    }

    const result = await dialog.showMessageBox(focusedWindow, {
      type: 'info',
      title: 'Update Ready',
      message: `WorkTrack Desktop v${version} has been downloaded.`,
      detail: 'Restart the application to apply the update.',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      cancelId: 1,
    });

    if (result.response === 0) {
      autoUpdater.quitAndInstall(false, true);
    }
  }

  private _broadcast(channel: string, data: unknown): void {
    for (const win of this.windows) {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, data);
      }
    }
  }
}
