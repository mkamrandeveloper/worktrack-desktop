import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTimer } from '../hooks/useTimer';
import { useAuthStore } from '../store/authStore';
import { useTaskStore } from '../store/taskStore';
import { MaterialIcon } from '../components/ui/MaterialIcon';
import { DashboardAnalytics, Project, TimelineEvent } from '@shared/types';
import { formatDuration, calcProgress, hoursToSeconds } from '../utils/formatTime';
import { clsx } from 'clsx';

const ICON_COLORS: { bg: string; text: string }[] = [
  { bg: 'bg-indigo-50', text: 'text-indigo-600' },
  { bg: 'bg-teal-50', text: 'text-teal-600' },
  { bg: 'bg-rose-50', text: 'text-rose-600' },
  { bg: 'bg-amber-50', text: 'text-amber-600' },
];

function formatHoursMinutes(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

const PRIORITY_PILL: Record<string, string> = {
  URGENT: 'bg-destructive/10 text-destructive border-destructive/20',
  HIGH: 'bg-orange-100 text-orange-700 border-orange-200',
  MEDIUM: 'bg-secondary/10 text-secondary border-secondary/20',
  LOW: 'bg-muted text-muted-foreground border-border',
};

function fmtDeadline(d: string): string {
  const date = new Date(d);
  // datetime-local values carry a "T" (e.g. 2026-07-10T14:30); older
  // date-only deadlines don't — only show a time when one was actually set.
  return d.includes('T')
    ? date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { user, organization } = useAuthStore();
  const { tasks, selectedTaskId, fetchTasks, selectTask } = useTaskStore();
  const timer = useTimer();

  // Keep the ring widget pointed at whatever task actually has a running
  // timer (e.g. a session already in progress from before a restart, or one
  // just started from the My Tasks list below) rather than only tracking
  // what was picked in this render.
  useEffect(() => {
    if (timer.taskId && timer.taskId !== selectedTaskId) {
      selectTask(timer.taskId);
    }
  }, [timer.taskId]);

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

  const myOpenTasks = tasks
    .filter((t) => t.status !== 'DONE' && t.status !== 'completed')
    .sort((a, b) => (a.deadline && b.deadline ? a.deadline.localeCompare(b.deadline) : a.deadline ? -1 : b.deadline ? 1 : 0));

  // Circular progress ring — real elapsed time against the task's estimate (default 8h).
  const ringTarget = hoursToSeconds(selectedTask?.estimatedHours || 8);
  const ringProgress = calcProgress(timer.elapsedSeconds, ringTarget);
  const circumference = 283; // 2 * PI * r(45), matches the SVG radius below
  const ringOffset = circumference - (ringProgress / 100) * circumference;
  const timerRunning = timer.status === 'running';
  const timerOnBreak = timer.status === 'on_break';
  const timerPaused = timer.status === 'paused';
  const timerActive = timerRunning || timerOnBreak || timerPaused;

  const chartData = analytics?.chartData ?? [];
  const maxWorkHours = Math.max(1, ...chartData.map((d) => d.workHours));
  const periodTitle = period === 'daily' ? "Today's Activity" : period === 'monthly' ? 'Monthly Trend' : 'Weekly Trend';

  const idleLabel = analytics ? formatHoursMinutes(analytics.totalIdleHours) : '—';

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 animate-fade-in pb-24">
      {/* Header */}
      <div className="hidden md:flex justify-between items-center w-full">
        <h2 className="text-2xl font-display font-bold text-foreground">Overview</h2>
        <div className="flex items-center gap-4">
          <div className="relative">
            <MaterialIcon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              placeholder="Search tasks, projects..."
              type="text"
              className="pl-10 pr-4 py-2 rounded-xl bg-card/50 border border-border focus:border-secondary focus:ring-2 focus:ring-secondary/20 transition-all outline-none text-sm w-64 shadow-sm placeholder:text-muted-foreground"
            />
          </div>
          <button
            onClick={() => navigate('/notifications')}
            className="w-10 h-10 rounded-xl bg-card/70 border border-border flex items-center justify-center text-muted-foreground hover:bg-card/90 hover:text-primary transition-all shadow-sm relative"
          >
            <MaterialIcon name="notifications" size={20} />
            <span className="absolute top-2 right-2 w-2 h-2 bg-destructive rounded-full ring-2 ring-card" />
          </button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground -mt-4 hidden md:block">
        Good {getGreeting()}, <span className="text-primary font-medium">{user?.name?.split(' ')[0] ?? 'there'}</span> 👋
        {' · '}{organization?.name} · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
      </p>

      {/* Period toggle */}
      <div className="flex bg-card/50 border border-border rounded-lg p-1 w-fit">
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-panel rounded-xl p-4 flex flex-col justify-between min-h-[120px]">
          <div className="flex justify-between items-start mb-2">
            <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Hours Worked</span>
            <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <MaterialIcon name="schedule" size={18} />
            </span>
          </div>
          <div>
            <div className="text-2xl font-display font-bold text-foreground">{loading ? '—' : `${analytics?.totalWorkingHours ?? 0}h`}</div>
            <div className="text-sm text-primary flex items-center gap-1 mt-1">
              <MaterialIcon name="trending_up" size={14} />
              <span>this {period.replace('ly', '')}</span>
            </div>
          </div>
        </div>

        <div className="glass-panel rounded-xl p-4 flex flex-col justify-between min-h-[120px]">
          <div className="flex justify-between items-start mb-2">
            <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Active Tasks</span>
            <span className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
              <MaterialIcon name="task_alt" size={18} />
            </span>
          </div>
          <div>
            <div className="text-2xl font-display font-bold text-foreground">{activeTaskCount}</div>
            <div className="text-sm text-muted-foreground mt-1">{dueTodayCount} due today</div>
          </div>
        </div>

        <div className="glass-panel rounded-xl p-4 flex flex-col justify-between min-h-[120px]">
          <div className="flex justify-between items-start mb-2">
            <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Productivity Score</span>
            <span className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-primary">
              <MaterialIcon name="bolt" size={18} />
            </span>
          </div>
          <div>
            <div className="text-2xl font-display font-bold text-foreground">{loading ? '—' : `${analytics?.productivityScore ?? 0}%`}</div>
            <div className="w-full bg-muted rounded-full h-1.5 mt-2 overflow-hidden">
              <div className="bg-primary h-1.5 rounded-full transition-all duration-500" style={{ width: `${analytics?.productivityScore ?? 0}%` }} />
            </div>
          </div>
        </div>

        <div className="glass-panel rounded-xl p-4 flex flex-col justify-between min-h-[120px]">
          <div className="flex justify-between items-start mb-2">
            <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Idle Time</span>
            <span className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
              <MaterialIcon name="pause_circle" size={18} />
            </span>
          </div>
          <div>
            <div className="text-2xl font-display font-bold text-foreground">{loading ? '—' : idleLabel}</div>
            <div className="text-sm text-muted-foreground mt-1">This {period.replace('ly', '')}</div>
          </div>
        </div>
      </div>

      {/* Timer + Trend Bento */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Timer Widget */}
        <div className="glass-panel rounded-[2rem] p-6 md:p-8 lg:col-span-2 flex flex-col md:flex-row items-center justify-center gap-8 relative overflow-hidden">
          <div className="absolute -right-20 -top-20 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-secondary/5 rounded-full blur-3xl pointer-events-none" />

          {/* Ring */}
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

          {/* Details & Controls */}
          <div className="flex flex-col items-center md:items-start text-center md:text-left z-10 w-full max-w-sm">
            {timerActive && (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary font-mono text-[11px] uppercase tracking-widest mb-4">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                {timerOnBreak ? 'On Break' : timerPaused ? 'Paused' : 'Recording'}
              </div>
            )}
            <h3 className="text-xl font-display font-bold text-foreground mb-2">
              {selectedTask ? selectedTask.title : 'Pick a task to start tracking'}
            </h3>
            <p className="text-muted-foreground mb-6">{selectedTask?.projectName ?? 'No project selected'}</p>

            <div className="flex items-center gap-3 w-full justify-center md:justify-start">
              {!selectedTask ? (
                <button
                  onClick={() => navigate('/projects')}
                  className="h-14 px-6 rounded-full bg-primary text-primary-foreground font-semibold hover:opacity-90 hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <MaterialIcon name="play_arrow" size={20} />
                  Pick a Task
                </button>
              ) : !timerActive ? (
                <button
                  onClick={() => handleStartTask(selectedTask.id)}
                  className="h-14 px-6 rounded-full bg-primary text-primary-foreground font-semibold hover:opacity-90 hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <MaterialIcon name="play_arrow" size={20} />
                  Start Timer
                </button>
              ) : (
                <>
                  <button
                    onClick={() => (timerRunning ? timer.pauseTimer() : timer.resumeTimer())}
                    disabled={timerOnBreak}
                    className="w-14 h-14 rounded-full bg-card/40 border border-border flex items-center justify-center text-muted-foreground hover:bg-card hover:text-secondary hover:border-secondary transition-all shadow-sm disabled:opacity-40"
                  >
                    <MaterialIcon name={timerRunning ? 'pause' : 'play_arrow'} size={26} />
                  </button>
                  <button
                    onClick={() => (timerOnBreak ? timer.endBreak() : timer.startBreak())}
                    disabled={timerPaused}
                    className={clsx(
                      'w-14 h-14 rounded-full border flex items-center justify-center transition-all shadow-sm disabled:opacity-40',
                      timerOnBreak ? 'bg-amber-500/20 text-amber-600 border-amber-500/30' : 'bg-card/40 border-border text-muted-foreground hover:bg-card hover:text-amber-600 hover:border-amber-500/40'
                    )}
                  >
                    <MaterialIcon name={timerOnBreak ? 'play_circle' : 'coffee'} size={24} />
                  </button>
                  <button
                    onClick={() => timer.stopTimer()}
                    className="flex-1 h-14 rounded-full bg-primary text-primary-foreground font-semibold hover:opacity-90 hover:shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    <MaterialIcon name="stop_circle" size={20} />
                    Complete Task
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Trend chart */}
        <div className="glass-panel rounded-[2rem] p-6 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-semibold text-foreground">{periodTitle}</h3>
            <MaterialIcon name="more_horiz" size={20} className="text-muted-foreground" />
          </div>
          <div className="flex-1 relative min-h-[180px] flex items-end gap-2 pb-6">
            {chartData.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">No activity yet.</div>
            ) : chartData.map((d, i) => {
              const heightPct = Math.max(4, Math.round((d.workHours / maxWorkHours) * 100));
              const isPeak = d.workHours === maxWorkHours && maxWorkHours > 0;
              return (
                <div key={i} className="flex-1 flex flex-col justify-end items-center gap-2 group">
                  <div
                    className={clsx(
                      'w-full rounded-t-lg transition-all relative',
                      isPeak ? 'bg-primary shadow-[0_0_15px_rgba(0,104,95,0.3)]' : 'bg-primary/20 group-hover:bg-primary/40'
                    )}
                    style={{ height: `${heightPct}%` }}
                  >
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-card text-foreground font-mono text-[10px] px-2 py-1 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      {d.workHours}h
                    </div>
                  </div>
                  <span className={clsx('font-mono text-[11px]', isPeak ? 'text-primary font-bold' : 'text-muted-foreground')}>
                    {new Date(d.date).toLocaleDateString(undefined, { weekday: 'narrow' })}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-auto border-t border-border pt-4 flex items-center justify-between">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-1">Total this {period.replace('ly', '')}</div>
              <div className="font-semibold text-foreground">{analytics?.totalWorkingHours ?? 0} hrs</div>
            </div>
            <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
              <MaterialIcon name="insights" size={20} />
            </div>
          </div>
        </div>
      </div>

      {/* My Tasks — every task assigned to me, with a direct Start action */}
      <div className="glass-panel rounded-xl p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-semibold text-foreground">My Tasks</h3>
          <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{myOpenTasks.length} open</span>
        </div>
        {myOpenTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No tasks assigned to you right now.</p>
        ) : (
          <div className="space-y-2">
            {myOpenTasks.map((t) => {
              const tracking = timerActive && timer.taskId === t.id;
              const p = PRIORITY_PILL[t.priority] ?? PRIORITY_PILL.MEDIUM;
              return (
                <div
                  key={t.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-card/40 border border-border hover:bg-card/70 transition-colors"
                >
                  <div className="min-w-0">
                    <h4 className="text-sm font-medium text-foreground truncate">{t.title}</h4>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap mt-1">
                      {t.projectName && <span>{t.projectName}</span>}
                      {t.deadline && (
                        <span className="flex items-center gap-1">
                          <MaterialIcon name="calendar_today" size={12} /> {fmtDeadline(t.deadline)}
                        </span>
                      )}
                      <span className={clsx('px-2 py-0.5 rounded-full border font-mono text-[10px] uppercase', p)}>
                        {t.priority.toString().toLowerCase()}
                      </span>
                    </div>
                  </div>
                  {tracking ? (
                    <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-primary text-xs font-medium shrink-0">
                      <MaterialIcon name="play_arrow" size={16} /> Tracking
                    </span>
                  ) : (
                    <button
                      onClick={() => handleStartTask(t.id)}
                      disabled={timerActive}
                      title={timerActive ? 'Stop the current timer first' : 'Start working'}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-secondary border border-secondary/30 hover:bg-secondary/10 transition-colors text-xs font-medium disabled:opacity-40 shrink-0"
                    >
                      <MaterialIcon name="play_arrow" size={16} /> Start
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Activity + Active Projects */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activities (today's real chronological timeline) */}
        <div className="glass-panel rounded-xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-semibold text-foreground">Recent Activities</h3>
            <button onClick={() => navigate('/timesheets')} className="font-mono text-[11px] uppercase tracking-widest text-primary hover:underline">
              View All
            </button>
          </div>
          {todayTimeline.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No activity logged yet today.</p>
          ) : (
            <div className="relative border-l-2 border-border ml-3 flex flex-col gap-5">
              {todayTimeline.slice(-6).reverse().map((ev, i) => (
                <div key={i} className="relative pl-6">
                  <span className={clsx('absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 ring-4 ring-card/50', i === 0 ? 'bg-card border-primary' : 'bg-muted border-card')} />
                  <div className="font-mono text-[11px] text-muted-foreground mb-1">
                    {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="bg-card/40 rounded-lg p-3 border border-border hover:bg-card/60 transition-colors">
                    <h4 className="text-sm font-medium text-foreground">{ev.label}</h4>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active Projects */}
        <div className="glass-panel rounded-xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-semibold text-foreground">Active Projects</h3>
            <button
              onClick={() => navigate('/projects')}
              className="w-8 h-8 rounded-full bg-card/50 flex items-center justify-center text-muted-foreground hover:bg-card hover:text-primary transition-all"
            >
              <MaterialIcon name="add" size={20} />
            </button>
          </div>
          {activeProjects.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No active projects.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {activeProjects.map((p, i) => {
                const progressPct = (p.taskCount ?? 0) > 0 ? Math.round((p.actualHours / (p.estimatedHours || 1)) * 100) : 0;
                const color = ICON_COLORS[i % ICON_COLORS.length];
                return (
                  <div key={p.id}>
                    <div
                      onClick={() => navigate(`/projects/${p.id}`)}
                      className="group flex items-center justify-between p-3 rounded-xl hover:bg-card/50 border border-transparent hover:border-border transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', color.bg, color.text)}>
                          <MaterialIcon name="web" size={20} />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-medium text-foreground truncate">{p.name}</h4>
                          <p className="text-[13px] text-muted-foreground">
                            {p.deadline ? `Due ${new Date(p.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : 'No deadline'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <div className="text-sm font-semibold text-foreground">{p.actualHours}h / {p.estimatedHours}h</div>
                        <div className="w-20 bg-muted rounded-full h-1.5 mt-1 overflow-hidden inline-block">
                          <div className="bg-secondary h-1.5 rounded-full" style={{ width: `${Math.min(progressPct, 100)}%` }} />
                        </div>
                      </div>
                    </div>
                    {i < activeProjects.length - 1 && <div className="h-px w-full bg-border/60" />}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
