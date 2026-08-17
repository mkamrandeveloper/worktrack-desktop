import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, X, ChevronLeft, Plus, Pause, Play, Coffee, StopCircle, CheckCircle2, Circle, Calendar, Users, Edit3, Image as ImageIcon, Briefcase, Activity, Clock } from 'lucide-react';
import { Project, Task, TeamMember, ProjectMember, ScreenshotRecord } from '@shared/types';
import { useAuthStore } from '../store/authStore';
import { useTimerStore } from '../store/timerStore';
import { ScreenshotImage } from '../components/ScreenshotImage';
import { Badge, Button, Card } from '../components/ui/primitives';
import { formatDuration } from '../utils/formatTime';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

type FullProject = Project & { members: ProjectMember[]; tasks: Task[] };

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info' | 'secondary'> = {
  ACTIVE: 'success',
  COMPLETED: 'secondary',
  ON_HOLD: 'warning',
  CANCELLED: 'danger',
  ARCHIVED: 'default',
};

function priorityPill(priority: string) {
  const p = priority.toLowerCase();
  if (p === 'urgent' || p === 'critical') return { cls: 'text-destructive border-destructive bg-destructive/10', icon: 'warning' };
  if (p === 'high') return { cls: 'text-orange-500 border-orange-500 bg-orange-500/10', icon: null };
  if (p === 'medium') return { cls: 'text-secondary border-secondary bg-secondary/10', icon: null };
  return { cls: 'text-muted-foreground border-border bg-muted', icon: null };
}

