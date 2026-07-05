/**
 * Socket.io event names for real-time communication with the WorkTrack backend.
 */
export const SOCKET_EVENTS = {
  // ── Client → Server ────────────────────────────────────────────────────────
  EMIT: {
    JOIN_ROOM: 'join',
    HEARTBEAT: 'heartbeat',
    TIMER_START: 'timer:start',
    TIMER_PAUSE: 'timer:pause',
    TIMER_RESUME: 'timer:resume',
    TIMER_STOP: 'timer:stop',
    BREAK_START: 'break:start',
    BREAK_END: 'break:end',
    ACTIVITY_UPDATE: 'activity:update',
    SCREENSHOT_CAPTURED: 'screenshot:captured',
  },

  // ── Server → Client ────────────────────────────────────────────────────────
  ON: {
    CONNECT: 'connect',
    DISCONNECT: 'disconnect',
    CONNECT_ERROR: 'connect_error',
    TASK_ASSIGNED: 'task:assigned',
    TASK_UPDATED: 'task:updated',
    TASK_REMOVED: 'task:removed',
    SCREENSHOT_INTERVAL_CHANGED: 'screenshot:interval_changed',
    NOTIFICATION: 'notification',
    FORCE_TIMER_STOP: 'timer:force_stop',
    SETTINGS_UPDATED: 'settings:updated',
    SESSION_EXPIRED: 'auth:session_expired',
    ORG_PRESENCE: 'org:presence',
    ORG_TIMER_ACTIVITY: 'org:timer',
  },
} as const;

/** API endpoint paths relative to API_BASE_URL */
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/api/auth/login',
    LOGOUT: '/api/auth/logout',
    REFRESH: '/api/auth/refresh',
    ME: '/api/auth/me',
    SIGNUP_CREATE_ORG: '/api/auth/signup/create-org',
    SIGNUP_JOIN_ORG: '/api/auth/signup/join-org',
    LIST_ORGS: '/api/auth/orgs',
  },
  TASKS: {
    LIST: '/api/tasks/assigned',
    START_SESSION: (taskId: string) => `/api/tasks/${taskId}/sessions/start`,
    PAUSE_SESSION: (sessionId: string) => `/api/sessions/${sessionId}/pause`,
    RESUME_SESSION: (sessionId: string) => `/api/sessions/${sessionId}/resume`,
    STOP_SESSION: (sessionId: string) => `/api/sessions/${sessionId}/stop`,
    BREAK_START: (sessionId: string) => `/api/sessions/${sessionId}/break/start`,
    BREAK_END: (sessionId: string) => `/api/sessions/${sessionId}/break/end`,
  },
  SCREENSHOTS: {
    UPLOAD: '/api/screenshots/upload',
  },
  ACTIVITY: {
    HEARTBEAT: '/api/activity/heartbeat',
    OFFLINE_SYNC: '/api/activity/sync',
  },
  SETTINGS: {
    ORGANIZATION: '/api/organizations/settings',
    USER: '/api/users/settings',
  },
  MANAGER: {
    GET_TEAM: '/api/manager/team',
    APPROVE_REQUEST: (userId: string) => `/api/manager/requests/${userId}/approve`,
    REJECT_REQUEST: (userId: string) => `/api/manager/requests/${userId}/reject`,
    ASSIGN_TASK: '/api/manager/tasks',
    GET_TASKS: '/api/manager/tasks',
    ADD_EMPLOYEE: '/api/manager/employees',
    GET_EMPLOYEE_TASKS: (userId: string) => `/api/manager/employees/${userId}/tasks`,
    UPDATE_ORG_SETTINGS: '/api/manager/org-settings',
  },
  DRIVE: {
    AUTH_URL: '/api/drive/auth-url',
    CALLBACK: '/api/drive/callback',
    STATUS: '/api/drive/status',
  },
  UPDATES: {
    CHECK: '/api/updates/check',
  },
} as const;
