/// <reference types="vite/client" />

import type {
  AuthState,
  LoginCredentials,
  TimerState,
  Task,
  ActivitySnapshot,
  NotificationPayload,
  UserSettings,
  StartTimerPayload,
  IpcResponse,
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
  DashboardAnalytics,
  OrgOverviewReport,
  ClientAcceptPayload,
  ClientProject,
  TimesheetReport,
  OrgPresenceEvent,
  OrgTimerActivityEvent,
  MonthlyTimesheet,
  ScreenshotRecord,
  ScreenshotListFilters,
} from '@shared/types';

type EventUnsubscribe = () => void;
type EventCallback<T> = (data: T) => void;

interface WorktrackAPI {
  auth: {
    login: (credentials: LoginCredentials) => Promise<IpcResponse<AuthState>>;
    signupCreateOrg: (payload: SignupCreateOrgPayload) => Promise<IpcResponse<AuthState>>;
    signupJoinOrg: (payload: SignupJoinOrgPayload) => Promise<IpcResponse>;
    listOrgs: () => Promise<IpcResponse<{ id: string; name: string; teamSize: number }[]>>;
    logout: () => Promise<IpcResponse>;
    getState: () => Promise<IpcResponse<AuthState>>;
    onStateChanged: (cb: EventCallback<AuthState>) => EventUnsubscribe;
  };
  timer: {
    start: (payload: StartTimerPayload) => Promise<IpcResponse<TimerState>>;
    pause: () => Promise<IpcResponse<TimerState>>;
    resume: () => Promise<IpcResponse<TimerState>>;
    breakStart: () => Promise<IpcResponse<TimerState>>;
    breakEnd: () => Promise<IpcResponse<TimerState>>;
    stop: () => Promise<IpcResponse<TimerState>>;
    getState: () => Promise<IpcResponse<TimerState>>;
    onStateChanged: (cb: EventCallback<TimerState>) => EventUnsubscribe;
  };
  tasks: {
    fetch: () => Promise<IpcResponse<Task[]>>;
    getCached: () => Promise<IpcResponse<Task[]>>;
    onUpdated: (cb: EventCallback<{ task: Task }>) => EventUnsubscribe;
  };
  screenshots: {
    test: () => Promise<IpcResponse<void>>;
    getQueue: () => Promise<IpcResponse<{ pending: number; items: unknown[] }>>;
    flushQueue: () => Promise<IpcResponse<{ uploaded: number; failed: number }>>;
    onUploadStatus: (cb: EventCallback<unknown>) => EventUnsubscribe;
    onSettingsChanged: (cb: EventCallback<unknown>) => EventUnsubscribe;
    list: (filters?: ScreenshotListFilters) => Promise<IpcResponse<ScreenshotRecord[]>>;
    getImage: (screenshotId: string) => Promise<IpcResponse<{ dataUrl: string }>>;
  };
  activity: {
    getStatus: () => Promise<IpcResponse<ActivitySnapshot>>;
    onStatusChanged: (cb: EventCallback<{ status: string; idleSeconds: number }>) => EventUnsubscribe;
  };
  settings: {
    get: () => Promise<IpcResponse<UserSettings>>;
    update: (settings: Partial<UserSettings>) => Promise<IpcResponse<UserSettings>>;
    toggleStartup: (enable: boolean) => Promise<IpcResponse<{ launchOnStartup: boolean }>>;
  };
  notifications: {
    onReceived: (cb: EventCallback<NotificationPayload>) => EventUnsubscribe;
  };
  sync: {
    getStatus: () => Promise<IpcResponse<{ status: string }>>;
    onStatusChanged: (cb: EventCallback<{ status: string }>) => EventUnsubscribe;
    onPresenceChanged: (cb: EventCallback<OrgPresenceEvent>) => EventUnsubscribe;
    onTimerActivity: (cb: EventCallback<OrgTimerActivityEvent>) => EventUnsubscribe;
  };
  manager: {
    getTeam: () => Promise<IpcResponse<{ members: TeamMember[]; requests: TeamMember[] }>>;
    approveRequest: (userId: string) => Promise<IpcResponse>;
    rejectRequest: (userId: string) => Promise<IpcResponse>;
    getTasks: () => Promise<IpcResponse<Task[]>>;
    updateOrgSettings: (settings: Record<string, unknown>) => Promise<IpcResponse>;
    addEmployee: (payload: { name: string; email: string; password: string }) => Promise<IpcResponse>;
    getEmployeeTasks: (userId: string) => Promise<IpcResponse<Task[]>>;
    getMembers: () => Promise<IpcResponse<TeamMember[]>>;
    setRole: (userId: string, role: string) => Promise<IpcResponse<TeamMember>>;
  };
  clients: {
    accept: (payload: ClientAcceptPayload) => Promise<IpcResponse<AuthState>>;
    projects: () => Promise<IpcResponse<ClientProject[]>>;
    projectScreenshots: (projectId: string) => Promise<IpcResponse<unknown>>;
  };
  drive: {
    getAuthUrl: () => Promise<IpcResponse<{ url: string }>>;
    handleCallback: (code: string) => Promise<IpcResponse<{ orgFolderUrl?: string }>>;
    isConnected: () => Promise<IpcResponse<{ connected: boolean; orgFolderUrl?: string }>>;
    openFolder: (url: string) => Promise<IpcResponse>;
  };
  projects: {
    list: () => Promise<IpcResponse<Project[]>>;
    get: (id: string) => Promise<IpcResponse<Project>>;
    create: (payload: CreateProjectPayload) => Promise<IpcResponse<Project>>;
    update: (id: string, payload: Partial<Project>) => Promise<IpcResponse<Project>>;
    delete: (id: string) => Promise<IpcResponse>;
    addMember: (projectId: string, userId: string) => Promise<IpcResponse>;
    removeMember: (projectId: string, userId: string) => Promise<IpcResponse>;
    getTasks: (projectId: string) => Promise<IpcResponse<Task[]>>;
    createTask: (projectId: string, payload: unknown) => Promise<IpcResponse<Task>>;
    updateTask: (projectId: string, taskId: string, payload: unknown) => Promise<IpcResponse<Task>>;
  };
  departments: {
    list: () => Promise<IpcResponse<Department[]>>;
    create: (payload: { name: string; description?: string }) => Promise<IpcResponse<Department>>;
    update: (id: string, payload: { name?: string; description?: string }) => Promise<IpcResponse<Department>>;
    delete: (id: string) => Promise<IpcResponse>;
  };
  timelogs: {
    clockIn: () => Promise<IpcResponse>;
    clockOut: () => Promise<IpcResponse>;
    breakStart: () => Promise<IpcResponse>;
    breakEnd: () => Promise<IpcResponse>;
    fetch: (params?: { userId?: string; from?: string; to?: string }) => Promise<IpcResponse<TimeLog[]>>;
  };
  timesheets: {
    daily: (params?: { userId?: string; date?: string }) => Promise<IpcResponse<DailyTimesheet>>;
    weekly: (params?: { userId?: string; weekStart?: string }) => Promise<IpcResponse<WeeklyTimesheet>>;
    monthly: (params?: { userId?: string; year?: number; month?: number }) => Promise<IpcResponse<MonthlyTimesheet>>;
    team: (params?: { date?: string }) => Promise<IpcResponse>;
  };
  attendance: {
    live: () => Promise<IpcResponse<LiveEmployee[]>>;
    history: (params?: { from?: string; to?: string; userId?: string }) => Promise<IpcResponse>;
    summary: () => Promise<IpcResponse>;
  };
  appNotifications: {
    fetch: (params?: { unreadOnly?: boolean; limit?: number }) => Promise<IpcResponse<{ notifications: AppNotification[]; unreadCount: number }>>;
    markRead: (id: string) => Promise<IpcResponse>;
    markAllRead: () => Promise<IpcResponse>;
  };
  reports: {
    overview: (params?: { from?: string; to?: string }) => Promise<IpcResponse<OrgOverviewReport>>;
    employee: (id: string, params?: { from?: string; to?: string }) => Promise<IpcResponse>;
    project: (id: string) => Promise<IpcResponse>;
    attendance: (params?: { from?: string; to?: string }) => Promise<IpcResponse>;
    productivity: (params?: { from?: string; to?: string }) => Promise<IpcResponse>;
    timesheet: (params?: { period?: string; from?: string; to?: string; userId?: string; projectId?: string }) => Promise<IpcResponse<TimesheetReport>>;
    exportXlsx: (params?: { period?: string; from?: string; to?: string; userId?: string; projectId?: string }) => Promise<IpcResponse<{ saved: boolean; filePath?: string }>>;
  };
  dashboard: {
    getPersonalAnalytics: (period: 'daily' | 'weekly' | 'monthly') => Promise<IpcResponse<DashboardAnalytics>>;
  };
  system: {
    getVersion: () => Promise<IpcResponse<{ version: string }>>;
    checkUpdate: () => Promise<IpcResponse>;
    installUpdate: () => Promise<IpcResponse>;
    openExternal: (url: string) => Promise<IpcResponse>;
    quit: () => Promise<IpcResponse>;
    onUpdateAvailable: (cb: EventCallback<{ version: string }>) => EventUnsubscribe;
    onUpdateDownloaded: (cb: EventCallback<{ version: string }>) => EventUnsubscribe;
  };
}

declare global {
  interface Window {
    worktrack: WorktrackAPI;
  }
}
