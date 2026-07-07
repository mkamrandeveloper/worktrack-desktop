import { useState, useEffect } from 'react';
import { AppNotification } from '@shared/types';
import { Bell, Check, Trash2, CalendarClock, Briefcase, Users, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';

export function NotificationsPage() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
  }, []);

  async function loadNotifications() {
    setLoading(true);
    try {
      const res = await window.worktrack.appNotifications.fetch();
      if (res.success && res.data) {
        setNotifications(res.data.notifications);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function markAllRead() {
    await window.worktrack.appNotifications.markAllRead();
    loadNotifications();
  }

  async function deleteNotification(id: string) {
    setNotifications(prev => prev.filter(n => n.id !== id));
    await window.worktrack.appNotifications.delete(id);
  }

  return (
    <div className="flex flex-col h-full bg-background/50">
      <header className="flex-none px-8 py-6 border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Stay updated on tasks, team activity, and alerts.
            </p>
          </div>
          <button 
            onClick={markAllRead}
            className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted/50 transition-colors"
          >
            <Check className="w-4 h-4" />
            Mark all read
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-4xl mx-auto space-y-4">
          
          {loading ? (
            [1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 rounded-xl border border-border bg-card animate-pulse" />
            ))
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-border rounded-xl bg-card/50">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Bell className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">You're all caught up!</h3>
              <p className="text-sm text-muted-foreground max-w-sm mb-6">
                You don't have any new notifications at the moment.
              </p>
            </div>
          ) : (
            notifications.map(notif => (
              <NotificationItem key={notif.id} notification={notif} onRead={loadNotifications} onDelete={deleteNotification} />
            ))
          )}

        </div>
      </div>
    </div>
  );
}

function NotificationItem({ notification, onRead, onDelete }: { notification: AppNotification, onRead: () => void, onDelete: (id: string) => void }) {
  const getIcon = () => {
    switch (notification.type) {
      case 'task_assigned':
      case 'task_updated': return <Briefcase className="w-5 h-5 text-primary" />;
      case 'deadline_reminder': return <CalendarClock className="w-5 h-5 text-amber-500" />;
      case 'employee_added': return <Users className="w-5 h-5 text-emerald-500" />;
      case 'system_alert':
      case 'idle_alert': return <AlertTriangle className="w-5 h-5 text-rose-500" />;
      default: return <Bell className="w-5 h-5 text-primary" />;
    }
  };

  const markRead = async () => {
    if (notification.isRead) return;
    await window.worktrack.appNotifications.markRead(notification.id);
    onRead();
  };

  return (
    <div 
      className={clsx(
        "group relative flex items-start gap-4 p-5 rounded-xl border transition-all cursor-pointer",
        notification.isRead 
          ? "bg-background/50 border-border/50 opacity-75 hover:opacity-100" 
          : "bg-card border-primary/20 shadow-sm"
      )}
      onClick={markRead}
    >
      {!notification.isRead && (
        <div className="absolute top-1/2 -left-2 w-2 h-2 rounded-full bg-primary -translate-y-1/2" />
      )}
      
      <div className={clsx(
        "flex-none w-10 h-10 rounded-full flex items-center justify-center",
        notification.isRead ? "bg-muted text-muted-foreground" : "bg-primary/10"
      )}>
        {getIcon()}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-4 mb-1">
          <h4 className={clsx("font-semibold text-sm", !notification.isRead && "text-foreground")}>
            {notification.title}
          </h4>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {new Date(notification.createdAt).toLocaleDateString()}
          </span>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {notification.message}
        </p>
      </div>

      <button 
        className="opacity-0 group-hover:opacity-100 p-2 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
        title="Delete notification"
        onClick={(e) => { e.stopPropagation(); onDelete(notification.id); }}
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
