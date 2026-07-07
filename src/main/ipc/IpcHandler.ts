import { ipcMain, IpcMainInvokeEvent, shell, app, dialog, BrowserWindow } from 'electron';
import fs from 'fs';
import { AuthService } from '../authentication/AuthService';
import { TimerEngine } from '../timer/TimerEngine';
import { TaskService } from '../services/TaskService';
import { ScreenshotService } from '../screenshots/ScreenshotService';
import { ScreenshotQueue } from '../screenshots/ScreenshotQueue';
import { ActivityMonitor } from '../activity/ActivityMonitor';
import { SyncService } from '../sync/SyncService';
import { UpdaterService } from '../updater/UpdaterService';
import { ManagerService } from '../manager/ManagerService';
import { DriveService } from '../drive/DriveService';
import { SecurityManager } from '../security/SecurityManager';
import { IPC } from '../../shared/constants/ipcChannels';
import {
  IpcResponse,
  LoginCredentials,
  StartTimerPayload,
  UserSettings,
  SignupCreateOrgPayload,
  SignupJoinOrgPayload,
  ClientAcceptPayload,
  ScreenshotListFilters,
} from '../../shared/types';
import { createLogger } from '../logger/Logger';
import Store from 'electron-store';

const log = createLogger('IpcHandler');

interface SettingsStore {
  settings: UserSettings;
}

interface Services {
  auth: AuthService;
  timer: TimerEngine;
  tasks: TaskService;
  screenshots: ScreenshotService;
  screenshotQueue: ScreenshotQueue;
  activity: ActivityMonitor;
  sync: SyncService;
  updater: UpdaterService;
  manager: ManagerService;
  drive: DriveService;
  settingsStore: Store<SettingsStore>;
  onStartTimer: (taskId: string) => Promise<void>;
  onStopTimer: () => Promise<void>;
  onPauseTimer: () => void;
  onResumeTimer: () => void;
  onBreakStart: () => Promise<void>;
  onBreakEnd: () => Promise<void>;
  onSessionEstablished: () => Promise<void>;
}

/**
 * Registers all IPC handlers.
 * The renderer never accesses Node APIs directly — all calls route through here.
 * Every handler validates the sender origin before processing.
 */
export class IpcHandler {
  private services: Services;

  constructor(services: Services) {
    this.services = services;
  }

  register(): void {
    this._registerAuthHandlers();
    this._registerTimerHandlers();
    this._registerTaskHandlers();
    this._registerScreenshotHandlers();
    this._registerActivityHandlers();
    this._registerSettingsHandlers();
    this._registerSystemHandlers();
    this._registerSyncHandlers();
    this._registerManagerHandlers();
    this._registerDriveHandlers();
    log.info('All IPC handlers registered');
  }

  private _ok<T>(data?: T): IpcResponse<T> {
    return { success: true, data };
  }

  private _err(err: unknown): IpcResponse {
    return { success: false, error: this._extractMessage(err) };
  }

  /**
   * Axios errors' own .message is a generic "Request failed with status code
   * 409" — the backend's actual reason (e.g. "Organization name already
   * taken") lives in the JSON error body every route responds with. Prefer
   * that so the renderer shows something the user can act on.
   */
  private _extractMessage(err: unknown): string {
    const backendMessage = (err as { response?: { data?: { error?: string } } })?.response?.data
      ?.error;
    if (backendMessage) return backendMessage;
    return err instanceof Error ? err.message : String(err);
  }

  private _validateSender(event: IpcMainInvokeEvent): void {
    const url = event.senderFrame?.url ?? '';
    if (!SecurityManager.isTrustedSender(url)) {
      throw new Error(`Untrusted IPC sender: ${url}`);
    }
  }

  // ── Auth ─────────────────────────────────────────────────────────────────────

