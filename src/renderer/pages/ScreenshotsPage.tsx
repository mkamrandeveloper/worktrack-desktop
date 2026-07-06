import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { MaterialIcon } from '../components/ui/MaterialIcon';
import { ScreenshotRecord, TeamMember, BreakInterval } from '@shared/types';
import { formatDuration } from '../utils/formatTime';
import { clsx } from 'clsx';

const PAGE_SIZE = 36;

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

type DayItem =
  | { kind: 'screenshot'; time: string; record: ScreenshotRecord }
  | { kind: 'break'; time: string; brk: BreakInterval };

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
    <button
      onClick={onOpen}
      className="group relative aspect-video rounded-xl overflow-hidden bg-muted border border-border hover:border-primary/50 hover:shadow-md transition-all text-left"
    >
      {status === 'ready' && src ? (
        <img src={src} alt="" className="w-full h-full object-cover" />
      ) : status === 'error' ? (
        <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-1">
          <MaterialIcon name="broken_image" size={22} />
          <span className="text-[10px]">Unavailable</span>
        </div>
      ) : (
        <div className="w-full h-full flex items-center justify-center text-muted-foreground/50 animate-pulse">
          <MaterialIcon name="image" size={22} />
        </div>
      )}
      {showEmployee && record.employeeName && (
        <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/75 to-transparent px-2 py-1.5 flex items-center gap-1.5">
          <span className="w-4 h-4 rounded-full bg-white/25 backdrop-blur text-white text-[8px] font-bold flex items-center justify-center shrink-0">
            {initials(record.employeeName)}
          </span>
          <span className="text-white text-[11px] font-semibold truncate drop-shadow">{record.employeeName}</span>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent p-2">
        <span className="text-white text-[11px] font-medium drop-shadow">{fmtTime(record.capturedAt)}</span>
      </div>
    </button>
  );
}

