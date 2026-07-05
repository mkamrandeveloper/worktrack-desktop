import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, X } from 'lucide-react';
import { Project, Task, TeamMember, ProjectMember } from '@shared/types';
import { useAuthStore } from '../store/authStore';
import { useTimerStore } from '../store/timerStore';
import { MaterialIcon } from '../components/ui/MaterialIcon';
import { formatDuration } from '../utils/formatTime';
import { clsx } from 'clsx';

type FullProject = Project & { members: ProjectMember[]; tasks: Task[] };

interface ProjectScreenshot {
  id: string; captured_at: string; drive_file_url?: string; employee_name?: string;
}

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'bg-secondary/10 text-secondary border-secondary/20',
  COMPLETED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  ON_HOLD: 'bg-amber-100 text-amber-700 border-amber-200',
  CANCELLED: 'bg-destructive/10 text-destructive border-destructive/20',
  ARCHIVED: 'bg-muted text-muted-foreground border-border',
};

function priorityPill(priority: string) {
  const p = priority.toLowerCase();
  if (p === 'urgent' || p === 'critical') return { cls: 'bg-destructive/10 text-destructive border-destructive/20', icon: 'warning' };
  if (p === 'high') return { cls: 'bg-orange-100 text-orange-700 border-orange-200', icon: null };
  if (p === 'medium') return { cls: 'bg-secondary/10 text-secondary border-secondary/20', icon: null };
  return { cls: 'bg-muted text-muted-foreground border-border', icon: null };
}