  private _registerAuthHandlers(): void {
    ipcMain.handle(IPC.AUTH.LOGIN, async (event, credentials: LoginCredentials) => {
      try {
        this._validateSender(event);
        const result = await this.services.auth.login(credentials);
        // Bootstraps screenshot config, WebSocket sync, heartbeat, and the
        // initial task fetch — previously only ran for a session restored at
        // app startup, so a fresh login (without restarting the app) got none
        // of these until the process was relaunched.
        await this.services.onSessionEstablished();
        return this._ok(result);
      } catch (err) {
        log.error('Login failed', { error: (err as Error).message });
        return this._err(err);
      }
    });

    ipcMain.handle(IPC.AUTH.SIGNUP_CREATE_ORG, async (event, payload: SignupCreateOrgPayload) => {
      try {
        this._validateSender(event);
        const result = await this.services.auth.signupCreateOrg(payload);
        await this.services.onSessionEstablished();
        return this._ok(result);
      } catch (err) {
        return this._err(err);
      }
    });

    ipcMain.handle(IPC.AUTH.SIGNUP_JOIN_ORG, async (event, payload: SignupJoinOrgPayload) => {
      try {
        this._validateSender(event);
        await this.services.auth.signupJoinOrg(payload);
        return this._ok();
      } catch (err) {
        return this._err(err);
      }
    });

    ipcMain.handle(IPC.AUTH.LIST_ORGS, async (event) => {
      try {
        this._validateSender(event);
        const orgs = await this.services.auth.listOrgs();
        return this._ok(orgs);
      } catch (err) {
        return this._err(err);
      }
    });

    ipcMain.handle(IPC.AUTH.LOGOUT, async (event) => {
      try {
        this._validateSender(event);
        await this.services.auth.logout();
        return this._ok();
      } catch (err) {
        return this._err(err);
      }
    });

    ipcMain.handle(IPC.AUTH.GET_STATE, (event) => {
      try {
        this._validateSender(event);
        return this._ok(this.services.auth.getState());
      } catch (err) {
        return this._err(err);
      }
    });

    ipcMain.handle(IPC.CLIENTS.ACCEPT, async (event, payload: ClientAcceptPayload) => {
      try {
        this._validateSender(event);
        const result = await this.services.auth.acceptClientInvite(payload);
        await this.services.onSessionEstablished();
        return this._ok(result);
      } catch (err) {
        log.error('Client invite accept failed', { error: (err as Error).message });
        return this._err(err);
      }
    });
  }

  // ── Timer ─────────────────────────────────────────────────────────────────────

  private _registerTimerHandlers(): void {
    ipcMain.handle(IPC.TIMER.START, async (event, payload: StartTimerPayload) => {
      try {
        this._validateSender(event);
        await this.services.onStartTimer(payload.taskId);
        return this._ok(this.services.timer.getState());
      } catch (err) {
        log.error('Timer start failed', { error: (err as Error).message });
        return this._err(err);
      }
    });

    ipcMain.handle(IPC.TIMER.PAUSE, async (event) => {
      try {
        this._validateSender(event);
        this.services.onPauseTimer();
        return this._ok(this.services.timer.getState());
      } catch (err) {
        return this._err(err);
      }
    });

    ipcMain.handle(IPC.TIMER.RESUME, async (event) => {
      try {
        this._validateSender(event);
        this.services.onResumeTimer();
        return this._ok(this.services.timer.getState());
      } catch (err) {
        return this._err(err);
      }
    });

    ipcMain.handle(IPC.TIMER.BREAK_START, async (event) => {
      try {
        this._validateSender(event);
        await this.services.onBreakStart();
        return this._ok(this.services.timer.getState());
      } catch (err) {
        return this._err(err);
      }
    });

    ipcMain.handle(IPC.TIMER.BREAK_END, async (event) => {
      try {
        this._validateSender(event);
        await this.services.onBreakEnd();
        return this._ok(this.services.timer.getState());
      } catch (err) {
        return this._err(err);
      }
    });

    ipcMain.handle(IPC.TIMER.STOP, async (event) => {
      try {
        this._validateSender(event);
        await this.services.onStopTimer();
        return this._ok(this.services.timer.getState());
      } catch (err) {
        return this._err(err);
      }
    });

    ipcMain.handle(IPC.TIMER.GET_STATE, (event) => {
      try {
        this._validateSender(event);
        return this._ok(this.services.timer.getState());
      } catch (err) {
        return this._err(err);
      }
    });
  }

