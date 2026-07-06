import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { MaterialIcon } from './ui/MaterialIcon';
import { clsx } from 'clsx';

function fmtClockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** Personal clock-in/out control — visible to every staff member on every page. */
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

  // Clocked in if there's a clock-in with no later clock-out yet.
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
    <div className="px-4 pb-3 shrink-0">
      <button
        onClick={handleClick}
        disabled={busy}
        className={clsx(
          'flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50',
          isClockedIn
            ? 'bg-destructive/10 text-destructive hover:bg-destructive/20'
            : 'bg-primary text-primary-foreground hover:opacity-90'
        )}
      >
        <MaterialIcon name={isClockedIn ? 'logout' : 'login'} size={16} />
        {isClockedIn ? 'Clock Out' : 'Clock In'}
      </button>
      {(clockInTime || clockOutTime) && (
        <p className="text-[10px] text-muted-foreground text-center mt-1.5">
          {isClockedIn ? `Clocked in at ${fmtClockTime(clockInTime!)}` : clockOutTime ? `Clocked out at ${fmtClockTime(clockOutTime)}` : ''}
        </p>
      )}
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

  // Clients are external, read-only viewers: only their project portal + settings.
  const navGroups = isClient()
    ? [
        {
          title: 'Client',
          items: [
            { to: '/client-portal', icon: 'folder_shared', label: 'My Projects', end: true },
            { to: '/screenshots', icon: 'photo_camera', label: 'Screenshots', end: false },
            { to: '/notifications', icon: 'notifications', label: 'Notifications', end: false },
          ]
        },
        {
          title: 'Preferences',
          items: [
            { to: '/settings', icon: 'settings', label: 'Settings', end: false },
          ]
        }
      ]
    : [
    {
      title: 'Workspace',
      items: [
        { to: isManagerOrAbove() ? '/' : '/dashboard', icon: 'dashboard', label: 'Dashboard', end: true },
        { to: '/projects', icon: 'work_outline', label: 'Projects', end: false },
        { to: '/timesheets', icon: 'schedule', label: 'Timesheets', end: false },
        { to: '/screenshots', icon: 'photo_camera', label: 'Screenshots', end: false },
        { to: '/notifications', icon: 'notifications', label: 'Notifications', end: false },
      ]
    },
    ...(isManagerOrAbove() ? [{
      title: 'Management',
      items: [
        { to: '/attendance', icon: 'sensors', label: 'Live Attendance', end: false },
        { to: '/team', icon: 'groups', label: 'Team', end: false },
        { to: '/departments', icon: 'domain', label: 'Departments', end: false },
        { to: '/reports', icon: 'bar_chart', label: 'Reports', end: false },
      ]
    }] : []),
    {
      title: 'Preferences',
      items: [
        { to: '/settings', icon: 'settings', label: 'Settings', end: false },
      ]
    }
  ];

  const initials = user?.name
    ? user.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const roleBadge = getRoleBadge();

  return (
    <div className="glass-nav w-64 flex flex-col h-full select-none">
      {/* Brand */}
      <div className="flex items-center gap-3 px-6 pt-6 pb-5 shrink-0">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-md">
          <MaterialIcon name="timer" fill size={22} />
        </div>
        <div>
          <h1 className="font-display text-[20px] leading-tight font-bold text-primary">WorkTrack</h1>
          <p className="text-xs text-muted-foreground">Premium Productivity</p>
        </div>
      </div>

      {/* Role Badge */}
      <div className="px-4 pb-3 shrink-0">
        <div className={clsx(
          'flex items-center justify-center rounded-lg px-3 py-1.5 text-xs font-semibold border',
          roleBadge.color
        )}>
          {roleBadge.label}
        </div>
      </div>

      {!isClient() && <ClockWidget />}

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-6 overflow-y-auto custom-scrollbar">
        {navGroups.map((group, i) => (
          <div key={i} className="space-y-1">
            <div className="px-3 mb-2 font-mono text-[11px] font-medium uppercase tracking-widest text-muted-foreground/70">
              {group.title}
            </div>
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-200',
                    isActive
                      ? 'bg-card/90 text-secondary font-bold shadow-sm'
                      : 'text-muted-foreground hover:text-primary hover:bg-card/40 font-medium'
                  )
                }
              >
                <MaterialIcon name={item.icon} size={20} />
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* User Profile */}
      <div className="p-4 mt-4 border-t border-card-foreground/10 shrink-0">
        <div className="flex items-center gap-3 mb-3 px-2">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center text-primary font-bold shrink-0 border-2 border-card text-sm shadow-sm">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">{user?.name ?? 'User'}</div>
            <div className="text-xs text-muted-foreground truncate">{organization?.name ?? 'Organization'}</div>
          </div>
        </div>
        <button
          id="btn-logout"
          onClick={handleLogout}
          className="flex items-center justify-center gap-2 w-full px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-colors"
        >
          <MaterialIcon name="logout" size={18} />
          Log Out
        </button>
      </div>
    </div>
  );
}
