import { BrowserWindow } from 'electron';
import {
  AuthTokens,
  AuthState,
  LoginCredentials,
  LoginResponse,
  User,
  Organization,
  SignupCreateOrgPayload,
  SignupJoinOrgPayload,
  ClientAcceptPayload,
} from '../../shared/types';
import { TokenManager } from './TokenManager';
import { getApiService } from '../services/ApiService';
import { API_ENDPOINTS } from '../../shared/constants/events';
import { IPC } from '../../shared/constants/ipcChannels';
import { createLogger } from '../logger/Logger';
import { SecurityManager } from '../security/SecurityManager';
import Store from 'electron-store';

const log = createLogger('AuthService');

interface AuthCache {
  user: User | null;
  organization: Organization | null;
}

/**
 * Handles all authentication flows: login, logout, session restoration,
 * token lifecycle, and broadcasting auth state changes to the renderer.
 */
export class AuthService {
  private tokenManager: TokenManager;
  private cache: Store<AuthCache>;
  private state: AuthState = {
    user: null,
    organization: null,
    tokens: null,
    isAuthenticated: false,
  };
  private windows: Set<BrowserWindow> = new Set();

  constructor(tokenManager: TokenManager, encryptionKey: string) {
    this.tokenManager = tokenManager;
    this.cache = new Store<AuthCache>({
      name: 'auth-cache',
      encryptionKey,
      clearInvalidConfig: true,
      defaults: { user: null, organization: null },
    });

    // Wire refresh handler into ApiService
    const api = getApiService();
    api.setTokenProvider(() => this.tokenManager.getAccessToken());
    api.setRefreshHandler(() => this.tokenManager.refresh());

    // Handle token expiry — force re-login
    this.tokenManager.setTokenExpiredHandler((reason) => {
      log.warn(`Session ended — forcing re-authentication${reason ? `: ${reason}` : ''}`);
      this.state = { user: null, organization: null, tokens: null, isAuthenticated: false, signOutReason: reason ?? null };
      this.onForcedSignOut?.();
      this._broadcastState();
    });
  }

  /** Call this on app start to restore a persisted session */
  async restoreSession(): Promise<boolean> {
    const tokens = this.tokenManager.getTokens();
    const user = this.cache.get('user');
    const organization = this.cache.get('organization');

    if (!tokens || !user || !organization) {
      log.info('No persisted session found');
      return false;
    }

    this.state = {
      user,
      organization,
      tokens,
      isAuthenticated: true,
    };

    // Silently refresh if expired
    if (!this.tokenManager.isAccessTokenValid()) {
      log.info('Stored access token expired — attempting silent refresh');
      const newToken = await this.tokenManager.refresh();
      if (!newToken) {
        log.warn('Silent refresh failed — session not restored');
        this._clearState();
        return false;
      }
      // TokenManager persisted the new tokens internally, but this.state
      // still held the stale (already-expired) ones set above — AUTH.GET_STATE
      // and STATE_CHANGED would report an expired token/expiry to the
      // renderer even though real API calls (via TokenManager.getAccessToken())
      // were working fine off the refreshed one.
      this.state.tokens = this.tokenManager.getTokens();
    }

    log.info(`Session restored for user: ${user.email}`);
    return true;
  }

  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const api = getApiService();
    const response = await api.post<LoginResponse>(API_ENDPOINTS.AUTH.LOGIN, { ...credentials, deviceId: SecurityManager.getOrCreateDeviceId() });

    this.tokenManager.setTokens(response.tokens);
    this.cache.set('user', response.user);
    this.cache.set('organization', response.organization);

    this.state = {
      user: response.user,
      organization: response.organization,
      tokens: response.tokens,
      isAuthenticated: true,
    };