  // ── Tasks ─────────────────────────────────────────────────────────────────────

  private _registerTaskHandlers(): void {
    ipcMain.handle(IPC.TASKS.FETCH, async (event) => {
      try {
        this._validateSender(event);
        const tasks = await this.services.tasks.fetchTasks();
        return this._ok(tasks);
      } catch (err) {
        return this._err(err);
      }
    });

    ipcMain.handle(IPC.TASKS.GET_CACHED, (event) => {
      try {
        this._validateSender(event);
        return this._ok(this.services.tasks.getCachedTasks());
      } catch (err) {
        return this._err(err);
      }
    });
  }

  // ── Screenshots ───────────────────────────────────────────────────────────────

  private _registerScreenshotHandlers(): void {
    const api = () => (this.services as any).apiService || require('../services/ApiService').getApiService();

    ipcMain.handle(IPC.SCREENSHOTS.LIST, async (event, filters?: ScreenshotListFilters) => {
      try {
        this._validateSender(event);
        const params = new URLSearchParams();
        if (filters?.userId) params.set('userId', filters.userId);
        if (filters?.projectId) params.set('projectId', filters.projectId);
        if (filters?.from) params.set('from', filters.from);
        if (filters?.to) params.set('to', filters.to);
        if (filters?.limit) params.set('limit', String(filters.limit));
        if (filters?.offset) params.set('offset', String(filters.offset));
        const qs = params.toString() ? `?${params.toString()}` : '';
        return this._ok(await api().get(`/api/screenshots${qs}`));
      } catch (err) {
        return this._err(err);
      }
    });

    ipcMain.handle(IPC.SCREENSHOTS.GET_IMAGE, async (event, screenshotId: string) => {
      try {
        this._validateSender(event);
        const data = await api().get(`/api/screenshots/${screenshotId}/image`, { responseType: 'arraybuffer' });
        const base64 = Buffer.from(data as ArrayBuffer).toString('base64');
        return this._ok({ dataUrl: `data:image/jpeg;base64,${base64}` });
      } catch (err) {
        return this._err(err);
      }
    });

    ipcMain.handle(IPC.SCREENSHOTS.LIST_BREAKS, async (event, filters?: ScreenshotListFilters) => {
      try {
        this._validateSender(event);
        const params = new URLSearchParams();
        if (filters?.userId) params.set('userId', filters.userId);
        if (filters?.from) params.set('from', filters.from);
        if (filters?.to) params.set('to', filters.to);
        const qs = params.toString() ? `?${params.toString()}` : '';
        return this._ok(await api().get(`/api/screenshots/breaks${qs}`));
      } catch (err) {
        return this._err(err);
      }
    });

    ipcMain.handle(IPC.SCREENSHOTS.GET_QUEUE, (event) => {
      try {
        this._validateSender(event);
        return this._ok({
          pending: this.services.screenshotQueue.getPendingCount(),
          items: this.services.screenshotQueue.getAll(),
        });
      } catch (err) {
        return this._err(err);
      }
    });

    ipcMain.handle(IPC.SCREENSHOTS.FLUSH_QUEUE, async (event) => {
      try {
        this._validateSender(event);
        const result = await this.services.screenshotQueue.flush();
        return this._ok(result);
      } catch (err) {
        return this._err(err);
      }
    });

    ipcMain.handle(IPC.SCREENSHOTS.TEST, async () => {
      try {
        await this.services.screenshots.takeTestScreenshot();
        return this._ok();
      } catch (err) {
        return this._err(err);
      }
    });
  }

  // ── Activity ──────────────────────────────────────────────────────────────────

  private _registerActivityHandlers(): void {
    ipcMain.handle(IPC.ACTIVITY.GET_STATUS, (event) => {
      try {
        this._validateSender(event);
        return this._ok(this.services.activity.getSnapshot());
      } catch (err) {
        return this._err(err);
      }
    });
  }

  // ── Settings ──────────────────────────────────────────────────────────────────