function BreakCard({ brk, showEmployee }: { brk: BreakInterval; showEmployee: boolean }) {
  const durationLabel = brk.end
    ? formatDuration(Math.round((new Date(brk.end).getTime() - new Date(brk.start).getTime()) / 1000))
    : 'Ongoing';
  return (
    <div className="aspect-video rounded-xl border border-amber-300/50 bg-amber-50 dark:bg-amber-500/10 flex flex-col items-center justify-center gap-1 text-amber-700 dark:text-amber-400 p-2 text-center">
      <MaterialIcon name="coffee" size={20} />
      <span className="text-[11px] font-semibold">On Break</span>
      <span className="text-[10px] opacity-80">
        {fmtTime(brk.start)}{brk.end ? ` – ${fmtTime(brk.end)}` : ''} · {durationLabel}
      </span>
      {showEmployee && <span className="text-[10px] font-medium truncate max-w-full">{brk.employeeName}</span>}
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
  const [breaks, setBreaks] = useState<BreakInterval[]>([]);
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
  // Breaks are only merged into days that already have at least one
  // screenshot in view (avoids showing a lone break card on an "all dates"
  // view for a day the current filters wouldn't otherwise surface).
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

  // Safety net: fetch the image directly if the lightbox opens on an id
  // whose thumbnail hasn't finished loading yet.
  useEffect(() => {
    if (!lightboxRecord || imageCache.has(lightboxRecord.id)) return;
    let alive = true;
    window.worktrack.screenshots.getImage(lightboxRecord.id).then((res) => {
      if (alive && res.success && res.data) onImageLoaded(lightboxRecord.id, res.data.dataUrl);
    });
    return () => { alive = false; };
  }, [lightboxRecord?.id]);

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 animate-fade-in pb-24">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">Screenshots</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isClient ? 'Work screenshots for your projects.' : isManager ? 'Work screenshots across your team.' : 'Your captured work screenshots.'}
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="glass-panel rounded-xl p-4 flex flex-wrap items-center gap-3">
        {isManager && (
          <div className="flex items-center gap-2">
            <MaterialIcon name="person" size={16} className="text-muted-foreground" />
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="bg-input border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
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
            <MaterialIcon name="work_outline" size={16} className="text-muted-foreground" />
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="bg-input border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">All projects</option>
              {projectOptions.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-2">
          <MaterialIcon name="calendar_today" size={16} className="text-muted-foreground" />
          <input
            type="date"
            value={date}
            disabled={allDates}
            onChange={(e) => setDate(e.target.value)}
            className="bg-input border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-40"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none ml-auto">
          <input type="checkbox" checked={allDates} onChange={(e) => setAllDates(e.target.checked)} className="accent-primary" />
          All dates
        </label>
      </div>

      {/* Content */}
      {loading && records.length === 0 ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
          <MaterialIcon name="progress_activity" size={20} className="animate-spin" />
          Loading screenshots...
        </div>
      ) : records.length === 0 ? (
        <div className="glass-panel rounded-xl flex flex-col items-center justify-center py-24 text-center px-6">
          <MaterialIcon name="photo_camera" size={32} className="text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-foreground mb-1">No screenshots yet</p>
          <p className="text-xs text-muted-foreground">
            {allDates ? 'Nothing captured for this filter yet.' : 'Nothing captured on this day — try "All dates" or pick another day.'}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {dayKeys.map((key) => (
            <div key={key}>
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                {fmtDayHeading(key)}
                <span className="text-xs font-normal text-muted-foreground">
                  ({groups[key].filter((i) => i.kind === 'screenshot').length})
                </span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
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
            <div className="flex justify-center">
              <button
                onClick={() => load(records.length, true)}
                disabled={loading}
                className="px-5 py-2.5 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition disabled:opacity-50 flex items-center gap-2"
              >
                {loading && <MaterialIcon name="progress_activity" size={16} className="animate-spin" />}
                Load more
              </button>
            </div>
          )}
        </div>
      )}

      {/* Lightbox */}
      {lightboxRecord && lightboxIndex !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" onClick={() => setLightboxIndex(null)}>
          <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" />
          <div className="relative z-10 max-w-4xl w-full flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
            <div className="w-full flex items-center justify-between text-white/90 text-sm">
              <div className="flex items-center gap-3">
                {lightboxRecord.employeeName && (
                  <span className="flex items-center gap-1.5">
                    <MaterialIcon name="person" size={16} /> {lightboxRecord.employeeName}
                  </span>
                )}
                {lightboxRecord.taskTitle && (
                  <span className="flex items-center gap-1.5 text-white/70">
                    <MaterialIcon name="task_alt" size={16} /> {lightboxRecord.taskTitle}
                    {lightboxRecord.projectName ? ` · ${lightboxRecord.projectName}` : ''}
                  </span>
                )}
                <span className="text-white/60">{new Date(lightboxRecord.capturedAt).toLocaleString()}</span>
              </div>
              <button onClick={() => setLightboxIndex(null)} className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center">
                <MaterialIcon name="close" size={20} />
              </button>
            </div>

            <div className="relative w-full flex items-center justify-center">
              <button
                disabled={lightboxIndex === 0}
                onClick={() => setLightboxIndex((i) => (i !== null ? Math.max(0, i - 1) : i))}
                className="absolute left-0 -translate-x-14 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center disabled:opacity-30"
              >
                <MaterialIcon name="chevron_left" size={22} />
              </button>

              {imageCache.get(lightboxRecord.id) ? (
                <img src={imageCache.get(lightboxRecord.id)} alt="" className="max-h-[70vh] rounded-xl border border-white/10 shadow-2xl" />
              ) : (
                <div className="w-full h-[50vh] rounded-xl bg-white/5 flex items-center justify-center text-white/40">
                  <MaterialIcon name="progress_activity" size={28} className="animate-spin" />
                </div>
              )}

              <button
                disabled={lightboxIndex === records.length - 1}
                onClick={() => setLightboxIndex((i) => (i !== null ? Math.min(records.length - 1, i + 1) : i))}
                className="absolute right-0 translate-x-14 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center disabled:opacity-30"
              >
                <MaterialIcon name="chevron_right" size={22} />
              </button>
            </div>

            {lightboxRecord.driveFileUrl && (
              <button
                onClick={() => window.worktrack.system.openExternal(lightboxRecord.driveFileUrl!)}
                className={clsx(
                  'flex items-center gap-1.5 text-xs text-white/70 hover:text-white transition',
                )}
              >
                <MaterialIcon name="open_in_new" size={14} /> Open in Google Drive
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
