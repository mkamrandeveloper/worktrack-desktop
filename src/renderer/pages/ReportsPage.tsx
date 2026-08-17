import { useState, useEffect } from 'react';
import { OrgOverviewReport, TimesheetReport } from '@shared/types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';
import { Card, Badge, Button } from '../components/ui/primitives';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { FileSpreadsheet, Users, CheckCircle2, TrendingUp, Monitor, Loader2, CheckCircle, Download } from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

type Period = 'daily' | 'weekly' | 'monthly';

export function ReportsPage() {
  const [overview, setOverview] = useState<OrgOverviewReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('weekly');
  const [report, setReport] = useState<TimesheetReport | null>(null);
  const [reportLoading, setReportLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  useEffect(() => { loadOverview(); }, []);
  useEffect(() => { loadTimesheetReport(period); }, [period]);

  async function loadOverview() {
    setLoading(true);
    try {
      const res = await window.worktrack.reports.overview();
      if (res.success && res.data) setOverview(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadTimesheetReport(p: Period) {
    setReportLoading(true);
    try {
      const res = await window.worktrack.reports.timesheet({ period: p });
      if (res.success && res.data) setReport(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setReportLoading(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    setExportMsg(null);
    try {
      const res = await window.worktrack.reports.exportXlsx({ period });
      if (res.success && res.data?.saved) {
        setExportMsg(`Saved to ${res.data.filePath}`);
      } else if (res.success) {
        setExportMsg(null);
      } else {
        setExportMsg(res.error ?? 'Export failed.');
      }
    } finally {
      setExporting(false);
      setTimeout(() => setExportMsg(null), 5000);
    }
  }

  const productivityData = (report?.rows ?? [])
    .slice()
    .reverse()
    .slice(-14)
    .map((r) => ({ name: new Date(r.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), hours: r.workHours }));

  const statColors: Record<string, string> = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-emerald-500/10 text-emerald-500',
    warning: 'bg-amber-500/10 text-amber-500',
    danger: 'bg-destructive/10 text-destructive',
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="flex-none px-8 py-6 border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-[1400px] mx-auto flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">Analytics & Reports</h1>
            <p className="text-sm font-medium text-muted-foreground mt-1">
              Organization-wide insights and productivity metrics.
            </p>
          </div>
          <div className="flex bg-card/60 border border-border/50 rounded-lg p-1.5 shadow-sm">
            {(['daily', 'weekly', 'monthly'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={clsx(
                  'px-5 py-2 text-sm font-bold tracking-wide uppercase rounded-md transition-all duration-300',
                  period === p ? 'bg-primary text-primary-foreground shadow-md' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8 animate-fade-in pb-24">
        <div className="max-w-[1400px] mx-auto space-y-8">

          {/* Top KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <Card className="p-6 flex flex-col justify-between min-h-[140px]">
              <div className="flex justify-between items-start mb-4">
                <span className="font-display text-[12px] uppercase tracking-wider font-bold text-muted-foreground">Total Team</span>
                <span className={clsx("w-9 h-9 rounded-full flex items-center justify-center shrink-0", statColors.primary)}>
                  <Users size={18} />
                </span>
              </div>
              <div>
                <div className="text-3xl font-display font-bold text-foreground tracking-tight">{loading ? '—' : overview?.employees.total || 0}</div>
              </div>
            </Card>

            <Card className="p-6 flex flex-col justify-between min-h-[140px]">
              <div className="flex justify-between items-start mb-4">
                <span className="font-display text-[12px] uppercase tracking-wider font-bold text-muted-foreground">Task Completion</span>
                <span className={clsx("w-9 h-9 rounded-full flex items-center justify-center shrink-0", statColors.success)}>
                  <CheckCircle2 size={18} />
                </span>
              </div>
              <div>
                <div className="text-3xl font-display font-bold text-foreground tracking-tight">{loading ? '—' : `${overview?.tasks.completionRate || 0}%`}</div>
              </div>
            </Card>

            <Card className="p-6 flex flex-col justify-between min-h-[140px]">
              <div className="flex justify-between items-start mb-4">
                <span className="font-display text-[12px] uppercase tracking-wider font-bold text-muted-foreground">Avg Work Hours</span>
                <span className={clsx("w-9 h-9 rounded-full flex items-center justify-center shrink-0", statColors.primary)}>
                  <Monitor size={18} />
                </span>
              </div>
              <div>
                <div className="text-3xl font-display font-bold text-foreground tracking-tight">{loading ? '—' : `${overview?.attendance.totalWorkHours || 0}h`}</div>
                <div className="text-sm font-medium text-muted-foreground mt-1">Per employee</div>
              </div>
            </Card>

            <Card className="p-6 flex flex-col justify-between min-h-[140px]">
              <div className="flex justify-between items-start mb-4">
                <span className="font-display text-[12px] uppercase tracking-wider font-bold text-muted-foreground">Active Projects</span>
                <span className={clsx("w-9 h-9 rounded-full flex items-center justify-center shrink-0", statColors.warning)}>
                  <TrendingUp size={18} />
                </span>
              </div>
              <div>
                <div className="text-3xl font-display font-bold text-foreground tracking-tight">{loading ? '—' : overview?.projects.active || 0}</div>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Productivity Chart */}
            <Card className="p-7">
              <h3 className="text-sm font-display font-bold uppercase tracking-wider text-muted-foreground mb-6">Working Hours Trend</h3>
              <div className="h-72 w-full">
                {productivityData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={productivityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} dx={-10} />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '12px', boxShadow: 'var(--tw-shadow-lg)' }} />
                      <Line type="monotone" dataKey="hours" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4, fill: 'hsl(var(--primary))', strokeWidth: 2, stroke: 'hsl(var(--card))' }} activeDot={{ r: 6 }} name="Working Hours" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground font-medium text-sm bg-muted/20 rounded-xl border border-dashed border-border/50">No data for this period.</div>
                )}
              </div>
            </Card>

            {/* Break vs Overtime Chart */}
            <Card className="p-7">
              <h3 className="text-sm font-display font-bold uppercase tracking-wider text-muted-foreground mb-6">Break & Overtime</h3>
              <div className="h-72 w-full">
                {productivityData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={(report?.rows ?? []).slice().reverse().slice(-14).map((r) => ({
                      name: new Date(r.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                      breakHours: r.breakHours,
                      overtimeHours: r.overtimeHours,
                    }))} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} dx={-10} />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '12px', boxShadow: 'var(--tw-shadow-lg)' }} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }} />
                      <Bar dataKey="breakHours" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Break (hrs)" />
                      <Bar dataKey="overtimeHours" fill="#ef4444" radius={[4, 4, 0, 0]} name="Overtime (hrs)" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground font-medium text-sm bg-muted/20 rounded-xl border border-dashed border-border/50">No data for this period.</div>
                )}
              </div>
            </Card>
          </div>

          {/* Detailed timesheet report */}
          <Card className="p-0 overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-border/60 bg-muted/20 flex-wrap gap-4">
              <div>
                <h3 className="font-display font-bold text-xl capitalize text-foreground">{period} Timesheet Report</h3>
                {report && <p className="text-sm font-medium text-muted-foreground mt-1">{report.range.from} to {report.range.to} · {report.summary.entries} entries</p>}
              </div>
              <div className="flex items-center gap-4">
                <AnimatePresence>
                  {exportMsg && (
                    <motion.span initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="text-sm font-medium text-emerald-500 flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1.5 rounded-md border border-emerald-500/20">
                      <CheckCircle size={16} /> {exportMsg}
                    </motion.span>
                  )}
                </AnimatePresence>
                <Button
                  onClick={handleExport}
                  disabled={exporting || reportLoading || !report?.rows.length}
                  className="rounded-full shadow-sm"
                >
                  {exporting ? <Loader2 size={16} className="animate-spin mr-1.5" /> : <Download size={16} className="mr-1.5" />}
                  Export Excel
                </Button>
              </div>
            </div>

            {report && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-6 border-b border-border bg-card">
                {[
                  ['Work Hours', `${report.summary.workHours}h`],
                  ['Break Hours', `${report.summary.breakHours}h`],
                  ['Overtime', `${report.summary.overtimeHours}h`],
                  ['Idle', `${report.summary.idleHours}h`],
                  ['Avg Productivity', `${report.summary.avgProductivity}%`],
                ].map(([k, v]) => (
                  <div key={k} className="bg-muted/30 p-4 rounded-xl border border-border/50">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{k}</div>
                    <div className="text-2xl font-display font-bold text-foreground">{v}</div>
                  </div>
                ))}
              </div>
            )}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Clock In</TableHead>
                  <TableHead>Clock Out</TableHead>
                  <TableHead className="text-right">Work</TableHead>
                  <TableHead className="text-right">Break</TableHead>
                  <TableHead className="text-right">OT</TableHead>
                  <TableHead className="text-right">Idle</TableHead>
                  <TableHead className="text-right">Prod.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-20 text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Loader2 size={24} className="animate-spin text-primary" />
                        <span className="font-medium">Loading report...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : !report?.rows.length ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-20">
                      <div className="inline-flex flex-col items-center justify-center p-6 bg-muted/20 rounded-xl border border-dashed border-border/50">
                        <FileSpreadsheet size={32} className="text-muted-foreground mb-3" />
                        <p className="text-sm font-medium text-muted-foreground">No timesheet entries for this period.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  report.rows.map((r, i) => (
                    <TableRow key={`${r.email}-${r.date}-${i}`}>
                      <TableCell className="font-semibold text-foreground">{r.employeeName}</TableCell>
                      <TableCell className="text-muted-foreground max-w-[180px] truncate">{r.projects}</TableCell>
                      <TableCell className="text-muted-foreground">{r.date}</TableCell>
                      <TableCell className="text-muted-foreground font-mono">{r.clockIn}</TableCell>
                      <TableCell className="text-muted-foreground font-mono">{r.clockOut}</TableCell>
                      <TableCell className="text-right font-mono font-medium">{r.workHours}h</TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">{r.breakHours}h</TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">{r.overtimeHours}h</TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">{r.idleHours}h</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={r.productivity >= 70 ? 'success' : r.productivity >= 40 ? 'warning' : 'danger'} className="font-mono py-0.5">
                          {r.productivity}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>

        </div>
      </div>
    </div>
  );
}