  private _registerSettingsHandlers(): void {
    ipcMain.handle(IPC.SETTINGS.GET, (event) => {
      try {
        this._validateSender(event);
        return this._ok(this.services.settingsStore.get('settings'));
      } catch (err) {
        return this._err(err);
      }
    });

    ipcMain.handle(IPC.SETTINGS.UPDATE, (event, settings: Partial<UserSettings>) => {
      try {
        this._validateSender(event);
        const current = this.services.settingsStore.get('settings');
        const updated = { ...current, ...settings };
        this.services.settingsStore.set('settings', updated);
        return this._ok(updated);
      } catch (err) {
        return this._err(err);
      }
    });

    ipcMain.handle(IPC.SETTINGS.TOGGLE_STARTUP, (event, enable: boolean) => {
      try {
        this._validateSender(event);
        app.setLoginItemSettings({ openAtLogin: enable });
        const settings = this.services.settingsStore.get('settings');
        settings.launchOnStartup = enable;
        this.services.settingsStore.set('settings', settings);
        return this._ok({ launchOnStartup: enable });
      } catch (err) {
        return this._err(err);
      }
    });
  }

  // ── System ────────────────────────────────────────────────────────────────────

  private _registerSystemHandlers(): void {
    // All five wrapped in try/catch to match every other handler in this file
    // — without it, a failed _validateSender() or a thrown updater/shell call
    // rejects the invoke promise with a raw Error instead of the normalized
    // IpcResponse shape the renderer's typed preload contract assumes.
    ipcMain.handle(IPC.SYSTEM.GET_APP_VERSION, (event) => {
      try {
        this._validateSender(event);
        return this._ok({ version: app.getVersion() });
      } catch (err) {
        return this._err(err);
      }
    });

    ipcMain.handle(IPC.SYSTEM.CHECK_UPDATE, (event) => {
      try {
        this._validateSender(event);
        this.services.updater.checkForUpdates();
        return this._ok();
      } catch (err) {
        return this._err(err);
      }
    });

    ipcMain.handle(IPC.SYSTEM.INSTALL_UPDATE, (event) => {
      try {
        this._validateSender(event);
        this.services.updater.installUpdateAndRestart();
        return this._ok();
      } catch (err) {
        return this._err(err);
      }
    });

    ipcMain.handle(IPC.SYSTEM.OPEN_EXTERNAL, async (event, url: string) => {
      try {
        this._validateSender(event);
        // Only allow https:// URLs
        if (!url.startsWith('https://')) {
          return this._err('Only HTTPS URLs are allowed');
        }
        await shell.openExternal(url);
        return this._ok();
      } catch (err) {
        return this._err(err);
      }
    });

    ipcMain.handle(IPC.SYSTEM.QUIT, (event) => {
      try {
        this._validateSender(event);
        app.quit();
        return this._ok();
      } catch (err) {
        return this._err(err);
      }
    });
  }

  // ── Sync ──────────────────────────────────────────────────────────────────────

  private _registerSyncHandlers(): void {
    ipcMain.handle(IPC.SYNC.GET_STATUS, (event) => {
      try {
        this._validateSender(event);
        return this._ok({ status: this.services.sync.getStatus() });
      } catch (err) {
        return this._err(err);
      }
    });
  }

  // ── Manager ───────────────────────────────────────────────────────────────────

