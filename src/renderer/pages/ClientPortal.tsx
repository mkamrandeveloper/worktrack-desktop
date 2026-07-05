import { useEffect, useState } from 'react';
import {
  FolderKanban, ChevronLeft, Loader2, CalendarClock, CheckCircle2,
  ListTodo, ImageIcon, Building2, RefreshCw,
} from 'lucide-react';
import { ClientProject, Task } from '@shared/types';
import { KPICard } from '../components/ui/KPICard';
import { Card, Badge } from '../components/ui/primitives';
import { clsx } from 'clsx';

interface ProjectDetail extends ClientProject {
  tasks?: Task[];
}

interface ProjectScreenshot {
  id: string;
  captured_at: string;
  drive_file_url?: string;
  employee_name?: string;
}

const STATUS_VARIANT: Record<string, 'default' | 'info' | 'success' | 'warning' | 'danger'> = {
  ACTIVE: 'info', COMPLETED: 'success', ON_HOLD: 'warning', CANCELLED: 'danger', ARCHIVED: 'default',
};

function fmtDate(d?: string) {
  return d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
}

export function ClientPortal() {
  const [projects, setProjects] = useState<ClientProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ProjectDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [screenshots, setScreenshots] = useState<ProjectScreenshot[]>([]);

  async function loadProjects() {
    setLoading(true);
    try {
      const res = await window.worktrack.clients.projects();
      if (res.success && res.data) setProjects(res.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadProjects(); }, []);

  async function openProject(p: ClientProject) {
    setSelected(p);
    setDetailLoading(true);
    setScreenshots([]);
    try {
      const [detailRes, shotsRes] = await Promise.all([
        window.worktrack.projects.get(p.id),
        window.worktrack.clients.projectScreenshots(p.id),
      ]);
      if (detailRes.success && detailRes.data) {
        const detail = detailRes.data as unknown as { tasks?: Task[] };
        setSelected({ ...p, tasks: detail.tasks ?? [] });
      }
      if (shotsRes.success && Array.isArray(shotsRes.data)) {
        setScreenshots(shotsRes.data as ProjectScreenshot[]);
      }
    } finally {
      setDetailLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Detail view ──────────────────────────────────────────────────────────────
  if (selected) {
    const tasks = selected.tasks ?? [];
    const done = tasks.filter((t) => t.status === 'DONE' || t.status === 'completed').length;
    return (
      <div className="flex-1 overflow-y-auto p-8 space-y-6 animate-fade-in pb-24">
        <button
          onClick={() => setSelected(null)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> All Projects
        </button>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{selected.name}</h1>
              <Badge variant={STATUS_VARIANT[selected.status] ?? 'default'}>{selected.status}</Badge>
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
              <Building2 className="w-3.5 h-3.5" /> {selected.org_name}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard title="Progress" value={`${selected.progress_percent}%`} color="primary" icon={<CheckCircle2 className="w-5 h-5" />} />
          <KPICard title="Total Tasks" value={tasks.length || selected.task_count} icon={<ListTodo className="w-5 h-5" />} />
          <KPICard title="Completed" value={done || selected.completed_count} color="success" icon={<CheckCircle2 className="w-5 h-5" />} />
          <KPICard title="Deadline" value={fmtDate(selected.deadline)} icon={<CalendarClock className="w-5 h-5" />} />
        </div>

        {selected.description && (
          <Card className="p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">Overview</h2>
            <p className="text-sm text-foreground/90 leading-relaxed">{selected.description}</p>
          </Card>
        )}

        <Card className="p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Deliverables &amp; Tasks</h2>
          {detailLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No tasks yet.</p>
          ) : (
            <div className="space-y-2">
              {tasks.map((t) => {
                const isDone = t.status === 'DONE' || t.status === 'completed';
                return (
                  <div key={t.id} className="flex items-center justify-between gap-4 p-3 rounded-lg bg-secondary/40 border border-border">
                    <div className="flex items-center gap-3 min-w-0">
                      <CheckCircle2 className={clsx('w-4 h-4 shrink-0', isDone ? 'text-emerald-500' : 'text-muted-foreground/40')} />
                      <span className="text-sm font-medium truncate">{t.title}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-muted-foreground">{fmtDate(t.deadline)}</span>
                      <Badge variant={isDone ? 'success' : 'default'}>{String(t.status).replace('_', ' ')}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
            <ImageIcon className="w-4 h-4" /> Work Screenshots
          </h2>
          {detailLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : screenshots.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No screenshots available for this project yet.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {screenshots.map((s) => (
                <a
                  key={s.id}
                  href={s.drive_file_url || '#'}
                  onClick={(e) => { if (s.drive_file_url) { e.preventDefault(); window.worktrack.system.openExternal(s.drive_file_url); } }}
                  className="group block rounded-lg overflow-hidden border border-border bg-secondary/40 aspect-video relative"
                  title={`${s.employee_name ?? 'Team'} · ${new Date(s.captured_at).toLocaleString()}`}
                >
                  <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/50 group-hover:text-primary transition-colors">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                  <div className="absolute bottom-0 inset-x-0 bg-background/80 backdrop-blur-sm px-2 py-1 text-[10px] text-muted-foreground truncate">
                    {new Date(s.captured_at).toLocaleDateString()}
                  </div>
                </a>
              ))}
            </div>
          )}
        </Card>
      </div>
    );
  }

  // ── List view ────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6 animate-fade-in pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FolderKanban className="w-6 h-6 text-teal-400" /> My Projects
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Track the progress of projects you've been invited to.</p>
        </div>
        <button
          onClick={loadProjects}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent/50 transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {projects.length === 0 ? (
        <Card className="p-12 text-center">
          <FolderKanban className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">You haven't been invited to any projects yet.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {projects.map((p) => (
            <Card key={p.id} className="p-5 cursor-pointer hover:border-primary/50 transition-all" onClick={() => openProject(p)}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <h3 className="font-semibold text-base truncate">{p.name}</h3>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <Building2 className="w-3 h-3" /> {p.org_name}
                  </p>
                </div>
                <Badge variant={STATUS_VARIANT[p.status] ?? 'default'}>{p.status}</Badge>
              </div>

              {p.description && <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{p.description}</p>}

              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{p.completed_count} / {p.task_count} tasks</span>
                  <span className="font-medium text-foreground">{p.progress_percent}%</span>
                </div>
                <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${p.progress_percent}%` }} />
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
                  <CalendarClock className="w-3.5 h-3.5" /> Due {fmtDate(p.deadline)}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
