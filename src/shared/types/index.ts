// ─── User & Auth ──────────────────────────────────────────────────────────────

export type UserRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'EMPLOYEE' | 'CLIENT';
export type MemberStatus = 'PENDING' | 'ACTIVE' | 'DISABLED';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organizationId: string;
  status?: MemberStatus;
  departmentId?: string;
  position?: string;
  avatarUrl?: string;
  phone?: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: MemberStatus;
  driveFolderUrl?: string;
  departmentId?: string;
  position?: string;
}

export interface SignupCreateOrgPayload {
  name: string;
  email: string;
  password: string;
  orgName: string;
  teamSize: number;
}

export interface SignupJoinOrgPayload {
  name: string;
  email: string;
  password: string;
  organizationId: string;
}

export interface ClientAcceptPayload {
  token: string;
  password: string;
  name?: string;
}

export interface ClientProject {
  id: string;
  name: string;
  description?: string;
  status: string;
  priority: string;
  deadline?: string;
  org_name: string;
  client_name?: string;
  task_count: number;
  completed_count: number;
  progress_percent: number;
  created_at: string;
}

export interface AssignTaskPayload {
  title: string;
  description: string;
  assigneeId: string;
  estimatedHours: number;
  projectId?: string;
  customScreenshotInterval?: number;
  deadline?: string;
  priority?: TaskPriority;
}

export interface Organization {
  id: string;
  name: string;
  logo?: string;
  screenshotInterval: number; // minutes
  screenshotEnabled: boolean;
  screenshotMonitors: 'primary' | 'all';
  idleThreshold: number; // seconds
  enforceAutoStart: boolean;
  workingHoursStart?: string; // HH:mm
  workingHoursEnd?: string;   // HH:mm
  timezone: string;
  teamSize?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp ms
}

export interface AuthState {
  user: User | null;
  organization: Organization | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  organization: Organization;
  tokens: AuthTokens;
}

// ─── Departments ──────────────────────────────────────────────────────────────

