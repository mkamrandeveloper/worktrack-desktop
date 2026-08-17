import { useState, useEffect } from 'react';
import { LiveEmployee } from '@shared/types';
import { Search, Filter, Activity, Clock, Coffee, MonitorOff, UserCheck } from 'lucide-react';
import { Badge, Button } from '../components/ui/primitives';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

export function AttendancePage() {
  const [employees, setEmployees] = useState<LiveEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadLiveStatus();
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

  const activeCount = employees.filter(e => ['active', 'working', 'overtime'].includes(e.displayStatus)).length;
  const breakCount = employees.filter(e => e.displayStatus === 'on_break').length;
  const offlineCount = employees.filter(e => ['offline', 'clocked_out'].includes(e.displayStatus)).length;
  const totalOnline = employees.length - offlineCount;

  const filteredEmployees = employees.filter(e =>
    e.name.toLowerCase().includes(search.trim().toLowerCase()) ||
    e.email.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-background animate-fade-in relative">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
      
      <header className="flex-none px-8 py-8 relative z-10 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-sm relative">
              <Activity size={24} className="text-primary" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-background animate-pulse" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">Live Attendance</h1>
              <p className="text-sm font-medium text-muted-foreground mt-1">
                Real-time monitor of team presence and current activity.
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8 relative z-10 custom-scrollbar">
        <div className="max-w-7xl mx-auto space-y-8">
          
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <StatCard icon={<UserCheck size={20} className="text-primary" />} label="Total Online" value={totalOnline} subvalue={`/ ${employees.length}`} bg="bg-primary/10 border-primary/20" />
            <StatCard icon={<MonitorOff size={20} className="text-emerald-500" />} label="Working" value={activeCount} bg="bg-emerald-500/10 border-emerald-500/20" />
            <StatCard icon={<Coffee size={20} className="text-amber-500" />} label="On Break" value={breakCount} bg="bg-amber-500/10 border-amber-500/20" />
            <StatCard icon={<Clock size={20} className="text-muted-foreground" />} label="Offline" value={offlineCount} bg="bg-muted border-border/50" />
          </div>

          {/* Controls */}
          <div className="flex items-center gap-4 py-2">
            <div className="relative flex-1 max-w-md group">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search team members..."
                className="w-full pl-11 pr-4 h-12 bg-card border border-border/80 rounded-xl text-base font-medium text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm hover:border-border"
              />
            </div>
            <Button variant="outline" className="h-12 px-5 rounded-xl border-border/80 shadow-sm text-foreground hover:bg-muted/50 font-semibold text-sm">
              <Filter size={18} className="mr-2 text-muted-foreground" /> Filter
            </Button>
          </div>

          {/* Employee Grid */}
          {!loading && filteredEmployees.length === 0 ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center py-24 text-center border border-dashed border-border/60 rounded-3xl bg-muted/10">
              <div className="w-20 h-20 rounded-full bg-card flex items-center justify-center mb-6 shadow-sm border border-border/50">
                <Search size={32} className="text-muted-foreground/60" />
              </div>
              <h3 className="text-2xl font-display font-bold text-foreground mb-2">No members found</h3>
              <p className="text-base font-medium text-muted-foreground max-w-md">
                No team members match your search for "{search}".
              </p>
            </motion.div>
          ) : (
            <motion.div 
              initial="hidden" 
              animate="show" 
              variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            >
              <AnimatePresence>
                {loading ? (
                  [1, 2, 3, 4].map(i => (
                    <div key={i} className="h-48 rounded-2xl bg-card border border-border/50 animate-pulse shadow-sm" />
                  ))
                ) : filteredEmployees.map(emp => (
                  <EmployeeLiveCard key={emp.id} employee={emp} />
                ))}
              </AnimatePresence>
            </motion.div>
          )}

        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, subvalue, bg }: { icon: React.ReactNode, label: string, value: number, subvalue?: string, bg: string }) {
  return (
    <div className="bg-card border border-border/60 rounded-2xl p-6 flex items-center gap-5 shadow-sm hover:border-primary/20 transition-colors">
      <div className={clsx("w-14 h-14 rounded-xl flex items-center justify-center border shadow-sm", bg)}>
        {icon}
      </div>
      <div>
        <p className="font-display text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
        <p className="text-3xl font-display font-bold text-foreground">
          {value} {subvalue && <span className="text-base font-medium text-muted-foreground ml-1">{subvalue}</span>}
        </p>
      </div>
    </div>
  );
}

