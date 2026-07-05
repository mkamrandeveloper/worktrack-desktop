import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useTaskStore } from '../store/taskStore';
import { useTimer } from '../hooks/useTimer';
import { TeamMember, Task, DashboardAnalytics, LiveStatus, OrgPresenceEvent, OrgTimerActivityEvent } from '@shared/types';
import { MaterialIcon } from '../components/ui/MaterialIcon';
import { Badge } from '../components/ui/primitives';
import { formatDuration, calcProgress, hoursToSeconds } from '../utils/formatTime';
import { clsx } from 'clsx';

interface OrgSettings {
  screenshotInterval: number;
}

export function ManagerDashboard() {
  const navigate = useNavigate();
  const { user, organization } = useAuthStore();
  const { tasks: allTasks, selectedTaskId, fetchTasks } = useTaskStore();
  const timer = useTimer();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [settings] = useState<OrgSettings>({ screenshotInterval: 1 });
  const [newInterval, setNewInterval] = useState('1');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [driveConnected, setDriveConnected] = useState(false);
  const [driveLoading, setDriveLoading] = useState(false);
  const [authCode, setAuthCode] = useState('');
  const [showAuthInput, setShowAuthInput] = useState(false);

  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  const selectedTask = allTasks.find((t) => t.id === selectedTaskId) ?? null;

  // ── Live Pulse (real-time) ──────────────────────────────────────────────────
  const [activeProjectsCount, setActiveProjectsCount] = useState(0);
  const [onlineStatus, setOnlineStatus] = useState<Map<string, string>>(new Map());
  const [runningTimers, setRunningTimers] = useState<Set<string>>(new Set());
  const [recentActivity, setRecentActivity] = useState<{ id: string; label: string; timestamp: string }[]>([]);

  const pushActivity = (label: string, timestamp: string) => {
    setRecentActivity((prev) => [{ id: `${timestamp}-${Math.random()}`, label, timestamp }, ...prev].slice(0, 8));
  };

  useEffect(() => {
    window.worktrack.projects.list().then((r) => {
      if (r.success && r.data) setActiveProjectsCount(r.data.filter((p) => p.status === 'ACTIVE').length);
    });
    window.worktrack.attendance.live().then((r) => {
      if (r.success && r.data) {
        const statusMap = new Map<string, string>();
        const running = new Set<string>();
        for (const emp of r.data) {
          statusMap.set(emp.id, emp.displayStatus);
          if (emp.displayStatus === 'active' && emp.currentTask) running.add(emp.id);
        }
        setOnlineStatus(statusMap);
        setRunningTimers(running);
      }
    });
  }, []);

  useEffect(() => {
    const nameFor = (userId: string) => members.find((m) => m.id === userId)?.name ?? 'Someone';

    const unsubPresence = window.worktrack.sync.onPresenceChanged((evt: OrgPresenceEvent) => {
      setOnlineStatus((prev) => {
        const prevStatus = prev.get(evt.userId);
        if (prevStatus !== evt.status) {
          pushActivity(`${evt.name || nameFor(evt.userId)} is now ${evt.status.replace('_', ' ')}`, evt.timestamp);
        }
        const next = new Map(prev);
        next.set(evt.userId, evt.status);
        return next;
      });
    });

    const unsubTimer = window.worktrack.sync.onTimerActivity((evt: OrgTimerActivityEvent) => {
      setRunningTimers((prev) => {
        const next = new Set(prev);
        if (evt.status === 'running') next.add(evt.userId);
        else next.delete(evt.userId);
        return next;
      });
      const verb = evt.status === 'running' ? 'started working on' : evt.status === 'paused' ? 'paused' : evt.status === 'on_break' ? 'took a break from' : 'stopped working on';
      pushActivity(`${nameFor(evt.userId)} ${verb} ${evt.taskTitle ?? 'a task'}${evt.projectName ? ` (${evt.projectName})` : ''}`, evt.timestamp);
    });

    return () => { unsubPresence(); unsubTimer(); };
  }, [members]);

  const onlineCount = Array.from(onlineStatus.values()).filter((s) => s !== 'offline' && s !== 'clocked_out').length;

  useEffect(() => {
    fetchTasks();
  }, []);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setAnalyticsLoading(true);
        const res = await window.worktrack.dashboard.getPersonalAnalytics(period);
        if (res.success && res.data) setAnalytics(res.data);
      } catch (err) {
        console.error('Failed to fetch analytics', err);
      } finally {
        setAnalyticsLoading(false);
      }
    };
    fetchAnalytics();
  }, [period]);

  useEffect(() => {
    window.worktrack.manager.getTeam().then(r => {
      if (r.success && r.data) setMembers(r.data.members);
    });
    window.worktrack.manager.getTasks().then(r => {
      if (r.success && r.data) setTasks(r.data);
    });
    window.worktrack.drive.isConnected().then(r => {
      if (r.success && r.data) setDriveConnected(r.data.connected);
    });
  }, []);

  const handleSaveInterval = async () => {
    setSaving(true);
    await window.worktrack.manager.updateOrgSettings({ screenshotInterval: parseInt(newInterval) || 1 });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleConnectDrive = async () => {
    setDriveLoading(true);
    const res = await window.worktrack.drive.getAuthUrl();
    setDriveLoading(false);
    if (res.success && res.data) {
      await window.worktrack.system.openExternal(res.data.url);
      setShowAuthInput(true);
    }
  };

  const handleAuthSubmit = async () => {
    if (!authCode) return;
    setDriveLoading(true);
    const res = await window.worktrack.drive.handleCallback(authCode);
    setDriveLoading(false);
    if (res.success) {
      setDriveConnected(true);
      setShowAuthInput(false);
      setAuthCode('');
    } else {
      alert(res.error || 'Failed to authenticate');
    }
  };

  const pendingTasks = tasks.filter(t => t.status === 'TODO' || t.status === 'pending').length;
  const activeTasks = tasks.filter(t => t.status === 'IN_PROGRESS' || t.status === 'in_progress').length;
  const completedTasks = tasks.filter(t => t.status === 'completed' || t.status === 'DONE').length;

  const getStatusColor = (status: LiveStatus) => {
    switch (status) {
      case 'active':
      case 'working': return 'success';
      case 'idle': return 'warning';
      case 'on_break': return 'warning';
      case 'offline': return 'default';
      case 'clocked_out': return 'default';
      case 'overtime': return 'danger';
      default: return 'default';
    }
  };

  // Timer ring (same treatment as the employee Dashboard)
  const ringTarget = hoursToSeconds(selectedTask?.estimatedHours || 8);
  const ringProgress = calcProgress(timer.elapsedSeconds, ringTarget);
  const circumference = 283;
  const ringOffset = circumference - (ringProgress / 100) * circumference;
  const timerRunning = timer.status === 'running';
  const timerOnBreak = timer.status === 'on_break';
  const timerPaused = timer.status === 'paused';
  const timerActive = timerRunning || timerOnBreak || timerPaused;

  const chartData = analytics?.chartData ?? [];
  const maxWorkHours = Math.max(1, ...chartData.map((d) => d.workHours));
  const periodTitle = period === 'daily' ? "Today's Activity" : period === 'monthly' ? 'Monthly Trend' : 'Weekly Trend';

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 animate-fade-in mesh-bg pb-24">
      {/* Header */}
      <div className="hidden md:flex justify-between items-center w-full">
        <h2 className="text-2xl font-display font-bold text-foreground">Overview</h2>
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/notifications')}
            className="w-10 h-10 rounded-xl bg-card/70 border border-border flex items-center justify-center text-muted-foreground hover:bg-card/90 hover:text-primary transition-all shadow-sm relative"
          >
            <MaterialIcon name="notifications" size={20} />
            <span className="absolute top-2 right-2 w-2 h-2 bg-destructive rounded-full ring-2 ring-card" />
          </button>
        </div>
      </div>
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, <span className="text-primary font-medium">{user?.name?.split(' ')[0] ?? 'there'}</span> 👋
          {' · '}{organization?.name ?? 'Your Organization'} · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          {analytics && (
            <Badge variant={getStatusColor(analytics.realTimeStatus)} className="ml-2 uppercase text-xs">
              {analytics.realTimeStatus.replace('_', ' ')}
            </Badge>
          )}
        </p>

        {/* Period Toggle */}
        <div className="flex bg-card/50 border border-border rounded-lg p-1">
          {(['daily', 'weekly', 'monthly'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={clsx(
                'px-4 py-1.5 text-sm font-medium rounded-md capitalize transition-all duration-200',
                period === p ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-card/80'
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Analytics KPI Cards */}
      {analyticsLoading ? (
        <div className="h-32 flex items-center justify-center glass-panel rounded-xl">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : analytics ? (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="glass-panel rounded-xl p-4 flex flex-col justify-between min-h-[120px]">
              <div className="flex justify-between items-start mb-2">
                <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Working Hours</span>
                <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary"><MaterialIcon name="schedule" size={18} /></span>
              </div>
              <div>
                <div className="text-2xl font-display font-bold text-foreground">{analytics.totalWorkingHours}h</div>
                <div className="text-sm text-primary flex items-center gap-1 mt-1"><MaterialIcon name="trending_up" size={14} /><span>this {period.replace('ly', '')}</span></div>
              </div>
            </div>
            <div className="glass-panel rounded-xl p-4 flex flex-col justify-between min-h-[120px]">
              <div className="flex justify-between items-start mb-2">
                <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Break Time</span>
                <span className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center text-secondary"><MaterialIcon name="coffee" size={18} /></span>
              </div>
              <div className="text-2xl font-display font-bold text-foreground">{analytics.totalBreakHours}h</div>
            </div>
            <div className="glass-panel rounded-xl p-4 flex flex-col justify-between min-h-[120px]">
              <div className="flex justify-between items-start mb-2">
                <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Overtime</span>
                <span className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center text-destructive"><MaterialIcon name="warning" size={18} /></span>
              </div>
              <div className="text-2xl font-display font-bold text-foreground">{analytics.totalOvertimeHours}h</div>
            </div>
            <div className="glass-panel rounded-xl p-4 flex flex-col justify-between min-h-[120px]">
              <div className="flex justify-between items-start mb-2">
                <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Productivity</span>
                <span className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-primary"><MaterialIcon name="bolt" size={18} /></span>
              </div>
              <div>
                <div className="text-2xl font-display font-bold text-foreground">{analytics.productivityScore}%</div>
                <div className="w-full bg-muted rounded-full h-1.5 mt-2 overflow-hidden">
                  <div className="bg-primary h-1.5 rounded-full transition-all duration-500" style={{ width: `${analytics.productivityScore}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Chart */}
            <div className="glass-panel rounded-[2rem] p-6 xl:col-span-2 flex flex-col">
              <h3 className="font-semibold text-foreground mb-6">{periodTitle}</h3>
              <div className="flex-1 relative min-h-[180px] flex items-end gap-2 pb-6">
                {chartData.length === 0 ? (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">No activity data available for this period.</div>
                ) : chartData.map((d, i) => {
                  const heightPct = Math.max(4, Math.round((d.workHours / maxWorkHours) * 100));
                  const isPeak = d.workHours === maxWorkHours && maxWorkHours > 0;
                  return (
                    <div key={i} className="flex-1 flex flex-col justify-end items-center gap-2 group">
                      <div className={clsx('w-full rounded-t-lg transition-all relative', isPeak ? 'bg-primary shadow-[0_0_15px_rgba(0,104,95,0.3)]' : 'bg-primary/20 group-hover:bg-primary/40')} style={{ height: `${heightPct}%` }}>
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-card text-foreground font-mono text-[10px] px-2 py-1 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{d.workHours}h</div>
                      </div>
                      <span className={clsx('font-mono text-[11px]', isPeak ? 'text-primary font-bold' : 'text-muted-foreground')}>{new Date(d.date).toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Attendance & Quick Access */}
            <div className="glass-panel rounded-[2rem] p-6 flex flex-col gap-6">
              <div>
                <h3 className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-4">Today's Attendance</h3>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-muted-foreground text-sm">Status</span>
                  <span className={clsx('px-2.5 py-1 rounded-full text-xs font-medium capitalize', analytics.attendanceStatus === 'present' ? 'bg-emerald-100 text-emerald-700' : analytics.attendanceStatus === 'late' ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground')}>
                    {analytics.attendanceStatus}
                  </span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-muted-foreground text-sm flex items-center gap-2"><MaterialIcon name="login" size={16} /> Clock In</span>
                  <span className="font-medium text-sm">{analytics.clockInTime ? new Date(analytics.clockInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm flex items-center gap-2"><MaterialIcon name="logout" size={16} /> Clock Out</span>
                  <span className="font-medium text-sm">{analytics.clockOutTime ? new Date(analytics.clockOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
                </div>
              </div>

              <div className="h-px bg-border w-full" />

              <div>
                <h3 className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-4">Manager Quick-Access</h3>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-muted-foreground text-sm flex items-center gap-2"><MaterialIcon name="photo_camera" size={16} /> Screenshots</span>
                  <span className="font-medium text-sm">{settings.screenshotInterval} min interval</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm flex items-center gap-2"><MaterialIcon name="groups" size={16} /> Team Size</span>
                  <span className="font-medium text-sm">{members.length} active</span>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {/* Timer + Active Task */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-panel rounded-[2rem] p-6 md:p-8 lg:col-span-2 flex flex-col md:flex-row items-center justify-center gap-8 relative overflow-hidden">
          <div className="absolute -right-20 -top-20 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-secondary/5 rounded-full blur-3xl pointer-events-none" />

          <div className="relative w-56 h-56 md:w-64 md:h-64 shrink-0 z-10">
            <svg className="w-full h-full circular-progress" viewBox="0 0 100 100">
              <circle cx="50" cy="50" fill="none" r="45" stroke="hsl(var(--border))" strokeWidth="4" />
              <circle
                cx="50" cy="50" fill="none" r="45"
                stroke={timerOnBreak ? '#f59e0b' : 'hsl(var(--primary))'}
                strokeDasharray={circumference}
                strokeDashoffset={timerActive ? ringOffset : circumference}
                strokeLinecap="round" strokeWidth="4"
                className="transition-all duration-1000 ease-in-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="font-mono text-[11px] uppercase tracking-widest text-secondary mb-1">
                {timerOnBreak ? 'ON BREAK' : timerPaused ? 'PAUSED' : timerRunning ? 'CURRENT SESSION' : 'READY'}
              </span>
              <span className="text-3xl md:text-4xl font-display font-bold text-foreground tracking-tight">
                {formatDuration(timerOnBreak ? timer.breakSeconds : timer.elapsedSeconds)}
              </span>
              <span className="text-sm text-muted-foreground mt-1">{selectedTask?.title ?? 'No task selected'}</span>
            </div>
          </div>

          <div className="flex flex-col items-center md:items-start text-center md:text-left z-10 w-full max-w-sm">
            {timerActive && (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary font-mono text-[11px] uppercase tracking-widest mb-4">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                {timerOnBreak ? 'On Break' : timerPaused ? 'Paused' : 'Recording'}
              </div>
            )}
            <h3 className="text-xl font-display font-bold text-foreground mb-2">{selectedTask ? selectedTask.title : 'Pick a task to start tracking'}</h3>
            <p className="text-muted-foreground mb-6">{selectedTask?.projectName ?? 'No project selected'}</p>

            <div className="flex items-center gap-3 w-full justify-center md:justify-start">
              {!selectedTask ? (
                <button onClick={() => navigate('/projects')} className="h-14 px-6 rounded-full bg-primary text-primary-foreground font-semibold hover:opacity-90 hover:shadow-lg transition-all flex items-center justify-center gap-2">
                  <MaterialIcon name="play_arrow" size={20} /> Pick a Task
                </button>
              ) : !timerActive ? (
                <button onClick={() => timer.startTimer(selectedTask.id)} className="h-14 px-6 rounded-full bg-primary text-primary-foreground font-semibold hover:opacity-90 hover:shadow-lg transition-all flex items-center justify-center gap-2">
                  <MaterialIcon name="play_arrow" size={20} /> Start Timer
                </button>
              ) : (
                <>
                  <button onClick={() => (timerRunning ? timer.pauseTimer() : timer.resumeTimer())} disabled={timerOnBreak} className="w-14 h-14 rounded-full bg-card/40 border border-border flex items-center justify-center text-muted-foreground hover:bg-card hover:text-secondary hover:border-secondary transition-all shadow-sm disabled:opacity-40">
                    <MaterialIcon name={timerRunning ? 'pause' : 'play_arrow'} size={26} />
                  </button>
                  <button onClick={() => (timerOnBreak ? timer.endBreak() : timer.startBreak())} disabled={timerPaused} className={clsx('w-14 h-14 rounded-full border flex items-center justify-center transition-all shadow-sm disabled:opacity-40', timerOnBreak ? 'bg-amber-500/20 text-amber-600 border-amber-500/30' : 'bg-card/40 border-border text-muted-foreground hover:bg-card hover:text-amber-600 hover:border-amber-500/40')}>
                    <MaterialIcon name={timerOnBreak ? 'play_circle' : 'coffee'} size={24} />
                  </button>
                  <button onClick={() => timer.stopTimer()} className="flex-1 h-14 rounded-full bg-primary text-primary-foreground font-semibold hover:opacity-90 hover:shadow-lg transition-all flex items-center justify-center gap-2">
                    <MaterialIcon name="stop_circle" size={20} /> Complete Task
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Org quick stats */}
        <div className="glass-panel rounded-[2rem] p-6 flex flex-col gap-4">
          <h3 className="font-semibold text-foreground mb-2">Organization Overview</h3>
          {[
            { label: 'Team Members', value: members.length, icon: 'groups', color: 'text-secondary', bg: 'bg-secondary/10' },
            { label: 'Active Tasks', value: activeTasks, icon: 'task_alt', color: 'text-emerald-600', bg: 'bg-emerald-100' },
            { label: 'Pending Tasks', value: pendingTasks, icon: 'checklist', color: 'text-amber-600', bg: 'bg-amber-100' },
            { label: 'Completed', value: completedTasks, icon: 'check_circle', color: 'text-primary', bg: 'bg-primary/10' },
          ].map((stat) => (
            <div key={stat.label} className="flex items-center gap-3">
              <div className={clsx('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', stat.bg, stat.color)}>
                <MaterialIcon name={stat.icon} size={18} />
              </div>
              <div className="flex-1 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{stat.label}</span>
                <span className="font-display font-bold text-foreground">{stat.value}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Live Now */}
      <h3 className="text-xl font-display font-bold text-foreground flex items-center gap-2">
        <MaterialIcon name="sensors" size={18} className="text-primary" /> Live Now
      </h3>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="grid grid-cols-3 lg:col-span-2 gap-4">
          {[
            { label: 'Active Projects', value: activeProjectsCount, icon: 'work_outline', color: 'text-secondary', bg: 'bg-secondary/10' },
            { label: 'Running Timers', value: runningTimers.size, icon: 'play_circle', color: 'text-emerald-600', bg: 'bg-emerald-100' },
            { label: 'Employees Online', value: onlineCount, icon: 'groups', color: 'text-primary', bg: 'bg-primary/10' },
          ].map((stat) => (
            <div key={stat.label} className="glass-panel rounded-2xl p-4 flex flex-col items-start gap-3">
              <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center', stat.bg, stat.color)}>
                <MaterialIcon name={stat.icon} size={20} />
              </div>
              <div>
                <p className="text-2xl font-display font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="glass-panel rounded-2xl p-4 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <MaterialIcon name="history" size={18} className="text-primary" />
            <h4 className="font-semibold text-foreground text-sm">Recent Activity</h4>
          </div>
          {recentActivity.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center flex-1 flex items-center justify-center">Activity will appear here in real time.</p>
          ) : (
            <div className="space-y-2.5 overflow-y-auto max-h-40 custom-scrollbar">
              {recentActivity.map((a) => (
                <div key={a.id} className="text-xs">
                  <p className="text-foreground/90 leading-snug">{a.label}</p>
                  <p className="text-muted-foreground text-[10px] mt-0.5">{new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Screenshot Settings + Google Drive */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="glass-panel rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <MaterialIcon name="photo_camera" size={18} className="text-primary" />
            <h4 className="font-semibold text-foreground text-sm">Screenshot Settings</h4>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Set the global interval for taking screenshots of <strong>all team members</strong>. Screenshots are automatically uploaded to each member's Google Drive folder.
          </p>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Interval (minutes)</label>
              <input
                id="inp-screenshot-interval"
                type="number"
                min="1"
                max="60"
                value={newInterval}
                onChange={e => setNewInterval(e.target.value)}
                className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
              />
            </div>
            <button
              id="btn-save-interval"
              onClick={handleSaveInterval}
              disabled={saving}
              className="mt-5 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition disabled:opacity-60"
            >
              {saving ? '...' : saved ? '✓ Saved' : 'Save'}
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
            <MaterialIcon name="schedule" size={14} />
            Current: every <strong className="text-foreground mx-1">{settings.screenshotInterval}</strong> minute(s)
          </p>
        </div>

        <div className="glass-panel rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <MaterialIcon name="folder_open" size={18} className="text-primary" />
            <h4 className="font-semibold text-foreground text-sm">Google Drive</h4>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Connect Google Drive to automatically store screenshots organized in per-employee folders.
          </p>
          <div className="flex items-center gap-3 mb-4">
            <div className={clsx('w-2.5 h-2.5 rounded-full', driveConnected ? 'bg-emerald-500' : 'bg-muted-foreground')} />
            <span className="text-sm text-foreground">{driveConnected ? 'Connected' : 'Not Connected'}</span>
          </div>
          <div className="flex gap-2">
            <button
              id="btn-connect-drive"
              onClick={handleConnectDrive}
              disabled={driveLoading || driveConnected}
              className="flex-1 py-2.5 text-sm font-semibold bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition disabled:opacity-60"
            >
              {driveLoading ? 'Opening...' : driveConnected ? 'Connected' : 'Connect Google Drive'}
            </button>
            <button
              id="btn-open-drive"
              onClick={() => window.worktrack.drive.openFolder('https://drive.google.com')}
              className="px-4 py-2.5 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition"
            >
              Open Drive
            </button>
          </div>

          {showAuthInput && !driveConnected && (
            <div className="mt-4 p-4 bg-muted/50 rounded-xl border border-border animate-fade-in">
              <label className="block text-xs font-medium text-muted-foreground mb-2">Paste the Authorization Code here:</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={authCode}
                  onChange={e => setAuthCode(e.target.value)}
                  placeholder="4/1AdkVLP..."
                  className="flex-1 bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition font-mono"
                />
                <button
                  onClick={handleAuthSubmit}
                  disabled={driveLoading || !authCode}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition disabled:opacity-60"
                >
                  {driveLoading ? '...' : 'Submit'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Team Overview */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="border-b border-border px-5 py-3 flex items-center gap-2">
          <MaterialIcon name="trending_up" size={18} className="text-primary" />
          <span className="text-sm font-semibold text-foreground">Team Overview</span>
        </div>
        {members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center px-6">
            <MaterialIcon name="warning" size={32} className="text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">No active members yet</p>
            <p className="text-xs text-muted-foreground">Go to Team Management to approve join requests.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {members.map(member => {
              const memberTasks = tasks.filter(t => t.assigneeId === member.id);
              const activeMemberTask = memberTasks.find(t => t.status === 'IN_PROGRESS' || t.status === 'in_progress');
              return (
                <div key={member.id} className="flex flex-col border-b border-border last:border-0 hover:bg-card/40 transition">
                  <div className="flex items-center gap-4 px-5 py-4">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/30 to-secondary/20 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{member.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{memberTasks.length} task{memberTasks.length !== 1 ? 's' : ''}</span>
                      {activeMemberTask ? (
                        <span className="flex items-center gap-1 text-emerald-700 bg-emerald-100 border border-emerald-200 rounded-full px-2 py-0.5">
                          <MaterialIcon name="bolt" size={12} /> Working
                        </span>
                      ) : (
                        <span className="text-muted-foreground bg-muted border border-border rounded-full px-2 py-0.5">Idle</span>
                      )}
                    </div>
                    <button
                      onClick={() => window.worktrack.drive.openFolder(member.driveFolderUrl ?? 'https://drive.google.com')}
                      className="p-1.5 hover:bg-muted rounded-lg transition"
                      title="Open Drive folder"
                    >
                      <MaterialIcon name="folder_open" size={16} className="text-muted-foreground hover:text-foreground transition" />
                    </button>
                  </div>

                  {memberTasks.length > 0 && (
                    <div className="px-5 pb-4 pl-[68px]">
                      <div className="bg-card/60 border border-border rounded-xl divide-y divide-border">
                        {memberTasks.map(task => (
                          <div key={task.id} className="p-3 flex items-center justify-between hover:bg-card/80 transition">
                            <div className="flex-1 min-w-0 pr-4">
                              <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                              <p className="text-xs text-muted-foreground truncate">{task.description || 'No description'}</p>
                            </div>
                            <div className="flex items-center gap-6">
                              <span className={clsx(
                                'text-xs px-2 py-1 rounded-full font-medium',
                                task.status === 'IN_PROGRESS' || task.status === 'in_progress' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                                task.status === 'DONE' || task.status === 'completed' ? 'bg-secondary/10 text-secondary border border-secondary/20' :
                                'bg-amber-100 text-amber-700 border border-amber-200'
                              )}>
                                {task.status.replace('_', ' ')}
                              </span>
                              <div className="w-32 text-right">
                                <div className="flex items-center justify-between text-xs mb-1">
                                  <span className="text-muted-foreground">Remaining:</span>
                                  <span className="font-medium text-foreground">
                                    {(task as any).remainingHours !== undefined ? `${(task as any).remainingHours}h` : `${task.estimatedHours}h`}
                                  </span>
                                </div>
                                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                  <div className="h-full bg-primary rounded-full" style={{ width: `${(task as any).progressPercent || 0}%` }} />
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