    log.info(`User logged in: ${response.user.email}`);
    this._broadcastState();
    return response;
  }

  async signupCreateOrg(payload: SignupCreateOrgPayload): Promise<LoginResponse> {
    const api = getApiService();
    const response = await api.post<LoginResponse>(API_ENDPOINTS.AUTH.SIGNUP_CREATE_ORG, { ...payload, deviceId: SecurityManager.getOrCreateDeviceId() });

    this.tokenManager.setTokens(response.tokens);
    this.cache.set('user', response.user);
    this.cache.set('organization', response.organization);

    this.state = {
      user: response.user,
      organization: response.organization,
      tokens: response.tokens,
      isAuthenticated: true,
    };

    log.info(`Org created and manager logged in: ${response.user.email}`);
    this._broadcastState();
    return response;
  }

  async acceptClientInvite(payload: ClientAcceptPayload): Promise<LoginResponse> {
    const api = getApiService();
    const response = await api.post<LoginResponse>('/api/clients/accept', { ...payload, deviceId: SecurityManager.getOrCreateDeviceId() });

    this.tokenManager.setTokens(response.tokens);
    this.cache.set('user', response.user);
    this.cache.set('organization', response.organization);

    this.state = {
      user: response.user,
      organization: response.organization,
      tokens: response.tokens,
      isAuthenticated: true,
    };

    log.info(`Client accepted invite and logged in: ${response.user.email}`);
    this._broadcastState();
    return response;
  }

  async signupJoinOrg(payload: SignupJoinOrgPayload): Promise<void> {
    const api = getApiService();
    await api.post(API_ENDPOINTS.AUTH.SIGNUP_JOIN_ORG, payload);
    log.info(`Join request sent for: ${payload.email}`);
  }

  async logout(): Promise<void> {
    try {
      const api = getApiService();
      await api.post(API_ENDPOINTS.AUTH.LOGOUT);
    } catch {
      // Best-effort logout call — clear local state regardless
    }

    this.tokenManager.clearTokens();
    this._clearState();
    log.info('User logged out');
    this._broadcastState();
  }

  /**
   * Changes the signed-in user's password. The server signs out other
   * devices and returns a fresh access token for this one (older tokens stop
   * working), which is stored so this session stays signed in.
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const api = getApiService();
    const keepRefreshToken = this.tokenManager.getTokens()?.refreshToken;
    const res = await api.post<{ tokens: AuthTokens | null }>(API_ENDPOINTS.AUTH.CHANGE_PASSWORD, {
      currentPassword, newPassword, keepRefreshToken,
    });
    if (res.tokens) {
      this.tokenManager.setTokens(res.tokens);
      this.state.tokens = res.tokens;
    }
    log.info('Password changed');
  }

  /** Emails a 6-digit reset code (the server never reveals whether the email exists). */
  async forgotPassword(email: string): Promise<void> {
    await getApiService().post(API_ENDPOINTS.AUTH.FORGOT_PASSWORD, { email });
  }

  /** Sets a new password using the emailed code; the user then signs in normally. */
  async resetPassword(email: string, code: string, newPassword: string): Promise<void> {
    await getApiService().post(API_ENDPOINTS.AUTH.RESET_PASSWORD, { email, code, newPassword });
  }

  /** Set by the app shell: stop timers/background work when the session is ended for us. */
  onForcedSignOut: (() => void) | null = null;

  getState(): AuthState {
    return this.state;
  }

  getUser(): User | null {
    return this.state.user;
  }

  getOrganization(): Organization | null {
    return this.state.organization;
  }

  /** Applies an org settings change (e.g. screenshot interval) and tells every window. */
  updateOrganization(patch: Partial<Organization>): void {
    if (!this.state.organization) return;
    this.state = { ...this.state, organization: { ...this.state.organization, ...patch } };
    this.cache.set('organization', this.state.organization);
    this._broadcastState();
  }

  isAuthenticated(): boolean {
    return this.state.isAuthenticated;
  }

  /** Register a BrowserWindow to receive auth state change events */
  registerWindow(win: BrowserWindow): void {
    this.windows.add(win);
    win.on('closed', () => this.windows.delete(win));
  }

  private _clearState(): void {
    this.state = { user: null, organization: null, tokens: null, isAuthenticated: false };
    this.cache.set('user', null);
    this.cache.set('organization', null);
  }

  private _broadcastState(): void {
    for (const win of this.windows) {
      if (!win.isDestroyed()) {
        win.webContents.send(IPC.AUTH.STATE_CHANGED, this.state);
      }
    }
  }
}
