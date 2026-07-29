import { useState, useEffect, useCallback } from 'react';
import {
  Calendar, ChevronLeft, ChevronRight, Clock, Coffee, Monitor, TrendingUp,
  X, Loader2, LogIn, LogOut, PlayCircle, StopCircle, Award,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { WeeklyTimesheet, MonthlyTimesheet, DailyTimesheet } from '@shared/types';
import { clsx } from 'clsx';
import { KPICard } from '../components/ui/KPICard';
import { Card } from '../components/ui/primitives';
import { StatusBadge } from '../components/ui/StatusBadge';

type View = 'daily' | 'weekly' | 'monthly';

const CHART_COLORS = { work: '#7c3aed', breakC: '#f59e0b', overtime: '#ef4444', idle: '#64748b' };

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
    <div className="flex flex-col h-full bg-background/50">
      <header className="flex-none px-8 py-6 border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-7xl mx-auto flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Timesheets</h1>
            <p className="text-sm text-muted-foreground mt-1">Review your logged hours, breaks, and attendance history.</p>
          </div>
          <div className="flex items-center gap-1 bg-muted/50 p-1.5 rounded-xl border border-border">
            {(['daily', 'weekly', 'monthly'] as View[]).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={clsx('px-5 py-2 text-sm font-semibold rounded-lg capitalize transition-all duration-300', view === v ? 'bg-background shadow-md text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60')}>
                {v}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-7xl mx-auto space-y-6">
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

      {detailDate && <DayDetailModal date={detailDate} onClose={() => setDetailDate(null)} />}
    </div>
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
    <>
      <DateNav label={new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} onPrev={onPrev} onNext={onNext} extra={
        <button onClick={onJumpToday} className="px-3 py-2 text-sm font-medium border border-border rounded-lg hover:bg-muted/50 transition-colors">Today</button>
      } />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KPICard title="Working Hours" value={fmtHours(work)} icon={<Monitor />} color="primary" loading={loading} />
        <KPICard title="Break Time" value={fmtHours(brk)} icon={<Coffee />} color="warning" loading={loading} />
        <KPICard title="Overtime" value={fmtHours(ot)} icon={<TrendingUp />} color="danger" loading={loading} />
        <KPICard title="Idle Time" value={fmtHours(idle)} icon={<Clock />} loading={loading} />
        <KPICard title="Productivity" value={`${productivity}%`} icon={<Award />} color="success" loading={loading} />
      </div>

      <Card className="p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Time Breakdown</h3>
        <div className="h-64 w-full">
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {pieData.map((d) => <Cell key={d.name} fill={d.color} />)}
                </Pie>
                <Tooltip formatter={(v) => `${Number(v).toFixed(1)}h`} contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '8px' }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No activity recorded for this day.</div>
          )}
        </div>
      </Card>

      <DailyDetailInline date={date} data={data} loading={loading} />
    </>
  );
}

// Inline detail panel for the Daily tab's own selected date (no need for a modal here).
function DailyDetailInline({ date, data, loading }: { date: string; data: DailyTimesheet | null; loading: boolean }) {
  if (loading) return <Card className="p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></Card>;
  if (!data) return null;
  return <TimelineCard date={date} data={data} />;
}