  private _registerManagerHandlers(): void {
    ipcMain.handle(IPC.MANAGER.GET_TEAM, async (event) => {
      try {
        this._validateSender(event);
        return this._ok(await this.services.manager.getTeam());
      } catch (err) {
        return this._err(err);
      }
    });

    ipcMain.handle(IPC.MANAGER.APPROVE_REQUEST, async (event, userId: string) => {
      try {
        this._validateSender(event);
        await this.services.manager.approveRequest(userId);
        return this._ok();
      } catch (err) {
        return this._err(err);
      }
    });

    ipcMain.handle(IPC.MANAGER.REJECT_REQUEST, async (event, userId: string) => {
      try {
        this._validateSender(event);
        await this.services.manager.rejectRequest(userId);
        return this._ok();
      } catch (err) {
        return this._err(err);
      }
    });

    ipcMain.handle(IPC.MANAGER.GET_TASKS, async (event) => {
      try {
        this._validateSender(event);
        return this._ok(await this.services.manager.getTasks());
      } catch (err) {
        return this._err(err);
      }
    });

    ipcMain.handle(IPC.MANAGER.UPDATE_ORG_SETTINGS, async (event, settings: Record<string, unknown>) => {
      try {
        this._validateSender(event);
        await this.services.manager.updateOrgSettings(settings);
        return this._ok();
      } catch (err) {
        return this._err(err);
      }
    });

    ipcMain.handle(IPC.MANAGER.ADD_EMPLOYEE, async (event, payload: { name: string; email: string; password: string; departmentId?: string; position?: string }) => {
      try {
        this._validateSender(event);
        return this._ok(await this.services.manager.addEmployee(payload));
      } catch (err) {
        return this._err(err);
      }
    });

    ipcMain.handle(IPC.MANAGER.GET_EMPLOYEE_TASKS, async (event, userId: string) => {
      try {
        this._validateSender(event);
        return this._ok(await this.services.manager.getEmployeeTasks(userId));
      } catch (err) {
        return this._err(err);
      }
    });
  }

  // ── Drive ─────────────────────────────────────────────────────────────────────

