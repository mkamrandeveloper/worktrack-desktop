import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LogOut, LogIn, FolderKey, Camera, Bell, Settings, LayoutDashboard, 
  Briefcase, Clock, Activity, Users, Building, BarChart, Timer 
} from 'lucide-react';

function fmtClockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function ClockWidget() {
  const [clockInTime, setClockInTime] = useState<string | null>(null);
  const [clockOutTime, setClockOutTime] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    window.worktrack.dashboard.getPersonalAnalytics('daily').then((res) => {
      if (res.success && res.data) {
        setClockInTime(res.data.clockInTime);
        setClockOutTime(res.data.clockOutTime);
      }
    });
  };

  useEffect(() => { refresh(); }, []);

  const isClockedIn = !!clockInTime && (!clockOutTime || new Date(clockOutTime) < new Date(clockInTime));

  const handleClick = async () => {
    setBusy(true);
    try {
      if (isClockedIn) {
        const timerState = await window.worktrack.timer.getState();
        if (timerState.success && timerState.data && timerState.data.status !== 'idle' && timerState.data.status !== 'stopped') {
          await window.worktrack.timer.stop();
        }
        await window.worktrack.timelogs.clockOut();
      } else {
        await window.worktrack.timelogs.clockIn();
      }
    } finally {
      setBusy(false);
      refresh();
    }
  };

  return (
    <div className="px-4 pb-4 shrink-0">
      <motion.button
        whileHover={{ scale: busy ? 1 : 1.02 }}
        whileTap={{ scale: busy ? 1 : 0.96 }}
        onClick={handleClick}
        disabled={busy}
        className={clsx(
          'flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 relative overflow-hidden group',
          isClockedIn
            ? 'bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20'
            : 'bg-primary text-primary-foreground shadow-premium hover:shadow-premium-hover border border-primary/20'
        )}
      >
        <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
        {isClockedIn ? <LogOut size={16} /> : <LogIn size={16} />}
        <span>{isClockedIn ? 'Clock Out' : 'Clock In'}</span>
      </motion.button>
      <AnimatePresence>
        {(clockInTime || clockOutTime) && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="text-[11px] text-muted-foreground text-center mt-2 font-medium"
          >
            {isClockedIn ? `Clocked in at ${fmtClockTime(clockInTime!)}` : clockOutTime ? `Clocked out at ${fmtClockTime(clockOutTime)}` : ''}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Sidebar() {
  const navigate = useNavigate();
  const { user, organization, logout, isManagerOrAbove, isClient, getRoleBadge } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const navGroups = isClient()
    ? [
        {
          title: 'Client',
          items: [
            { to: '/client-portal', icon: FolderKey, label: 'My Projects', end: true },
            { to: '/screenshots', icon: Camera, label: 'Screenshots', end: false },
            { to: '/notifications', icon: Bell, label: 'Notifications', end: false },
          ]
        },
        {
          title: 'Preferences',
          items: [
            { to: '/settings', icon: Settings, label: 'Settings', end: false },
          ]
        }
      ]
    : [
    {
      title: 'Workspace',
      items: [
        { to: isManagerOrAbove() ? '/' : '/dashboard', icon: LayoutDashboard, label: 'Dashboard', end: true },
        { to: '/projects', icon: Briefcase, label: 'Projects', end: false },
        { to: '/timesheets', icon: Clock, label: 'Timesheets', end: false },
        { to: '/screenshots', icon: Camera, label: 'Screenshots', end: false },
        { to: '/notifications', icon: Bell, label: 'Notifications', end: false },
      ]
    },
    ...(isManagerOrAbove() ? [{
      title: 'Management',
      items: [
        { to: '/attendance', icon: Activity, label: 'Live Attendance', end: false },
        { to: '/team', icon: Users, label: 'Team', end: false },
        { to: '/departments', icon: Building, label: 'Departments', end: false },
        { to: '/reports', icon: BarChart, label: 'Reports', end: false },
      ]
    }] : []),
    {
      title: 'Preferences',
      items: [
        { to: '/settings', icon: Settings, label: 'Settings', end: false },
      ]
    }
  ];

  const initials = user?.name
    ? user.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const roleBadge = getRoleBadge();

  return (
    <div className="glass-nav w-64 flex flex-col h-full select-none shadow-[2px_0_24px_rgba(0,0,0,0.02)] border-r border-border/40">
      {/* Brand */}
      <div className="flex items-center gap-3 px-6 pt-8 pb-6 shrink-0">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20 border border-primary/20">
          <Timer size={22} strokeWidth={2.5} />
        </div>
        <div>
          <h1 className="font-display text-[20px] leading-tight font-bold tracking-tight text-foreground">WorkTrack</h1>
          <p className="text-xs text-muted-foreground font-medium">Productivity Suite</p>
        </div>
      </div>

      {/* Role Badge — centered */}
      <div className="px-6 pb-4 shrink-0 flex justify-center">
        <div className={clsx(
          'flex items-center justify-center rounded-full px-4 py-1 text-[11px] font-bold tracking-widest uppercase border shadow-sm',
          roleBadge.color
        )}>
          {roleBadge.label}
        </div>
      </div>

      {!isClient() && <ClockWidget />}

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-6 overflow-y-auto custom-scrollbar">
        {navGroups.map((group, i) => (
          <div key={i} className="space-y-1.5">
            <div className="px-3 mb-2 font-display text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60">
              {group.title}
            </div>
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 relative group',
                    isActive
                      ? 'text-primary font-semibold bg-primary/10'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 font-medium'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.div 
                        layoutId="activeNavIndicator"
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-full"
                        initial={false}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}
                    <item.icon size={18} className={clsx("transition-transform duration-200 group-hover:scale-110", isActive ? "text-primary" : "")} />
                    {item.label}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* User Profile */}
      <div className="p-4 mt-4 border-t border-border/40 shrink-0 bg-muted/20">
        <div className="flex items-center gap-3 mb-3 px-2">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center text-primary font-bold shrink-0 border border-primary/10 text-sm shadow-sm">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate text-foreground">{user?.name ?? 'User'}</div>
            <div className="text-xs text-muted-foreground truncate font-medium">{organization?.name ?? 'Organization'}</div>
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          id="btn-logout"
          onClick={handleLogout}
          className="flex items-center justify-center gap-2 w-full px-3 py-2 text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors border border-transparent hover:border-destructive/20"
        >
          <LogOut size={16} />
          Log Out
        </motion.button>
      </div>
    </div>
  );
}
