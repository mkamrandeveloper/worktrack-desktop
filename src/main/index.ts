import { app, BrowserWindow, net } from 'electron';
import path from 'path';
import Store from 'electron-store';
import dotenv from 'dotenv';
import { setupCrashReporting, createLogger } from './logger/Logger';
import { SecurityManager } from './security/SecurityManager';
import { initApiService } from './services/ApiService';
import { TokenManager } from './authentication/TokenManager';
import { AuthService } from './authentication/AuthService';
import { TimerEngine } from './timer/TimerEngine';
import { ScreenshotQueue } from './screenshots/ScreenshotQueue';
import { ScreenshotService } from './screenshots/ScreenshotService';
import { IdleDetector } from './activity/IdleDetector';
import { ActivityMonitor } from './activity/ActivityMonitor';
import { OfflineQueue } from './sync/OfflineQueue';
import { SyncService } from './sync/SyncService';
import { NotificationService } from './notifications/NotificationService';
import { TrayManager } from './tray/TrayManager';
import { UpdaterService } from './updater/UpdaterService';
import { TaskService } from './services/TaskService';
import { HeartbeatService } from './services/HeartbeatService';
import { PluginManager } from './plugin/PluginManager';
import { IpcHandler } from './ipc/IpcHandler';
import { ManagerService } from './manager/ManagerService';
import { DriveService } from './drive/DriveService';
import { DEFAULT_SETTINGS, UserSettings, TimerState, Organization } from '../shared/types';
import { SOCKET_EVENTS, API_ENDPOINTS } from '../shared/constants/events';
import { IPC } from '../shared/constants/ipcChannels';

// Load environment variables from .env
dotenv.config();

const log = createLogger('App');

// ── Constants ─────────────────────────────────────────────────────────────────

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000';
const WS_URL = process.env.WS_URL ?? API_BASE_URL;
const ENCRYPTION_KEY = process.env.STORAGE_ENCRYPTION_KEY ?? 'worktrack-default-key-change-me!';
// app.isPackaged is the authoritative signal — a distributed .dmg/.exe install
// never has NODE_ENV set, so relying on NODE_ENV alone would make every
// packaged build try to load the Vite dev server instead of the bundled files.
const IS_DEV = !app.isPackaged;

// ── Service Instances ─────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;

// Initialize stores and services
const settingsStore = new Store<{ settings: UserSettings }>({
  name: 'user-settings',
  encryptionKey: ENCRYPTION_KEY,
  defaults: { settings: DEFAULT_SETTINGS },
});

setupCrashReporting();

initApiService(API_BASE_URL);

const tokenManager = new TokenManager(ENCRYPTION_KEY);
const authService = new AuthService(tokenManager, ENCRYPTION_KEY);
const timerEngine = new TimerEngine(ENCRYPTION_KEY);
const screenshotQueue = new ScreenshotQueue(ENCRYPTION_KEY);
const idleDetector = new IdleDetector(
  parseInt(process.env.IDLE_THRESHOLD_SECONDS ?? '300', 10)
);
const activityMonitor = new ActivityMonitor(idleDetector);
const offlineQueue = new OfflineQueue(ENCRYPTION_KEY);
const syncService = new SyncService(offlineQueue);
const notificationService = new NotificationService();
const trayManager = new TrayManager({
  onOpenDashboard: () => mainWindow?.show(),
  onStartTimer: () => log.info('Tray: start timer (no active task selected)'),
  onPauseTimer: () => timerEngine.pause(),
  onResumeTimer: () => timerEngine.resume(),
  onStartBreak: () => handleBreakStart(),
  onEndBreak: () => handleBreakEnd(),
  onStopTimer: () => handleTimerStop(),
  onQuit: () => {
    isQuitting = true;
    app.quit();
  },
});
const updaterService = new UpdaterService(notificationService);
const taskService = new TaskService(ENCRYPTION_KEY);
const heartbeatService = new HeartbeatService(activityMonitor, timerEngine, offlineQueue);
const pluginManager = new PluginManager();
const managerService = new ManagerService();
const driveService = new DriveService();

let screenshotService: ScreenshotService | null = null;

// ── Timer Orchestration ───────────────────────────────────────────────────────

async function handleTimerStart(taskId: string): Promise<void> {
  // Clients are read-only viewers and must never start time tracking.
  if (authService.getUser()?.role === 'CLIENT') {
    throw new Error('Clients cannot start time tracking');
  }
  const { sessionId } = await taskService.startSession(taskId);
  timerEngine.start(taskId, sessionId);

  const user = authService.getUser();
  if (user) {
    heartbeatService.start(user.id);

    // Wire timer state into activity monitor and screenshot service
    const timerState = timerEngine.getState();
    activityMonitor.onTimerStatusChanged('running');
    screenshotService?.onTimerStateChanged(timerState, user.id);
  }

  // Emit socket event
  const timerState = timerEngine.getState();
  syncService.sendToSocket(SOCKET_EVENTS.EMIT.TIMER_START, {
    taskId,
    sessionId: timerState.sessionId,
  });
}

