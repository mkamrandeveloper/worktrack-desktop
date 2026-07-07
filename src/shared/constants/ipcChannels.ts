/**
 * All IPC channel names used between main and renderer processes.
 * Centralizing these prevents typos and makes refactoring safe.
 */
export const IPC = {
  // ── Auth ────────────────────────────────────────────────────────────────────
  AUTH: {
    LOGIN: 'auth:login',
    SIGNUP_CREATE_ORG: 'auth:signup-create-org',
    SIGNUP_JOIN_ORG: 'auth:signup-join-org',
    LIST_ORGS: 'auth:list-orgs',
    LOGOUT: 'auth:logout',
    GET_STATE: 'auth:get-state',
    REFRESH_TOKEN: 'auth:refresh-token',
    STATE_CHANGED: 'auth:state-changed',
  },

  // ── Timer ───────────────────────────────────────────────────────────────────
  TIMER: {
    START: 'timer:start',
    PAUSE: 'timer:pause',
    RESUME: 'timer:resume',
    BREAK_START: 'timer:break-start',
    BREAK_END: 'timer:break-end',
    STOP: 'timer:stop',
    GET_STATE: 'timer:get-state',
    STATE_CHANGED: 'timer:state-changed',
  },

  // ── Tasks ───────────────────────────────────────────────────────────────────
  TASKS: {
    FETCH: 'tasks:fetch',
    GET_CACHED: 'tasks:get-cached',
    UPDATED: 'tasks:updated',
  },

  // ── Screenshots ─────────────────────────────────────────────────────────────
  SCREENSHOTS: {
    CAPTURE_NOW: 'screenshots:capture-now',
    GET_QUEUE: 'screenshots:get-queue',
    FLUSH_QUEUE: 'screenshots:flush-queue',
    UPLOAD_STATUS: 'screenshots:upload-status',
    SETTINGS_CHANGED: 'screenshots:settings-changed',
    TEST: 'screenshots:test',
    LIST: 'screenshots:list',
    GET_IMAGE: 'screenshots:get-image',
    LIST_BREAKS: 'screenshots:list-breaks',
  },

  // ── Activity ────────────────────────────────────────────────────────────────
  ACTIVITY: {
    GET_STATUS: 'activity:get-status',
    STATUS_CHANGED: 'activity:status-changed',
  },

  // ── Settings ────────────────────────────────────────────────────────────────
  SETTINGS: {
    GET: 'settings:get',
    UPDATE: 'settings:update',
    TOGGLE_STARTUP: 'settings:toggle-startup',
  },

  // ── Notifications ───────────────────────────────────────────────────────────
  NOTIFICATIONS: {
    SHOW: 'notifications:show',
    RECEIVED: 'notifications:received',
  },

  // ── System ──────────────────────────────────────────────────────────────────
  SYSTEM: {
    GET_DISPLAYS: 'system:get-displays',
    GET_APP_VERSION: 'system:get-app-version',
    CHECK_UPDATE: 'system:check-update',
    INSTALL_UPDATE: 'system:install-update',
    UPDATE_AVAILABLE: 'system:update-available',
    UPDATE_DOWNLOADED: 'system:update-downloaded',
    OPEN_EXTERNAL: 'system:open-external',
    QUIT: 'system:quit',
  },

  // ── Sync ────────────────────────────────────────────────────────────────────
  SYNC: {
    STATUS_CHANGED: 'sync:status-changed',
    GET_STATUS: 'sync:get-status',
    PRESENCE_CHANGED: 'sync:presence-changed',
    TIMER_ACTIVITY: 'sync:timer-activity',
  },

  // ── Manager ──────────────────────────────────────────────────────────────
  MANAGER: {
    GET_TEAM: 'manager:get-team',
    APPROVE_REQUEST: 'manager:approve-request',
    REJECT_REQUEST: 'manager:reject-request',
    GET_TASKS: 'manager:get-tasks',
    UPDATE_ORG_SETTINGS: 'manager:update-org-settings',
    ADD_EMPLOYEE: 'manager:add-employee',
    GET_EMPLOYEE_TASKS: 'manager:get-employee-tasks',
    GET_MEMBERS: 'manager:get-members',
    SET_ROLE: 'manager:set-role',
  },

  // ── Clients ──────────────────────────────────────────────────────────────────
  CLIENTS: {
    ACCEPT: 'clients:accept',
    PROJECTS: 'clients:projects',
    PROJECT_SCREENSHOTS: 'clients:project-screenshots',
  },

  // ── Google Drive ──────────────────────────────────────────────────────────────
  DRIVE: {
    OPEN_FOLDER: 'drive:open-folder',
    IS_CONNECTED: 'drive:is-connected',
  },

  // ── Projects ─────────────────────────────────────────────────────────────────
  PROJECTS: {
    LIST: 'projects:list',
    GET: 'projects:get',
    CREATE: 'projects:create',
    UPDATE: 'projects:update',
    DELETE: 'projects:delete',
    ADD_MEMBER: 'projects:add-member',
    REMOVE_MEMBER: 'projects:remove-member',
    GET_TASKS: 'projects:get-tasks',
    CREATE_TASK: 'projects:create-task',
    UPDATE_TASK: 'projects:update-task',
  },

  // ── Departments ──────────────────────────────────────────────────────────────
  DEPARTMENTS: {
    LIST: 'departments:list',
    CREATE: 'departments:create',
    UPDATE: 'departments:update',
    DELETE: 'departments:delete',
  },

  // ── Time Logs ────────────────────────────────────────────────────────────────
  TIMELOGS: {
    CLOCK_IN: 'timelogs:clock-in',
    CLOCK_OUT: 'timelogs:clock-out',
    BREAK_START: 'timelogs:break-start',
    BREAK_END: 'timelogs:break-end',
    FETCH: 'timelogs:fetch',
  },

  // ── Timesheets ───────────────────────────────────────────────────────────────
  TIMESHEETS: {
    DAILY: 'timesheets:daily',
    WEEKLY: 'timesheets:weekly',
    MONTHLY: 'timesheets:monthly',
    TEAM: 'timesheets:team',
  },

  // ── Attendance ───────────────────────────────────────────────────────────────
  ATTENDANCE: {
    LIVE: 'attendance:live',
    HISTORY: 'attendance:history',
    SUMMARY: 'attendance:summary',
  },

  // ── App Notifications ────────────────────────────────────────────────────────
  APP_NOTIFICATIONS: {
    FETCH: 'app-notifications:fetch',
    MARK_READ: 'app-notifications:mark-read',
    MARK_ALL_READ: 'app-notifications:mark-all-read',
    DELETE: 'app-notifications:delete',
  },

  // ── Reports ──────────────────────────────────────────────────────────────────
  REPORTS: {
    OVERVIEW: 'reports:overview',
    EMPLOYEE: 'reports:employee',
    PROJECT: 'reports:project',
    ATTENDANCE: 'reports:attendance',
    PRODUCTIVITY: 'reports:productivity',
    TIMESHEET: 'reports:timesheet',
    EXPORT_XLSX: 'reports:export-xlsx',
  },

  // ── Dashboard ────────────────────────────────────────────────────────────────
  DASHBOARD: {
    GET_PERSONAL: 'dashboard:get-personal',
  },
} as const;

export type IpcChannel = typeof IPC[keyof typeof IPC][keyof typeof IPC[keyof typeof IPC]];
