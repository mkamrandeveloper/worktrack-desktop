import { useState, useEffect, useCallback } from 'react';
import {
  Calendar, ChevronLeft, ChevronRight, Clock, Coffee, Monitor, TrendingUp,
  X, Loader2, LogIn, LogOut, PlayCircle, StopCircle, Award, LayoutGrid, CalendarDays
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { WeeklyTimesheet, MonthlyTimesheet, DailyTimesheet } from '@shared/types';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, Button, Badge, Separator } from '../components/ui/primitives';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { StatusBadge } from '../components/ui/StatusBadge';

type View = 'daily' | 'weekly' | 'monthly';

const CHART_COLORS = { work: '#10b981', breakC: '#f59e0b', overtime: '#ef4444', idle: '#64748b' };

const fmtHours = (v: number) => `${v.toFixed(1)}h`;
const fmtClock = (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—');
const productivityOf = (work: number, idle: number) => (work > 0 ? Math.max(0, Math.min(100, Math.round(((work - idle) / work) * 100))) : 0);

function startOfWeek(d: Date) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() - copy.getDay());
  copy.setHours(0, 0, 0, 0);
  return copy;
}
const toISODate = (d: Date) => d.toISOString().split('T')[0];

export function TimesheetsPage() {
  const [view, setView] = useState<View>('weekly');
  const [loading, setLoading] = useState(true);

  const [dailyDate, setDailyDate] = useState(() => toISODate(new Date()));
  const [dailyData, setDailyData] = useState<DailyTimesheet | null>(null);

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [weeklyData, setWeeklyData] = useState<WeeklyTimesheet | null>(null);

  const [monthCursor, setMonthCursor] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() + 1 }; });
  const [monthlyData, setMonthlyData] = useState<MonthlyTimesheet | null>(null);

  const [detailDate, setDetailDate] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (view === 'daily') {
        const res = await window.worktrack.timesheets.daily({ date: dailyDate });
        if (res.success && res.data) setDailyData(res.data);
      } else if (view === 'weekly') {
        const res = await window.worktrack.timesheets.weekly({ weekStart: toISODate(weekStart) });
        if (res.success && res.data) setWeeklyData(res.data);
      } else {
        const res = await window.worktrack.timesheets.monthly(monthCursor);
        if (res.success && res.data) setMonthlyData(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [view, dailyDate, weekStart, monthCursor]);

  useEffect(() => { load(); }, [load]);

  const shiftDaily = (delta: number) => {
    const d = new Date(dailyDate); d.setDate(d.getDate() + delta);
    setDailyDate(toISODate(d));
  };
  const shiftWeek = (delta: number) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + delta * 7);
    setWeekStart(startOfWeek(d));
  };
  const shiftMonth = (delta: number) => {
    let { year, month } = monthCursor;
    month += delta;
    if (month < 1) { month = 12; year -= 1; }
    if (month > 12) { month = 1; year += 1; }
    setMonthCursor({ year, month });
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="flex-none px-8 py-6 border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-10 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">Timesheets</h1>
          <p className="text-sm font-medium text-muted-foreground mt-1">Review your logged hours, breaks, and attendance history.</p>
        </div>
        <div className="flex items-center gap-1 bg-card/60 p-1.5 rounded-xl border border-border/50 shadow-sm">
          {(['daily', 'weekly', 'monthly'] as View[]).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={clsx('px-5 py-2 text-sm font-bold tracking-wide uppercase rounded-lg transition-all duration-300', view === v ? 'bg-primary text-primary-foreground shadow-md' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50')}>
              {v}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8 pb-24 animate-fade-in">
        <div className="max-w-[1400px] mx-auto space-y-8">
          {view === 'daily' && (
            <DailyView
              date={dailyDate} data={dailyData} loading={loading}
              onPrev={() => shiftDaily(-1)} onNext={() => shiftDaily(1)}
              onJumpToday={() => setDailyDate(toISODate(new Date()))}
            />
          )}
          {view === 'weekly' && (
            <WeeklyView
              weekStart={weekStart} data={weeklyData} loading={loading}
              onPrev={() => shiftWeek(-1)} onNext={() => shiftWeek(1)}
              onSelectDay={(date) => setDetailDate(date)}
            />
          )}
          {view === 'monthly' && (
            <MonthlyView
              cursor={monthCursor} data={monthlyData} loading={loading}
              onPrev={() => shiftMonth(-1)} onNext={() => shiftMonth(1)}
              onSelectDay={(date) => setDetailDate(date)}
            />
          )}
        </div>
      </div>

      <AnimatePresence>
        {detailDate && <DayDetailModal date={detailDate} onClose={() => setDetailDate(null)} />}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ title, value, icon, color = 'primary', loading }: { title: string; value: string; icon: React.ReactNode; color?: string; loading?: boolean }) {
  const colors: Record<string, string> = {
    primary: 'bg-primary/10 text-primary',
    warning: 'bg-amber-500/10 text-amber-500',
    danger: 'bg-destructive/10 text-destructive',
    success: 'bg-emerald-500/10 text-emerald-500',
    default: 'bg-muted text-muted-foreground',
  };

  return (
    <Card className="p-6 flex flex-col justify-between min-h-[140px] hover:-translate-y-1 transition-transform">
      <div className="flex justify-between items-start mb-4">
        <span className="font-display text-[12px] uppercase tracking-wider font-bold text-muted-foreground">{title}</span>
        <span className={clsx("w-9 h-9 rounded-full flex items-center justify-center shrink-0", colors[color] || colors.default)}>
          {icon}
        </span>
      </div>
      <div>
        <div className="text-3xl font-display font-bold text-foreground tracking-tight">{loading ? '—' : value}</div>
      </div>
    </Card>
  );
}

// ── Daily View ───────────────────────────────────────────────────────────────
function DailyView({ date, data, loading, onPrev, onNext, onJumpToday }: {
  date: string; data: DailyTimesheet | null; loading: boolean;
  onPrev: () => void; onNext: () => void; onJumpToday: () => void;
}) {
  const work = data?.workHours ?? 0, brk = data?.breakHours ?? 0, ot = data?.overtimeHours ?? 0, idle = data?.idleHours ?? 0;
  const productivity = productivityOf(work, idle);
  const pieData = [
    { name: 'Working', value: work, color: CHART_COLORS.work },
    { name: 'Break', value: brk, color: CHART_COLORS.breakC },
    { name: 'Overtime', value: ot, color: CHART_COLORS.overtime },
    { name: 'Idle', value: idle, color: CHART_COLORS.idle },
  ].filter((d) => d.value > 0);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <DateNav label={new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} onPrev={onPrev} onNext={onNext} extra={
        <Button variant="outline" onClick={onJumpToday} size="sm" className="shadow-sm">Today</Button>
      } />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-5">
        <StatCard title="Working Hours" value={fmtHours(work)} icon={<Monitor size={18} />} color="primary" loading={loading} />
        <StatCard title="Break Time" value={fmtHours(brk)} icon={<Coffee size={18} />} color="warning" loading={loading} />
        <StatCard title="Overtime" value={fmtHours(ot)} icon={<TrendingUp size={18} />} color="danger" loading={loading} />
        <StatCard title="Idle Time" value={fmtHours(idle)} icon={<Clock size={18} />} color="default" loading={loading} />
        <StatCard title="Productivity" value={`${productivity}%`} icon={<Award size={18} />} color="success" loading={loading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-7">
          <h3 className="text-sm font-display font-bold uppercase tracking-wider text-muted-foreground mb-6">Time Breakdown</h3>
          <div className="h-64 w-full">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={4} cornerRadius={4} stroke="none">
                    {pieData.map((d) => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                  <Tooltip formatter={(v) => `${Number(v).toFixed(1)}h`} contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '12px', boxShadow: 'var(--tw-shadow-lg)' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 500 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground font-medium text-sm bg-muted/20 rounded-xl border border-dashed border-border/50">No activity recorded for this day.</div>
            )}
          </div>
        </Card>

        <div className="lg:col-span-2">
          <DailyDetailInline date={date} data={data} loading={loading} />
        </div>
      </div>
    </motion.div>
  );
}

function DailyDetailInline({ date, data, loading }: { date: string; data: DailyTimesheet | null; loading: boolean }) {
  if (loading) return <Card className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></Card>;
  if (!data) return null;
  return <TimelineCard date={date} data={data} />;
}

function TimelineCard({ date, data }: { date: string; data: DailyTimesheet }) {
  const icons: Record<string, React.ReactNode> = {
    clock_in: <LogIn size={14} />,
    clock_out: <LogOut size={14} />,
    break_start: <Coffee size={14} />,
    break_end: <Coffee size={14} />,
    session_start: <PlayCircle size={14} />,
    session_end: <StopCircle size={14} />,
  };
  return (
    <Card className="p-7 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-display font-bold uppercase tracking-wider text-muted-foreground">Chronological Activity Log</h3>
        <Badge variant="outline" className="font-mono bg-background">{new Date(date).toLocaleDateString()}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8 text-sm">
        <div className="flex justify-between items-center p-4 rounded-xl bg-card border border-border shadow-sm"><span className="text-muted-foreground font-medium">Clock In</span><span className="font-mono font-bold text-base">{fmtClock(data.attendance.clockInTime)}</span></div>
        <div className="flex justify-between items-center p-4 rounded-xl bg-card border border-border shadow-sm"><span className="text-muted-foreground font-medium">Clock Out</span><span className="font-mono font-bold text-base">{fmtClock(data.attendance.clockOutTime)}</span></div>
      </div>

      {data.breaks && data.breaks.length > 0 && (
        <div className="mb-8">
          <p className="text-xs font-display font-bold uppercase tracking-wider text-muted-foreground mb-3">Breaks ({data.breaks.length})</p>
          <div className="space-y-2">
            {data.breaks.map((b, i) => (
              <div key={i} className="flex justify-between items-center text-sm px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 font-medium">
                <span className="font-mono">{fmtClock(b.start)} → {b.end ? fmtClock(b.end) : 'ongoing'}</span>
                {b.end && <span className="opacity-70 bg-amber-500/20 px-2 py-0.5 rounded text-xs">{Math.round((new Date(b.end).getTime() - new Date(b.start).getTime()) / 60000)} min</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {!data.timeline || data.timeline.length === 0 ? (
        <p className="text-sm text-muted-foreground font-medium text-center py-10 flex-1 bg-muted/20 rounded-xl border border-dashed border-border/50">No activity logged for this day.</p>
      ) : (
        <div className="relative border-l-2 border-border/50 ml-4 flex flex-col gap-6 pt-2 pb-4">
          {data.timeline.map((e, i) => (
            <div key={i} className="relative pl-8 group">
              <span className={clsx('absolute -left-[11px] top-1 w-5 h-5 rounded-full border-4 ring-4 ring-card', i === 0 ? 'bg-card border-primary' : 'bg-muted border-card')} />
              <div className="bg-card/40 rounded-xl p-4 border border-border/60 hover:bg-card hover:shadow-md transition-all duration-300 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20 shadow-inner">
                  {icons[e.type] ?? <Clock size={16} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate mb-0.5">{e.label}</div>
                  <div className="text-xs text-muted-foreground font-mono">{fmtClock(e.timestamp)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ── Weekly View ──────────────────────────────────────────────────────────────
function DateNav({ label, onPrev, onNext, extra }: { label: string; onPrev: () => void; onNext: () => void; extra?: React.ReactNode }) {
  return (
    <Card className="flex items-center justify-between p-4 px-6 mb-8 shadow-sm">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onPrev} className="rounded-full bg-muted/50 hover:bg-muted"><ChevronLeft size={20} /></Button>
        <span className="font-display font-bold text-xl text-foreground tracking-tight min-w-[200px] text-center">{label}</span>
        <Button variant="ghost" size="icon" onClick={onNext} className="rounded-full bg-muted/50 hover:bg-muted"><ChevronRight size={20} /></Button>
      </div>
      <div className="flex items-center gap-3">
        {extra}
        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
          <CalendarDays size={18} />
        </div>
      </div>
    </Card>
  );
}

function WeeklyView({ weekStart, data, loading, onPrev, onNext, onSelectDay }: {
  weekStart: Date; data: WeeklyTimesheet | null; loading: boolean;
  onPrev: () => void; onNext: () => void; onSelectDay: (date: string) => void;
}) {
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6);
  const chartData = (data?.days ?? []).map((d) => ({
    name: new Date(d.date).toLocaleDateString(undefined, { weekday: 'short' }),
    date: d.date,
    Working: d.workHours, Break: d.breakHours, Overtime: d.overtimeHours, Idle: d.idleHours,
    Productivity: productivityOf(d.workHours, d.idleHours),
  }));

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <DateNav label={`${weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} — ${weekEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`} onPrev={onPrev} onNext={onNext} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard title="Total Work" value={data ? fmtHours(data.totals.totalWorkHours) : '0h'} icon={<Monitor size={18} />} color="primary" loading={loading} />
        <StatCard title="Total Break" value={data ? fmtHours(data.totals.totalBreakHours) : '0h'} icon={<Coffee size={18} />} color="warning" loading={loading} />
        <StatCard title="Idle Time" value={data ? fmtHours(data.totals.totalIdleHours) : '0h'} icon={<Clock size={18} />} color="default" loading={loading} />
        <StatCard title="Overtime" value={data ? fmtHours(data.totals.totalOvertimeHours) : '0h'} icon={<TrendingUp size={18} />} color="danger" loading={loading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-7">
          <h3 className="text-sm font-display font-bold uppercase tracking-wider text-muted-foreground mb-6">Daily Breakdown (Stacked)</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} dx={-10} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '12px', boxShadow: 'var(--tw-shadow-lg)' }} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 500, paddingTop: '20px' }} />
                <Bar dataKey="Working" stackId="a" fill={CHART_COLORS.work} radius={[0, 0, 0, 0]} />
                <Bar dataKey="Break" stackId="a" fill={CHART_COLORS.breakC} />
                <Bar dataKey="Overtime" stackId="a" fill={CHART_COLORS.overtime} />
                <Bar dataKey="Idle" stackId="a" fill={CHART_COLORS.idle} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-7">
          <h3 className="text-sm font-display font-bold uppercase tracking-wider text-muted-foreground mb-6">Productivity Trend</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} dx={-10} />
                <Tooltip formatter={(v) => `${v}%`} contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '12px', boxShadow: 'var(--tw-shadow-lg)' }} />
                <Line type="monotone" dataKey="Productivity" stroke={CHART_COLORS.work} strokeWidth={3} dot={{ r: 4, fill: CHART_COLORS.work, strokeWidth: 2, stroke: 'hsl(var(--card))' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Clock In</TableHead>
            <TableHead>Clock Out</TableHead>
            <TableHead>Work</TableHead>
            <TableHead>Break</TableHead>
            <TableHead>Overtime</TableHead>
            <TableHead>Idle</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground animate-pulse py-10">Loading timesheet...</TableCell></TableRow>
          ) : data?.days.map((day) => (
            <TableRow key={day.date} onClick={() => onSelectDay(day.date)} className="cursor-pointer group">
              <TableCell className="font-semibold text-foreground group-hover:text-primary transition-colors">{new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</TableCell>
              <TableCell>
                <StatusBadge variant={
                  day.attendance.status === 'present' ? 'success' :
                  day.attendance.status === 'absent' ? 'danger' :
                  day.attendance.status === 'late' ? 'warning' : 'default'
                } />
              </TableCell>
              <TableCell className="text-muted-foreground font-mono">{fmtClock(day.attendance.clockInTime)}</TableCell>
              <TableCell className="text-muted-foreground font-mono">{fmtClock(day.attendance.clockOutTime)}</TableCell>
              <TableCell className="font-semibold">{fmtHours(day.workHours)}</TableCell>
              <TableCell className="text-muted-foreground">{fmtHours(day.breakHours)}</TableCell>
              <TableCell className="text-muted-foreground">{fmtHours(day.overtimeHours)}</TableCell>
              <TableCell className="text-muted-foreground">{fmtHours(day.idleHours)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </motion.div>
  );
}

// ── Monthly View ─────────────────────────────────────────────────────────────
function MonthlyView({ cursor, data, loading, onPrev, onNext, onSelectDay }: {
  cursor: { year: number; month: number }; data: MonthlyTimesheet | null; loading: boolean;
  onPrev: () => void; onNext: () => void; onSelectDay: (date: string) => void;
}) {
  const monthLabel = new Date(cursor.year, cursor.month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const days = data?.days ?? [];
  const firstWeekday = days.length ? new Date(days[0].date).getDay() : 0;
  const leadingBlanks = Array.from({ length: firstWeekday });

  const chartData = days.map((d) => ({ name: new Date(d.date).getDate().toString(), Working: d.workHours, Productivity: d.productivity }));

  const weeks: { label: string; workHours: number; breakHours: number; overtimeHours: number }[] = [];
  for (let i = 0; i < days.length; i += 7) {
    const chunk = days.slice(i, i + 7);
    weeks.push({
      label: `${new Date(chunk[0].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${new Date(chunk[chunk.length - 1].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
      workHours: Math.round(chunk.reduce((s, d) => s + d.workHours, 0) * 100) / 100,
      breakHours: Math.round(chunk.reduce((s, d) => s + d.breakHours, 0) * 100) / 100,
      overtimeHours: Math.round(chunk.reduce((s, d) => s + d.overtimeHours, 0) * 100) / 100,
    });
  }

  const statusColor: Record<string, string> = {
    present: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:border-emerald-500/50',
    late: 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400 hover:border-amber-500/50',
    absent: 'bg-transparent border-border/60 text-muted-foreground hover:border-border',
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <DateNav label={monthLabel} onPrev={onPrev} onNext={onNext} />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-5">
        <StatCard title="Total Work" value={data ? fmtHours(data.totals.totalWorkHours) : '0h'} icon={<Monitor size={18} />} color="primary" loading={loading} />
        <StatCard title="Total Break" value={data ? fmtHours(data.totals.totalBreakHours) : '0h'} icon={<Coffee size={18} />} color="warning" loading={loading} />
        <StatCard title="Overtime" value={data ? fmtHours(data.totals.totalOvertimeHours) : '0h'} icon={<TrendingUp size={18} />} color="danger" loading={loading} />
        <StatCard title="Idle Time" value={data ? fmtHours(data.totals.totalIdleHours) : '0h'} icon={<Clock size={18} />} color="default" loading={loading} />
        <StatCard title="Avg Productivity" value={data ? `${data.totals.avgProductivity}%` : '0%'} icon={<Award size={18} />} color="success" loading={loading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-7">
          <h3 className="text-sm font-display font-bold uppercase tracking-wider text-muted-foreground mb-6">Daily Working Hours</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} interval={2} dy={10} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} dx={-10} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '12px', boxShadow: 'var(--tw-shadow-lg)' }} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }} />
                <Bar dataKey="Working" fill={CHART_COLORS.work} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-7">
          <h3 className="text-sm font-display font-bold uppercase tracking-wider text-muted-foreground mb-6">Productivity Trend</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} interval={2} dy={10} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} dx={-10} />
                <Tooltip formatter={(v) => `${v}%`} contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '12px', boxShadow: 'var(--tw-shadow-lg)' }} />
                <Line type="monotone" dataKey="Productivity" stroke={CHART_COLORS.work} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <h3 className="text-sm font-display font-bold uppercase tracking-wider text-muted-foreground mb-4">Weekly Summaries</h3>
          <div className="flex flex-col gap-3">
            {weeks.map((w, i) => (
              <Card key={i} className="p-4 bg-card/30">
                <p className="text-xs font-semibold text-muted-foreground mb-2">{w.label}</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-bold text-foreground">{fmtHours(w.workHours)}</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Work</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-muted-foreground">{fmtHours(w.breakHours)} <span className="text-[10px]">BRK</span></p>
                    <p className="text-sm font-medium text-muted-foreground">{fmtHours(w.overtimeHours)} <span className="text-[10px]">OT</span></p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <Card className="lg:col-span-3 p-7">
          <h3 className="text-sm font-display font-bold uppercase tracking-wider text-muted-foreground mb-6">Calendar</h3>
          <div className="grid grid-cols-7 gap-3 mb-3 text-center text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-3">
            {leadingBlanks.map((_, i) => <div key={`b${i}`} />)}
            {days.map((d) => (
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                key={d.date} 
                onClick={() => onSelectDay(d.date)}
                className={clsx('aspect-square rounded-xl border p-2 flex flex-col items-center justify-center transition-colors shadow-sm', statusColor[d.status] ?? statusColor.absent)}
              >
                <span className="text-sm font-bold">{new Date(d.date).getDate()}</span>
                {d.workHours > 0 && <span className="text-[10px] mt-1 font-medium bg-background/50 px-1.5 py-0.5 rounded">{d.workHours.toFixed(1)}h</span>}
              </motion.button>
            ))}
          </div>
        </Card>
      </div>
    </motion.div>
  );
}

// ── Day Detail Modal ─────────────────────────────────────────────────────────
function DayDetailModal({ date, onClose }: { date: string; onClose: () => void }) {
  const [data, setData] = useState<DailyTimesheet | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    window.worktrack.timesheets.daily({ date }).then((res) => {
      if (!cancelled && res.success && res.data) setData(res.data);
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [date]);

  const work = data?.workHours ?? 0, idle = data?.idleHours ?? 0;
  const productivity = productivityOf(work, idle);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }} 
        exit={{ opacity: 0, scale: 0.95, y: 20 }} 
        className="relative bg-card border border-border rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between p-6 border-b border-border bg-muted/20">
          <div>
            <h3 className="font-display font-bold text-xl text-foreground">{new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</h3>
            <p className="text-sm font-medium text-muted-foreground mt-1">Detailed daily timeline</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full"><X size={20} /></Button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : !data ? (
            <p className="text-sm text-muted-foreground font-medium text-center py-20 bg-muted/20 rounded-xl border border-dashed border-border/50">No data for this day.</p>
          ) : (
            <div className="space-y-8">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                  ['Work', fmtHours(data.workHours)], ['Break', fmtHours(data.breakHours)],
                  ['Overtime', fmtHours(data.overtimeHours)], ['Idle', fmtHours(data.idleHours)],
                  ['Productivity', `${productivity}%`],
                ].map(([k, v]) => (
                  <div key={k} className="text-center p-4 rounded-xl bg-card border border-border shadow-sm">
                    <div className="text-xl font-display font-bold text-foreground mb-1">{v}</div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{k}</div>
                  </div>
                ))}
              </div>
              <TimelineCard date={date} data={data} />
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
