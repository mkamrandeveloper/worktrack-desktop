import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTimer } from '../hooks/useTimer';
import { useAuthStore } from '../store/authStore';
import { useTaskStore } from '../store/taskStore';
import { DashboardAnalytics, Project, TimelineEvent } from '@shared/types';
import { formatDuration, calcProgress, hoursToSeconds, formatDeadlineCountdown } from '../utils/formatTime';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Bell, Clock, TrendingUp, CheckCircle2, Zap, PauseCircle, Timer, 
  Play, Pause, Coffee, StopCircle, MoreHorizontal, LineChart, Calendar, 
  Plus, Globe, AlertCircle, RotateCcw, X, PlayCircle
} from 'lucide-react';
import { Card, Button, Badge } from '../components/ui/primitives';

const ICON_COLORS: { bg: string; text: string }[] = [
  { bg: 'bg-indigo-500/10', text: 'text-indigo-500' },
  { bg: 'bg-teal-500/10', text: 'text-teal-500' },
  { bg: 'bg-rose-500/10', text: 'text-rose-500' },
  { bg: 'bg-amber-500/10', text: 'text-amber-500' },
];

function formatHoursMinutes(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function fmtDeadline(d: string): string {
  const date = new Date(d);
  return d.includes('T')
    ? date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { user, organization } = useAuthStore();
  const { tasks, selectedTaskId, fetchTasks, selectTask } = useTaskStore();
  const timer = useTimer();

  useEffect(() => {
    if (timer.taskId && timer.taskId !== selectedTaskId) {
      selectTask(timer.taskId);
    }
  }, [timer.taskId]);

  const [, setCountdownTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setCountdownTick((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [todayTimeline, setTodayTimeline] = useState<TimelineEvent[]>([]);
  const [activeProjects, setActiveProjects] = useState<Project[]>([]);

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;
  const activeTaskCount = tasks.filter((t) => t.status !== 'DONE' && t.status !== 'completed').length;
  const dueTodayCount = tasks.filter((t) => {
    if (!t.deadline) return false;
    const today = new Date().toDateString();
    return new Date(t.deadline).toDateString() === today && t.status !== 'DONE' && t.status !== 'completed';
  }).length;

  useEffect(() => {
    fetchTasks();
  }, []);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const res = await window.worktrack.dashboard.getPersonalAnalytics(period);
        if (res.success && res.data) setAnalytics(res.data);
      } catch (err) {
        console.error('Failed to fetch analytics', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, [period]);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    window.worktrack.timesheets.daily({ date: today }).then((res) => {
      if (res.success && res.data?.timeline) setTodayTimeline(res.data.timeline);
    });
    window.worktrack.projects.list().then((res) => {
      if (res.success && res.data) {
        setActiveProjects(res.data.filter((p) => p.status === 'ACTIVE').slice(0, 3));
      }
    });
  }, []);

  const handleStartTask = async (taskId: string) => {
    selectTask(taskId);
    await timer.startTimer(taskId);
  };

  // ── Undo task completion ─────────────────────────────────────────────────
  const [undoTask, setUndoTask] = useState<{ id: string; title: string; projectId?: string } | null>(null);
  const undoProgress = useRef(100);
  const undoInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const [, setUndoTick] = useState(0);

  const clearUndo = () => {
    if (undoInterval.current) { clearInterval(undoInterval.current); undoInterval.current = null; }
    setUndoTask(null);
    undoProgress.current = 100;
  };

  const handleComplete = async () => {
    // Capture task before stopping (stopping marks it DONE server-side)
    const taskSnapshot = selectedTask ? { id: selectedTask.id, title: selectedTask.title, projectId: selectedTask.projectId } : null;
    await timer.stopTimer();
    if (taskSnapshot) {
      clearUndo();
      undoProgress.current = 100;
      setUndoTask(taskSnapshot);
      setUndoTick(n => n + 1);
      undoInterval.current = setInterval(() => {
        undoProgress.current = Math.max(0, undoProgress.current - 2);
        setUndoTick(n => n + 1);
        if (undoProgress.current <= 0) clearUndo();
      }, 100);
    }
  };

  const handleUndo = async () => {
    if (!undoTask) return;
    clearUndo();
    // Revert to IN_PROGRESS and restart timer so the session continues
    if (undoTask.projectId) {
      await window.worktrack.projects.updateTask(undoTask.projectId, undoTask.id, { status: 'IN_PROGRESS' });
    }
    await handleStartTask(undoTask.id);
    fetchTasks();
  };

  const myOpenTasks = tasks
    .filter((t) => t.status !== 'DONE' && t.status !== 'completed')
    .sort((a, b) => (a.deadline && b.deadline ? a.deadline.localeCompare(b.deadline) : a.deadline ? -1 : b.deadline ? 1 : 0));

  const ringTarget = hoursToSeconds(selectedTask?.estimatedHours || 8);
  const ringProgress = calcProgress(timer.elapsedSeconds, ringTarget);
  const circumference = 283;
  const ringOffset = circumference - (ringProgress / 100) * circumference;
  const timerRunning = timer.status === 'running';
  const timerOnBreak = timer.status === 'on_break';
  const timerPaused = timer.status === 'paused';
  const timerActive = timerRunning || timerOnBreak || timerPaused;
  const deadlineCountdown = selectedTask?.deadline ? formatDeadlineCountdown(selectedTask.deadline) : null;

  const chartData = analytics?.chartData ?? [];
  const maxWorkHours = Math.max(1, ...chartData.map((d) => d.workHours));
  const periodTitle = period === 'daily' ? "Today's Activity" : period === 'monthly' ? 'Monthly Trend' : 'Weekly Trend';

  const idleLabel = analytics ? formatHoursMinutes(analytics.totalIdleHours) : '—';

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 lg:p-10 space-y-8 animate-fade-in pb-24">
      {/* Header */}
      <header className="hidden md:flex justify-between items-center w-full">
        <div>
          <h2 className="text-3xl font-display font-bold tracking-tight text-foreground">Overview</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Good {getGreeting()}, <span className="text-primary font-medium">{user?.name?.split(' ')[0] ?? 'there'}</span> 👋
            {' · '}{organization?.name}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative group">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input
              placeholder="Search tasks, projects..."
              type="text"
              className="pl-10 pr-4 py-2.5 rounded-full bg-card/60 border border-border focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all outline-none text-sm w-72 shadow-sm placeholder:text-muted-foreground/70"
            />
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/notifications')}
            className="w-10 h-10 rounded-full bg-card/60 border border-border flex items-center justify-center text-muted-foreground hover:bg-card hover:text-primary transition-all shadow-sm relative"
          >
            <Bell size={18} />
            <span className="absolute top-2 right-2 w-2 h-2 bg-destructive rounded-full ring-2 ring-card" />
          </motion.button>
        </div>
      </header>

      {/* Period toggle */}
      <div className="flex bg-card/40 border border-border/60 rounded-lg p-1 w-fit backdrop-blur-sm shadow-sm">
        {(['daily', 'weekly', 'monthly'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={clsx(
              'px-5 py-2 text-sm font-semibold rounded-md capitalize transition-all duration-300',
              period === p ? 'bg-primary text-primary-foreground shadow-md' : 'text-muted-foreground hover:text-foreground hover:bg-card/80'
            )}
          >
            {p}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <Card interactive className="p-6 flex flex-col justify-between min-h-[150px]">
          <div className="flex justify-between items-start mb-4">
            <span className="font-display text-[12px] uppercase tracking-wider font-bold text-muted-foreground">Hours Worked</span>
            <span className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Clock size={18} />
            </span>
          </div>
          <div>
            <div className="text-3xl font-display font-bold text-foreground tracking-tight">{loading ? '—' : `${analytics?.totalWorkingHours ?? 0}h`}</div>
            <div className="text-sm text-primary font-medium flex items-center gap-1.5 mt-2">
              <TrendingUp size={14} />
              <span>this {{ daily: 'day', weekly: 'week', monthly: 'month' }[period]}</span>
            </div>
          </div>
        </Card>

        <Card interactive className="p-6 flex flex-col justify-between min-h-[150px]">
          <div className="flex justify-between items-start mb-4">
            <span className="font-display text-[12px] uppercase tracking-wider font-bold text-muted-foreground">Active Tasks</span>
            <span className="w-9 h-9 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
              <CheckCircle2 size={18} />
            </span>
          </div>
          <div>
            <div className="text-3xl font-display font-bold text-foreground tracking-tight">{activeTaskCount}</div>
            <div className="text-sm text-muted-foreground mt-2">{dueTodayCount} due today</div>
          </div>
        </Card>

        <Card interactive className="p-6 flex flex-col justify-between min-h-[150px]">
          <div className="flex justify-between items-start mb-4">
            <span className="font-display text-[12px] uppercase tracking-wider font-bold text-muted-foreground">Productivity</span>
            <span className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center text-primary">
              <Zap size={18} />
            </span>
          </div>
          <div>
            <div className="text-3xl font-display font-bold text-foreground tracking-tight">{loading ? '—' : `${analytics?.productivityScore ?? 0}%`}</div>
            <div className="w-full bg-muted/50 rounded-full h-1.5 mt-3 overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${analytics?.productivityScore ?? 0}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="bg-primary h-1.5 rounded-full" 
              />
            </div>
          </div>
        </Card>

        <Card interactive className="p-6 flex flex-col justify-between min-h-[150px]">
          <div className="flex justify-between items-start mb-4">
            <span className="font-display text-[12px] uppercase tracking-wider font-bold text-muted-foreground">Idle Time</span>
            <span className="w-9 h-9 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
              <PauseCircle size={18} />
            </span>
          </div>
          <div>
            <div className="text-3xl font-display font-bold text-foreground tracking-tight">{loading ? '—' : idleLabel}</div>
            <div className="text-sm text-muted-foreground mt-2">This {{ daily: 'day', weekly: 'week', monthly: 'month' }[period]}</div>
          </div>
        </Card>
      </div>

      {/* Timer + Trend Bento */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Timer Widget */}
        <Card glowing={timerActive} className="p-8 lg:col-span-2 flex flex-col md:flex-row items-center justify-center gap-10 relative overflow-hidden">
          {/* Subtle gradient blobs */}
          <div className="absolute -right-20 -top-20 w-80 h-80 bg-primary/10 rounded-full blur-3xl pointer-events-none opacity-50" />
          <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-secondary/10 rounded-full blur-3xl pointer-events-none opacity-50" />

          {/* Ring */}
          <div className="relative w-56 h-56 md:w-64 md:h-64 shrink-0 z-10">
            <svg className="w-full h-full circular-progress drop-shadow-xl" viewBox="0 0 100 100">
              <circle cx="50" cy="50" fill="none" r="45" stroke="hsl(var(--border))" strokeWidth="2.5" />
              <circle
                cx="50" cy="50" fill="none" r="45"
                stroke={timerOnBreak ? '#f59e0b' : 'hsl(var(--primary))'}
                strokeDasharray={circumference}
                strokeDashoffset={timerActive ? ringOffset : circumference}
                strokeLinecap="round" strokeWidth="3.5"
                className="transition-all duration-1000 ease-in-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
              <span className="font-display text-[11px] font-bold uppercase tracking-[0.2em] text-secondary mb-2">
                {timerOnBreak ? 'ON BREAK' : timerPaused ? 'PAUSED' : timerRunning ? 'RECORDING' : 'READY'}
              </span>
              <span className="text-4xl md:text-5xl font-mono font-bold text-foreground tracking-tight drop-shadow-sm">
                {formatDuration(timerOnBreak ? timer.breakSeconds : timer.elapsedSeconds)}
              </span>
              <span className="text-xs font-medium text-muted-foreground mt-2 max-w-full truncate px-4">
                {selectedTask?.title ?? 'No task selected'}
              </span>
            </div>
          </div>

          {/* Details & Controls */}
          <div className="flex flex-col items-center md:items-start text-center md:text-left z-10 w-full max-w-sm">
            {timerActive && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary/10 text-primary font-display text-[11px] font-bold uppercase tracking-wider mb-5">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                {timerOnBreak ? 'On Break' : timerPaused ? 'Paused' : 'Recording'}
              </div>
            )}
            <h3 className="text-2xl font-display font-bold text-foreground leading-tight mb-2">
              {selectedTask ? selectedTask.title : 'Pick a task to start tracking'}
            </h3>
            <p className="text-muted-foreground font-medium mb-4">{selectedTask?.projectName ?? 'No project selected'}</p>
            {deadlineCountdown && (
              <div
                className={clsx(
                  'inline-flex items-center gap-2 px-3 py-1.5 rounded-md font-display text-[11px] font-bold uppercase tracking-wider mb-6',
                  deadlineCountdown.isOverdue
                    ? 'bg-destructive/10 text-destructive'
                    : deadlineCountdown.isUrgent
                    ? 'bg-amber-500/10 text-amber-600'
                    : 'bg-muted/50 text-muted-foreground'
                )}
              >
                {deadlineCountdown.isOverdue ? <AlertCircle size={14} /> : <Timer size={14} />}
                {deadlineCountdown.label}
              </div>
            )}

            <div className="flex items-center gap-4 w-full justify-center md:justify-start">
              {!selectedTask ? (
                <Button size="lg" className="rounded-full px-8 shadow-premium" onClick={() => navigate('/projects')}>
                  <Play size={18} className="mr-1" /> Pick a Task
                </Button>
              ) : !timerActive ? (
                <Button size="lg" className="rounded-full px-8 shadow-premium" onClick={() => handleStartTask(selectedTask.id)}>
                  <Play size={18} className="mr-1" /> Start Timer
                </Button>
              ) : (
                <>
                  <motion.button
                    whileHover={{ scale: timerOnBreak ? 1 : 1.05 }}
                    whileTap={{ scale: timerOnBreak ? 1 : 0.95 }}
                    onClick={() => (timerRunning ? timer.pauseTimer() : timer.resumeTimer())}
                    disabled={timerOnBreak}
                    className="w-14 h-14 rounded-full bg-card/60 border border-border flex items-center justify-center text-foreground hover:bg-card hover:border-secondary hover:text-secondary hover:shadow-md transition-colors disabled:opacity-40"
                  >
                    {timerRunning ? <Pause size={24} /> : <Play size={24} />}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: timerPaused ? 1 : 1.05 }}
                    whileTap={{ scale: timerPaused ? 1 : 0.95 }}
                    onClick={() => (timerOnBreak ? timer.endBreak() : timer.startBreak())}
                    disabled={timerPaused}
                    className={clsx(
                      'w-14 h-14 rounded-full flex items-center justify-center transition-colors shadow-sm disabled:opacity-40',
                      timerOnBreak ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'bg-card/60 border border-border text-foreground hover:bg-card hover:border-amber-500 hover:text-amber-500 hover:shadow-md'
                    )}
                  >
                    {timerOnBreak ? <PlayCircle size={24} /> : <Coffee size={24} />}
                  </motion.button>
                  <Button 
                    size="lg" 
                    variant="danger" 
                    className="flex-1 rounded-full shadow-md"
                    onClick={handleComplete}
                  >
                    <StopCircle size={18} /> Complete
                  </Button>
                </>
              )}
            </div>
          </div>
        </Card>

        {/* Trend chart */}
        <Card className="p-7 flex flex-col relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-secondary opacity-50" />
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-display font-bold text-lg text-foreground">{periodTitle}</h3>
            <button className="text-muted-foreground hover:text-foreground transition-colors p-1">
              <MoreHorizontal size={20} />
            </button>
          </div>
          <div className="flex-1 relative min-h-[180px] flex items-end gap-3 pb-8">
            {chartData.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm font-medium">No activity yet.</div>
            ) : chartData.map((d, i) => {
              const heightPct = Math.max(8, Math.round((d.workHours / maxWorkHours) * 100));
              const isPeak = d.workHours === maxWorkHours && maxWorkHours > 0;
              return (
                <div key={i} className="flex-1 flex flex-col justify-end items-center gap-3 group">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${heightPct}%` }}
                    transition={{ duration: 0.8, delay: i * 0.1, ease: "easeOut" }}
                    className={clsx(
                      'w-full rounded-md transition-all relative',
                      isPeak ? 'bg-primary shadow-[0_0_20px_rgba(var(--primary),0.4)]' : 'bg-primary/20 group-hover:bg-primary/40'
                    )}
                  >
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-popover border border-border text-foreground font-mono text-[11px] px-2.5 py-1 rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20">
                      {d.workHours}h
                    </div>
                  </motion.div>
                  <span className={clsx('font-display text-[11px] font-bold uppercase tracking-wider', isPeak ? 'text-primary' : 'text-muted-foreground')}>
                    {new Date(d.date).toLocaleDateString(undefined, { weekday: 'narrow' })}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-auto border-t border-border/50 pt-5 flex items-center justify-between">
            <div>
              <div className="font-display text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Total this {{ daily: 'day', weekly: 'week', monthly: 'month' }[period]}</div>
              <div className="font-display font-bold text-xl text-foreground">{analytics?.totalWorkingHours ?? 0} hrs</div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary border border-secondary/20 shadow-inner">
              <LineChart size={24} />
            </div>
          </div>
        </Card>
      </div>

      {/* My Tasks */}
      <Card className="p-7">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-display font-bold text-lg text-foreground">My Tasks</h3>
          <Badge variant="outline" className="font-display text-[10px] uppercase tracking-wider px-3 py-1 bg-background">{myOpenTasks.length} open</Badge>
        </div>
        {myOpenTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground font-medium text-center py-10 bg-muted/20 rounded-xl border border-dashed border-border">No tasks assigned to you right now.</p>
        ) : (
          <div className="space-y-3">
            {myOpenTasks.map((t) => {
              const tracking = timerActive && timer.taskId === t.id;
              
              // Map legacy priorities to new Badge variants
              const variantMap: Record<string, any> = {
                URGENT: 'danger',
                HIGH: 'warning',
                MEDIUM: 'info',
                LOW: 'default',
              };
              const variant = variantMap[t.priority] || 'default';

              return (
                <div
                  key={t.id}
                  className={clsx(
                    "flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl border transition-all duration-300",
                    tracking ? "bg-primary/5 border-primary/30 shadow-md shadow-primary/5" : "bg-card/40 border-border hover:bg-card/80 hover:shadow-sm"
                  )}
                >
                  <div className="min-w-0">
                    <h4 className="text-base font-semibold text-foreground truncate mb-1">{t.title}</h4>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                      <span className="font-medium">{t.projectName}</span>
                      {t.deadline && (
                        <span className="flex items-center gap-1.5 opacity-80">
                          <Calendar size={14} /> {fmtDeadline(t.deadline)}
                        </span>
                      )}
                      <Badge variant={variant} className="font-display text-[10px] uppercase tracking-wider py-0.5">
                        {t.priority}
                      </Badge>
                    </div>
                  </div>
                  {tracking ? (
                    <div className="flex items-center gap-3 shrink-0 bg-background/50 p-1.5 rounded-full border border-border/50">
                      <span className="font-mono text-sm font-bold text-primary ml-3 mr-2">
                        {formatDuration(timerOnBreak ? timer.breakSeconds : timer.elapsedSeconds)}
                      </span>
                      {timerRunning && (
                        <button onClick={() => timer.pauseTimer()} className="w-10 h-10 rounded-full bg-card hover:bg-muted border border-border flex items-center justify-center transition-colors" title="Pause"><Pause size={18} /></button>
                      )}
                      {timerPaused && (
                        <button onClick={() => timer.resumeTimer()} className="w-10 h-10 rounded-full bg-primary text-primary-foreground hover:opacity-90 flex items-center justify-center transition-colors shadow-sm" title="Resume"><Play size={18} /></button>
                      )}
                      <button
                        onClick={() => (timerOnBreak ? timer.endBreak() : timer.startBreak())}
                        disabled={timerPaused}
                        className="w-10 h-10 rounded-full bg-card hover:bg-amber-500/10 hover:text-amber-500 hover:border-amber-500/30 border border-border flex items-center justify-center disabled:opacity-40 transition-colors"
                        title={timerOnBreak ? 'End break' : 'Take a break'}
                      >
                        {timerOnBreak ? <PlayCircle size={18} /> : <Coffee size={18} />}
                      </button>
                      <button onClick={handleComplete} className="w-10 h-10 rounded-full bg-card hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 border border-border flex items-center justify-center transition-colors" title="Complete task">
                        <StopCircle size={18} />
                      </button>
                    </div>
                  ) : (
                    <Button
                      variant="secondary"
                      onClick={() => handleStartTask(t.id)}
                      disabled={timerActive}
                      title={timerActive ? 'Stop the current timer first' : 'Start working'}
                      className="shrink-0 rounded-full px-5 h-10 shadow-sm"
                    >
                      <Play size={16} /> Start
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Recent Activity + Active Projects */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activities */}
        <Card className="p-7">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-display font-bold text-lg text-foreground">Recent Activities</h3>
            <button onClick={() => navigate('/timesheets')} className="font-display text-[11px] font-bold uppercase tracking-wider text-primary hover:underline">
              View All
            </button>
          </div>
          {todayTimeline.length === 0 ? (
            <p className="text-sm text-muted-foreground font-medium text-center py-10 bg-muted/20 rounded-xl border border-dashed border-border">No activity logged yet today.</p>
          ) : (
            <div className="relative border-l-2 border-border ml-3.5 flex flex-col gap-6 mt-4">
              {todayTimeline.slice(-6).reverse().map((ev, i) => (
                <div key={i} className="relative pl-7 group">
                  <span className={clsx('absolute -left-[11px] top-1.5 w-5 h-5 rounded-full border-4 ring-4 ring-card', i === 0 ? 'bg-card border-primary' : 'bg-muted border-card')} />
                  <div className="font-mono text-[11px] text-muted-foreground mb-1.5 font-medium group-hover:text-foreground transition-colors">
                    {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="bg-card/40 rounded-xl p-4 border border-border/60 group-hover:bg-card group-hover:border-border group-hover:shadow-sm transition-all duration-300">
                    <h4 className="text-sm font-semibold text-foreground">{ev.label}</h4>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Active Projects */}
        <Card className="p-7">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-display font-bold text-lg text-foreground">Active Projects</h3>
            <button
              onClick={() => navigate('/projects')}
              className="w-9 h-9 rounded-full bg-card/60 border border-border flex items-center justify-center text-muted-foreground hover:bg-card hover:text-primary transition-all shadow-sm"
            >
              <Plus size={20} />
            </button>
          </div>
          {activeProjects.length === 0 ? (
            <p className="text-sm text-muted-foreground font-medium text-center py-10 bg-muted/20 rounded-xl border border-dashed border-border">No active projects.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {activeProjects.map((p, i) => {
                const progressPct = (p.taskCount ?? 0) > 0 ? Math.round((p.actualHours / (p.estimatedHours || 1)) * 100) : 0;
                const color = ICON_COLORS[i % ICON_COLORS.length];
                return (
                  <motion.div
                    key={p.id}
                    whileHover={{ y: -2 }}
                    onClick={() => navigate(`/projects/${p.id}`)}
                    className="group flex items-center justify-between p-4 rounded-xl bg-card/40 hover:bg-card border border-transparent hover:border-border transition-all duration-300 cursor-pointer shadow-sm hover:shadow-md"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border border-current/10 shadow-inner', color.bg, color.text)}>
                        <Globe size={22} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-base font-semibold text-foreground truncate">{p.name}</h4>
                        <p className="text-sm text-muted-foreground font-medium mt-0.5">
                          {p.deadline ? `Due ${new Date(p.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : 'No deadline'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <div className="text-sm font-bold text-foreground mb-1.5">{p.actualHours}h / {p.estimatedHours}h</div>
                      <div className="w-24 bg-muted/60 rounded-full h-1.5 overflow-hidden inline-block">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(progressPct, 100)}%` }}
                          transition={{ duration: 1 }}
                          className="bg-secondary h-full rounded-full" 
                        />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
      {/* ── Undo completion toast ─────────────────────────────────────────── */}
      <AnimatePresence>
        {undoTask && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4"
          >
            <div className="relative bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
              <div
                className="absolute top-0 left-0 h-1 bg-primary rounded-full transition-none"
                style={{ width: `${undoProgress.current}%` }}
              />
              <div className="flex items-center gap-3 px-4 py-3.5">
                <CheckCircle2 size={18} className="text-secondary shrink-0" />
                <p className="flex-1 text-sm font-semibold text-foreground truncate">
                  <span className="text-muted-foreground font-medium">Completed: </span>
                  {undoTask.title}
                </p>
                <button
                  onClick={handleUndo}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/25 text-xs font-bold uppercase tracking-wider hover:bg-primary/20 transition-colors shrink-0"
                >
                  <RotateCcw size={12} /> Undo
                </button>
                <button
                  onClick={clearUndo}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
