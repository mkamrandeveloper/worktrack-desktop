import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { IPC } from '../shared/constants/ipcChannels';
import type {
  LoginCredentials,
  StartTimerPayload,
  UserSettings,
  IpcResponse,
  AuthState,
  TimerState,
  Task,
  ActivitySnapshot,
  NotificationPayload,
  SignupCreateOrgPayload,
  SignupJoinOrgPayload,
  TeamMember,
  Project,
  Department,
  TimeLog,
  DailyTimesheet,
  WeeklyTimesheet,
  LiveEmployee,
  AppNotification,
  CreateProjectPayload,
  ClientAcceptPayload,
  ClientProject,
  TimesheetReport,
  OrgPresenceEvent,
  OrgTimerActivityEvent,
  MonthlyTimesheet,
  ScreenshotRecord,
  ScreenshotListFilters,
  ScreenshotBreakInterval,
} from '../shared/types';

type EventCallback<T> = (data: T) => void;

function invoke<T>(channel: string, ...args: unknown[]): Promise<IpcResponse<T>> {
  return ipcRenderer.invoke(channel, ...args);
}

function on<T>(channel: string, callback: EventCallback<T>): () => void {
  const handler = (_event: IpcRendererEvent, data: T) => callback(data);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

const api = {
  // ── Auth ─────────────────────────────────────────────────────────────────────
  auth: {
    login: (credentials: LoginCredentials) =>
      invoke<AuthState>(IPC.AUTH.LOGIN, credentials),
    signupCreateOrg: (payload: SignupCreateOrgPayload) =>
      invoke<AuthState>(IPC.AUTH.SIGNUP_CREATE_ORG, payload),
    signupJoinOrg: (payload: SignupJoinOrgPayload) =>
      invoke(IPC.AUTH.SIGNUP_JOIN_ORG, payload),
    listOrgs: () =>
      invoke<{ id: string; name: string; teamSize: number }[]>(IPC.AUTH.LIST_ORGS),
    logout: () => invoke(IPC.AUTH.LOGOUT),
    getState: () => invoke<AuthState>(IPC.AUTH.GET_STATE),
    onStateChanged: (cb: EventCallback<AuthState>) =>
      on<AuthState>(IPC.AUTH.STATE_CHANGED, cb),
  },

  // ── Timer ─────────────────────────────────────────────────────────────────────
  timer: {
    start: (payload: StartTimerPayload) =>
      invoke<TimerState>(IPC.TIMER.START, payload),
    pause: () => invoke<TimerState>(IPC.TIMER.PAUSE),
    resume: () => invoke<TimerState>(IPC.TIMER.RESUME),
    breakStart: () => invoke<TimerState>(IPC.TIMER.BREAK_START),
    breakEnd: () => invoke<TimerState>(IPC.TIMER.BREAK_END),
    stop: () => invoke<TimerState>(IPC.TIMER.STOP),
    getState: () => invoke<TimerState>(IPC.TIMER.GET_STATE),
    onStateChanged: (cb: EventCallback<TimerState>) =>
      on<TimerState>(IPC.TIMER.STATE_CHANGED, cb),
  },

  // ── Tasks ─────────────────────────────────────────────────────────────────────
  tasks: {
    fetch: () => invoke<Task[]>(IPC.TASKS.FETCH),
    getCached: () => invoke<Task[]>(IPC.TASKS.GET_CACHED),
    onUpdated: (cb: EventCallback<{ task: Task }>) =>
      on<{ task: Task }>(IPC.TASKS.UPDATED, cb),
  },

  // ── Screenshots ───────────────────────────────────────────────────────────────
  screenshots: {
    test: () => ipcRenderer.invoke(IPC.SCREENSHOTS.TEST),
    getQueue: () => invoke(IPC.SCREENSHOTS.GET_QUEUE),
    flushQueue: () => invoke(IPC.SCREENSHOTS.FLUSH_QUEUE),
    onUploadStatus: (cb: EventCallback<unknown>) =>
      on(IPC.SCREENSHOTS.UPLOAD_STATUS, cb),
    onSettingsChanged: (cb: EventCallback<unknown>) =>
      on(IPC.SCREENSHOTS.SETTINGS_CHANGED, cb),
    list: (filters?: ScreenshotListFilters) =>
      invoke<ScreenshotRecord[]>(IPC.SCREENSHOTS.LIST, filters),
    getImage: (screenshotId: string) =>
      invoke<{ dataUrl: string }>(IPC.SCREENSHOTS.GET_IMAGE, screenshotId),
    listBreaks: (filters?: ScreenshotListFilters) =>
      invoke<ScreenshotBreakInterval[]>(IPC.SCREENSHOTS.LIST_BREAKS, filters),
  },

  // ── Activity ──────────────────────────────────────────────────────────────────
  activity: {
    getStatus: () => invoke<ActivitySnapshot>(IPC.ACTIVITY.GET_STATUS),
    onStatusChanged: (cb: EventCallback<{ status: string; idleSeconds: number }>) =>
      on(IPC.ACTIVITY.STATUS_CHANGED, cb),
  },

  // ── Settings ──────────────────────────────────────────────────────────────────
  settings: {
    get: () => invoke<UserSettings>(IPC.SETTINGS.GET),
    update: (settings: Partial<UserSettings>) =>
      invoke<UserSettings>(IPC.SETTINGS.UPDATE, settings),
    toggleStartup: (enable: boolean) =>
      invoke(IPC.SETTINGS.TOGGLE_STARTUP, enable),
  },

  // ── Notifications ─────────────────────────────────────────────────────────────
  notifications: {
    onReceived: (cb: EventCallback<NotificationPayload>) =>
      on<NotificationPayload>(IPC.NOTIFICATIONS.RECEIVED, cb),
  },

  // ── Sync ──────────────────────────────────────────────────────────────────────
  sync: {
    getStatus: () => invoke(IPC.SYNC.GET_STATUS),
    onStatusChanged: (cb: EventCallback<{ status: string }>) =>
      on(IPC.SYNC.STATUS_CHANGED, cb),
    onPresenceChanged: (cb: EventCallback<OrgPresenceEvent>) =>
      on<OrgPresenceEvent>(IPC.SYNC.PRESENCE_CHANGED, cb),
    onTimerActivity: (cb: EventCallback<OrgTimerActivityEvent>) =>
      on<OrgTimerActivityEvent>(IPC.SYNC.TIMER_ACTIVITY, cb),
  },

  // ── Manager ───────────────────────────────────────────────────────────────────
  manager: {
    getTeam: () =>
      invoke<{ members: TeamMember[]; requests: TeamMember[] }>(IPC.MANAGER.GET_TEAM),
    approveRequest: (userId: string) =>
      invoke(IPC.MANAGER.APPROVE_REQUEST, userId),
    rejectRequest: (userId: string) =>
      invoke(IPC.MANAGER.REJECT_REQUEST, userId),
    getTasks: () =>
      invoke<Task[]>(IPC.MANAGER.GET_TASKS),
    updateOrgSettings: (settings: Record<string, unknown>) =>
      invoke(IPC.MANAGER.UPDATE_ORG_SETTINGS, settings),
    addEmployee: (payload: { name: string; email: string; password: string }) =>
      invoke(IPC.MANAGER.ADD_EMPLOYEE, payload),
    getEmployeeTasks: (userId: string) =>
      invoke<Task[]>(IPC.MANAGER.GET_EMPLOYEE_TASKS, userId),
    getMembers: () =>
      invoke<TeamMember[]>(IPC.MANAGER.GET_MEMBERS),
    setRole: (userId: string, role: string) =>
      invoke<TeamMember>(IPC.MANAGER.SET_ROLE, { userId, role }),
  },

  // ── Clients ───────────────────────────────────────────────────────────────────
  clients: {
    accept: (payload: ClientAcceptPayload) =>
      invoke<AuthState>(IPC.CLIENTS.ACCEPT, payload),
    projects: () =>
      invoke<ClientProject[]>(IPC.CLIENTS.PROJECTS),
    projectScreenshots: (projectId: string) =>
      invoke(IPC.CLIENTS.PROJECT_SCREENSHOTS, projectId),
  },

  // ── Google Drive ──────────────────────────────────────────────────────────────
  drive: {
    getAuthUrl: () => invoke<{ url: string }>(IPC.DRIVE.GET_AUTH_URL),
    handleCallback: (code: string) => invoke<{ orgFolderUrl?: string }>(IPC.DRIVE.HANDLE_CALLBACK, code),
    isConnected: () => invoke<{ connected: boolean; orgFolderUrl?: string }>(IPC.DRIVE.IS_CONNECTED),
    openFolder: (url: string) => invoke(IPC.DRIVE.OPEN_FOLDER, url),
  },


  // ── System ────────────────────────────────────────────────────────────────────
  system: {
    getVersion: () => invoke<{ version: string }>(IPC.SYSTEM.GET_APP_VERSION),
    checkUpdate: () => invoke(IPC.SYSTEM.CHECK_UPDATE),
    installUpdate: () => invoke(IPC.SYSTEM.INSTALL_UPDATE),
    openExternal: (url: string) => invoke(IPC.SYSTEM.OPEN_EXTERNAL, url),
    quit: () => invoke(IPC.SYSTEM.QUIT),
    onUpdateAvailable: (cb: EventCallback<{ version: string }>) =>
      on(IPC.SYSTEM.UPDATE_AVAILABLE, cb),
    onUpdateDownloaded: (cb: EventCallback<{ version: string }>) =>
      on(IPC.SYSTEM.UPDATE_DOWNLOADED, cb),
  },

  // ── Projects ─────────────────────────────────────────────────────────────────
  projects: {
    list: () => invoke<Project[]>(IPC.PROJECTS.LIST),
    get: (id: string) => invoke<Project>(IPC.PROJECTS.GET, id),
    create: (payload: CreateProjectPayload) => invoke<Project>(IPC.PROJECTS.CREATE, payload),
    update: (id: string, payload: Partial<Project>) => invoke<Project>(IPC.PROJECTS.UPDATE, { id, payload }),
    delete: (id: string) => invoke(IPC.PROJECTS.DELETE, id),
    addMember: (projectId: string, userId: string) => invoke(IPC.PROJECTS.ADD_MEMBER, { projectId, userId }),
    removeMember: (projectId: string, userId: string) => invoke(IPC.PROJECTS.REMOVE_MEMBER, { projectId, userId }),
    getTasks: (projectId: string) => invoke<Task[]>(IPC.PROJECTS.GET_TASKS, projectId),
    createTask: (projectId: string, payload: unknown) => invoke<Task>(IPC.PROJECTS.CREATE_TASK, { projectId, payload }),
    updateTask: (projectId: string, taskId: string, payload: unknown) => invoke<Task>(IPC.PROJECTS.UPDATE_TASK, { projectId, taskId, payload }),
  },

  // ── Departments ──────────────────────────────────────────────────────────────
  departments: {
    list: () => invoke<Department[]>(IPC.DEPARTMENTS.LIST),
    create: (payload: { name: string; description?: string }) => invoke<Department>(IPC.DEPARTMENTS.CREATE, payload),
    update: (id: string, payload: { name?: string; description?: string }) => invoke<Department>(IPC.DEPARTMENTS.UPDATE, { id, payload }),
    delete: (id: string) => invoke(IPC.DEPARTMENTS.DELETE, id),
  },

  // ── Time Logs ────────────────────────────────────────────────────────────────
  timelogs: {
    clockIn: () => invoke(IPC.TIMELOGS.CLOCK_IN),
    clockOut: () => invoke(IPC.TIMELOGS.CLOCK_OUT),
    breakStart: () => invoke(IPC.TIMELOGS.BREAK_START),
    breakEnd: () => invoke(IPC.TIMELOGS.BREAK_END),
    fetch: (params?: { userId?: string; from?: string; to?: string }) => invoke<TimeLog[]>(IPC.TIMELOGS.FETCH, params),
  },

  // ── Timesheets ───────────────────────────────────────────────────────────────
  timesheets: {
    daily: (params?: { userId?: string; date?: string }) => invoke<DailyTimesheet>(IPC.TIMESHEETS.DAILY, params),
    weekly: (params?: { userId?: string; weekStart?: string }) => invoke<WeeklyTimesheet>(IPC.TIMESHEETS.WEEKLY, params),
    monthly: (params?: { userId?: string; year?: number; month?: number }) => invoke<MonthlyTimesheet>(IPC.TIMESHEETS.MONTHLY, params),
    team: (params?: { date?: string }) => invoke(IPC.TIMESHEETS.TEAM, params),
  },

  // ── Attendance ───────────────────────────────────────────────────────────────
  attendance: {
    live: () => invoke<LiveEmployee[]>(IPC.ATTENDANCE.LIVE),
    history: (params?: { from?: string; to?: string; userId?: string }) => invoke(IPC.ATTENDANCE.HISTORY, params),
    summary: () => invoke(IPC.ATTENDANCE.SUMMARY),
  },

  // ── App Notifications ────────────────────────────────────────────────────────
  appNotifications: {
    fetch: (params?: { unreadOnly?: boolean; limit?: number }) => invoke<{ notifications: AppNotification[]; unreadCount: number }>(IPC.APP_NOTIFICATIONS.FETCH, params),
    markRead: (id: string) => invoke(IPC.APP_NOTIFICATIONS.MARK_READ, id),
    markAllRead: () => invoke(IPC.APP_NOTIFICATIONS.MARK_ALL_READ),
  },

  reports: {
    overview: (params?: { from?: string; to?: string }) => invoke(IPC.REPORTS.OVERVIEW, params),
    employee: (id: string, params?: { from?: string; to?: string }) => invoke(IPC.REPORTS.EMPLOYEE, { id, ...params }),
    project: (id: string) => invoke(IPC.REPORTS.PROJECT, id),
    attendance: (params?: { from?: string; to?: string }) => invoke(IPC.REPORTS.ATTENDANCE, params),
    productivity: (params?: { from?: string; to?: string }) => invoke(IPC.REPORTS.PRODUCTIVITY, params),
    timesheet: (params?: { period?: string; from?: string; to?: string; userId?: string; projectId?: string }) =>
      invoke<TimesheetReport>(IPC.REPORTS.TIMESHEET, params),
    exportXlsx: (params?: { period?: string; from?: string; to?: string; userId?: string; projectId?: string }) =>
      invoke<{ saved: boolean; filePath?: string }>(IPC.REPORTS.EXPORT_XLSX, params),
  },

  // ── Dashboard ────────────────────────────────────────────────────────────────
  dashboard: {
    getPersonalAnalytics: (period: 'daily' | 'weekly' | 'monthly') => 
      invoke(IPC.DASHBOARD.GET_PERSONAL, { period }),
  }
};

contextBridge.exposeInMainWorld('worktrack', api);

declare global {
  interface Window {
    worktrack: typeof api;
  }
}
