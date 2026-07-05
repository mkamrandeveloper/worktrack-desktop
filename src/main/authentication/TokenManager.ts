import Store from 'electron-store';
import { AuthTokens } from '../../shared/types';
import { createLogger } from '../logger/Logger';
import { getApiService } from '../services/ApiService';
import { API_ENDPOINTS } from '../../shared/constants/events';

const log = createLogger('TokenManager');

interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface TokenStore {
  tokens: StoredTokens | null;
}

/**
 * Manages the JWT access/refresh token lifecycle.
 * Tokens are stored encrypted in electron-store.
 * Provides the access token to ApiService and handles silent refresh.
 */
export class TokenManager {
  private store: Store<TokenStore>;
  private refreshTimer: NodeJS.Timeout | null = null;
  private onTokenExpired?: () => void;

  constructor(encryptionKey: string) {
    this.store = new Store<TokenStore>({
      name: 'auth-tokens',
      encryptionKey,
      defaults: { tokens: null },
    });
  }

  /** Returns the current access token (may be expired — check before use) */
  getAccessToken(): string | null {
    return this.store.get('tokens')?.accessToken ?? null;
  }

  /** Returns all stored tokens */
  getTokens(): AuthTokens | null {
    const stored = this.store.get('tokens');
    if (!stored) return null;
    return {
      accessToken: stored.accessToken,
      refreshToken: stored.refreshToken,
      expiresAt: stored.expiresAt,
    };
  }

  /** Persists tokens and schedules the next silent refresh */
  setTokens(tokens: AuthTokens): void {
    this.store.set('tokens', {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
    });
    this._scheduleRefresh(tokens.expiresAt);
    log.info('Tokens stored and refresh scheduled');
  }

  /** Clears all stored tokens and cancels the refresh timer */
  clearTokens(): void {
    this.store.set('tokens', null);
    this._cancelRefreshTimer();
    log.info('Tokens cleared');
  }

  /** Returns true if the access token is still valid (with 60s buffer) */
  isAccessTokenValid(): boolean {
    const tokens = this.store.get('tokens');
    if (!tokens) return false;
    return Date.now() < tokens.expiresAt - 60_000;
  }

  /** Sets a callback fired when refresh fails and user must re-authenticate */
  setTokenExpiredHandler(handler: () => void): void {
    this.onTokenExpired = handler;
  }

  /**
   * Attempts to silently refresh the access token using the refresh token.
   * Returns the new access token or null on failure.
   */
  async refresh(): Promise<string | null> {
    const tokens = this.store.get('tokens');
    if (!tokens?.refreshToken) {
      log.warn('No refresh token available');
      this.onTokenExpired?.();
      return null;
    }

    try {
      const api = getApiService();
      const response = await api.post<{ tokens: AuthTokens }>(
        API_ENDPOINTS.AUTH.REFRESH,
        { refreshToken: tokens.refreshToken }
      );
      this.setTokens(response.tokens);
      log.info('Access token silently refreshed');
      return response.tokens.accessToken;
    } catch (err) {
      log.error('Silent token refresh failed', { error: (err as Error).message });
      this.clearTokens();
      this.onTokenExpired?.();
      return null;
    }
  }

  /** Re-arms the silent refresh timer based on token expiry */
  private _scheduleRefresh(expiresAt: number): void {
    this._cancelRefreshTimer();
    // Refresh 2 minutes before expiry
    const delay = Math.max(expiresAt - Date.now() - 120_000, 0);
    this.refreshTimer = setTimeout(() => {
      log.debug('Executing scheduled token refresh');
      this.refresh().catch((err) => log.error('Scheduled refresh error', { error: err.message }));
    }, delay);
    log.debug(`Token refresh scheduled in ${Math.round(delay / 1000)}s`);
  }

  private _cancelRefreshTimer(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
}
