import { useEffect, useState } from 'react';
import {
  FolderKanban, ChevronLeft, Loader2, CalendarClock, CheckCircle2,
  ListTodo, Image as ImageIcon, Building2, RefreshCw, Circle,
} from 'lucide-react';
import { ClientProject, Task, ScreenshotRecord } from '@shared/types';
import { Card, Badge, Button } from '../components/ui/primitives';
import { ScreenshotImage } from '../components/ScreenshotImage';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

interface ProjectDetail extends ClientProject {
  tasks?: Task[];
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
  const [screenshots, setScreenshots] = useState<ScreenshotRecord[]>([]);

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
        setScreenshots(shotsRes.data as ScreenshotRecord[]);
      }
    } finally {
      setDetailLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500 mb-4" />
        <p className="text-sm font-medium text-muted-foreground animate-pulse">Loading portal...</p>
      </div>
    );
  }

  // ── Detail view ──────────────────────────────────────────────────────────────
  if (selected) {
    const tasks = selected.tasks ?? [];
    const done = tasks.filter((t) => t.status === 'DONE' || t.status === 'completed').length;
    return (
      <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 bg-background pb-24 relative">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-teal-500/5 rounded-full blur-[100px] pointer-events-none" />
        
        <button
          onClick={() => setSelected(null)}
          className="flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors relative z-10"
        >
          <ChevronLeft size={16} /> All Projects
        </button>

        <div className="flex items-start justify-between gap-4 flex-wrap relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center shadow-sm">
                <FolderKanban size={24} className="text-teal-500" />
              </div>
              <h1 className="text-3xl font-display font-bold text-foreground">{selected.name}</h1>
              <Badge variant={STATUS_VARIANT[selected.status] ?? 'default'} className="uppercase font-bold tracking-widest text-[10px] ml-2">
                {selected.status.replace('_', ' ')}
              </Badge>
            </div>
            <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5 mt-2 bg-muted/40 px-3 py-1.5 rounded-lg border border-border inline-flex">
              <Building2 size={16} className="text-muted-foreground/70" /> {selected.org_name}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
          {[
            { label: 'Progress', value: `${selected.progress_percent}%`, icon: <CheckCircle2 size={20} className="text-teal-500" /> },
            { label: 'Total Tasks', value: tasks.length || selected.task_count, icon: <ListTodo size={20} className="text-blue-500" /> },
            { label: 'Completed', value: done || selected.completed_count, icon: <CheckCircle2 size={20} className="text-emerald-500" /> },
            { label: 'Deadline', value: fmtDate(selected.deadline), icon: <CalendarClock size={20} className="text-amber-500" /> },
          ].map((kpi, i) => (
            <Card key={i} className="p-5 flex flex-col justify-between hover:border-teal-500/30 transition-colors">
              <div className="flex justify-between items-start mb-3">
                <span className="font-display text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{kpi.label}</span>
                <div className="p-1.5 rounded-lg bg-card border border-border shadow-sm">{kpi.icon}</div>
              </div>
              <span className="text-2xl font-display font-bold text-foreground">{kpi.value}</span>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 relative z-10">
          <div className="xl:col-span-2 space-y-6">
            
            {selected.description && (
              <Card className="p-7">
                <h2 className="text-[11px] font-display font-bold uppercase tracking-widest text-muted-foreground mb-4">Project Overview</h2>
                <p className="text-[15px] font-medium text-foreground/90 leading-relaxed">{selected.description}</p>
              </Card>
            )}

            <Card className="p-7">
              <h2 className="text-[11px] font-display font-bold uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
                <ListTodo size={16} /> Deliverables & Tasks
              </h2>
              {detailLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-teal-500" /></div>
              ) : tasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 bg-muted/20 rounded-xl border border-dashed border-border/60">
                  <CheckCircle2 size={32} className="text-muted-foreground/40 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">No tasks available yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {tasks.map((t) => {
                    const isDone = t.status === 'DONE' || t.status === 'completed';
                    return (
                      <div key={t.id} className={clsx("flex items-center justify-between gap-4 p-4 rounded-xl border transition-all", isDone ? "bg-muted/30 border-border/50 opacity-80" : "bg-card border-border hover:border-teal-500/30 hover:shadow-sm")}>
                        <div className="flex items-start gap-4 min-w-0">
                          {isDone ? <CheckCircle2 size={20} className="text-emerald-500 shrink-0 mt-0.5" /> : <Circle size={20} className="text-muted-foreground/40 shrink-0 mt-0.5" />}
                          <div>
                            <span className={clsx("text-sm font-semibold truncate block", isDone && "line-through text-muted-foreground")}>{t.title}</span>
                            <span className="text-[11px] font-bold font-mono text-muted-foreground mt-1 block">Due: {fmtDate(t.deadline)}</span>
                          </div>
                        </div>
                        <div className="shrink-0">
                          <Badge variant={isDone ? 'success' : 'outline'} className="uppercase font-bold tracking-widest text-[10px]">{String(t.status).replace('_', ' ')}</Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="p-7">
              <h2 className="text-[11px] font-display font-bold uppercase tracking-widest text-muted-foreground mb-5 flex items-center gap-2">
                <ImageIcon size={16} /> Work Screenshots
              </h2>
              {detailLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-teal-500" /></div>
              ) : screenshots.length === 0 ? (
                <p className="text-sm font-medium text-muted-foreground bg-muted/30 p-4 rounded-xl border border-border/50 text-center">No screenshots available.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {screenshots.slice(0, 6).map((s) => (
                    <a
                      key={s.id}
                      href={s.driveFileUrl || '#'}
                      onClick={(e) => { if (s.driveFileUrl) { e.preventDefault(); window.worktrack.system.openExternal(s.driveFileUrl); } }}
                      className="group relative block rounded-xl overflow-hidden border border-border/60 bg-muted aspect-video shadow-sm hover:border-teal-500/50 hover:shadow-md transition-all"
                      title={`${s.employeeName ?? 'Team'} · ${new Date(s.capturedAt).toLocaleString()}`}
                    >
                      <ScreenshotImage screenshotId={s.id} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                        <span className="text-[10px] font-bold text-white uppercase tracking-wider truncate">
                          {new Date(s.capturedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // ── List view ────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-y-auto p-8 lg:p-12 space-y-8 bg-background pb-24 relative animate-fade-in">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-teal-500/5 rounded-full blur-[100px] pointer-events-none" />
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center shadow-sm">
              <FolderKanban size={24} className="text-teal-500" />
            </div>
            Client Portal
          </h1>
          <p className="text-base font-medium text-muted-foreground mt-2">Track the progress of projects you've been invited to oversee.</p>
        </div>
        <Button
          variant="outline"
          onClick={loadProjects}
          className="h-11 px-4 rounded-xl shadow-sm text-foreground font-semibold shrink-0 hover:bg-teal-500/10 hover:text-teal-500 hover:border-teal-500/30 transition-colors"
        >
          <RefreshCw size={18} className="mr-2" /> Refresh
        </Button>
      </div>

      <div className="relative z-10">
        {projects.length === 0 ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-16 text-center border border-dashed border-border/60 rounded-3xl bg-muted/10">
            <div className="w-20 h-20 rounded-full bg-card flex items-center justify-center mx-auto mb-6 shadow-sm border border-border/50">
              <FolderKanban size={32} className="text-muted-foreground/40" />
            </div>
            <h3 className="text-2xl font-display font-bold text-foreground mb-2">No projects yet</h3>
            <p className="text-base font-medium text-muted-foreground">You haven't been invited to any active projects.</p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            <AnimatePresence>
              {projects.map((p) => (
                <motion.div 
                  layout
                  key={p.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -5 }}
                  onClick={() => openProject(p)}
                  className="bg-card border border-border/60 rounded-2xl p-7 cursor-pointer hover:border-teal-500/40 hover:shadow-xl transition-all duration-300 flex flex-col group overflow-hidden relative"
                >
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-teal-500/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <Badge variant={STATUS_VARIANT[p.status] ?? 'default'} className="uppercase font-bold tracking-widest text-[10px] px-2.5 py-1">
                      {p.status.replace('_', ' ')}
                    </Badge>
                    <div className="bg-muted/50 p-1.5 rounded-lg border border-border/50 shadow-sm">
                      <FolderKanban size={16} className="text-teal-500/70" />
                    </div>
                  </div>

                  <h3 className="font-display font-bold text-xl text-foreground mb-1.5 group-hover:text-teal-500 transition-colors line-clamp-1">{p.name}</h3>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-5">
                    <Building2 size={14} /> {p.org_name}
                  </p>

                  <p className="text-sm font-medium text-muted-foreground line-clamp-2 mb-8 flex-1 leading-relaxed">{p.description || 'No description provided.'}</p>

                  <div className="space-y-4 bg-muted/30 p-4 rounded-xl border border-border/50">
                    <div>
                      <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2.5">
                        <span>{p.completed_count} of {p.task_count} tasks</span>
                        <span className="text-teal-500 text-sm font-mono">{p.progress_percent}%</span>
                      </div>
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden shadow-inner border border-border/40">
                        <div className="h-full bg-teal-500 rounded-full transition-all duration-1000 shadow-sm" style={{ width: `${p.progress_percent}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-border/50">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        <CalendarClock size={14} /> Due Date
                      </div>
                      <span className="text-sm font-semibold text-foreground">{fmtDate(p.deadline)}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
