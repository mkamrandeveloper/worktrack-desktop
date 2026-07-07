import { shell } from 'electron';
import { createLogger } from '../logger/Logger';
import { getApiService } from '../services/ApiService';
import { API_ENDPOINTS } from '../../shared/constants/events';

const log = createLogger('DriveService');

export class DriveService {
  /** Check if Drive is connected and return folder URL. Every organization
   * shares one pre-authorized Drive account set up server-side — there's no
   * per-org connect flow, so this just reflects whether the backend has
   * that shared account configured. */
  async isConnected(): Promise<{ connected: boolean; orgFolderUrl?: string }> {
    try {
      const api = getApiService();
      return await api.get<{ connected: boolean; orgFolderUrl?: string }>(API_ENDPOINTS.DRIVE.STATUS);
    } catch {
      return { connected: false };
    }
  }

  /** Open a Google Drive URL in the default browser */
  async openFolder(url: string): Promise<void> {
    const target = url || 'https://drive.google.com';
    // Matches the same https-only allow-list SYSTEM.OPEN_EXTERNAL enforces —
    // this handler forwarded any renderer-supplied string straight to
    // shell.openExternal with no scheme check at all.
    if (!target.startsWith('https://')) {
      throw new Error('Only HTTPS URLs are allowed');
    }
    log.info(`Opening Google Drive: ${target}`);
    await shell.openExternal(target);
  }
}