function TimelineCard({ date, data }: { date: string; data: DailyTimesheet }) {
  const icons: Record<string, React.ReactNode> = {
    clock_in: <LogIn className="w-3.5 h-3.5" />,
    clock_out: <LogOut className="w-3.5 h-3.5" />,
    break_start: <Coffee className="w-3.5 h-3.5" />,
    break_end: <Coffee className="w-3.5 h-3.5" />,
    session_start: <PlayCircle className="w-3.5 h-3.5" />,
    session_end: <StopCircle className="w-3.5 h-3.5" />,
  };
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Chronological Activity Log</h3>
        <span className="text-xs text-muted-foreground">{new Date(date).toLocaleDateString()}</span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
        <div className="flex justify-between p-3 rounded-lg bg-secondary/40"><span className="text-muted-foreground">Clock In</span><span className="font-medium">{fmtClock(data.attendance.clockInTime)}</span></div>
        <div className="flex justify-between p-3 rounded-lg bg-secondary/40"><span className="text-muted-foreground">Clock Out</span><span className="font-medium">{fmtClock(data.attendance.clockOutTime)}</span></div>
      </div>

      {data.breaks && data.breaks.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-medium text-muted-foreground mb-2">Breaks ({data.breaks.length})</p>
          <div className="space-y-1.5">
            {data.breaks.map((b, i) => (
              <div key={i} className="flex justify-between text-xs px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/20">
                <span>{fmtClock(b.start)} → {b.end ? fmtClock(b.end) : 'ongoing'}</span>
                {b.end && <span className="text-muted-foreground">{Math.round((new Date(b.end).getTime() - new Date(b.start).getTime()) / 60000)} min</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {!data.timeline || data.timeline.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No activity logged for this day.</p>
      ) : (
        <div className="space-y-0">
          {data.timeline.map((e, i) => (
            <div key={i} className="flex items-center gap-3 py-2.5 border-b border-border/40 last:border-0">
              <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">{icons[e.type] ?? <Clock className="w-3.5 h-3.5" />}</div>
              <span className="text-sm flex-1">{e.label}</span>
              <span className="text-xs text-muted-foreground font-mono">{fmtClock(e.timestamp)}</span>
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
    <div className="flex items-center justify-between bg-card/80 border border-border rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <button onClick={onPrev} className="p-2.5 hover:bg-muted rounded-xl text-muted-foreground transition-all duration-300 hover:-translate-y-0.5 hover:shadow-sm active:scale-95"><ChevronLeft className="w-5 h-5" /></button>
        <span className="font-semibold px-3 text-lg">{label}</span>
        <button onClick={onNext} className="p-2.5 hover:bg-muted rounded-xl text-muted-foreground transition-all duration-300 hover:-translate-y-0.5 hover:shadow-sm active:scale-95"><ChevronRight className="w-5 h-5" /></button>
      </div>
      <div className="flex items-center gap-2">{extra}<Calendar className="w-4 h-4 text-muted-foreground" /></div>
    </div>
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
    <>
      <DateNav label={`${weekStart.toLocaleDateString()} — ${weekEnd.toLocaleDateString()}`} onPrev={onPrev} onNext={onNext} />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard title="Total Work" value={data ? fmtHours(data.totals.totalWorkHours) : '0h'} icon={<Monitor />} color="primary" loading={loading} />
        <KPICard title="Total Break" value={data ? fmtHours(data.totals.totalBreakHours) : '0h'} icon={<Coffee />} color="warning" loading={loading} />
        <KPICard title="Idle Time" value={data ? fmtHours(data.totals.totalIdleHours) : '0h'} icon={<Clock />} loading={loading} />
        <KPICard title="Overtime" value={data ? fmtHours(data.totals.totalOvertimeHours) : '0h'} icon={<TrendingUp />} color="success" loading={loading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Daily Breakdown (Stacked)</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                <XAxis dataKey="name" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '8px' }} cursor={{ fill: '#374151', opacity: 0.2 }} />
                <Legend />
                <Bar dataKey="Working" stackId="a" fill={CHART_COLORS.work} radius={[0, 0, 0, 0]} />
                <Bar dataKey="Break" stackId="a" fill={CHART_COLORS.breakC} />
                <Bar dataKey="Overtime" stackId="a" fill={CHART_COLORS.overtime} />
                <Bar dataKey="Idle" stackId="a" fill={CHART_COLORS.idle} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Productivity Trend</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                <XAxis dataKey="name" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip formatter={(v) => `${v}%`} contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '8px' }} />
                <Line type="monotone" dataKey="Productivity" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground font-medium border-b border-border">
              <tr>
                <th className="px-6 py-4">Date</th><th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Clock In</th><th className="px-6 py-4">Clock Out</th>
                <th className="px-6 py-4">Work</th><th className="px-6 py-4">Break</th><th className="px-6 py-4">Overtime</th><th className="px-6 py-4">Idle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {loading ? (
                <tr><td colSpan={8} className="px-6 py-8 text-center text-muted-foreground animate-pulse">Loading timesheet...</td></tr>
              ) : data?.days.map((day) => (
                <tr key={day.date} onClick={() => onSelectDay(day.date)} className="hover:bg-muted/40 transition-all duration-300 cursor-pointer group">
                  <td className="px-6 py-5 font-semibold text-foreground group-hover:text-primary transition-colors">{new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</td>
                  <td className="px-6 py-5">
                    <StatusBadge variant={
                      day.attendance.status === 'present' ? 'success' :
                      day.attendance.status === 'absent' ? 'danger' :
                      day.attendance.status === 'late' ? 'warning' : 'default'
                    } />
                  </td>
                  <td className="px-6 py-5 text-muted-foreground">{fmtClock(day.attendance.clockInTime)}</td>
                  <td className="px-6 py-5 text-muted-foreground">{fmtClock(day.attendance.clockOutTime)}</td>
                  <td className="px-6 py-5 font-semibold">{fmtHours(day.workHours)}</td>
                  <td className="px-6 py-5 text-muted-foreground">{fmtHours(day.breakHours)}</td>
                  <td className="px-6 py-5 text-muted-foreground">{fmtHours(day.overtimeHours)}</td>
                  <td className="px-6 py-5 text-muted-foreground">{fmtHours(day.idleHours)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
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

  // Weekly subtotals within the month
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
    present: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
    late: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
    absent: 'bg-transparent border-border/60 text-muted-foreground/50',
  };

  return (
    <>
      <DateNav label={monthLabel} onPrev={onPrev} onNext={onNext} />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KPICard title="Total Work" value={data ? fmtHours(data.totals.totalWorkHours) : '0h'} icon={<Monitor />} color="primary" loading={loading} />
        <KPICard title="Total Break" value={data ? fmtHours(data.totals.totalBreakHours) : '0h'} icon={<Coffee />} color="warning" loading={loading} />
        <KPICard title="Overtime" value={data ? fmtHours(data.totals.totalOvertimeHours) : '0h'} icon={<TrendingUp />} color="danger" loading={loading} />
        <KPICard title="Idle Time" value={data ? fmtHours(data.totals.totalIdleHours) : '0h'} icon={<Clock />} loading={loading} />
        <KPICard title="Avg Productivity" value={data ? `${data.totals.avgProductivity}%` : '0%'} icon={<Award />} color="success" loading={loading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Daily Working Hours</h3>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                <XAxis dataKey="name" stroke="#6b7280" fontSize={10} tickLine={false} axisLine={false} interval={2} />
                <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '8px' }} cursor={{ fill: '#374151', opacity: 0.2 }} />
                <Bar dataKey="Working" fill={CHART_COLORS.work} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Productivity Trend</h3>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                <XAxis dataKey="name" stroke="#6b7280" fontSize={10} tickLine={false} axisLine={false} interval={2} />
                <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip formatter={(v) => `${v}%`} contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '8px' }} />
                <Line type="monotone" dataKey="Productivity" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Weekly Summaries</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {weeks.map((w, i) => (
            <div key={i} className="p-3 rounded-lg bg-secondary/40 border border-border">
              <p className="text-xs text-muted-foreground mb-1">{w.label}</p>
              <p className="text-sm font-semibold">{fmtHours(w.workHours)} <span className="text-xs font-normal text-muted-foreground">work</span></p>
              <p className="text-xs text-muted-foreground">{fmtHours(w.breakHours)} break · {fmtHours(w.overtimeHours)} OT</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Calendar</h3>
        <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-medium text-muted-foreground">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {leadingBlanks.map((_, i) => <div key={`b${i}`} />)}
          {days.map((d) => (
            <button key={d.date} onClick={() => onSelectDay(d.date)}
              className={clsx('aspect-square rounded-lg border p-1.5 flex flex-col items-center justify-center hover:border-primary/50 transition-colors', statusColor[d.status] ?? statusColor.absent)}>
              <span className="text-xs font-semibold">{new Date(d.date).getDate()}</span>
              {d.workHours > 0 && <span className="text-[10px] mt-0.5">{d.workHours.toFixed(1)}h</span>}
            </button>
          ))}
        </div>
      </Card>
    </>
  );
}

// ── Day Detail Modal (drill-down target from Weekly/Monthly) ─────────────────
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
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card/90 backdrop-blur-xl border border-border rounded-3xl w-full max-w-2xl shadow-2xl shadow-primary/5 animate-fade-in max-h-[90vh] overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card z-10">
          <div>
            <h3 className="font-semibold text-foreground">{new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Detailed daily timeline</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center transition"><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>

        <div className="p-5 space-y-5">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : !data ? (
            <p className="text-sm text-muted-foreground text-center py-12">No data for this day.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  ['Work', fmtHours(data.workHours)], ['Break', fmtHours(data.breakHours)],
                  ['Overtime', fmtHours(data.overtimeHours)], ['Idle', fmtHours(data.idleHours)],
                  ['Productivity', `${productivity}%`],
                ].map(([k, v]) => (
                  <div key={k} className="text-center p-3 rounded-lg bg-secondary/40 border border-border">
                    <div className="text-lg font-bold">{v}</div>
                    <div className="text-[11px] text-muted-foreground">{k}</div>
                  </div>
                ))}
              </div>
              <TimelineCard date={date} data={data} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
