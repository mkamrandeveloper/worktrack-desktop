import { useState, useEffect } from 'react';
import { OrgOverviewReport, TimesheetReport } from '@shared/types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';
import { KPICard } from '../components/ui/KPICard';
import { Card, Badge } from '../components/ui/primitives';
import { FileSpreadsheet, Users, CheckCircle2, TrendingUp, Monitor, Loader2, CheckCircle } from 'lucide-react';
import { clsx } from 'clsx';

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
        setExportMsg(null); // user cancelled the save dialog
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

  return (
    <div className="flex flex-col h-full bg-background/50">
      <header className="flex-none px-8 py-6 border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-7xl mx-auto flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Analytics &amp; Reports</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Organization-wide insights and productivity metrics.
            </p>
          </div>
          <div className="flex bg-background/50 border border-border/50 rounded-lg p-1">
            {(['daily', 'weekly', 'monthly'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={clsx(
                  'px-4 py-1.5 text-sm font-medium rounded-md capitalize transition-all duration-200',
                  period === p ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-background/80'
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-7xl mx-auto space-y-8">

          {/* Top KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard title="Total Team" value={overview?.employees.total || 0} icon={<Users />} loading={loading} />
            <KPICard title="Task Completion" value={`${overview?.tasks.completionRate || 0}%`} icon={<CheckCircle2 />} color="success" loading={loading} />
            <KPICard title="Avg Work Hours" value={`${overview?.attendance.totalWorkHours || 0}h`} subtitle="Per employee" icon={<Monitor />} color="primary" loading={loading} />
            <KPICard title="Active Projects" value={overview?.projects.active || 0} icon={<TrendingUp />} color="warning" loading={loading} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Productivity Chart (real data) */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold mb-6">Working Hours Trend</h3>
              <div className="h-72 w-full">
                {productivityData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={productivityData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                      <XAxis dataKey="name" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '8px' }} itemStyle={{ color: '#e5e7eb' }} />
                      <Line type="monotone" dataKey="hours" stroke="#7c3aed" strokeWidth={3} dot={{ r: 3, fill: '#7c3aed' }} activeDot={{ r: 6 }} name="Working Hours" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No data for this period.</div>
                )}
              </div>
            </div>

            {/* Break vs Overtime Chart (real data) */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold mb-6">Break &amp; Overtime</h3>
              <div className="h-72 w-full">
                {productivityData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={(report?.rows ?? []).slice().reverse().slice(-14).map((r) => ({
                      name: new Date(r.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                      breakHours: r.breakHours,
                      overtimeHours: r.overtimeHours,
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                      <XAxis dataKey="name" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '8px' }} cursor={{ fill: '#374151', opacity: 0.2 }} />
                      <Bar dataKey="breakHours" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Break (hrs)" />
                      <Bar dataKey="overtimeHours" fill="#ef4444" radius={[4, 4, 0, 0]} name="Overtime (hrs)" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No data for this period.</div>
                )}
              </div>
            </div>
          </div>

          {/* Detailed timesheet report */}
          <Card className="p-0 overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-border flex-wrap gap-3">
              <div>
                <h3 className="text-lg font-semibold capitalize">{period} Timesheet Report</h3>
                {report && <p className="text-xs text-muted-foreground mt-0.5">{report.range.from} to {report.range.to} · {report.summary.entries} entries</p>}
              </div>
              <div className="flex items-center gap-3">
                {exportMsg && (
                  <span className="text-xs text-emerald-500 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> {exportMsg}</span>
                )}
                <button
                  onClick={handleExport}
                  disabled={exporting || reportLoading || !report?.rows.length}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
                >
                  {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                  Export to Excel
                </button>
              </div>
            </div>

            {report && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-5 border-b border-border/60 bg-secondary/20">
                {[
                  ['Work Hours', `${report.summary.workHours}h`],
                  ['Break Hours', `${report.summary.breakHours}h`],
                  ['Overtime', `${report.summary.overtimeHours}h`],
                  ['Idle', `${report.summary.idleHours}h`],
                  ['Avg Productivity', `${report.summary.avgProductivity}%`],
                ].map(([k, v]) => (
                  <div key={k}>
                    <div className="text-xs text-muted-foreground">{k}</div>
                    <div className="text-lg font-semibold">{v}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="overflow-x-auto">
              {reportLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : !report?.rows.length ? (
                <p className="text-sm text-muted-foreground text-center py-12">No timesheet entries for this period.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
                      <th className="px-5 py-3 font-medium">Employee</th>
                      <th className="px-5 py-3 font-medium">Project</th>
                      <th className="px-5 py-3 font-medium">Date</th>
                      <th className="px-5 py-3 font-medium">Clock In</th>
                      <th className="px-5 py-3 font-medium">Clock Out</th>
                      <th className="px-5 py-3 font-medium text-right">Work</th>
                      <th className="px-5 py-3 font-medium text-right">Break</th>
                      <th className="px-5 py-3 font-medium text-right">OT</th>
                      <th className="px-5 py-3 font-medium text-right">Idle</th>
                      <th className="px-5 py-3 font-medium text-right">Productivity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((r, i) => (
                      <tr key={`${r.email}-${r.date}-${i}`} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                        <td className="px-5 py-3 font-medium">{r.employeeName}</td>
                        <td className="px-5 py-3 text-muted-foreground truncate max-w-[180px]">{r.projects}</td>
                        <td className="px-5 py-3 text-muted-foreground">{r.date}</td>
                        <td className="px-5 py-3 text-muted-foreground">{r.clockIn}</td>
                        <td className="px-5 py-3 text-muted-foreground">{r.clockOut}</td>
                        <td className="px-5 py-3 text-right font-mono">{r.workHours}h</td>
                        <td className="px-5 py-3 text-right font-mono text-muted-foreground">{r.breakHours}h</td>
                        <td className="px-5 py-3 text-right font-mono text-muted-foreground">{r.overtimeHours}h</td>
                        <td className="px-5 py-3 text-right font-mono text-muted-foreground">{r.idleHours}h</td>
                        <td className="px-5 py-3 text-right">
                          <Badge variant={r.productivity >= 70 ? 'success' : r.productivity >= 40 ? 'warning' : 'danger'}>{r.productivity}%</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