async function handleTimerStop(): Promise<void> {
  const state = timerEngine.getState();
  timerEngine.stop();
  activityMonitor.onTimerStatusChanged('stopped');
  screenshotService?.onTimerStateChanged(timerEngine.getState(), authService.getUser()?.id ?? '');

  if (state.sessionId) {
    await taskService.stopSession(state.sessionId).catch((err) => {
      log.error('Failed to stop session on backend', { error: err.message });
      offlineQueue.enqueue({ url: API_ENDPOINTS.TASKS.STOP_SESSION(state.sessionId!), method: 'POST' });
    });
  }

  syncService.sendToSocket(SOCKET_EVENTS.EMIT.TIMER_STOP, { sessionId: state.sessionId });
}

function handleTimerPause(): void {
  timerEngine.pause();
  activityMonitor.onTimerStatusChanged('paused');
  const state = timerEngine.getState();
  if (state.sessionId) {
    taskService.pauseSession(state.sessionId).catch((err) => {
      offlineQueue.enqueue({ url: API_ENDPOINTS.TASKS.PAUSE_SESSION(state.sessionId!), method: 'POST' });
      log.error('Pause session failed', { error: err.message });
    });
  }
  syncService.sendToSocket(SOCKET_EVENTS.EMIT.TIMER_PAUSE, { sessionId: state.sessionId });
}

function handleTimerResume(): void {
  timerEngine.resume();
  activityMonitor.onTimerStatusChanged('running');
  const state = timerEngine.getState();
  if (state.sessionId) {
    taskService.resumeSession(state.sessionId).catch((err) => {
      offlineQueue.enqueue({ url: API_ENDPOINTS.TASKS.RESUME_SESSION(state.sessionId!), method: 'POST' });
      log.error('Resume session failed', { error: err.message });
    });
  }
  syncService.sendToSocket(SOCKET_EVENTS.EMIT.TIMER_RESUME, { sessionId: state.sessionId });
}

async function handleBreakStart(): Promise<void> {
  timerEngine.startBreak();
  activityMonitor.onTimerStatusChanged('on_break');
  const state = timerEngine.getState();
  if (state.sessionId) {
    await taskService.startBreak(state.sessionId).catch((err) => {
      offlineQueue.enqueue({ url: API_ENDPOINTS.TASKS.BREAK_START(state.sessionId!), method: 'POST' });
      log.error('Break start failed', { error: err.message });
    });
  }
  syncService.sendToSocket(SOCKET_EVENTS.EMIT.BREAK_START, { sessionId: state.sessionId });
}

async function handleBreakEnd(): Promise<void> {
  timerEngine.endBreak();
  activityMonitor.onTimerStatusChanged('running');
  const state = timerEngine.getState();
  if (state.sessionId) {
    await taskService.endBreak(state.sessionId).catch((err) => {
      offlineQueue.enqueue({ url: API_ENDPOINTS.TASKS.BREAK_END(state.sessionId!), method: 'POST' });
      log.error('Break end failed', { error: err.message });
    });
  }
  syncService.sendToSocket(SOCKET_EVENTS.EMIT.BREAK_END, { sessionId: state.sessionId });
}

// ── Window Management ─────────────────────────────────────────────────────────

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 900,
    minHeight: 600,
    show: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#0f1117',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // Electron 20+ enables sandbox by default. Explicitly disable so preload
      // can require() local shared constants (contextIsolation keeps renderer secure).
      sandbox: false,
      webSecurity: true,
      devTools: IS_DEV,
    },
    icon: path.join(__dirname, '../../assets/icons/icon.png'),
  });

  if (IS_DEV) {
    win.loadURL('http://localhost:5173');
    // Forward renderer console to main process log for debugging
    win.webContents.on('console-message', (_e, level, msg, line, src) => {
      const levels = ['verbose', 'info', 'warn', 'error'];
      const prefix = `[Renderer:${levels[level] ?? 'log'}]`;
      if (level >= 2) { // warn or error only
        log.warn(`${prefix} ${msg}  (${src}:${line})`);
      }
    });
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  win.once('ready-to-show', () => {
    win.show();
    win.focus();
  });

  // Minimize to tray instead of closing (if setting enabled)
  win.on('close', (event) => {
    if (isQuitting) return;
    const settings = settingsStore.get('settings');
    if (settings.minimizeToTray) {
      event.preventDefault();
      win.hide();
    }
  });

  return win;
}

// ── App Lifecycle ─────────────────────────────────────────────────────────────

