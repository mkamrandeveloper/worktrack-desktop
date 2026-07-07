import { useState, useEffect } from 'react';
import { LiveEmployee } from '@shared/types';
import { Search, Filter, Activity, Clock, Coffee, MonitorOff } from 'lucide-react';
import { StatusBadge } from '../components/ui/StatusBadge';

export function AttendancePage() {
  const [employees, setEmployees] = useState<LiveEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadLiveStatus();
    // Poll every 10 seconds
    const interval = setInterval(loadLiveStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  async function loadLiveStatus() {
    try {
      const res = await window.worktrack.attendance.live();
      if (res.success && res.data) {
        setEmployees(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // LiveStatus is 'active' | 'working' | 'idle' | 'on_break' | 'offline' |
  // 'clocked_out' | 'overtime' — these counts previously only matched
  // 'active', so anyone reported as 'working' or 'overtime' fell through
  // every bucket (miscounted as neither online nor offline) and rendered
  // with the wrong card body ("Currently offline" despite being on a task).
  const activeCount = employees.filter(e => ['active', 'working', 'overtime'].includes(e.displayStatus)).length;
  const breakCount = employees.filter(e => e.displayStatus === 'on_break').length;
  const offlineCount = employees.filter(e => ['offline', 'clocked_out'].includes(e.displayStatus)).length;
  const totalOnline = employees.length - offlineCount;

  const filteredEmployees = employees.filter(e =>
    e.name.toLowerCase().includes(search.trim().toLowerCase()) ||
    e.email.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-background/50">
      <header className="flex-none px-8 py-6 border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Live Attendance</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Real-time monitor of team presence and current activity.
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">Total Online</p>
                <p className="text-2xl font-bold">{totalOnline} <span className="text-sm text-muted-foreground font-normal">/ {employees.length}</span></p>
              </div>
            </div>
            
            <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <MonitorOff className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">Working</p>
                <p className="text-2xl font-bold">{activeCount}</p>
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <Coffee className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">On Break</p>
                <p className="text-2xl font-bold">{breakCount}</p>
              </div>
            </div>
            
            <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-muted text-muted-foreground flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">Offline</p>
                <p className="text-2xl font-bold">{offlineCount}</p>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-4 py-2">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search team members..."
                className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
              />
            </div>
            <button className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted/50 transition-colors text-muted-foreground">
              <Filter className="w-4 h-4" /> Filter
            </button>
          </div>

          {/* Employee Grid */}
          {!loading && filteredEmployees.length === 0 ? (
            <div className="text-center py-16 text-sm text-muted-foreground">
              No team members match "{search}".
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {loading ? (
                [1, 2, 3, 4].map(i => (
                  <div key={i} className="h-40 rounded-xl border border-border bg-card animate-pulse" />
                ))
              ) : filteredEmployees.map(emp => (
                <EmployeeLiveCard key={emp.id} employee={emp} />
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function EmployeeLiveCard({ employee }: { employee: LiveEmployee }) {
  const getVariant = (status: string) => {
    if (status === 'active' || status === 'working') return 'active';
    if (status === 'overtime') return 'overtime';
    if (status === 'idle') return 'idle';
    if (status === 'on_break') return 'break';
    if (status === 'clocked_out') return 'clocked_out';
    return 'offline';
  };

  const isWorking = ['active', 'working', 'overtime', 'idle'].includes(employee.displayStatus);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
            {getInitials(employee.name)}
          </div>
          <div>
            <h3 className="font-semibold text-sm line-clamp-1">{employee.name}</h3>
            <p className="text-xs text-muted-foreground line-clamp-1">{employee.email}</p>
          </div>
        </div>
        <StatusBadge
          variant={getVariant(employee.displayStatus)}
          dot
          pulse={employee.displayStatus === 'active' || employee.displayStatus === 'working'}
        />
      </div>

      <div className="flex-1">
        {isWorking ? (
          <div className="text-xs">
            <p className="text-muted-foreground mb-1">Working on:</p>
            <p className="font-medium line-clamp-2">{employee.currentTask || 'No active task'}</p>
            {employee.currentProject && (
              <p className="text-primary mt-1">{employee.currentProject}</p>
            )}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground flex flex-col justify-center h-full">
            {employee.displayStatus === 'clocked_out' ? (
              <p>Clocked out for the day</p>
            ) : employee.displayStatus === 'on_break' ? (
              <p>Currently on break</p>
            ) : (
              <p>Currently offline</p>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between text-xs">
        <div className="flex flex-col">
          <span className="text-muted-foreground mb-0.5">Work Today</span>
          <span className="font-medium">{employee.workHours.toFixed(1)}h</span>
        </div>
        <div className="flex flex-col text-right">
          <span className="text-muted-foreground mb-0.5">Clock In</span>
          <span className="font-medium">
            {employee.clockInTime ? new Date(employee.clockInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
          </span>
        </div>
      </div>
    </div>
  );
}
