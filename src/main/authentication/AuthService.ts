import { BrowserWindow } from 'electron';
import {
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
    this.tokenManager.setTokenExpiredHandler(() => {
      log.warn('Session expired — forcing re-authentication');
      this.state = { user: null, organization: null, tokens: null, isAuthenticated: false };
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
    const response = await api.post<LoginResponse>(API_ENDPOINTS.AUTH.LOGIN, credentials);

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
    const response = await api.post<LoginResponse>(API_ENDPOINTS.AUTH.SIGNUP_CREATE_ORG, payload);

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
    const response = await api.post<LoginResponse>('/api/clients/accept', payload);

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

  async listOrgs(): Promise<{ id: string; name: string; teamSize: number }[]> {
    const api = getApiService();
    return api.get<{ id: string; name: string; teamSize: number }[]>(API_ENDPOINTS.AUTH.LIST_ORGS);
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

  getState(): AuthState {
    return this.state;
  }

  getUser(): User | null {
    return this.state.user;
  }

  getOrganization(): Organization | null {
    return this.state.organization;
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