app.on('ready', async () => {
  log.info(`WorkTrack Desktop starting — v${app.getVersion()} (${process.platform})`);

  // Initialize security FIRST — requires app to be ready for session.defaultSession
  SecurityManager.initialize();

  mainWindow = createMainWindow();

  // Register all services with window-aware components
  authService.registerWindow(mainWindow);
  activityMonitor.registerWindow(mainWindow);
  syncService.registerWindow(mainWindow);
  updaterService.registerWindow(mainWindow);

  // Create system tray
  trayManager.create(mainWindow);

  // Wire up timer state → tray tooltip
  timerEngine.on('state-changed', (state: TimerState) => {
    trayManager.updateTimerState(state);

    // Broadcast to renderer
    if (!mainWindow?.isDestroyed()) {
      mainWindow?.webContents.send(IPC.TIMER.STATE_CHANGED, state);
    }

    // Keep screenshot service in sync with timer
    const user = authService.getUser();
    if (user) {
      screenshotService?.onTimerStateChanged(state, user.id);
    }
  });

  // Wire activity → tray
  activityMonitor.on('status-changed', (status) => {
    trayManager.updateActivityStatus(status);
  });

  // Wire sync status → tray
  syncService.on('status-changed', (status: string) => {
    trayManager.updateSyncStatus(status);
    const prevStatus = syncService.getStatus();
    // Notify on disconnect/reconnect
    if (status === 'disconnected' && prevStatus === 'connected') {
      notificationService.internetLost();
    } else if (status === 'connected') {
      notificationService.internetRestored();
    }
  });

  // Monitor internet connectivity for offline queue
  setInterval(() => {
    const isOnline = net.isOnline();
    if (isOnline && offlineQueue.getPendingCount() > 0) {
      offlineQueue.flush().catch((err) => log.error('Offline flush error', { error: err.message }));
    }
  }, 30_000);

  // Set up sync service event handlers
  syncService.setEventHandlers({
    onTaskAssigned: (task) => {
      taskService.upsertTask(task);
      notificationService.taskAssigned(task.title);
    },
    onIntervalChanged: (event) => {
      screenshotService?.updateConfig({
        screenshotInterval: event.screenshotInterval,
        screenshotMonitors: event.captureMonitors,
      });
    },
    onNotification: (notification) => {
      notificationService.show(notification);
    },
    onForceTimerStop: () => {
      handleTimerStop().catch((err) => log.error('Force stop failed', { error: err.message }));
    },
  });

  // Register IPC handlers
  const ipcHandler = new IpcHandler({
    auth: authService,
    timer: timerEngine,
    tasks: taskService,
    screenshots: screenshotService!,
    screenshotQueue,
    activity: activityMonitor,
    sync: syncService,
    updater: updaterService,
    manager: managerService,
    drive: driveService,
    settingsStore,
    onStartTimer: handleTimerStart,
    onStopTimer: handleTimerStop,
    onPauseTimer: handleTimerPause,
    onResumeTimer: handleTimerResume,
    onBreakStart: handleBreakStart,
    onBreakEnd: handleBreakEnd,
  });
  ipcHandler.register();

  // Attempt session restoration
  const restored = await authService.restoreSession();
  if (restored) {
    const user = authService.getUser();
    const org = authService.getOrganization() as Organization;
    log.info(`Session restored for: ${user?.email}`);

    // CLIENT users are external, read-only viewers — never monitor them
    // (no screenshots, heartbeats, activity tracking, or timer sync).
    if (user?.role === 'CLIENT') {
      log.info('Restored session is a CLIENT — monitoring services disabled');
    } else {
      // Initialize screenshot service with org settings
      screenshotService = new ScreenshotService(screenshotQueue, org);
      activityMonitor.start();

      // Connect WebSocket
      syncService.setTokenProvider(() => tokenManager.getAccessToken());
      syncService.connect(WS_URL, user!.id, org.id);

      // Start heartbeat
      heartbeatService.start(user!.id);

      // Load tasks
      taskService.fetchTasks().catch((err) => {
        log.warn('Initial task fetch failed', { error: err.message });
      });
    }
  }

  // Start activity monitoring always (idle detection works without auth)
  activityMonitor.start();

  // Check for updates after startup (2 minute delay)
  setTimeout(() => updaterService.checkForUpdates(), 120_000);

  log.info('WorkTrack Desktop started successfully');
});

// macOS: re-create window on dock click
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createMainWindow();
  } else {
    mainWindow?.show();
  }
});

app.on('window-all-closed', () => {
  // Don't quit on macOS — keep running in tray
  if (process.platform !== 'darwin') {
    if (isQuitting) app.quit();
  }
});

app.on('before-quit', async () => {
  isQuitting = true;
  log.info('Application quitting...');

  // Stop timer if running
  const timerState = timerEngine.getState();
  if (timerState.status === 'running' || timerState.status === 'on_break' || timerState.status === 'paused') {
    await handleTimerStop().catch(() => {});
  }

  heartbeatService.stop();
  syncService.disconnect();
  activityMonitor.dispose();
  timerEngine.dispose();
  screenshotService?.dispose();
  trayManager.destroy();

  await pluginManager.disposeAll();
  log.info('Cleanup complete — bye!');
});
