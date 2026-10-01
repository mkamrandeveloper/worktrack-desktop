import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';
import { createLogger } from '../logger/Logger';

const log = createLogger('ApiService');

// A 401 from these pre-authentication endpoints means "wrong credentials",
// not "your session expired" — retrying them via refreshHandler() is not
// just pointless (there's no session to refresh yet), it actively masks the
// real error behind a confusing "Token refresh returned null" message.
const NO_REFRESH_RETRY_URLS = [
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/auth/signup/create-org',
  '/api/auth/signup/join-org',
  '/api/clients/accept',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
];

/**
 * True for failures worth retrying later: no response at all (offline, DNS,
 * connection reset, timeout) or the hosting proxy/server being temporarily
 * unavailable. 4xx and genuine 500s are real answers — retrying won't help.
 */
export function isTransientError(err: unknown): boolean {
  const e = err as { response?: { status?: number } };
  if (!e?.response) return true;
  return [429, 502, 503, 504].includes(e.response.status ?? 0);
}

const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [600, 1500, 3500];
const IDEMPOTENT = ['get', 'head', 'options', 'put', 'delete'];

/**
 * Whether a failed request may be sent again automatically. Reads are always
 * safe. Writes (POST/PATCH) are only resent when the failure proves the
 * server never processed them — the proxy answered 502/503 (not routed) or
 * the connection was refused — never after a timeout, where the first
 * attempt may already have taken effect.
 */
function shouldRetry(err: unknown, config: RetryableConfig): boolean {
  if (config.noRetry || (config.__retryCount ?? 0) >= MAX_RETRIES) return false;
  if (!isTransientError(err)) return false;
  const method = (config.method ?? 'get').toLowerCase();
  if (IDEMPOTENT.includes(method)) return true;
  const e = err as { response?: { status?: number }; code?: string };
  const status = e.response?.status;
  return status === 502 || status === 503 || status === 429
    || ['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN'].includes(e.code ?? '');
}

type RetryableConfig = InternalAxiosRequestConfig & { _retry?: boolean; __retryCount?: number; noRetry?: boolean };

export type TokenProvider = () => string | null;
export type RefreshHandler = () => Promise<string | null>;

/**
 * Configured Axios instance with auth headers, automatic token refresh on 401,
 * request/response logging, and retry logic for transient network errors.
 */
export class ApiService {
  private readonly client: AxiosInstance;
  private tokenProvider: TokenProvider = () => null;
  private refreshHandler: RefreshHandler = async () => null;
  private isRefreshing = false;
  private refreshQueue: Array<{
    resolve: (token: string) => void;
    reject: (err: Error) => void;
  }> = [];

  constructor(baseURL: string) {
    this.client = axios.create({
      baseURL,
      timeout: 30_000,
      headers: {
        'Content-Type': 'application/json',
        'X-Client': 'worktrack-desktop',
        'X-Client-Version': process.env.npm_package_version ?? '1.0.0',
      },
    });

    this._setupInterceptors();
    log.info(`ApiService initialized with baseURL: ${baseURL}`);
  }

  setTokenProvider(provider: TokenProvider): void {
    this.tokenProvider = provider;
  }

  setRefreshHandler(handler: RefreshHandler): void {
    this.refreshHandler = handler;
  }

  private _setupInterceptors(): void {
    // Attach Authorization header to every request
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const token = this.tokenProvider();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        log.debug(`→ ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        log.error('Request interceptor error', { error: error.message });
        return Promise.reject(error);
      }
    );

    // Handle 401 with token refresh, log other errors
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        log.debug(`← ${response.status} ${response.config.url}`);
        return response;
      },
      async (error) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
        const isPreAuthEndpoint = NO_REFRESH_RETRY_URLS.some((url) =>
          originalRequest.url?.includes(url)
        );

        if (error.response?.status === 401 && !originalRequest._retry && !isPreAuthEndpoint) {
          if (this.isRefreshing) {
            // Queue requests while refresh is in progress
            return new Promise<AxiosResponse>((resolve, reject) => {
              this.refreshQueue.push({
                resolve: (token: string) => {
                  originalRequest.headers.Authorization = `Bearer ${token}`;
                  resolve(this.client(originalRequest));
                },
                reject,
              });
            });
          }

          originalRequest._retry = true;
          this.isRefreshing = true;

          try {
            const newToken = await this.refreshHandler();
            if (!newToken) throw new Error('Token refresh returned null');

            this.refreshQueue.forEach(({ resolve }) => resolve(newToken));
            this.refreshQueue = [];
            this.isRefreshing = false;

            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return this.client(originalRequest);
          } catch (refreshError) {
            this.refreshQueue.forEach(({ reject }) => reject(refreshError as Error));
            this.refreshQueue = [];
            this.isRefreshing = false;
            log.error('Token refresh failed — user must re-authenticate');
            return Promise.reject(refreshError);
          }
        }

        // Hosting hiccups (e.g. the proxy dropping requests) are retried with
        // short, growing, jittered waits before the caller ever sees an error.
        const config = error.config as RetryableConfig | undefined;
        if (config && shouldRetry(error, config)) {
          config.__retryCount = (config.__retryCount ?? 0) + 1;
          const retryAfterSec = Number(error.response?.headers?.['retry-after']);
          const base = Number.isFinite(retryAfterSec) && retryAfterSec > 0
            ? Math.min(retryAfterSec * 1000, 5000)
            : RETRY_DELAYS_MS[config.__retryCount - 1];
          const delay = base + Math.floor(Math.random() * 250);
          log.warn(`Transient ${error.response?.status ?? error.code ?? 'network'} on ${config.url} — retry ${config.__retryCount}/${MAX_RETRIES} in ${delay}ms`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          return this.client(config);
        }

        const status = error.response?.status;
        const url = error.config?.url;
        log.error(`HTTP error ${status ?? 'network'} on ${url}`, {
          message: error.message,
          data: typeof error.response?.data === 'string' ? error.response.data.slice(0, 200) : error.response?.data,
        });

        return Promise.reject(error);
      }
    );
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  async put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put<T>(url, data, config);
    return response.data;
  }

  async patch<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.patch<T>(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }

  /** Upload a file using multipart/form-data */
  async uploadFile<T>(url: string, formData: FormData, onProgress?: (percent: number) => void): Promise<T> {
    const response = await this.client.post<T>(url, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (evt) => {
        if (onProgress && evt.total) {
          onProgress(Math.round((evt.loaded * 100) / evt.total));
        }
      },
    });
    return response.data;
  }
}

// Singleton instance — initialized in main/index.ts
let _instance: ApiService | null = null;

export function getApiService(): ApiService {
  if (!_instance) throw new Error('ApiService not initialized. Call initApiService() first.');
  return _instance;
}

export function initApiService(baseURL: string): ApiService {
  _instance = new ApiService(baseURL);
  return _instance;
}