const fmtDate = (d?: string) => {
  if (!d) return '—';
  const date = new Date(d);
  return d.includes('T')
    ? date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const isDone = (s: string) => s === 'DONE' || s === 'completed';

const initials = (name: string) => name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

export function ProjectDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user, isManagerOrAbove } = useAuthStore();
  const timer = useTimerStore();

  const [project, setProject] = useState<FullProject | null>(null);
  const [screenshots, setScreenshots] = useState<ScreenshotRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddTask, setShowAddTask] = useState(false);

  const load = useCallback(async () => {
    const [detail, shots] = await Promise.all([
      window.worktrack.projects.get(id),
      window.worktrack.clients.projectScreenshots(id),
    ]);
    if (detail.success && detail.data) setProject(detail.data as unknown as FullProject);
    if (shots.success && Array.isArray(shots.data)) setScreenshots(shots.data as ScreenshotRecord[]);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const refreshTasks = async () => {
    const res = await window.worktrack.projects.getTasks(id);
    if (res.success && res.data) setProject((p) => (p ? { ...p, tasks: res.data as Task[] } : p));
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-background h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-sm font-medium text-muted-foreground animate-pulse">Loading project details...</p>
      </div>
    );
  }
  if (!project) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-background">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center border border-border">
          <Briefcase className="w-8 h-8 text-muted-foreground/50" />
        </div>
        <p className="text-muted-foreground font-medium">Project not found or access denied.</p>
        <Button variant="outline" onClick={() => navigate('/projects')}>
          <ChevronLeft className="w-4 h-4 mr-2" /> Back to Projects
        </Button>
      </div>
    );
  }

  const tasks = project.tasks ?? [];
  const done = tasks.filter((t) => isDone(t.status)).length;
  const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const canManage = isManagerOrAbove();
  const priority = priorityPill(project.priority);

  const timerActive = timer.status !== 'idle' && timer.status !== 'stopped';

  const startTask = async (taskId: string) => { await timer.startTimer(taskId); };
  const setTaskStatus = async (taskId: string, status: string) => {
    const res = await window.worktrack.projects.updateTask(id, taskId, { status });
    if (res.success) refreshTasks();
  };

  const recentActivity = [...screenshots]
    .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())
    .slice(0, 5);

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 bg-background pb-24 animate-fade-in relative">
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      
      <button onClick={() => navigate('/projects')} className="flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors relative z-10">
        <ChevronLeft size={16} /> Back to Projects
      </button>

      {/* Header */}
      <div className="relative z-10 flex flex-col xl:flex-row xl:items-start justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-sm">
              <Briefcase size={24} className="text-primary" />
            </div>
            <h2 className="text-3xl font-display font-bold text-foreground">{project.name}</h2>
            <Badge variant={STATUS_VARIANT[project.status] ?? 'default'} className="uppercase font-bold tracking-widest text-[10px] ml-2">
              {project.status.replace('_', ' ')}
            </Badge>
            <Badge variant="outline" className={clsx("uppercase font-bold tracking-widest text-[10px] border-border", priority.cls)}>
              {project.priority}
            </Badge>
          </div>
          {(project.clientName || project.clientEmail) && (
            <p className="text-muted-foreground font-medium flex items-center gap-2 text-sm bg-muted/30 px-3 py-1.5 rounded-lg border border-border inline-flex mt-2">
              <Users size={16} className="text-muted-foreground/70" />
              Client: <strong className="text-foreground">{project.clientName || project.clientEmail}</strong>
            </p>
          )}
        </div>
        
        <div className="flex gap-3 shrink-0">
          <Button variant="outline" className="h-11 px-4 rounded-xl shadow-sm hover:border-primary/50 text-foreground font-semibold">
            <Edit3 size={18} className="mr-2 text-muted-foreground" /> Edit
          </Button>
          {canManage && (
            <Button onClick={() => setShowAddTask(true)} className="h-11 px-5 rounded-xl shadow-premium text-sm">
              <Plus size={18} className="mr-2" /> New Task
            </Button>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 relative z-10">
        <Card className="p-6 bg-card hover:border-primary/30 transition-colors">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-display text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Completion</h3>
            <span className="text-3xl font-display font-bold text-primary">{progress}%</span>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden shadow-inner border border-border/50">
            <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 1 }} className="h-full bg-primary rounded-full shadow-sm" />
          </div>
          <p className="text-xs font-medium text-muted-foreground mt-3 text-right">{done} of {tasks.length} tasks done</p>
        </Card>

        <Card className="p-6 flex flex-col justify-center">
          <h3 className="font-display text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-4">Timeline</h3>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Started</p>
              <p className="text-sm font-semibold text-foreground bg-muted/40 px-2.5 py-1.5 rounded-md inline-block border border-border/50">{fmtDate(project.startDate)}</p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Due Date</p>
              <p className="text-sm font-semibold text-foreground bg-muted/40 px-2.5 py-1.5 rounded-md inline-block border border-border/50">{fmtDate(project.deadline)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 flex flex-col justify-center">
          <h3 className="font-display text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-4">Time Tracking</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-display font-bold text-foreground">{project.actualHours}h</p>
              <p className="text-xs font-medium text-muted-foreground">Logged total</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shadow-inner text-primary">
              <Clock size={20} />
            </div>
          </div>
        </Card>
      </div>

      {/* Active timer bar */}
      <AnimatePresence>
        {timerActive && (
          <motion.div initial={{ opacity: 0, y: -20, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, y: -20, height: 0 }}>
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-5 shadow-sm relative overflow-hidden group mt-4">
              <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-primary group-hover:w-2 transition-all" />
              <span className="w-3 h-3 rounded-full bg-primary animate-pulse shrink-0 ml-2 shadow-[0_0_10px_rgba(var(--primary),0.8)]" />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-display font-bold uppercase tracking-widest text-primary mb-1">
                  {timer.status === 'on_break' ? 'ON BREAK' : timer.status === 'paused' ? 'PAUSED' : 'CURRENTLY TRACKING'}
                </div>
                <div className="text-base font-bold text-foreground truncate">
                  {tasks.find((t) => t.id === timer.taskId)?.title ?? 'Active task'}
                </div>
              </div>
              <div className="text-3xl font-mono font-bold text-primary tracking-tight">
                {formatDuration(timer.status === 'on_break' ? timer.breakSeconds : timer.elapsedSeconds)}
              </div>
              <div className="flex items-center gap-2 bg-background p-1.5 rounded-xl border border-border shadow-sm">
                {timer.status === 'running' && (
                  <button onClick={() => timer.pauseTimer()} className="w-10 h-10 rounded-lg hover:bg-muted flex items-center justify-center transition-colors" title="Pause"><Pause size={18} className="fill-current" /></button>
                )}
                {timer.status === 'paused' && (
                  <button onClick={() => timer.resumeTimer()} className="w-10 h-10 rounded-lg bg-primary text-primary-foreground hover:opacity-90 flex items-center justify-center transition-colors shadow-sm" title="Resume"><Play size={18} className="fill-current" /></button>
                )}
                <button
                  onClick={() => (timer.status === 'on_break' ? timer.endBreak() : timer.startBreak())}
                  disabled={timer.status !== 'running' && timer.status !== 'on_break'}
                  className="w-10 h-10 rounded-lg hover:bg-amber-500/10 hover:text-amber-500 flex items-center justify-center disabled:opacity-40 transition-colors"
                  title={timer.status === 'on_break' ? 'End break' : 'Break'}
                >
                  {timer.status === 'on_break' ? <Play size={18} /> : <Coffee size={18} />}
                </button>
                <button onClick={() => timer.stopTimer()} className="w-10 h-10 rounded-lg hover:bg-destructive/10 hover:text-destructive flex items-center justify-center transition-colors" title="Stop">
                  <StopCircle size={18} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 relative z-10">
        
        {/* Left Column: Description & Tasks */}
        <div className="xl:col-span-2 space-y-8">
          
          {project.description && (
            <Card className="p-7">
              <h3 className="font-display text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-4">Project Overview</h3>
              <p className="text-[15px] font-medium text-foreground/90 leading-relaxed">{project.description}</p>
            </Card>
          )}

          <Card className="p-7">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-display font-bold text-foreground">Tasks</h3>
              <Badge variant="secondary" className="font-bold">{tasks.length} total</Badge>
            </div>

            {tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 bg-muted/20 rounded-xl border border-dashed border-border/60">
                <CheckCircle2 size={32} className="text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No tasks created yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tasks.map((t) => {
                  const tracking = timerActive && timer.taskId === t.id;
                  const mineOrManager = canManage || t.assigneeId === user?.id;
                  const done_ = isDone(t.status);
                  const p = priorityPill(t.priority);
                  return (
                    <motion.div
                      layout
                      key={t.id}
                      className={clsx(
                        'group flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border transition-all duration-300 gap-4 relative overflow-hidden',
                        done_ ? 'bg-muted/30 border-border/50 opacity-70 grayscale-[0.5]' : tracking ? 'bg-primary/5 border-primary/30 shadow-md scale-[1.01]' : 'bg-card border-border hover:border-primary/40 hover:shadow-sm'
                      )}
                    >
                      <div className={clsx('absolute left-0 top-0 bottom-0 w-1.5 transition-colors', done_ ? 'bg-secondary/50' : tracking ? 'bg-primary' : 'bg-transparent group-hover:bg-primary/20')} />
                      
                      <div className="flex items-start gap-4">
                        <button
                          onClick={() => !done_ && mineOrManager && setTaskStatus(t.id, 'DONE')}
                          disabled={done_ || !mineOrManager}
                          className={clsx('mt-1 transition-colors', done_ ? 'text-secondary' : 'text-muted-foreground hover:text-primary')}
                        >
                          {done_ ? <CheckCircle2 size={22} className="fill-current text-white" /> : <Circle size={22} />}
                        </button>
                        
                        <div>
                          <h4 className={clsx('text-base font-semibold text-foreground mb-1.5 transition-colors', done_ && 'line-through text-muted-foreground')}>{t.title}</h4>
                          <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground flex-wrap">
                            {t.deadline && (
                              <span className="flex items-center gap-1 bg-muted px-2 py-0.5 rounded-md text-foreground">
                                <Calendar size={12} /> {fmtDate(t.deadline)}
                              </span>
                            )}
                            <span className={clsx('px-2 py-0.5 rounded-md border font-mono text-[10px] uppercase font-bold tracking-wider', p.cls)}>{t.priority.toString().toLowerCase()}</span>
                            {t.assigneeName && <span className="bg-muted/50 px-2 py-0.5 rounded-md">{t.assigneeName}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 sm:ml-auto shrink-0 bg-background/50 p-2 rounded-xl border border-border/50">
                        {t.assigneeName && (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 border border-border/50 flex items-center justify-center text-[10px] font-bold text-foreground shadow-inner shrink-0">
                            {initials(t.assigneeName)}
                          </div>
                        )}
                        
                        {done_ ? (
                          <Badge variant="secondary" className="px-3 py-1 font-bold uppercase tracking-wider text-[10px]">Completed</Badge>
                        ) : canManage ? (
                          <select
                            value={t.status}
                            onChange={(e) => setTaskStatus(t.id, e.target.value)}
                            className="text-xs font-bold uppercase tracking-wider bg-card text-foreground border border-border rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary py-1.5 pl-3 pr-8 cursor-pointer shadow-sm appearance-none outline-none"
                          >
                            <option value="TODO">To Do</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="REVIEW">Review</option>
                            <option value="DONE">Done</option>
                          </select>
                        ) : (
                          <Badge variant="outline" className="px-3 py-1 font-bold uppercase tracking-wider text-[10px]">{String(t.status).replace('_', ' ')}</Badge>
                        )}
                        
                        {mineOrManager && !done_ && (
                          tracking ? (
                            <Badge variant="default" className="bg-primary text-primary-foreground font-bold tracking-widest text-[10px] uppercase animate-pulse shadow-[0_0_8px_rgba(var(--primary),0.5)]">
                              Tracking
                            </Badge>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => startTask(t.id)}
                              disabled={timerActive}
                              title={timerActive ? 'Stop current timer first' : 'Start working'}
                              className="h-8 rounded-lg px-3 text-xs"
                            >
                              <Play size={14} className="mr-1.5" /> Start
                            </Button>
                          )
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {canManage && (
              <Button
                variant="outline"
                onClick={() => setShowAddTask(true)}
                className="mt-5 w-full h-12 rounded-xl border-dashed border-2 hover:border-primary/50 hover:bg-primary/5 text-muted-foreground hover:text-foreground font-semibold"
              >
                <Plus size={18} className="mr-2" /> Add New Task
              </Button>
            )}
          </Card>
        </div>

        {/* Right Column: Team, Activity, Screenshots */}
        <div className="space-y-8">
          
          <Card className="p-7">
            <h3 className="font-display text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
              <Users size={16} /> Project Team
            </h3>
            {project.members.length === 0 ? (
              <p className="text-sm font-medium text-muted-foreground">No members assigned.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {project.members.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/50 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/10 to-primary/30 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary shadow-sm shrink-0">
                      {initials(m.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground text-sm truncate">{m.name}</p>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{m.projectRole}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-7">
            <h3 className="font-display text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-5 flex items-center gap-2">
              <Activity size={16} /> Recent Activity
            </h3>
            {recentActivity.length === 0 ? (
              <p className="text-sm font-medium text-muted-foreground bg-muted/30 p-4 rounded-xl border border-border/50">No activity captured yet.</p>
            ) : (
              <div className="relative pl-5 border-l border-border/60 space-y-6">
                {recentActivity.map((s) => (
                  <div key={s.id} className="relative group">
                    <div className="absolute -left-[25px] top-1.5 w-3 h-3 rounded-full bg-primary/20 border-2 border-primary group-hover:scale-125 transition-transform" />
                    <div>
                      <p className="text-sm font-medium text-foreground leading-snug"><strong className="text-foreground">{s.employeeName ?? 'Team member'}</strong> captured a work screenshot</p>
                      <p className="text-xs font-mono font-bold text-muted-foreground mt-1.5">{new Date(s.capturedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-7">
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-display text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <ImageIcon size={16} /> Screenshots
              </h3>
            </div>
            {screenshots.length === 0 ? (
              <p className="text-sm font-medium text-muted-foreground bg-muted/30 p-4 rounded-xl border border-border/50">No screenshots captured yet.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 mb-4">
                {screenshots.slice(0, 4).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => s.driveFileUrl && window.worktrack.system.openExternal(s.driveFileUrl)}
                    className="group relative rounded-xl overflow-hidden border border-border/50 aspect-video bg-muted shadow-sm hover:border-primary/50 hover:shadow-md transition-all"
                    title={`${s.employeeName ?? 'Team'} · ${new Date(s.capturedAt).toLocaleString()}`}
                  >
                    <ScreenshotImage screenshotId={s.id} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                      <span className="text-[10px] font-bold text-white uppercase tracking-wider truncate">
                        {new Date(s.capturedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
            <Button
              variant="outline"
              onClick={() => navigate('/screenshots?projectId=' + id)}
              className="w-full text-xs font-bold uppercase tracking-wider"
            >
              View All Gallery
            </Button>
          </Card>
          
        </div>
      </div>

      {showAddTask && (
        <AddTaskModal
          projectId={id}
          members={project.members}
          onClose={() => setShowAddTask(false)}
          onCreated={() => { setShowAddTask(false); refreshTasks(); }}
        />
      )}
    </div>
  );
}

// ── Inline Add Task modal ───────────────────────────────────────────────────────
function AddTaskModal({ projectId, members, onClose, onCreated }: {
  projectId: string; members: ProjectMember[]; onClose: () => void; onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [estimatedHours, setEstimatedHours] = useState('1');
  const [deadline, setDeadline] = useState('');
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.worktrack.manager.getTeam().then((res) => {
      if (res.success && res.data) setTeam(res.data.members ?? []);
    });
  }, []);

  const options = team.length ? team : members.map((m) => ({ id: m.id, name: m.name } as TeamMember));

  const submit = async () => {
    if (!title.trim()) { setError('Task title is required.'); return; }
    setSaving(true); setError(null);
    const res = await window.worktrack.projects.createTask(projectId, {
      title: title.trim(), description: description.trim() || undefined,
      assigneeId: assigneeId || undefined, priority,
      estimatedHours: Number(estimatedHours) || 1, deadline: deadline || undefined,
    });
    setSaving(false);
    if (res.success) onCreated();
    else setError(res.error ?? 'Failed to create task.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="relative bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        
        <div className="flex items-center justify-between p-6 border-b border-border bg-muted/10">
          <h3 className="text-xl font-display font-bold flex items-center gap-3"><Plus size={24} className="text-primary bg-primary/10 p-1 rounded-lg" /> Create New Task</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors"><X size={18} className="text-muted-foreground" /></button>
        </div>
        
        <div className="p-6 space-y-5">
          {error && <div className="flex items-center gap-2 text-destructive text-sm font-medium bg-destructive/10 border border-destructive/20 rounded-xl p-4">{error}</div>}
          
          <div className="space-y-1.5">
            <label className="text-[11px] font-display font-bold uppercase tracking-widest text-muted-foreground">Task Title <span className="text-destructive">*</span></label>
            <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className="w-full h-12 bg-input border border-border/80 rounded-xl px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all shadow-sm" placeholder="e.g. Design homepage hero section" />
          </div>
          
          <div className="space-y-1.5">
            <label className="text-[11px] font-display font-bold uppercase tracking-widest text-muted-foreground">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full bg-input border border-border/80 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all shadow-sm resize-none" placeholder="Provide details about the task..." />
          </div>
          
          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-[11px] font-display font-bold uppercase tracking-widest text-muted-foreground">Assignee</label>
              <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className="w-full h-12 bg-input border border-border/80 rounded-xl px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all shadow-sm appearance-none">
                <option value="">Unassigned</option>
                {options.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-[11px] font-display font-bold uppercase tracking-widest text-muted-foreground">Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full h-12 bg-input border border-border/80 rounded-xl px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all shadow-sm appearance-none">
                <option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="URGENT">Urgent</option>
              </select>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-[11px] font-display font-bold uppercase tracking-widest text-muted-foreground">Est. Hours</label>
              <input type="number" min="0" step="0.5" value={estimatedHours} onChange={(e) => setEstimatedHours(e.target.value)} className="w-full h-12 bg-input border border-border/80 rounded-xl px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all shadow-sm" />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-[11px] font-display font-bold uppercase tracking-widest text-muted-foreground">Deadline</label>
              <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="w-full h-12 bg-input border border-border/80 rounded-xl px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all shadow-sm text-foreground" />
            </div>
          </div>
        </div>
        
        <div className="flex gap-4 p-6 border-t border-border bg-muted/10">
          <Button variant="outline" onClick={onClose} className="flex-1 h-12 rounded-xl font-bold">Cancel</Button>
          <Button onClick={submit} disabled={saving} className="flex-1 h-12 rounded-xl font-bold shadow-[0_4px_14px_0_rgba(var(--primary),0.39)]">
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Task'}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
