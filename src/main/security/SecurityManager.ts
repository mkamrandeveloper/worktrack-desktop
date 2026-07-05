import { app, session } from 'electron';
import { createLogger } from '../logger/Logger';

const log = createLogger('SecurityManager');

/**
 * Applies all Electron security hardening at startup.
 * Call this before any BrowserWindow is created.
 */
export class SecurityManager {
  /**
   * Installs strict Content-Security-Policy headers on all sessions.
   * In production the renderer only loads local files, so no remote
   * origins are needed in script-src or connect-src.
   */
  static applyCSP(): void {
    const isDev = process.env.NODE_ENV !== 'production';

    // In dev mode, skip CSP entirely.
    // Vite's React Refresh injects inline <script type="module"> preambles that
    // Chromium blocks even with 'unsafe-inline' (module scripts require a nonce/hash).
    // CSP is a production-only hardening measure.
    if (isDev) {
      log.info('CSP skipped in development mode');
      return;
    }

    const policy = [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob:",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
    ].join('; ');

    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [policy],
        },
      });
    });

    log.info('Content Security Policy applied');
  }

  /**
   * Blocks navigation to any external URL from the renderer.
   * Prevents open-redirect attacks.
   */
  static blockExternalNavigation(): void {
    app.on('web-contents-created', (_event, contents) => {
      contents.on('will-navigate', (event, url) => {
        const allowedOrigins = ['file://', 'http://localhost:5173'];
        const isAllowed = allowedOrigins.some((origin) => url.startsWith(origin));
        if (!isAllowed) {
          event.preventDefault();
          log.warn(`Blocked navigation to external URL: ${url}`);
        }
      });

      // Block new windows — all links must open in the default browser
      contents.setWindowOpenHandler(({ url }) => {
        const { shell } = require('electron');
        shell.openExternal(url).catch((err: Error) => {
          log.error('Failed to open external URL', { url, error: err.message });
        });
        return { action: 'deny' };
      });
    });
  }

  /**
   * Validates that an IPC payload is a plain object (not null, not array).
   * Throws if invalid — callers should catch and respond with an error.
   */
  static validatePayload(payload: unknown): asserts payload is Record<string, unknown> {
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
      throw new Error('Invalid IPC payload: expected a plain object');
    }
  }

  /**
   * Verifies a sender's frame is from a trusted origin.
   */
  static isTrustedSender(senderUrl: string): boolean {
    const trustedOrigins = [
      'file://',
      'http://localhost:5173',
    ];
    return trustedOrigins.some((origin) => senderUrl.startsWith(origin));
  }

  /** Initialize all security measures */
  static initialize(): void {
    this.applyCSP();
    this.blockExternalNavigation();
    log.info('Security manager initialized');
  }
}