  private _registerDriveHandlers(): void {
    ipcMain.handle(IPC.DRIVE.IS_CONNECTED, async (event) => {
      try {
        this._validateSender(event);
        return this._ok(await this.services.drive.isConnected());
      } catch (err) {
        return this._err(err);
      }
    });

    ipcMain.handle(IPC.DRIVE.OPEN_FOLDER, async (event, url: string) => {
      try {
        this._validateSender(event);
        await this.services.drive.openFolder(url);
        return this._ok();
      } catch (err) {
        return this._err(err);
      }
    });

    // ── Enterprise: Projects ────────────────────────────────────────────────
    const api = () => (this.services as any).apiService || require('../services/ApiService').getApiService();

    ipcMain.handle(IPC.PROJECTS.LIST, async (event) => {
      try { this._validateSender(event); return this._ok(await api().get('/api/projects')); }
      catch (err) { return this._err(err); }
    });
    ipcMain.handle(IPC.PROJECTS.GET, async (event, id: string) => {
      try { this._validateSender(event); return this._ok(await api().get(`/api/projects/${id}`)); }
      catch (err) { return this._err(err); }
    });
    ipcMain.handle(IPC.PROJECTS.CREATE, async (event, payload: unknown) => {
      try { this._validateSender(event); return this._ok(await api().post('/api/projects', payload)); }
      catch (err) { return this._err(err); }
    });
    ipcMain.handle(IPC.PROJECTS.UPDATE, async (event, { id, payload }: { id: string; payload: unknown }) => {
      try { this._validateSender(event); return this._ok(await api().patch(`/api/projects/${id}`, payload)); }
      catch (err) { return this._err(err); }
    });
    ipcMain.handle(IPC.PROJECTS.DELETE, async (event, id: string) => {
      try { this._validateSender(event); return this._ok(await api().delete(`/api/projects/${id}`)); }
      catch (err) { return this._err(err); }
    });
    ipcMain.handle(IPC.PROJECTS.ADD_MEMBER, async (event, { projectId, userId }: { projectId: string; userId: string }) => {
      try { this._validateSender(event); return this._ok(await api().post(`/api/projects/${projectId}/members`, { userId })); }
      catch (err) { return this._err(err); }
    });
    ipcMain.handle(IPC.PROJECTS.REMOVE_MEMBER, async (event, { projectId, userId }: { projectId: string; userId: string }) => {
      try { this._validateSender(event); return this._ok(await api().delete(`/api/projects/${projectId}/members/${userId}`)); }
      catch (err) { return this._err(err); }
    });
    ipcMain.handle(IPC.PROJECTS.GET_TASKS, async (event, projectId: string) => {
      try { this._validateSender(event); return this._ok(await api().get(`/api/projects/${projectId}/tasks`)); }
      catch (err) { return this._err(err); }
    });
    ipcMain.handle(IPC.PROJECTS.CREATE_TASK, async (event, { projectId, payload }: { projectId: string; payload: unknown }) => {
      try { this._validateSender(event); return this._ok(await api().post(`/api/projects/${projectId}/tasks`, payload)); }
      catch (err) { return this._err(err); }
    });
    ipcMain.handle(IPC.PROJECTS.UPDATE_TASK, async (event, { projectId, taskId, payload }: { projectId: string; taskId: string; payload: unknown }) => {
      try { this._validateSender(event); return this._ok(await api().patch(`/api/projects/${projectId}/tasks/${taskId}`, payload)); }
      catch (err) { return this._err(err); }
    });

    // ── Enterprise: Clients (portal) ────────────────────────────────────────
    ipcMain.handle(IPC.CLIENTS.PROJECTS, async (event) => {
      try { this._validateSender(event); return this._ok(await api().get('/api/clients/projects')); }
      catch (err) { return this._err(err); }
    });
    ipcMain.handle(IPC.CLIENTS.PROJECT_SCREENSHOTS, async (event, projectId: string) => {
      try { this._validateSender(event); return this._ok(await api().get(`/api/screenshots/project/${projectId}`)); }
      catch (err) { return this._err(err); }
    });

    // ── Enterprise: Role management ─────────────────────────────────────────
    ipcMain.handle(IPC.MANAGER.GET_MEMBERS, async (event) => {
      try { this._validateSender(event); return this._ok(await api().get('/api/manager/members')); }
      catch (err) { return this._err(err); }
    });
    ipcMain.handle(IPC.MANAGER.SET_ROLE, async (event, { userId, role }: { userId: string; role: string }) => {
      try { this._validateSender(event); return this._ok(await api().patch(`/api/manager/members/${userId}/role`, { role })); }
      catch (err) { return this._err(err); }
    });

    // ── Enterprise: Departments ─────────────────────────────────────────────
    ipcMain.handle(IPC.DEPARTMENTS.LIST, async (event) => {
      try { this._validateSender(event); return this._ok(await api().get('/api/departments')); }
      catch (err) { return this._err(err); }
    });
    ipcMain.handle(IPC.DEPARTMENTS.CREATE, async (event, payload: unknown) => {
      try { this._validateSender(event); return this._ok(await api().post('/api/departments', payload)); }
      catch (err) { return this._err(err); }
    });
    ipcMain.handle(IPC.DEPARTMENTS.UPDATE, async (event, { id, payload }: { id: string; payload: unknown }) => {
      try { this._validateSender(event); return this._ok(await api().patch(`/api/departments/${id}`, payload)); }
      catch (err) { return this._err(err); }
    });
    ipcMain.handle(IPC.DEPARTMENTS.DELETE, async (event, id: string) => {
      try { this._validateSender(event); return this._ok(await api().delete(`/api/departments/${id}`)); }
      catch (err) { return this._err(err); }
    });

    // ── Enterprise: Time Logs ───────────────────────────────────────────────
    ipcMain.handle(IPC.TIMELOGS.CLOCK_IN, async (event) => {
      try { this._validateSender(event); return this._ok(await api().post('/api/timelogs/clock-in')); }
      catch (err) { return this._err(err); }
    });
    ipcMain.handle(IPC.TIMELOGS.CLOCK_OUT, async (event) => {
      try { this._validateSender(event); return this._ok(await api().post('/api/timelogs/clock-out')); }
      catch (err) { return this._err(err); }
    });
    ipcMain.handle(IPC.TIMELOGS.BREAK_START, async (event) => {
      try { this._validateSender(event); return this._ok(await api().post('/api/timelogs/break-start')); }
      catch (err) { return this._err(err); }
    });
    ipcMain.handle(IPC.TIMELOGS.BREAK_END, async (event) => {
      try { this._validateSender(event); return this._ok(await api().post('/api/timelogs/break-end')); }
      catch (err) { return this._err(err); }
    });
    ipcMain.handle(IPC.TIMELOGS.FETCH, async (event, params: unknown) => {
      try {
        this._validateSender(event);
        const p = params as Record<string, string> | undefined;
        const qs = p ? '?' + new URLSearchParams(p as Record<string, string>).toString() : '';
        return this._ok(await api().get(`/api/timelogs${qs}`));
      } catch (err) { return this._err(err); }
    });

    // ── Enterprise: Timesheets ──────────────────────────────────────────────
    ipcMain.handle(IPC.TIMESHEETS.DAILY, async (event, params: unknown) => {
      try {
        this._validateSender(event);
        const p = params as Record<string, string> | undefined;
        const qs = p ? '?' + new URLSearchParams(p as Record<string, string>).toString() : '';
        return this._ok(await api().get(`/api/timesheets/daily${qs}`));
      } catch (err) { return this._err(err); }
    });
    ipcMain.handle(IPC.TIMESHEETS.WEEKLY, async (event, params: unknown) => {
      try {
        this._validateSender(event);
        const p = params as Record<string, string> | undefined;
        const qs = p ? '?' + new URLSearchParams(p as Record<string, string>).toString() : '';
        return this._ok(await api().get(`/api/timesheets/weekly${qs}`));
      } catch (err) { return this._err(err); }
    });
    ipcMain.handle(IPC.TIMESHEETS.MONTHLY, async (event, params: unknown) => {
      try {
        this._validateSender(event);
        const p = params as Record<string, string> | undefined;
        const qs = p ? '?' + new URLSearchParams(p as Record<string, string>).toString() : '';
        return this._ok(await api().get(`/api/timesheets/monthly${qs}`));
      } catch (err) { return this._err(err); }
    });
    ipcMain.handle(IPC.TIMESHEETS.TEAM, async (event, params: unknown) => {
      try {
        this._validateSender(event);
        const p = params as Record<string, string> | undefined;
        const qs = p ? '?' + new URLSearchParams(p as Record<string, string>).toString() : '';
        return this._ok(await api().get(`/api/timesheets/team${qs}`));
      } catch (err) { return this._err(err); }
    });

    // ── Enterprise: Attendance ──────────────────────────────────────────────
    ipcMain.handle(IPC.ATTENDANCE.LIVE, async (event) => {
      try { this._validateSender(event); return this._ok(await api().get('/api/attendance/live')); }
      catch (err) { return this._err(err); }
    });
    ipcMain.handle(IPC.ATTENDANCE.HISTORY, async (event, params: unknown) => {
      try {
        this._validateSender(event);
        const p = params as Record<string, string> | undefined;
        const qs = p ? '?' + new URLSearchParams(p as Record<string, string>).toString() : '';
        return this._ok(await api().get(`/api/attendance/history${qs}`));
      } catch (err) { return this._err(err); }
    });
    ipcMain.handle(IPC.ATTENDANCE.SUMMARY, async (event) => {
      try { this._validateSender(event); return this._ok(await api().get('/api/attendance/summary')); }
      catch (err) { return this._err(err); }
    });

    // ── Enterprise: App Notifications ───────────────────────────────────────
    ipcMain.handle(IPC.APP_NOTIFICATIONS.FETCH, async (event, params: unknown) => {
      try {
        this._validateSender(event);
        const p = params as Record<string, string> | undefined;
        const qs = p ? '?' + new URLSearchParams(p as Record<string, string>).toString() : '';
        return this._ok(await api().get(`/api/notifications${qs}`));
      } catch (err) { return this._err(err); }
    });
    ipcMain.handle(IPC.APP_NOTIFICATIONS.MARK_READ, async (event, id: string) => {
      try { this._validateSender(event); return this._ok(await api().post(`/api/notifications/${id}/read`)); }
      catch (err) { return this._err(err); }
    });
    ipcMain.handle(IPC.APP_NOTIFICATIONS.MARK_ALL_READ, async (event) => {
      try { this._validateSender(event); return this._ok(await api().post('/api/notifications/read-all')); }
      catch (err) { return this._err(err); }
    });
    ipcMain.handle(IPC.APP_NOTIFICATIONS.DELETE, async (event, id: string) => {
      try { this._validateSender(event); return this._ok(await api().delete(`/api/notifications/${id}`)); }
      catch (err) { return this._err(err); }
    });

    // ── Enterprise: Reports ─────────────────────────────────────────────────
    ipcMain.handle(IPC.REPORTS.OVERVIEW, async (event, params: unknown) => {
      try {
        this._validateSender(event);
        const p = params as Record<string, string> | undefined;
        const qs = p ? '?' + new URLSearchParams(p as Record<string, string>).toString() : '';
        return this._ok(await api().get(`/api/reports/overview${qs}`));
      } catch (err) { return this._err(err); }
    });
    ipcMain.handle(IPC.REPORTS.EMPLOYEE, async (event, params: { id: string } & Record<string, string>) => {
      try {
        this._validateSender(event);
        const { id, ...rest } = params;
        const qs = Object.keys(rest).length ? '?' + new URLSearchParams(rest).toString() : '';
        return this._ok(await api().get(`/api/reports/employee/${id}${qs}`));
      } catch (err) { return this._err(err); }
    });
    ipcMain.handle(IPC.REPORTS.PROJECT, async (event, id: string) => {
      try { this._validateSender(event); return this._ok(await api().get(`/api/reports/project/${id}`)); }
      catch (err) { return this._err(err); }
    });
    ipcMain.handle(IPC.REPORTS.ATTENDANCE, async (event, params: unknown) => {
      try {
        this._validateSender(event);
        const p = params as Record<string, string> | undefined;
        const qs = p ? '?' + new URLSearchParams(p as Record<string, string>).toString() : '';
        return this._ok(await api().get(`/api/reports/attendance${qs}`));
      } catch (err) { return this._err(err); }
    });
    ipcMain.handle(IPC.REPORTS.PRODUCTIVITY, async (event, params: unknown) => {
      try {
        this._validateSender(event);
        const p = params as Record<string, string> | undefined;
        const qs = p ? '?' + new URLSearchParams(p as Record<string, string>).toString() : '';
        return this._ok(await api().get(`/api/reports/productivity${qs}`));
      } catch (err) { return this._err(err); }
    });
    ipcMain.handle(IPC.REPORTS.TIMESHEET, async (event, params: unknown) => {
      try {
        this._validateSender(event);
        const p = params as Record<string, string> | undefined;
        const qs = p ? '?' + new URLSearchParams(p as Record<string, string>).toString() : '';
        return this._ok(await api().get(`/api/reports/timesheet${qs}`));
      } catch (err) { return this._err(err); }
    });
    ipcMain.handle(IPC.REPORTS.EXPORT_XLSX, async (event, params: unknown) => {
      try {
        this._validateSender(event);
        const p = params as Record<string, string> | undefined;
        const qs = p ? '?' + new URLSearchParams(p as Record<string, string>).toString() : '';

        const win = BrowserWindow.fromWebContents(event.sender);
        const dialogOptions = {
          title: 'Export Timesheet Report',
          defaultPath: `worktrack-timesheet-${(p?.from) || 'report'}.xlsx`,
          filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
        };
        const { canceled, filePath } = win
          ? await dialog.showSaveDialog(win, dialogOptions)
          : await dialog.showSaveDialog(dialogOptions);
        if (canceled || !filePath) return this._ok({ saved: false });

        const buffer = await api().get(`/api/reports/timesheet.xlsx${qs}`, {
          responseType: 'arraybuffer',
        });
        fs.writeFileSync(filePath, Buffer.from(buffer as ArrayBuffer));
        return this._ok({ saved: true, filePath });
      } catch (err) {
        log.error('Excel export failed', { error: (err as Error).message });
        return this._err(err);
      }
    });

    // ── Enterprise: Dashboard ───────────────────────────────────────────────
    ipcMain.handle(IPC.DASHBOARD.GET_PERSONAL, async (event, params: unknown) => {
      try {
        this._validateSender(event);
        const p = params as Record<string, string> | undefined;
        const qs = p ? '?' + new URLSearchParams(p as Record<string, string>).toString() : '';
        return this._ok(await api().get(`/api/dashboard/me${qs}`));
      } catch (err) { return this._err(err); }
    });
  }
}