export interface Department {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  memberCount?: number;
  createdAt: string;
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export type ProjectStatus = 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED' | 'ARCHIVED';
export type ProjectPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | 'CRITICAL';

export interface Project {
  id: string;
  organizationId: string;
  departmentId?: string;
  name: string;
  description?: string;
  clientName?: string;
  clientEmail?: string;
  companyName?: string;
  budget: number;
  priority: ProjectPriority;
  status: ProjectStatus;
  startDate?: string;
  deadline?: string;
  estimatedHours: number;
  actualHours: number;
  managerId?: string;
  managerName?: string;
  memberCount?: number;
  taskCount?: number;
  notes?: string;
  clientInviteToken?: string;
  clientInviteAccepted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMember {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  projectRole: 'manager' | 'member';
}

export interface CreateProjectPayload {
  name: string;
  description?: string;
  clientName?: string;
  clientEmail?: string;
  companyName?: string;
  budget?: number;
  priority?: ProjectPriority;
  status?: ProjectStatus;
  startDate?: string;
  deadline?: string;
  estimatedHours?: number;
  departmentId?: string;
  notes?: string;
  memberIds?: string[];
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export type TaskStatus =
  | 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE'
  | 'BLOCKED' | 'CANCELLED'
  | 'pending' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';

export type TaskPriority =
  | 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | 'CRITICAL'
  | 'low' | 'medium' | 'high' | 'urgent' | 'critical';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  estimatedHours: number;
  loggedHours?: number;
  remainingHours?: number;
  progressPercent?: number;
  deadline?: string;
  projectId?: string;
  projectName?: string;
  assigneeId?: string;
  assigneeName?: string;
  assignedAt: string;
  organizationId: string;
  comments?: string;
  activityLog?: string;
}

export interface TaskSession {
  id: string;
  taskId: string;
  userId: string;
  startedAt: string;
  endedAt?: string;
  durationSeconds: number;
  breakDurationSeconds: number;
}

// ─── Timer ────────────────────────────────────────────────────────────────────

export type TimerStatus =
  | 'idle'
  | 'running'
  | 'paused'
  | 'on_break'
  | 'stopped';

export interface TimerState {
  status: TimerStatus;
  taskId: string | null;
  sessionId: string | null;
  startedAt: number | null;       // Unix ms
  pausedAt: number | null;        // Unix ms
  breakStartedAt: number | null;  // Unix ms
  elapsedSeconds: number;         // total working seconds (excludes breaks)
  breakSeconds: number;           // total break seconds
  todaySeconds: number;
  weekSeconds: number;
}

export interface TimerEvent {
  type: 'start' | 'pause' | 'resume' | 'break_start' | 'break_end' | 'stop';
  taskId?: string;
  sessionId?: string;
  timestamp: number;
  payload?: Record<string, unknown>;
}

// ─── Time Logs & Attendance ───────────────────────────────────────────────────

export type TimeLogType = 'clock_in' | 'clock_out' | 'break_start' | 'break_end' | 'manual';
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'half_day';
export type LiveStatus = 'active' | 'working' | 'idle' | 'on_break' | 'offline' | 'clocked_out' | 'overtime';

export interface TimeLog {
  id: string;
  userId: string;
  organizationId: string;
  type: TimeLogType;
  timestamp: string;
  taskId?: string;
  taskTitle?: string;
  projectId?: string;
  projectName?: string;
  notes?: string;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  organizationId: string;
  date: string; // YYYY-MM-DD
  clockInTime?: string;
  clockOutTime?: string;
  totalWorkSeconds: number;
  totalBreakSeconds: number;
  totalIdleSeconds: number;
  totalOvertimeSeconds: number;
  status: AttendanceStatus;
  isLate: boolean;
}

export interface LiveEmployee {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  attendanceStatus?: AttendanceStatus;
  displayStatus: LiveStatus;
  clockInTime?: string;
  clockOutTime?: string;
  totalWorkSeconds: number;
  totalBreakSeconds: number;
  workHours: number;
  breakHours: number;
  liveStatus?: string;
  lastSeen?: string;
  currentTask?: string;
  currentProject?: string;
}

export interface TimelineEvent {
  timestamp: string;
  type: string;
  label: string;
}

export interface BreakInterval {
  start: string;
  end: string | null;
}

export interface DailyTimesheet {
  date: string;
  attendance: AttendanceRecord;
  logs: TimeLog[];
  tasks: Task[];
  workHours: number;
  breakHours: number;
  idleHours: number;
  overtimeHours: number;
  /** Present only on the dedicated single-day drill-down endpoint. */
  timeline?: TimelineEvent[];
  breaks?: BreakInterval[];
}

export interface WeeklyTimesheet {
  weekStart: string;
  weekEnd: string;
  days: DailyTimesheet[];
  totals: {
    totalWorkHours: number;
    totalBreakHours: number;
    totalIdleHours: number;
    totalOvertimeHours: number;
  };
}

export interface MonthlyTimesheetDay {
  date: string;
  status: string;
  workHours: number;
  breakHours: number;
  overtimeHours: number;
  idleHours: number;
  productivity: number;
  clockIn: string | null;
  clockOut: string | null;
}

export interface MonthlyTimesheet {
  year: number;
  month: number;
  days: MonthlyTimesheetDay[];
  totals: {
    presentDays: number;
    absentDays: number;
    lateDays: number;
    totalWorkHours: number;
    totalBreakHours: number;
    totalIdleHours: number;
    totalOvertimeHours: number;
    avgProductivity: number;
  };
}

// ─── Notifications ────────────────────────────────────────────────────────────

export type NotificationType =
  | 'task_assigned' | 'task_updated' | 'deadline_reminder'
  | 'employee_added' | 'employee_clock_in' | 'employee_clock_out'
  | 'idle_alert' | 'overtime_alert' | 'productivity_alert'
  | 'project_assigned' | 'client_joined' | 'system_alert';

export interface AppNotification {
  id: string;
  userId: string;
  organizationId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
}

// ─── Screenshots ──────────────────────────────────────────────────────────────

export interface ScreenshotMetadata {
  id: string;
  taskId: string;
  sessionId: string;
  userId: string;
  capturedAt: string;       // ISO string
  monitorIndex: number;
  monitorCount: number;
  width: number;
  height: number;
  fileSize: number;
  localPath: string;
  uploadStatus: 'pending' | 'uploading' | 'uploaded' | 'failed';
  remoteUrl?: string;
  retryCount: number;
}

export interface ScreenshotUploadResult {
  screenshotId: string;
  remoteUrl: string;
  driveFileId: string;
}

// ─── Activity ─────────────────────────────────────────────────────────────────

export type ActivityStatus = 'active' | 'idle' | 'on_break' | 'offline';

export interface ActivitySnapshot {
  timestamp: number;
  status: ActivityStatus;
  idleSeconds: number;
  activeSeconds: number;
  keystrokes?: number;
  mouseEvents?: number;
}

export interface HeartbeatPayload {
  userId: string;
  sessionId: string | null;
  status: ActivityStatus;
  timerStatus: TimerStatus;
  idleSeconds: number;
  timestamp: string;
  platform: string;
  appVersion: string;
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export interface OrgOverviewReport {
  period: { from: string; to: string };
  employees: { total: number };
  tasks: { total: number; completed: number; inProgress: number; completionRate: number };
  attendance: { totalWorkHours: number; uniquePresent: number; avgWorkSeconds: number };
  projects: { total: number; active: number; completed: number };
}

export interface TimesheetReportRow {
  employeeName: string;
  email: string;
  projects: string;
  date: string;
  clockIn: string;
  clockOut: string;
  workHours: number;
  breakHours: number;
  overtimeHours: number;
  idleHours: number;
  productivity: number;
  status: string;
}

export interface TimesheetReport {
  period: 'daily' | 'weekly' | 'monthly';
  range: { from: string; to: string };
  rows: TimesheetReportRow[];
  summary: {
    workHours: number;
    breakHours: number;
    overtimeHours: number;
    idleHours: number;
    avgProductivity: number;
    entries: number;
  };
}

export interface ProductivityReport {
  period: { from: string; to: string };
  employees: Array<{
    id: string;
    name: string;
    email: string;
    workHours: number;
    breakHours: number;
    idleHours: number;
    productivityScore: number;
    presentDays: number;
  }>;
}

// ─── Sync & Socket Events ─────────────────────────────────────────────────────

export interface SyncEvent<T = unknown> {
  type: string;
  payload: T;
  timestamp: string;
}

export interface TaskAssignedEvent {
  task: Task;
}

export interface IntervalChangedEvent {
  screenshotInterval: number;
  captureMonitors: 'primary' | 'all';
}

/** Org-wide presence push, emitted on every activity heartbeat. */
export interface OrgPresenceEvent {
  userId: string;
  name?: string;
  status: string;
  timestamp: string;
}

/** Org-wide timer lifecycle push, emitted on session start/stop/pause/resume/break. */
export interface OrgTimerActivityEvent {
  userId: string;
  taskId: string;
  taskTitle?: string;
  projectId?: string;
  projectName?: string;
  status: 'running' | 'stopped' | 'paused' | 'on_break';
  timestamp: string;
}

export interface NotificationPayload {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  actions?: Array<{ label: string; action: string }>;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export type Theme = 'dark' | 'light' | 'system';
export type Language = 'en' | 'es' | 'fr' | 'de' | 'ar';

export interface UserSettings {
  theme: Theme;
  language: Language;
  launchOnStartup: boolean;
  minimizeToTray: boolean;
  showDesktopNotifications: boolean;
  notifyOnTaskAssigned: boolean;
  notifyOnDeadlineReminder: boolean;
  notifyOnScreenshotFailed: boolean;
  autoUpdate: boolean;
  deadlineReminderHours: number;
}

export const DEFAULT_SETTINGS: UserSettings = {
  theme: 'light',
  language: 'en',
  launchOnStartup: false,
  minimizeToTray: true,
  showDesktopNotifications: true,
  notifyOnTaskAssigned: true,
  notifyOnDeadlineReminder: true,
  notifyOnScreenshotFailed: true,
  autoUpdate: true,
  deadlineReminderHours: 24,
};

// ─── IPC Payloads ─────────────────────────────────────────────────────────────

export interface IpcResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface StartTimerPayload {
  taskId: string;
}

export interface UploadResult {
  queued: number;
  uploaded: number;
  failed: number;
}

// ─── Plugin System ────────────────────────────────────────────────────────────

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  capabilities: PluginCapability[];
}

export type PluginCapability =
  | 'activity_monitor'
  | 'screenshot_provider'
  | 'ai_analysis'
  | 'webcam_snapshot'
  | 'app_tracker'
  | 'website_tracker';

export interface Plugin {
  manifest: PluginManifest;
  initialize(): Promise<void>;
  dispose(): Promise<void>;
}

// ─── Display / Monitor ────────────────────────────────────────────────────────

export interface DisplayInfo {
  id: number;
  label: string;
  bounds: { x: number; y: number; width: number; height: number };
  scaleFactor: number;
  isPrimary: boolean;
}

// ─── Dashboard Analytics ──────────────────────────────────────────────────────

export interface DashboardChartData {
  date: string;
  workHours: number;
  breakHours: number;
  overtimeHours: number;
}

export interface DashboardAnalytics {
  period: 'daily' | 'weekly' | 'monthly';
  totalWorkingHours: number;
  totalBreakHours: number;
  totalOvertimeHours: number;
  totalIdleHours: number;
  clockInTime: string | null;
  clockOutTime: string | null;
  attendanceStatus: AttendanceStatus;
  realTimeStatus: LiveStatus;
  currentTask: string | null;
  productivityScore: number;
  chartData: DashboardChartData[];
}

