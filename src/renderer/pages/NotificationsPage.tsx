import { useState, useEffect } from 'react';
import { AppNotification } from '@shared/types';
import { Bell, Check, Trash2, CalendarClock, Briefcase, Users, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../components/ui/primitives';

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

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="flex flex-col h-full bg-background animate-fade-in relative">
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
      
      <header className="flex-none px-8 py-8 relative z-10 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between max-w-4xl mx-auto gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-sm relative">
              <Bell size={24} className="text-primary" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-destructive rounded-full border-2 border-background animate-pulse" />
              )}
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">Notifications</h1>
              <p className="text-sm font-medium text-muted-foreground mt-1">
                Stay updated on tasks, team activity, and alerts.
              </p>
            </div>
          </div>
          {notifications.length > 0 && (
            <Button 
              variant="outline"
              onClick={markAllRead}
              className="h-11 px-5 rounded-xl shadow-sm text-foreground font-semibold hover:border-primary/50 hover:text-primary transition-all"
            >
              <Check size={18} className="mr-2" /> Mark all read
            </Button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8 relative z-10">
        <div className="max-w-4xl mx-auto space-y-4">
          
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-28 rounded-2xl border border-border/50 bg-card animate-pulse shadow-sm" />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center py-24 text-center border border-dashed border-border/60 rounded-3xl bg-muted/10">
              <div className="w-20 h-20 rounded-full bg-card flex items-center justify-center mb-6 shadow-sm border border-border/50 relative">
                <Bell size={32} className="text-muted-foreground/60" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full border-2 border-background bg-emerald-500 scale-125 opacity-0 animate-ping" />
                <Check size={16} className="text-emerald-500 absolute bottom-4 right-4 bg-background rounded-full" />
              </div>
              <h3 className="text-2xl font-display font-bold text-foreground mb-2">You're all caught up!</h3>
              <p className="text-base font-medium text-muted-foreground max-w-sm mb-6">
                You don't have any new notifications at the moment.
              </p>
            </motion.div>
          ) : (
            <motion.div 
              initial="hidden" 
              animate="show" 
              variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } }}
              className="space-y-3"
            >
              <AnimatePresence>
                {notifications.map(notif => (
                  <NotificationItem key={notif.id} notification={notif} onRead={loadNotifications} onDelete={deleteNotification} />
                ))}
              </AnimatePresence>
            </motion.div>
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
      case 'task_updated': return { icon: <Briefcase size={20} className="text-blue-500" />, bg: 'bg-blue-500/10 border-blue-500/20' };
      case 'deadline_reminder': return { icon: <CalendarClock size={20} className="text-amber-500" />, bg: 'bg-amber-500/10 border-amber-500/20' };
      case 'employee_added': return { icon: <Users size={20} className="text-emerald-500" />, bg: 'bg-emerald-500/10 border-emerald-500/20' };
      case 'system_alert':
      case 'idle_alert': return { icon: <AlertTriangle size={20} className="text-rose-500" />, bg: 'bg-rose-500/10 border-rose-500/20' };
      default: return { icon: <Bell size={20} className="text-primary" />, bg: 'bg-primary/10 border-primary/20' };
    }
  };

  const markRead = async () => {
    if (notification.isRead) return;
    await window.worktrack.appNotifications.markRead(notification.id);
    onRead();
  };

  const { icon, bg } = getIcon();

  return (
    <motion.div 
      layout
      variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      className={clsx(
        "group relative flex items-start gap-5 p-6 rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden",
        notification.isRead 
          ? "bg-card/50 border-border/40 opacity-70 hover:opacity-100 hover:bg-card hover:shadow-sm" 
          : "bg-card border-primary/20 shadow-md hover:shadow-lg hover:border-primary/40"
      )}
      onClick={markRead}
    >
      {!notification.isRead && (
        <div className="absolute top-0 left-0 bottom-0 w-1 bg-primary" />
      )}
      
      <div className={clsx("flex-none w-12 h-12 rounded-xl flex items-center justify-center border shadow-sm", notification.isRead ? "bg-muted border-border/50 text-muted-foreground/50 grayscale-[0.5]" : bg)}>
        {icon}
      </div>

      <div className="flex-1 min-w-0 pr-8">
        <div className="flex items-center justify-between gap-4 mb-1.5">
          <h4 className={clsx("font-display font-bold text-[15px]", !notification.isRead ? "text-foreground" : "text-foreground/80")}>
            {notification.title}
          </h4>
          <span className="text-[11px] font-bold font-mono uppercase tracking-wider text-muted-foreground whitespace-nowrap bg-muted/50 px-2 py-1 rounded-md">
            {new Date(notification.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <p className="text-sm font-medium text-muted-foreground leading-relaxed">
          {notification.message}
        </p>
      </div>

      <button 
        className="absolute top-1/2 right-4 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all"
        title="Delete notification"
        onClick={(e) => { e.stopPropagation(); onDelete(notification.id); }}
      >
        <Trash2 size={18} />
      </button>
    </motion.div>
  );
}
