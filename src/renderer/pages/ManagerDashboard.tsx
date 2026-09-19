import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useTaskStore } from '../store/taskStore';
import { useTimer } from '../hooks/useTimer';
import { TeamMember, Task, DashboardAnalytics, LiveStatus, OrgPresenceEvent, OrgTimerActivityEvent, LiveEmployee } from '@shared/types';
import { Badge, Card, Button } from '../components/ui/primitives';
import { formatDuration, calcProgress, hoursToSeconds, formatDeadlineCountdown } from '../utils/formatTime';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import {
  Bell, Clock, TrendingUp, Coffee, AlertTriangle, Zap, LogIn, LogOut, Camera, 
  Users, AlertCircle, Timer, Play, Pause, PlayCircle, StopCircle, CheckCircle2, 
  ListTodo, CheckCircle, Calendar, Activity, Briefcase, History, FolderOpen
} from 'lucide-react';

interface OrgSettings {
  screenshotInterval: number;
}

const PRIORITY_PILL: Record<string, string> = {
  URGENT: 'bg-destructive/10 text-destructive border-destructive/20',
  HIGH: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  MEDIUM: 'bg-secondary/10 text-secondary border-secondary/20',
  LOW: 'bg-muted text-muted-foreground border-border',
};

function fmtDeadline(d: string): string {
  const date = new Date(d);
  return d.includes('T')
    ? date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function ManagerDashboard() {
  const navigate = useNavigate();
  const { user, organization } = useAuthStore();
  const { tasks: allTasks, selectedTaskId, fetchTasks, selectTask } = useTaskStore();
  const timer = useTimer();

  useEffect(() => {
    if (timer.taskId && timer.taskId !== selectedTaskId) {
      selectTask(timer.taskId);
    }
  }, [timer.taskId]);

  // 1-second tick to drive live elapsed timers in Team Overview
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [settings] = useState<OrgSettings>({ screenshotInterval: 1 });
  const [newInterval, setNewInterval] = useState('1');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [driveConnected, setDriveConnected] = useState(false);

  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  const selectedTask = allTasks.find((t) => t.id === selectedTaskId) ?? null;

  const handleStartTask = async (taskId: string) => {
    selectTask(taskId);
    await timer.startTimer(taskId);
  };

  const myOpenTasks = allTasks.filter((t) => t.status !== 'DONE' && t.status !== 'completed');

  // ── Live Pulse (real-time) ──────────────────────────────────────────────────
  const [activeProjectsCount, setActiveProjectsCount] = useState(0);
  const [onlineStatus, setOnlineStatus] = useState<Map<string, string>>(new Map());
  const [runningTimers, setRunningTimers] = useState<Set<string>>(new Set());
  const [recentActivity, setRecentActivity] = useState<{ id: string; label: string; timestamp: string }[]>([]);
  const [liveTaskInfo, setLiveTaskInfo] = useState<Map<string, { status: string; taskTitle: string | null; projectName: string | null }>>(new Map());
  // Keyed by userId — stores clockInTime + totalWorkSeconds for elapsed timer computation
  const [liveEmployeeData, setLiveEmployeeData] = useState<Map<string, Pick<LiveEmployee, 'clockInTime' | 'totalWorkSeconds' | 'totalBreakSeconds' | 'displayStatus'>>>(new Map());

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
        const taskInfo = new Map<string, { status: string; taskTitle: string | null; projectName: string | null }>();
        const empData = new Map<string, Pick<LiveEmployee, 'clockInTime' | 'totalWorkSeconds' | 'totalBreakSeconds' | 'displayStatus'>>();
        for (const emp of r.data) {
          statusMap.set(emp.id, emp.displayStatus);
          if (emp.displayStatus === 'active' && emp.currentTask) running.add(emp.id);
          taskInfo.set(emp.id, {
            status: emp.currentTask ? emp.displayStatus : 'idle',
            taskTitle: emp.currentTask ?? null,
            projectName: emp.currentProject ?? null,
          });
          empData.set(emp.id, {
            clockInTime: emp.clockInTime,
            totalWorkSeconds: emp.totalWorkSeconds,
            totalBreakSeconds: emp.totalBreakSeconds,
            displayStatus: emp.displayStatus,
          });
        }
        setOnlineStatus(statusMap);
        setRunningTimers(running);
        setLiveTaskInfo(taskInfo);
        setLiveEmployeeData(empData);
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
      setLiveTaskInfo((prev) => {
        const next = new Map(prev);
        next.set(evt.userId, evt.status === 'stopped'
          ? { status: 'idle', taskTitle: null, projectName: null }
          : { status: evt.status, taskTitle: evt.taskTitle ?? null, projectName: evt.projectName ?? null });
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

  const ringTarget = hoursToSeconds(selectedTask?.estimatedHours || 8);
  const ringProgress = calcProgress(timer.elapsedSeconds, ringTarget);
  const circumference = 283;
  const ringOffset = circumference - (ringProgress / 100) * circumference;
  const deadlineCountdown = selectedTask?.deadline ? formatDeadlineCountdown(selectedTask.deadline) : null;
  const timerRunning = timer.status === 'running';
  const timerOnBreak = timer.status === 'on_break';
  const timerPaused = timer.status === 'paused';
  const timerActive = timerRunning || timerOnBreak || timerPaused;

  const chartData = analytics?.chartData ?? [];
  const maxWorkHours = Math.max(1, ...chartData.map((d) => d.workHours));
  const periodTitle = period === 'daily' ? "Today's Activity" : period === 'monthly' ? 'Monthly Trend' : 'Weekly Trend';

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 animate-fade-in bg-background pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 w-full">
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground tracking-tight">Overview</h2>
          <p className="text-sm font-medium text-muted-foreground mt-1">
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, <span className="text-primary font-bold">{user?.name?.split(' ')[0] ?? 'there'}</span> 👋
            {' · '}{organization?.name ?? 'Your Organization'} · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            {analytics && (
              <Badge variant={getStatusColor(analytics.realTimeStatus)} className="ml-2 uppercase tracking-wider text-[10px] font-bold">
                {analytics.realTimeStatus.replace('_', ' ')}
              </Badge>
            )}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex bg-card/60 border border-border/50 rounded-lg p-1.5 shadow-sm">
            {(['daily', 'weekly', 'monthly'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={clsx(
                  'px-5 py-2 text-sm font-bold uppercase tracking-wide rounded-md transition-all duration-300',
                  period === p ? 'bg-primary text-primary-foreground shadow-md' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                {p}
              </button>
            ))}
          </div>
          <button
            onClick={() => navigate('/notifications')}
            className="w-11 h-11 rounded-xl bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/50 hover:shadow-md transition-all relative"
          >
            <Bell size={20} />
            <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-destructive rounded-full ring-2 ring-card" />
          </button>
        </div>
      </div>

      {/* Analytics KPI Cards */}
      {analyticsLoading ? (
        <div className="h-40 flex items-center justify-center bg-card rounded-2xl border border-border">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : analytics ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
            <Card className="p-6 flex flex-col justify-between min-h-[140px]">
              <div className="flex justify-between items-start mb-4">
                <span className="font-display text-[11px] uppercase tracking-widest font-bold text-muted-foreground">Working Hours</span>
                <span className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shadow-inner"><Clock size={20} /></span>
              </div>
              <div>
                <div className="text-3xl font-display font-bold text-foreground">{analytics.totalWorkingHours}h</div>
                <div className="text-xs font-semibold text-primary flex items-center gap-1.5 mt-2"><TrendingUp size={14} /><span>this {period.replace('ly', '')}</span></div>
              </div>
            </Card>

            <Card className="p-6 flex flex-col justify-between min-h-[140px]">
              <div className="flex justify-between items-start mb-4">
                <span className="font-display text-[11px] uppercase tracking-widest font-bold text-muted-foreground">Break Time</span>
                <span className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 shadow-inner"><Coffee size={20} /></span>
              </div>
              <div className="text-3xl font-display font-bold text-foreground">{analytics.totalBreakHours}h</div>
            </Card>

            <Card className="p-6 flex flex-col justify-between min-h-[140px]">
              <div className="flex justify-between items-start mb-4">
                <span className="font-display text-[11px] uppercase tracking-widest font-bold text-muted-foreground">Overtime</span>
                <span className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center text-destructive shadow-inner"><AlertTriangle size={20} /></span>
              </div>
              <div className="text-3xl font-display font-bold text-foreground">{analytics.totalOvertimeHours}h</div>
            </Card>

            <Card className="p-6 flex flex-col justify-between min-h-[140px]">
              <div className="flex justify-between items-start mb-4">
                <span className="font-display text-[11px] uppercase tracking-widest font-bold text-muted-foreground">Productivity</span>
                <span className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-primary shadow-inner"><Zap size={20} /></span>
              </div>
              <div>
                <div className="text-3xl font-display font-bold text-foreground">{analytics.productivityScore}%</div>
                <div className="w-full bg-muted/60 rounded-full h-2 mt-3 overflow-hidden shadow-inner border border-border/50">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${analytics.productivityScore}%` }} transition={{ duration: 1 }} className="bg-primary h-2 rounded-full shadow-sm" />
                </div>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Chart */}
            <Card className="p-7 xl:col-span-2 flex flex-col min-h-[300px]">
              <h3 className="text-sm font-display font-bold uppercase tracking-wider text-muted-foreground mb-8">{periodTitle}</h3>
              <div className="flex-1 relative flex items-end gap-3 pb-4">
                {chartData.length === 0 ? (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground font-medium text-sm bg-muted/20 rounded-xl border border-dashed border-border/50">No activity data available for this period.</div>
                ) : chartData.map((d, i) => {
                  const heightPct = Math.max(4, Math.round((d.workHours / maxWorkHours) * 100));
                  const isPeak = d.workHours === maxWorkHours && maxWorkHours > 0;
                  return (
                    <div key={i} className="flex-1 flex flex-col justify-end items-center gap-3 group relative h-full">
                      <motion.div 
                        initial={{ height: 0 }}
                        animate={{ height: `${heightPct}%` }}
                        transition={{ duration: 0.5, delay: i * 0.05 }}
                        className={clsx('w-full rounded-t-lg transition-colors relative', isPeak ? 'bg-primary shadow-[0_0_20px_rgba(var(--primary),0.3)]' : 'bg-primary/20 group-hover:bg-primary/40')}
                      >
                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-card border border-border text-foreground font-mono font-bold text-[11px] px-2.5 py-1.5 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">{d.workHours}h</div>
                      </motion.div>
                      <span className={clsx('font-mono text-[11px] font-bold uppercase tracking-wider', isPeak ? 'text-primary' : 'text-muted-foreground')}>{new Date(d.date).toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Attendance & Quick Access */}
            <Card className="p-7 flex flex-col gap-8 justify-between">
              <div>
                <h3 className="font-display text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-5">Today's Attendance</h3>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-foreground font-medium text-sm">Status</span>
                  <Badge variant={analytics.attendanceStatus === 'present' ? 'success' : analytics.attendanceStatus === 'late' ? 'warning' : 'default'} className="uppercase font-bold text-[10px] px-3 py-1">
                    {analytics.attendanceStatus}
                  </Badge>
                </div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-muted-foreground font-medium text-sm flex items-center gap-2"><LogIn size={16} /> Clock In</span>
                  <span className="font-mono font-bold text-foreground">{analytics.clockInTime ? new Date(analytics.clockInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-medium text-sm flex items-center gap-2"><LogOut size={16} /> Clock Out</span>
                  <span className="font-mono font-bold text-foreground">{analytics.clockOutTime ? new Date(analytics.clockOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
                </div>
              </div>

              <div className="h-px bg-border/60 w-full" />

              <div>
                <h3 className="font-display text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-5">Manager Quick-Access</h3>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-muted-foreground font-medium text-sm flex items-center gap-2"><Camera size={16} /> Screenshots</span>
                  <span className="font-medium text-foreground text-sm bg-muted/50 px-2 py-1 rounded-md">{settings.screenshotInterval} min intv</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-medium text-sm flex items-center gap-2"><Users size={16} /> Team Size</span>
                  <span className="font-medium text-foreground text-sm bg-muted/50 px-2 py-1 rounded-md">{members.length} active</span>
                </div>
              </div>
            </Card>
          </div>
        </>
      ) : null}

      {/* Timer + Active Task */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-8 md:p-10 lg:col-span-2 flex flex-col md:flex-row items-center justify-center gap-10 relative overflow-hidden bg-gradient-to-br from-card to-card/50">
          <div className="absolute -right-32 -top-32 w-80 h-80 bg-primary/10 rounded-full blur-[80px] pointer-events-none" />
          <div className="absolute -left-32 -bottom-32 w-96 h-96 bg-secondary/10 rounded-full blur-[100px] pointer-events-none" />

          <div className="relative w-64 h-64 md:w-72 md:h-72 shrink-0 z-10 drop-shadow-xl">
            <svg className="w-full h-full rotate-[-90deg]" viewBox="0 0 100 100">
              <circle cx="50" cy="50" fill="none" r="45" stroke="hsl(var(--muted))" strokeWidth="3" />
              <circle
                cx="50" cy="50" fill="none" r="45"
                stroke={timerOnBreak ? 'hsl(var(--amber-500))' : 'hsl(var(--primary))'}
                strokeDasharray={circumference}
                strokeDashoffset={timerActive ? ringOffset : circumference}
                strokeLinecap="round" strokeWidth="4"
                className="transition-all duration-1000 ease-out shadow-sm"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="font-display font-bold text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                {timerOnBreak ? 'ON BREAK' : timerPaused ? 'PAUSED' : timerRunning ? 'CURRENT SESSION' : 'READY'}
              </span>
              <span className="text-4xl md:text-5xl font-display font-bold text-foreground tracking-tight drop-shadow-sm">
                {formatDuration(timerOnBreak ? timer.breakSeconds : timer.elapsedSeconds)}
              </span>
              <span className="text-sm font-medium text-muted-foreground mt-2 max-w-[180px] truncate">{selectedTask?.title ?? 'No task selected'}</span>
            </div>
          </div>

          <div className="flex flex-col items-center md:items-start text-center md:text-left z-10 w-full max-w-md">
            {timerActive && (
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary font-display font-bold text-[10px] uppercase tracking-widest mb-5 border border-primary/20 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(var(--primary),0.8)]" />
                {timerOnBreak ? 'On Break' : timerPaused ? 'Paused' : 'Recording'}
              </div>
            )}
            <h3 className="text-2xl font-display font-bold text-foreground mb-3 leading-tight">{selectedTask ? selectedTask.title : 'Pick a task to start tracking'}</h3>
            <p className="text-muted-foreground font-medium mb-4">{selectedTask?.projectName ?? 'No project selected'}</p>
            {deadlineCountdown && (
              <div
                className={clsx(
                  'inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md font-mono text-[11px] font-bold uppercase tracking-wider mb-6 border shadow-sm',
                  deadlineCountdown.isOverdue
                    ? 'bg-destructive/10 text-destructive border-destructive/20'
                    : deadlineCountdown.isUrgent
                    ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                    : 'bg-muted/50 text-muted-foreground border-border/50'
                )}
              >
                {deadlineCountdown.isOverdue ? <AlertCircle size={14} /> : <Timer size={14} />}
                {deadlineCountdown.label}
              </div>
            )}

            <div className="flex items-center gap-4 w-full justify-center md:justify-start">
              {!selectedTask ? (
                <Button onClick={() => navigate('/projects')} className="h-14 px-8 rounded-full shadow-premium text-base">
                  <Play size={20} className="mr-2" /> Pick a Task
                </Button>
              ) : !timerActive ? (
                <Button onClick={() => timer.startTimer(selectedTask.id)} className="h-14 px-8 rounded-full shadow-premium text-base">
                  <Play size={20} className="mr-2 fill-current" /> Start Timer
                </Button>
              ) : (
                <>
                  <Button variant="outline" size="icon" onClick={() => (timerRunning ? timer.pauseTimer() : timer.resumeTimer())} disabled={timerOnBreak} className="w-14 h-14 rounded-full shadow-sm hover:border-primary hover:text-primary">
                    {timerRunning ? <Pause size={24} className="fill-current" /> : <Play size={24} className="fill-current" />}
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => (timerOnBreak ? timer.endBreak() : timer.startBreak())} disabled={timerPaused} className={clsx('w-14 h-14 rounded-full shadow-sm transition-colors', timerOnBreak ? 'bg-amber-500/20 border-amber-500/40 text-amber-600 hover:bg-amber-500/30' : 'hover:border-amber-500/50 hover:text-amber-500')}>
                    {timerOnBreak ? <PlayCircle size={24} /> : <Coffee size={24} />}
                  </Button>
                  <Button onClick={() => timer.stopTimer()} className="flex-1 h-14 rounded-full shadow-premium text-base bg-emerald-500 hover:bg-emerald-600 border-transparent text-white">
                    <StopCircle size={20} className="mr-2" /> Complete Task
                  </Button>
                </>
              )}
            </div>
          </div>
        </Card>

        {/* Org quick stats */}
        <Card className="p-7 flex flex-col justify-center gap-6">
          <h3 className="font-display font-bold text-[11px] uppercase tracking-widest text-muted-foreground mb-2">Organization Overview</h3>
          {[
            { label: 'Team Members', value: members.length, icon: <Users size={20} />, color: 'text-primary', bg: 'bg-primary/10' },
            { label: 'Active Tasks', value: activeTasks, icon: <CheckCircle2 size={20} />, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
            { label: 'Pending Tasks', value: pendingTasks, icon: <ListTodo size={20} />, color: 'text-amber-500', bg: 'bg-amber-500/10' },
            { label: 'Completed', value: completedTasks, icon: <CheckCircle size={20} />, color: 'text-secondary', bg: 'bg-secondary/10' },
          ].map((stat) => (
            <div key={stat.label} className="flex items-center gap-4 bg-muted/30 p-3 rounded-xl border border-border/50">
              <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border shadow-sm', stat.bg, stat.color, stat.bg.replace('/10', '/20'))}>
                {stat.icon}
              </div>
              <div className="flex-1 flex items-center justify-between">
                <span className="text-sm font-semibold text-muted-foreground">{stat.label}</span>
                <span className="font-display font-bold text-xl text-foreground">{stat.value}</span>
              </div>
            </div>
          ))}
        </Card>
      </div>

      {/* My Tasks */}
      {myOpenTasks.length > 0 && (
        <Card className="p-7 overflow-visible">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-display font-bold text-foreground">My Tasks</h3>
            <Badge variant="secondary" className="font-bold">
              {myOpenTasks.length} open
            </Badge>
          </div>
          <div className="space-y-3">
            {myOpenTasks.map((t) => {
              const tracking = timerActive && timer.taskId === t.id;
              const p = PRIORITY_PILL[t.priority] ?? PRIORITY_PILL.MEDIUM;
              return (
                <div key={t.id} className={clsx("flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border transition-all shadow-sm", tracking ? 'bg-primary/5 border-primary/30 shadow-md scale-[1.01]' : 'bg-card hover:bg-muted/50 border-border')}>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-base font-semibold text-foreground truncate mb-1">{t.title}</h4>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap font-medium">
                      {t.projectName && <span className="bg-muted px-2 py-0.5 rounded-md">{t.projectName}</span>}
                      {t.deadline && (
                        <span className="flex items-center gap-1.5">
                          <Calendar size={14} /> {fmtDeadline(t.deadline)}
                        </span>
                      )}
                      <span className={clsx('px-2 py-0.5 rounded-md border font-mono font-bold text-[10px] uppercase tracking-wider', p)}>
                        {t.priority.toString().toLowerCase()}
                      </span>
                    </div>
                  </div>
                  {tracking ? (
                    <div className="flex items-center gap-3 shrink-0 bg-background p-2 rounded-xl border border-border shadow-inner">
                      <span className="font-mono text-base font-bold text-primary mr-2 ml-1">
                        {formatDuration(timerOnBreak ? timer.breakSeconds : timer.elapsedSeconds)}
                      </span>
                      {timerRunning && (
                        <button onClick={() => timer.pauseTimer()} className="w-10 h-10 rounded-lg bg-muted hover:bg-muted/70 flex items-center justify-center transition-colors" title="Pause"><Pause size={18} className="fill-current" /></button>
                      )}
                      {timerPaused && (
                        <button onClick={() => timer.resumeTimer()} className="w-10 h-10 rounded-lg bg-primary text-primary-foreground hover:opacity-90 flex items-center justify-center transition-colors shadow-sm" title="Resume"><Play size={18} className="fill-current" /></button>
                      )}
                      <button
                        onClick={() => (timerOnBreak ? timer.endBreak() : timer.startBreak())}
                        disabled={timerPaused}
                        className="w-10 h-10 rounded-lg bg-muted hover:bg-amber-500/20 hover:text-amber-600 flex items-center justify-center disabled:opacity-40 transition-colors"
                        title={timerOnBreak ? 'End break' : 'Take a break'}
                      >
                        {timerOnBreak ? <PlayCircle size={18} /> : <Coffee size={18} />}
                      </button>
                      <button onClick={() => timer.stopTimer()} className="w-10 h-10 rounded-lg bg-muted hover:bg-destructive/20 hover:text-destructive flex items-center justify-center transition-colors" title="Stop">
                        <StopCircle size={18} />
                      </button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStartTask(t.id)}
                      disabled={timerActive}
                      title={timerActive ? 'Stop the current timer first' : 'Start working'}
                      className="shrink-0 rounded-full"
                    >
                      <Play size={16} className="mr-1.5" /> Start
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Live Now */}
      <h3 className="text-2xl font-display font-bold text-foreground flex items-center gap-3 mt-10 mb-6">
        <Activity size={24} className="text-primary" /> Live Now
      </h3>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:col-span-2 gap-5">
          {[
            { label: 'Active Projects', value: activeProjectsCount, icon: <Briefcase size={24} />, color: 'text-secondary', bg: 'bg-secondary/10' },
            { label: 'Running Timers', value: runningTimers.size, icon: <PlayCircle size={24} />, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
            { label: 'Employees Online', value: onlineCount, icon: <Users size={24} />, color: 'text-primary', bg: 'bg-primary/10' },
          ].map((stat) => (
            <Card key={stat.label} className="p-6 flex flex-col items-start gap-4">
              <div className={clsx('w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm border border-border/50', stat.bg, stat.color)}>
                {stat.icon}
              </div>
              <div>
                <p className="text-4xl font-display font-bold text-foreground tracking-tight">{stat.value}</p>
                <p className="text-sm font-semibold text-muted-foreground mt-1">{stat.label}</p>
              </div>
            </Card>
          ))}
        </div>

        <Card className="p-6 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <History size={20} className="text-primary" />
            <h4 className="font-display font-bold uppercase tracking-wider text-[11px] text-muted-foreground">Recent Activity</h4>
          </div>
          {recentActivity.length === 0 ? (
            <div className="text-sm font-medium text-muted-foreground py-10 text-center flex-1 flex flex-col items-center justify-center bg-muted/20 rounded-xl border border-dashed border-border/50">
              <Activity size={24} className="opacity-50 mb-2" />
              Activity will appear here in real time.
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto max-h-48 custom-scrollbar pr-2">
              {recentActivity.map((a) => (
                <div key={a.id} className="text-sm bg-muted/30 p-3 rounded-xl border border-border/50">
                  <p className="text-foreground font-medium leading-snug">{a.label}</p>
                  <p className="text-muted-foreground font-mono text-[10px] font-bold mt-1.5">{new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Screenshot Settings + Google Drive */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-10">
        <Card className="p-7">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary"><Camera size={20} /></div>
            <h4 className="font-display font-bold text-lg text-foreground">Screenshot Settings</h4>
          </div>
          <p className="text-sm font-medium text-muted-foreground mb-6 leading-relaxed">
            Set the global interval for taking screenshots of <strong className="text-foreground">all team members</strong>. Screenshots are automatically uploaded to each member's Google Drive folder.
          </p>
          <div className="flex items-end gap-4 bg-muted/30 p-5 rounded-2xl border border-border/50">
            <div className="flex-1">
              <label className="block font-display font-bold text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Interval (minutes)</label>
              <input
                id="inp-screenshot-interval"
                type="number"
                min="1"
                max="60"
                value={newInterval}
                onChange={e => setNewInterval(e.target.value)}
                className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-base font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition shadow-sm"
              />
            </div>
            <Button
              id="btn-save-interval"
              onClick={handleSaveInterval}
              disabled={saving}
              className="px-6 py-2.5 h-[46px]"
            >
              {saving ? <Activity size={18} className="animate-spin" /> : saved ? <><CheckCircle2 size={18} className="mr-1.5" /> Saved</> : 'Save'}
            </Button>
          </div>
          <p className="text-sm font-semibold text-muted-foreground mt-4 flex items-center gap-2 px-2">
            <Clock size={16} />
            Current interval: <span className="bg-muted px-2 py-0.5 rounded text-foreground">{settings.screenshotInterval} min</span>
          </p>
        </Card>

        <Card className="p-7">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500"><FolderOpen size={20} /></div>
            <h4 className="font-display font-bold text-lg text-foreground">Google Drive</h4>
          </div>
          <p className="text-sm font-medium text-muted-foreground mb-6 leading-relaxed">
            Screenshots are automatically stored in Drive, organized into a folder per employee — connected by default, no setup needed.
          </p>
          <div className="flex items-center justify-between p-5 rounded-2xl border border-border/50 bg-muted/30 mb-6">
            <span className="font-display font-bold uppercase tracking-wider text-[11px] text-muted-foreground">Status</span>
            <div className="flex items-center gap-2 bg-card px-3 py-1.5 rounded-lg border border-border shadow-sm">
              <div className={clsx('w-2.5 h-2.5 rounded-full shadow-inner', driveConnected ? 'bg-emerald-500 shadow-emerald-500/50' : 'bg-muted-foreground')} />
              <span className="text-sm font-bold text-foreground">{driveConnected ? 'Connected' : 'Not available'}</span>
            </div>
          </div>
          <Button
            variant="outline"
            id="btn-open-drive"
            onClick={() => window.worktrack.drive.openFolder(organization?.driveFolderUrl ?? 'https://drive.google.com')}
            className="w-full py-6 text-base rounded-xl"
          >
            <FolderOpen size={18} className="mr-2" /> Open Drive
          </Button>
        </Card>
      </div>

      {/* Team Overview */}
      <Card className="p-0 overflow-hidden mt-10">
        <div className="border-b border-border px-7 py-5 flex items-center gap-3 bg-muted/20">
          <TrendingUp size={20} className="text-primary" />
          <span className="text-lg font-display font-bold text-foreground">Team Overview</span>
        </div>
        {members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-muted border border-border/50 flex items-center justify-center mb-4">
              <AlertTriangle size={32} className="text-muted-foreground" />
            </div>
            <p className="text-lg font-bold text-foreground mb-1">No active members yet</p>
            <p className="text-sm font-medium text-muted-foreground">Go to Team Management to approve join requests.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {members.map(member => {
              const memberTasks = tasks.filter(t => t.assigneeId === member.id);
              const live = liveTaskInfo.get(member.id);
              const empData = liveEmployeeData.get(member.id);
              const attendanceStatus = onlineStatus.get(member.id);
              const isOut = !attendanceStatus || attendanceStatus === 'clocked_out' || attendanceStatus === 'offline';
              const isOnBreak = live?.status === 'on_break' || attendanceStatus === 'on_break';
              const isWorking = live?.status === 'running' || attendanceStatus === 'active';
              const isPaused = live?.status === 'paused';

              // Compute live elapsed time: server-recorded seconds + delta since clock-in
              // `tick` drives 1-second re-renders so the timer updates every second
              void tick;
              let elapsedSeconds = 0;
              if (empData?.clockInTime && !isOut) {
                const serverSecs = empData.totalWorkSeconds || 0;
                const clockInMs = new Date(empData.clockInTime).getTime();
                const nowMs = Date.now();
                // Cap the live delta so it doesn't double-count if server already recorded it
                const liveExtra = Math.max(0, Math.floor((nowMs - clockInMs) / 1000) - serverSecs);
                elapsedSeconds = serverSecs + liveExtra;
              } else if (empData) {
                elapsedSeconds = empData.totalWorkSeconds || 0;
              }
              // Format as HH:MM:SS
              const hh = Math.floor(elapsedSeconds / 3600).toString().padStart(2, '0');
              const mm = Math.floor((elapsedSeconds % 3600) / 60).toString().padStart(2, '0');
              const ss = (elapsedSeconds % 60).toString().padStart(2, '0');
              const elapsedLabel = `${hh}:${mm}:${ss}`;

              const liveBadge = isWorking
                ? { cls: 'text-emerald-700 bg-emerald-500/10 border-emerald-500/30 dark:text-emerald-400', icon: <Zap size={12}/>, label: 'Working' }
                : isPaused
                ? { cls: 'text-amber-700 bg-amber-500/10 border-amber-500/30 dark:text-amber-400', icon: <Pause size={12}/>, label: 'Paused' }
                : isOnBreak
                ? { cls: 'text-amber-700 bg-amber-500/10 border-amber-500/30 dark:text-amber-400', icon: <Coffee size={12}/>, label: 'On Break' }
                : isOut
                ? { cls: 'text-muted-foreground bg-muted border-border', icon: <LogOut size={12}/>, label: 'Out' }
                : { cls: 'text-sky-700 bg-sky-500/10 border-sky-500/30 dark:text-sky-400', icon: <LogIn size={12}/>, label: 'In' };

              return (
                <div key={member.id} className="flex flex-col border-b border-border/50 last:border-0 hover:bg-card/40 transition-colors">
                  <div className="flex flex-wrap items-center gap-4 px-7 py-5">
                    {/* Avatar with pulse for active employees */}
                    <div className="relative shrink-0">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-secondary/10 border border-primary/20 flex items-center justify-center text-lg font-bold text-primary shadow-sm">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      {/* Active pulse ring */}
                      {(isWorking || isOnBreak) && (
                        <span className={clsx(
                          'absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-card flex items-center justify-center',
                          isOnBreak ? 'bg-amber-500' : 'bg-emerald-500'
                        )}>
                          {isOnBreak
                            ? <Coffee size={8} className="text-white" />
                            : <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-base font-semibold text-foreground">{member.name}</p>
                      <p className="text-sm font-medium text-muted-foreground truncate">
                        {live?.taskTitle
                          ? <span className="text-foreground">{live.taskTitle}{live.projectName ? <span className="text-muted-foreground"> · {live.projectName}</span> : ''}</span>
                          : member.email}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
                      <span className="bg-muted px-2.5 py-1 rounded-md">{memberTasks.length} task{memberTasks.length !== 1 ? 's' : ''}</span>

                      {/* ON BREAK pill — pulsing amber */}
                      {isOnBreak && (
                        <span className="flex items-center gap-1.5 border rounded-md px-3 py-1 font-bold text-[11px] uppercase tracking-wider shadow-sm animate-pulse bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400">
                          <Coffee size={12} /> On Break
                        </span>
                      )}

                      {/* Status badge */}
                      <span className={clsx('flex items-center gap-1.5 border rounded-md px-3 py-1 font-bold text-[11px] uppercase tracking-wider shadow-sm', liveBadge.cls)}>
                        {liveBadge.icon} {liveBadge.label}
                      </span>

                      {/* Live elapsed timer — shown for active or on-break employees */}
                      {(isWorking || isOnBreak || isPaused) && empData?.clockInTime && (
                        <div className={clsx(
                          'flex items-center gap-1.5 px-3 py-1 rounded-md border font-mono text-sm font-bold shadow-inner',
                          isOnBreak
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400'
                            : 'bg-primary/8 border-primary/25 text-primary'
                        )}>
                          {/* suppress tick dep lint — tick is intentionally used to force re-renders */}
                          <Clock size={13} className="shrink-0 opacity-70" />
                          <span>{elapsedLabel}</span>
                        </div>
                      )}
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => window.worktrack.drive.openFolder(member.driveFolderUrl ?? 'https://drive.google.com')}
                      className="ml-2 hover:bg-muted"
                      title="Open Drive folder"
                    >
                      <FolderOpen size={18} className="text-muted-foreground" />
                    </Button>
                  </div>

                  {memberTasks.length > 0 && (
                    <div className="px-7 pb-6 pl-[84px]">
                      <div className="bg-card border border-border/80 rounded-xl divide-y divide-border/50 shadow-sm">
                        {memberTasks.map(task => (
                          <div key={task.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-muted/30 transition-colors gap-4">
                            <div className="flex-1 min-w-0 pr-4">
                              <p className="text-sm font-semibold text-foreground truncate">{task.title}</p>
                              <p className="text-xs font-medium text-muted-foreground truncate mt-1">
                                {task.projectName ? <span className="bg-muted/80 px-1.5 py-0.5 rounded">{task.projectName}</span> : 'No project'} · {task.description || 'No description'}
                              </p>
                            </div>
                            <div className="flex items-center gap-6 shrink-0">
                              <span className={clsx(
                                'text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md shadow-sm',
                                task.status === 'IN_PROGRESS' || task.status === 'in_progress' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' :
                                task.status === 'DONE' || task.status === 'completed' ? 'bg-secondary/10 text-secondary border border-secondary/20' :
                                'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                              )}>
                                {task.status.replace('_', ' ')}
                              </span>
                              <div className="w-32 text-right">
                                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider mb-1.5">
                                  <span className="text-muted-foreground">Rem:</span>
                                  <span className="text-foreground">
                                    {(task as any).remainingHours !== undefined ? `${(task as any).remainingHours}h` : `${task.estimatedHours}h`}
                                  </span>
                                </div>
                                <div className="h-2 w-full bg-muted rounded-full overflow-hidden shadow-inner border border-border/50">
                                  <div className="h-full bg-primary rounded-full shadow-sm" style={{ width: `${(task as any).progressPercent || 0}%` }} />
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
      </Card>
    </div>
  );
}