const fmtDate = (d?: string) => {
  if (!d) return '—';
  const date = new Date(d);
  // datetime-local values carry a "T" (e.g. 2026-07-10T14:30); older
  // date-only deadlines don't — only show a time when one was actually set.
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
  const [screenshots, setScreenshots] = useState<ProjectScreenshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddTask, setShowAddTask] = useState(false);

  const load = useCallback(async () => {
    const [detail, shots] = await Promise.all([
      window.worktrack.projects.get(id),
      window.worktrack.clients.projectScreenshots(id),
    ]);
    if (detail.success && detail.data) setProject(detail.data as unknown as FullProject);
    if (shots.success && Array.isArray(shots.data)) setScreenshots(shots.data as ProjectScreenshot[]);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const refreshTasks = async () => {
    const res = await window.worktrack.projects.getTasks(id);
    if (res.success && res.data) setProject((p) => (p ? { ...p, tasks: res.data as Task[] } : p));
  };

  if (loading) {
    return <div className="flex-1 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!project) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <p className="text-muted-foreground text-sm">Project not found or you don't have access.</p>
        <button onClick={() => navigate('/projects')} className="text-sm text-primary hover:underline">Back to Projects</button>
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

  // Recent activity — real, timestamped: reuse the same screenshot captures
  // already fetched for this project (genuine per-employee activity signal).
  const recentActivity = [...screenshots]
    .sort((a, b) => new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime())
    .slice(0, 5);

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 animate-fade-in pb-24">
      <button onClick={() => navigate('/projects')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <MaterialIcon name="chevron_left" size={18} /> Projects
      </button>

      {/* Header */}
      <div className="mb-2">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h2 className="text-2xl font-display font-bold text-foreground">{project.name}</h2>
              <span className={clsx('px-3 py-1 rounded-full font-mono text-[11px] uppercase tracking-widest flex items-center gap-1 border', STATUS_BADGE[project.status] ?? STATUS_BADGE.ARCHIVED)}>
                {project.status.replace('_', ' ')}
              </span>
              <span className={clsx('px-3 py-1 rounded-full font-mono text-[11px] uppercase tracking-widest flex items-center gap-1 border', priority.cls)}>
                {priority.icon && <MaterialIcon name={priority.icon} size={14} />}
                {project.priority}
              </span>
            </div>
            {(project.clientName || project.clientEmail) && (
              <p className="text-muted-foreground flex items-center gap-2 flex-wrap text-sm">
                <MaterialIcon name="domain" size={18} />
                {project.clientEmail ? `Client: ${project.clientName || project.clientEmail}` : project.clientName}
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <button className="px-4 py-2 rounded-lg bg-card/40 border border-secondary text-secondary font-medium hover:bg-card/80 transition-all flex items-center gap-2">
              <MaterialIcon name="edit" size={18} /> Edit Project
            </button>
            {canManage && (
              <button onClick={() => setShowAddTask(true)} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-all shadow-md flex items-center gap-2">
                <MaterialIcon name="add_task" size={18} /> New Task
              </button>
            )}
          </div>
        </div>

        {/* Progress */}
        <div className="glass-panel p-4 rounded-xl">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-foreground">Project Completion</span>
            <span className="text-sm font-bold text-secondary">{progress}%</span>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-secondary rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>Started: {fmtDate(project.startDate)}</span>
            <span>Due: {fmtDate(project.deadline)}</span>
          </div>
        </div>
      </div>

      {/* Active timer bar */}
      {timerActive && (
        <div className="glass-panel rounded-xl p-4 flex items-center gap-4 border-primary/30">
          <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs text-muted-foreground">
              {timer.status === 'on_break' ? 'On break' : timer.status === 'paused' ? 'Paused' : 'Tracking'}
            </div>
            <div className="text-sm font-semibold truncate">
              {tasks.find((t) => t.id === timer.taskId)?.title ?? 'Active task'}
            </div>
          </div>
          <div className="text-2xl font-mono font-bold text-primary">
            {formatDuration(timer.status === 'on_break' ? timer.breakSeconds : timer.elapsedSeconds)}
          </div>
          <div className="flex items-center gap-2">
            {timer.status === 'running' && (
              <button onClick={() => timer.pauseTimer()} className="w-9 h-9 rounded-full bg-muted hover:bg-muted/70 flex items-center justify-center" title="Pause"><MaterialIcon name="pause" size={18} /></button>
            )}
            {timer.status === 'paused' && (
              <button onClick={() => timer.resumeTimer()} className="w-9 h-9 rounded-full bg-primary text-primary-foreground hover:opacity-90 flex items-center justify-center" title="Resume"><MaterialIcon name="play_arrow" size={18} /></button>
            )}
            <button
              onClick={() => (timer.status === 'on_break' ? timer.endBreak() : timer.startBreak())}
              disabled={timer.status !== 'running' && timer.status !== 'on_break'}
              className="w-9 h-9 rounded-full bg-muted hover:bg-muted/70 flex items-center justify-center disabled:opacity-40"
              title={timer.status === 'on_break' ? 'End break' : 'Break'}
            >
              <MaterialIcon name={timer.status === 'on_break' ? 'play_circle' : 'coffee'} size={18} />
            </button>
            <button onClick={() => timer.stopTimer()} className="w-9 h-9 rounded-full bg-muted hover:bg-destructive/20 hover:text-destructive flex items-center justify-center" title="Stop"><MaterialIcon name="stop_circle" size={18} /></button>
          </div>
        </div>
      )}

      {project.description && (
        <div className="glass-panel rounded-2xl p-6">
          <h3 className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-2">Overview</h3>
          <p className="text-sm text-foreground/90 leading-relaxed">{project.description}</p>
        </div>
      )}

      {/* Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Task List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel rounded-2xl p-6">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-border">
              <h3 className="text-lg font-display font-bold text-foreground">Active Tasks</h3>
            </div>

            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No tasks yet.</p>
            ) : (
              <div className="space-y-3">
                {tasks.map((t) => {
                  const tracking = timerActive && timer.taskId === t.id;
                  const mineOrManager = canManage || t.assigneeId === user?.id;
                  const done_ = isDone(t.status);
                  const p = priorityPill(t.priority);
                  return (
                    <div
                      key={t.id}
                      className={clsx(
                        'group flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-card/40 border border-border hover:bg-card/80 transition-colors gap-4 relative overflow-hidden',
                        done_ && 'opacity-70'
                      )}
                    >
                      <div className={clsx('absolute left-0 top-0 bottom-0 w-1', done_ ? 'bg-emerald-500' : tracking ? 'bg-primary' : 'bg-secondary')} />
                      <div className="flex items-start gap-4">
                        <button
                          onClick={() => !done_ && mineOrManager && setTaskStatus(t.id, 'DONE')}
                          disabled={done_ || !mineOrManager}
                          className={clsx('mt-1', done_ ? 'text-emerald-500' : 'text-muted-foreground hover:text-secondary')}
                        >
                          <MaterialIcon name={done_ ? 'check_circle' : 'radio_button_unchecked'} size={20} fill={done_} />
                        </button>
                        <div>
                          <h4 className={clsx('font-medium text-foreground mb-1', done_ && 'line-through')}>{t.title}</h4>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                            {t.deadline && (
                              <span className="flex items-center gap-1 text-secondary">
                                <MaterialIcon name="calendar_today" size={14} /> {fmtDate(t.deadline)}
                              </span>
                            )}
                            <span className={clsx('px-2 py-0.5 rounded-full border font-mono text-[10px] uppercase', p.cls)}>{t.priority.toString().toLowerCase()}</span>
                            {t.assigneeName && <span>{t.assigneeName}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 sm:ml-auto shrink-0">
                        {t.assigneeName && (
                          <div className="w-8 h-8 rounded-full border-2 border-card shadow-sm bg-secondary/10 text-secondary flex items-center justify-center text-[11px] font-bold shrink-0">
                            {initials(t.assigneeName)}
                          </div>
                        )}
                        {done_ ? (
                          <span className="px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-medium">Completed</span>
                        ) : canManage ? (
                          <select
                            value={t.status}
                            onChange={(e) => setTaskStatus(t.id, e.target.value)}
                            className="text-xs bg-secondary/10 text-secondary border-none rounded-lg focus:ring-0 py-1.5 pl-3 pr-8 cursor-pointer appearance-none"
                          >
                            <option value="TODO">To Do</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="REVIEW">Review</option>
                            <option value="DONE">Done</option>
                          </select>
                        ) : (
                          <span className="px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-medium">{String(t.status).replace('_', ' ')}</span>
                        )}
                        {mineOrManager && !done_ && (
                          tracking ? (
                            <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-primary text-xs font-medium">
                              <MaterialIcon name="play_arrow" size={16} /> Tracking
                            </span>
                          ) : (
                            <button
                              onClick={() => startTask(t.id)}
                              disabled={timerActive}
                              title={timerActive ? 'Stop the current timer first' : 'Start working'}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-secondary border border-secondary/30 hover:bg-secondary/10 transition-colors text-xs font-medium disabled:opacity-40"
                            >
                              <MaterialIcon name="play_arrow" size={16} /> Start
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {canManage && (
              <button
                onClick={() => setShowAddTask(true)}
                className="mt-4 w-full py-3 rounded-xl border border-dashed border-border text-muted-foreground hover:bg-card/50 hover:text-foreground transition-colors flex justify-center items-center gap-2"
              >
                <MaterialIcon name="add" size={18} /> Add New Task
              </button>
            )}
          </div>

          {/* Team */}
          <div className="glass-panel rounded-2xl p-6">
            <h3 className="text-lg font-display font-bold text-foreground mb-4 flex items-center gap-2">
              <MaterialIcon name="groups" size={20} /> Team
            </h3>
            {project.members.length === 0 ? (
              <p className="text-sm text-muted-foreground">No members assigned.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {project.members.map((m) => (
                  <div key={m.id} className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-secondary/10 border border-secondary/20 text-sm">
                    <span className="w-6 h-6 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center text-[10px] font-bold">{initials(m.name)}</span>
                    <span className="font-medium">{m.name}</span>
                    <span className="text-xs text-muted-foreground">{m.projectRole}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel */}
        <div className="space-y-6">
          {/* Recent Activity */}
          <div className="glass-panel rounded-2xl p-6">
            <h3 className="text-[17px] font-display font-bold text-foreground mb-4">Recent Activity</h3>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity captured yet.</p>
            ) : (
              <div className="relative pl-4 border-l border-border space-y-5">
                {recentActivity.map((s) => (
                  <div key={s.id} className="relative">
                    <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-secondary ring-4 ring-card" />
                    <div className="text-sm">
                      <p className="text-foreground"><span className="font-medium">{s.employee_name ?? 'A team member'}</span> captured a work screenshot</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{new Date(s.captured_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Screenshots */}
          <div className="glass-panel rounded-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[17px] font-display font-bold text-foreground">Work Screenshots</h3>
            </div>
            {screenshots.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No screenshots captured for this project yet.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {screenshots.slice(0, 6).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => s.drive_file_url && window.worktrack.system.openExternal(s.drive_file_url)}
                    className="group relative rounded-xl overflow-hidden border border-border aspect-square bg-muted"
                    title={`${s.employee_name ?? 'Team'} · ${new Date(s.captured_at).toLocaleString()}`}
                  >
                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/50 group-hover:text-secondary transition-colors">
                      <MaterialIcon name="image" size={24} />
                    </div>
                    <div className="absolute bottom-0 inset-x-0 bg-black/50 backdrop-blur-sm px-2 py-1 text-[10px] text-white truncate">
                      {new Date(s.captured_at).toLocaleDateString()}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
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
    // Offer all team members as assignees, not just current project members.
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
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl animate-fade-in">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="font-semibold flex items-center gap-2"><MaterialIcon name="add_task" size={18} className="text-primary" /> Add Task</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center"><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="p-5 space-y-4">
          {error && <div className="flex items-center gap-2 text-destructive text-xs bg-destructive/10 border border-destructive/20 rounded-lg p-3">{error}</div>}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Title *</label>
            <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="Design the landing page" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Assignee</label>
              <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                <option value="">Unassigned</option>
                {options.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                <option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="URGENT">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Est. Hours</label>
              <input type="number" min="0" step="0.5" value={estimatedHours} onChange={(e) => setEstimatedHours(e.target.value)} className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Deadline</label>
              <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t border-border">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-medium border border-border rounded-lg hover:bg-muted transition">Cancel</button>
          <button onClick={submit} disabled={saving} className="flex-1 py-2.5 text-sm font-semibold bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Task'}
          </button>
        </div>
      </div>
    </div>
  );
}
