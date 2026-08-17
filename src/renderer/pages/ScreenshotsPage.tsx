import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { ScreenshotRecord, TeamMember, ScreenshotBreakInterval } from '@shared/types';
import { formatDuration } from '../utils/formatTime';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ImageOff, Image as ImageIcon, Coffee, User, Briefcase, Calendar,
  Loader2, Camera, X, ChevronLeft, ChevronRight, ExternalLink, CheckCircle
} from 'lucide-react';
import { Card } from '../components/ui/primitives';

const PAGE_SIZE = 36;

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

type DayItem =
  | { kind: 'screenshot'; time: string; record: ScreenshotRecord }
  | { kind: 'break'; time: string; brk: ScreenshotBreakInterval };

function fmtDayHeading(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00`);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function initials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

interface ThumbProps {
  record: ScreenshotRecord;
  imageCache: Map<string, string>;
  onLoaded: (id: string, dataUrl: string) => void;
  onOpen: () => void;
  showEmployee: boolean;
}

function ScreenshotThumb({ record, imageCache, onLoaded, onOpen, showEmployee }: ThumbProps) {
  const cached = imageCache.get(record.id);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(cached ? 'ready' : 'loading');

  useEffect(() => {
    if (cached) return;
    let alive = true;
    window.worktrack.screenshots.getImage(record.id).then((res) => {
      if (!alive) return;
      if (res.success && res.data) {
        onLoaded(record.id, res.data.dataUrl);
        setStatus('ready');
      } else {
        setStatus('error');
      }
    });
    return () => { alive = false; };
  }, [record.id, cached]);

  const src = cached ?? imageCache.get(record.id);

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onOpen}
      className="group relative aspect-video rounded-xl overflow-hidden bg-card border border-border hover:border-primary/50 shadow-sm hover:shadow-md transition-all text-left"
    >
      {status === 'ready' && src ? (
        <img src={src} alt="" className="w-full h-full object-cover" />
      ) : status === 'error' ? (
        <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-1.5 bg-muted/20">
          <ImageOff size={24} className="opacity-50" />
          <span className="text-[10px] font-medium uppercase tracking-wider">Unavailable</span>
        </div>
      ) : (
        <div className="w-full h-full flex items-center justify-center text-muted-foreground/30 bg-muted/20 animate-pulse">
          <ImageIcon size={24} />
        </div>
      )}
      {showEmployee && record.employeeName && (
        <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/80 to-transparent px-2.5 py-2 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-white/20 backdrop-blur-md text-white text-[9px] font-bold flex items-center justify-center shrink-0 border border-white/20 shadow-sm">
            {initials(record.employeeName)}
          </span>
          <span className="text-white text-[11px] font-semibold truncate drop-shadow-md">{record.employeeName}</span>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-2.5">
        <span className="text-white text-[11px] font-medium drop-shadow-md">{fmtTime(record.capturedAt)}</span>
      </div>
    </motion.button>
  );
}

function BreakCard({ brk, showEmployee }: { brk: ScreenshotBreakInterval; showEmployee: boolean }) {
  const durationLabel = brk.end
    ? formatDuration(Math.round((new Date(brk.end).getTime() - new Date(brk.start).getTime()) / 1000))
    : 'Ongoing';
  return (
    <div className="aspect-video rounded-xl border border-amber-500/20 bg-amber-500/5 flex flex-col items-center justify-center gap-1.5 text-amber-600 dark:text-amber-500 p-2 text-center shadow-sm">
      <Coffee size={24} className="opacity-80" />
      <span className="text-xs font-display font-bold uppercase tracking-wider">On Break</span>
      <span className="text-[10px] opacity-80 font-medium">
        {fmtTime(brk.start)}{brk.end ? ` – ${fmtTime(brk.end)}` : ''} · {durationLabel}
      </span>
      {showEmployee && <span className="text-[10px] font-semibold truncate max-w-full mt-0.5 opacity-90">{brk.employeeName}</span>}
    </div>
  );
}

export function ScreenshotsPage() {
  const { user } = useAuthStore();
  const isManager = user?.role === 'OWNER' || user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const isClient = user?.role === 'CLIENT';

  const [searchParams] = useSearchParams();
  const initialProjectId = searchParams.get('projectId') ?? '';

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [projectOptions, setProjectOptions] = useState<{ id: string; name: string }[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [projectId, setProjectId] = useState(initialProjectId);
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [allDates, setAllDates] = useState(!!initialProjectId);
  const [records, setRecords] = useState<ScreenshotRecord[]>([]);
  const [breaks, setBreaks] = useState<ScreenshotBreakInterval[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const imageCache = useRef(new Map<string, string>()).current;
  const [, forceRerender] = useState(0);

  useEffect(() => {
    if (isManager) {
      window.worktrack.manager.getTeam().then((r) => {
        if (r.success && r.data) setMembers(r.data.members);
      });
      window.worktrack.projects.list().then((r) => {
        if (r.success && r.data) setProjectOptions(r.data.map((p) => ({ id: p.id, name: p.name })));
      });
    } else if (isClient) {
      window.worktrack.clients.projects().then((r) => {
        if (r.success && r.data) setProjectOptions(r.data.map((p) => ({ id: p.id, name: p.name })));
      });
    }
  }, [isManager, isClient]);

  const load = useCallback(
    async (offset: number, append: boolean) => {
      setLoading(true);
      const filters: Record<string, string | number> = { limit: PAGE_SIZE, offset };
      if (isManager && employeeId) filters.userId = employeeId;
      if (projectId) filters.projectId = projectId;
      if (!allDates) {
        filters.from = `${date}T00:00:00`;
        filters.to = `${date}T23:59:59`;
      }
      const res = await window.worktrack.screenshots.list(filters);
      if (res.success && res.data) {
        setRecords((prev) => (append ? [...prev, ...res.data!] : res.data!));
        setHasMore(res.data.length === PAGE_SIZE);
      }
      setLoading(false);
    },
    [employeeId, projectId, date, allDates, isManager]
  );

  useEffect(() => {
    load(0, false);
  }, [load]);

  useEffect(() => {
    if (isClient) return;
    const filters: Record<string, string> = {};
    if (isManager && employeeId) filters.userId = employeeId;
    if (!allDates) {
      filters.from = `${date}T00:00:00`;
      filters.to = `${date}T23:59:59`;
    }
    window.worktrack.screenshots.listBreaks(filters).then((res) => {
      if (res.success && res.data) setBreaks(res.data);
    });
  }, [employeeId, date, allDates, isManager, isClient]);

  const onImageLoaded = (id: string, dataUrl: string) => {
    imageCache.set(id, dataUrl);
    forceRerender((n) => n + 1);
  };

  const groups = records.reduce<Record<string, DayItem[]>>((acc, r) => {
    const key = dayKey(r.capturedAt);
    (acc[key] ??= []).push({ kind: 'screenshot', time: r.capturedAt, record: r });
    return acc;
  }, {});
  for (const brk of breaks) {
    const key = dayKey(brk.start);
    if (groups[key]) groups[key].push({ kind: 'break', time: brk.start, brk });
  }
  for (const key of Object.keys(groups)) {
    groups[key].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  }
  const dayKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  const lightboxRecord = lightboxIndex !== null ? records[lightboxIndex] : null;
  const showEmployeeBadge = isManager && !employeeId;

  useEffect(() => {
    if (!lightboxRecord || imageCache.has(lightboxRecord.id)) return;
    let alive = true;
    window.worktrack.screenshots.getImage(lightboxRecord.id).then((res) => {
      if (alive && res.success && res.data) onImageLoaded(lightboxRecord.id, res.data.dataUrl);
    });
    return () => { alive = false; };
  }, [lightboxRecord?.id]);

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 animate-fade-in pb-24 bg-background">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground tracking-tight">Screenshots</h2>
          <p className="text-sm font-medium text-muted-foreground mt-1">
            {isClient ? 'Work screenshots for your projects.' : isManager ? 'Work screenshots across your team.' : 'Your captured work screenshots.'}
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <Card className="p-4 flex flex-wrap items-center gap-4 bg-card/60 shadow-sm border-border/50">
        {isManager && (
          <div className="flex items-center gap-2">
            <User size={16} className="text-muted-foreground" />
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="bg-card border border-border rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm"
            >
              <option value="">All employees</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        )}

        {(isManager || isClient) && (
          <div className="flex items-center gap-2">
            <Briefcase size={16} className="text-muted-foreground" />
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="bg-card border border-border rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm"
            >
              <option value="">All projects</option>
              {projectOptions.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-muted-foreground" />
          <input
            type="date"
            value={date}
            disabled={allDates}
            onChange={(e) => setDate(e.target.value)}
            className="bg-card border border-border rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm disabled:opacity-40"
          />
        </div>

        <label className="flex items-center gap-2 text-sm font-semibold text-muted-foreground cursor-pointer select-none ml-auto hover:text-foreground transition-colors">
          <input type="checkbox" checked={allDates} onChange={(e) => setAllDates(e.target.checked)} className="accent-primary w-4 h-4 rounded" />
          All dates
        </label>
      </Card>

      {/* Content */}
      {loading && records.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-muted-foreground gap-3">
          <Loader2 size={32} className="animate-spin text-primary" />
          <span className="text-sm font-medium">Loading screenshots...</span>
        </div>
      ) : records.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-center px-6">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4 shadow-inner border border-border/50">
            <Camera size={28} className="text-muted-foreground" />
          </div>
          <p className="text-lg font-semibold text-foreground mb-1">No screenshots yet</p>
          <p className="text-sm text-muted-foreground font-medium">
            {allDates ? 'Nothing captured for this filter yet.' : 'Nothing captured on this day — try "All dates" or pick another day.'}
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {dayKeys.map((key) => (
            <div key={key}>
              <h3 className="text-lg font-display font-bold text-foreground mb-4 flex items-center gap-2">
                {fmtDayHeading(key)}
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                  {groups[key].filter((i) => i.kind === 'screenshot').length} captures
                </span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {groups[key].map((item) =>
                  item.kind === 'screenshot' ? (
                    <ScreenshotThumb
                      key={item.record.id}
                      record={item.record}
                      imageCache={imageCache}
                      onLoaded={onImageLoaded}
                      onOpen={() => setLightboxIndex(records.findIndex((x) => x.id === item.record.id))}
                      showEmployee={showEmployeeBadge}
                    />
                  ) : (
                    <BreakCard key={`${item.brk.userId}-${item.brk.start}`} brk={item.brk} showEmployee={showEmployeeBadge} />
                  )
                )}
              </div>
            </div>
          ))}

          {hasMore && (
            <div className="flex justify-center pt-4">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => load(records.length, true)}
                disabled={loading}
                className="px-6 py-2.5 rounded-full border border-border/60 bg-card/50 text-sm font-semibold text-foreground hover:bg-muted hover:shadow-sm transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {loading && <Loader2 size={16} className="animate-spin text-primary" />}
                Load more
              </motion.button>
            </div>
          )}
        </div>
      )}

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxRecord && lightboxIndex !== null && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6" 
            onClick={() => setLightboxIndex(null)}
          >
            <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" />
            <div className="relative z-10 max-w-5xl w-full flex flex-col items-center gap-6" onClick={(e) => e.stopPropagation()}>
              
              <div className="w-full flex items-center justify-between text-white text-sm bg-black/40 p-4 rounded-2xl border border-white/10 shadow-lg">
                <div className="flex items-center flex-wrap gap-4">
                  {lightboxRecord.employeeName && (
                    <span className="flex items-center gap-1.5 font-medium">
                      <User size={16} className="text-white/70" /> {lightboxRecord.employeeName}
                    </span>
                  )}
                  {lightboxRecord.taskTitle && (
                    <span className="flex items-center gap-1.5 font-medium">
                      <CheckCircle size={16} className="text-white/70" /> 
                      {lightboxRecord.taskTitle}
                      {lightboxRecord.projectName ? <span className="opacity-60 ml-1">· {lightboxRecord.projectName}</span> : ''}
                    </span>
                  )}
                  <span className="text-white/60 font-mono text-xs">{new Date(lightboxRecord.capturedAt).toLocaleString()}</span>
                </div>
                <button onClick={() => setLightboxIndex(null)} className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="relative w-full flex items-center justify-center">
                <button
                  disabled={lightboxIndex === 0}
                  onClick={() => setLightboxIndex((i) => (i !== null ? Math.max(0, i - 1) : i))}
                  className="absolute left-0 -translate-x-4 md:-translate-x-12 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center disabled:opacity-0 transition-all z-20 backdrop-blur-md border border-white/10"
                >
                  <ChevronLeft size={24} />
                </button>

                <motion.div 
                  key={lightboxRecord.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  {imageCache.get(lightboxRecord.id) ? (
                    <img src={imageCache.get(lightboxRecord.id)} alt="" className="max-h-[75vh] object-contain rounded-xl border border-white/20 shadow-2xl" />
                  ) : (
                    <div className="w-[60vw] h-[60vh] max-w-4xl rounded-xl bg-white/5 flex items-center justify-center text-white/40 border border-white/10">
                      <Loader2 size={32} className="animate-spin" />
                    </div>
                  )}
                </motion.div>

                <button
                  disabled={lightboxIndex === records.length - 1}
                  onClick={() => setLightboxIndex((i) => (i !== null ? Math.min(records.length - 1, i + 1) : i))}
                  className="absolute right-0 translate-x-4 md:translate-x-12 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center disabled:opacity-0 transition-all z-20 backdrop-blur-md border border-white/10"
                >
                  <ChevronRight size={24} />
                </button>
              </div>

              {lightboxRecord.driveFileUrl && (
                <button
                  onClick={() => window.worktrack.system.openExternal(lightboxRecord.driveFileUrl!)}
                  className="flex items-center gap-2 text-sm font-medium text-white/70 hover:text-white bg-white/10 hover:bg-white/20 px-5 py-2.5 rounded-full transition-colors border border-white/10 shadow-sm"
                >
                  <ExternalLink size={16} /> Open in Google Drive
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
