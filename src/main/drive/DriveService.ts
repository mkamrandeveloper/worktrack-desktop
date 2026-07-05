import { shell } from 'electron';
import { createLogger } from '../logger/Logger';
import { getApiService } from '../services/ApiService';
import { API_ENDPOINTS } from '../../shared/constants/events';

const log = createLogger('DriveService');

export class DriveService {
  /** Get the OAuth URL to open in the user's browser */
  async getAuthUrl(): Promise<{ url: string }> {
    const api = getApiService();
    const result = await api.get<{ url: string }>(API_ENDPOINTS.DRIVE.AUTH_URL);
    log.info('Drive auth URL retrieved');
    return result;
  }

  /** Exchange the OAuth code returned by Google for tokens (backend saves them) */
  async handleCallback(code: string): Promise<{ orgFolderUrl?: string }> {
    const api = getApiService();
    const result = await api.post<{ success: boolean; orgFolderUrl?: string }>(
      API_ENDPOINTS.DRIVE.CALLBACK,
      { code }
    );
    log.info('Drive OAuth callback handled, folders created');
    return { orgFolderUrl: result.orgFolderUrl };
  }

  /** Check if Drive is connected and return folder URL */
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
    log.info(`Opening Google Drive: ${target}`);
    await shell.openExternal(target);
  }
}
