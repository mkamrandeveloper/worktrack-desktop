import { app, session } from 'electron';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
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
    // app.isPackaged is the authoritative signal — a packaged install never has
    // NODE_ENV set, which would otherwise skip CSP hardening for real users.
    const isDev = !app.isPackaged;

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
   * Returns the key used to encrypt local electron-store data (auth tokens,
   * cached tasks, timer state, etc). An explicit STORAGE_ENCRYPTION_KEY env
   * var (set via .env for local dev) always wins; otherwise generates a
   * random key on first run and persists it in userData so every install
   * gets its own unique key instead of the single literal string that used
   * to ship hardcoded in source — visible to anyone with the repo, meaning
   * every user's local data was effectively encrypted with a public key.
   */
  static getOrCreateEncryptionKey(): string {
    if (process.env.STORAGE_ENCRYPTION_KEY) {
      return process.env.STORAGE_ENCRYPTION_KEY;
    }

    const keyFile = path.join(app.getPath('userData'), '.enc-key');
    try {
      const existing = fs.readFileSync(keyFile, 'utf8').trim();
      if (existing) return existing;
    } catch {
      // File doesn't exist yet (or is unreadable) — generate a new one below.
    }

    const generated = crypto.randomBytes(32).toString('hex');
    try {
      fs.mkdirSync(path.dirname(keyFile), { recursive: true });
      fs.writeFileSync(keyFile, generated, { mode: 0o600 });
    } catch (err) {
      log.error('Failed to persist encryption key — it will not survive a restart', { error: (err as Error).message });
    }
    return generated;
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
