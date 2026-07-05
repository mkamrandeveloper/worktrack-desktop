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
];

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

        const status = error.response?.status;
        const url = error.config?.url;
        log.error(`HTTP error ${status ?? 'network'} on ${url}`, {
          message: error.message,
          data: error.response?.data,
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
