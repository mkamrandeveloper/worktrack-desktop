import { Notification, nativeImage } from 'electron';
import path from 'path';
import { NotificationPayload } from '../../shared/types';
import { createLogger } from '../logger/Logger';

const log = createLogger('NotificationService');

/**
 * Sends cross-platform desktop notifications using Electron's Notification API.
 * Respects user preference settings passed in at call time.
 */
export class NotificationService {
  private iconPath: string;
  private enabled = true;

  constructor() {
    this.iconPath = path.join(__dirname, '../../../../assets/icons/icon.png');
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  show(payload: NotificationPayload): void {
    if (!this.enabled) return;
    if (!Notification.isSupported()) {
      log.warn('Desktop notifications not supported on this platform');
      return;
    }

    const icon = nativeImage.createFromPath(this.iconPath);

    const notification = new Notification({
      title: payload.title,
      body: payload.message,
      icon: icon.isEmpty() ? undefined : icon,
      urgency: payload.type === 'error' ? 'critical' : 'normal',
      silent: payload.type === 'info',
    });

    notification.on('click', () => {
      log.debug(`Notification clicked: ${payload.id}`);
    });

    notification.show();
    log.info(`Notification shown: ${payload.title}`);
  }

  taskAssigned(taskTitle: string): void {
    this.show({
      id: `task-assigned-${Date.now()}`,
      type: 'info',
      title: 'New Task Assigned',
      message: `You've been assigned: ${taskTitle}`,
    });
  }

  screenshotUploadFailed(failedCount: number): void {
    this.show({
      id: `screenshot-failed-${Date.now()}`,
      type: 'warning',
      title: 'Screenshot Upload Failed',
      message: failedCount === 1
        ? '1 screenshot failed to upload. Will retry automatically.'
        : `${failedCount} screenshots failed to upload. Will retry automatically.`,
    });
  }

  internetLost(): void {
    this.show({
      id: 'internet-lost',
      type: 'warning',
      title: 'Internet Connection Lost',
      message: 'WorkTrack is offline. Data will sync when connection is restored.',
    });
  }

  internetRestored(): void {
    this.show({
      id: 'internet-restored',
      type: 'success',
      title: 'Connection Restored',
      message: 'WorkTrack is back online. Syncing data...',
    });
  }

  updateAvailable(version: string): void {
    this.show({
      id: `update-${version}`,
      type: 'info',
      title: 'Update Available',
      message: `WorkTrack Desktop v${version} is downloading in the background.`,
    });
  }

  updateReadyToInstall(version: string): void {
    this.show({
      id: `update-ready-${version}`,
      type: 'info',
      title: 'Update Ready',
      message: `WorkTrack Desktop v${version} will install the next time you restart the app.`,
    });
  }

  deadlineReminder(taskTitle: string, hoursRemaining: number): void {
    this.show({
      id: `deadline-${Date.now()}`,
      type: 'warning',
      title: 'Deadline Reminder',
      message: `"${taskTitle}" is due in ${hoursRemaining} hour${hoursRemaining !== 1 ? 's' : ''}.`,
    });
  }
}