function EmployeeLiveCard({ employee }: { employee: LiveEmployee }) {
  const isWorking = ['active', 'working', 'overtime', 'idle'].includes(employee.displayStatus);
  const isBreak = employee.displayStatus === 'on_break';
  const isOffline = ['offline', 'clocked_out'].includes(employee.displayStatus);

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  
  const statusColor = isWorking ? 'success' : isBreak ? 'warning' : 'default';

  return (
    <motion.div 
      layout
      variants={{ hidden: { opacity: 0, scale: 0.95 }, show: { opacity: 1, scale: 1 } }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={clsx(
        "bg-card rounded-2xl p-6 flex flex-col border transition-all duration-300 relative overflow-hidden group hover:shadow-xl",
        isWorking ? "border-emerald-500/30 hover:border-emerald-500/50" : isBreak ? "border-amber-500/30 hover:border-amber-500/50" : "border-border/60 hover:border-border"
      )}
    >
      <div className={clsx("absolute top-0 left-0 right-0 h-1 transition-opacity opacity-0 group-hover:opacity-100", isWorking ? "bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" : isBreak ? "bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" : "bg-transparent")} />
      
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/10 to-primary/30 border border-primary/20 flex items-center justify-center font-bold text-primary shadow-sm shrink-0">
              {getInitials(employee.name)}
            </div>
            {isWorking && <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-card rounded-full animate-pulse" />}
          </div>
          <div>
            <h3 className="font-display font-bold text-base text-foreground line-clamp-1">{employee.name}</h3>
            <p className="text-xs font-medium text-muted-foreground line-clamp-1">{employee.email}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-muted/30 rounded-xl p-4 border border-border/50 mb-5">
        {isWorking ? (
          <div>
            <p className="text-[10px] font-display font-bold uppercase tracking-widest text-muted-foreground mb-1">Working on</p>
            <p className="font-semibold text-foreground text-sm line-clamp-2 leading-snug">{employee.currentTask || 'No active task'}</p>
            {employee.currentProject && (
              <p className="text-xs font-bold text-primary mt-2 flex items-center gap-1.5"><Activity size={14} /> {employee.currentProject}</p>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-2 text-center">
            {employee.displayStatus === 'clocked_out' ? (
              <><Clock size={20} className="text-muted-foreground/50 mb-2" /><p className="text-xs font-medium text-muted-foreground">Clocked out for the day</p></>
            ) : employee.displayStatus === 'on_break' ? (
              <><Coffee size={20} className="text-amber-500/70 mb-2" /><p className="text-xs font-bold text-amber-600">Currently on break</p></>
            ) : (
              <><MonitorOff size={20} className="text-muted-foreground/50 mb-2" /><p className="text-xs font-medium text-muted-foreground">Currently offline</p></>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-xs pt-1">
        <div className="flex flex-col">
          <span className="font-display font-bold uppercase tracking-widest text-[10px] text-muted-foreground mb-1">Work Today</span>
          <span className="font-mono font-bold text-sm text-foreground">{employee.workHours.toFixed(1)}h</span>
        </div>
        <div className="flex flex-col text-right">
          <span className="font-display font-bold uppercase tracking-widest text-[10px] text-muted-foreground mb-1">Clock In</span>
          <span className="font-mono font-bold text-sm text-foreground">
            {employee.clockInTime ? new Date(employee.clockInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
