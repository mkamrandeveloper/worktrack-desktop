import { useEffect, useState } from 'react';
import { Info, AlertTriangle, CheckCircle, XCircle, X } from 'lucide-react';
import { clsx } from 'clsx';
import { NotificationPayload } from '@shared/types';
interface ToastProps {
  notification: NotificationPayload;
  onDismiss: (id: string) => void;
}

function Toast({ notification, onDismiss }: ToastProps) {
  useEffect(() => {
    // Auto-dismiss after 5 seconds
    const timer = setTimeout(() => onDismiss(notification.id), 5000);
    return () => clearTimeout(timer);
  }, [notification.id, onDismiss]);

  const config = {
    info: { icon: <Info className="w-5 h-5 text-blue-400" />, bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
    success: { icon: <CheckCircle className="w-5 h-5 text-green-400" />, bg: 'bg-green-500/10', border: 'border-green-500/20' },
    warning: { icon: <AlertTriangle className="w-5 h-5 text-yellow-400" />, bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
    error: { icon: <XCircle className="w-5 h-5 text-red-400" />, bg: 'bg-red-500/10', border: 'border-red-500/20' },
  };

  const style = config[notification.type] ?? config.info;

  return (
    <div className={clsx('pointer-events-auto w-full max-w-sm overflow-hidden rounded-lg bg-card shadow-lg ring-1 ring-black/5 animate-slide-in-right', style.border, 'border')}>
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            {style.icon}
          </div>
          <div className="ml-3 w-0 flex-1 pt-0.5">
            <p className="text-sm font-medium text-foreground">{notification.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{notification.message}</p>
          </div>
          <div className="ml-4 flex flex-shrink-0">
            <button
              type="button"
              className="inline-flex rounded-md bg-card text-muted-foreground hover:text-foreground focus:outline-none"
              onClick={() => onDismiss(notification.id)}
            >
              <span className="sr-only">Close</span>
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function NotificationContainer() {
  const [notifications, setNotifications] = useState<NotificationPayload[]>([]);

  useEffect(() => {
    const unsubscribe = window.worktrack.notifications.onReceived((notification) => {
      setNotifications((prev) => [...prev, notification]);
    });
    return () => unsubscribe();
  }, []);

  const handleDismiss = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  if (notifications.length === 0) return null;

  return (
    <div
      aria-live="assertive"
      className="pointer-events-none fixed inset-0 z-50 flex items-end px-4 py-6 sm:items-start sm:p-6"
    >
      <div className="flex w-full flex-col items-center space-y-4 sm:items-end mt-10">
        {notifications.map((notification) => (
          <Toast key={notification.id} notification={notification} onDismiss={handleDismiss} />
        ))}
      </div>
    </div>
  );
}
