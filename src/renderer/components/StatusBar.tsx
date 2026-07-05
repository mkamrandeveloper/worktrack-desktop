import React, { useEffect, useState } from 'react';
import { Activity, Wifi, WifiOff, CloudOff, RefreshCw, UploadCloud } from 'lucide-react';
import { useActivity } from '../hooks/useActivity';
import { clsx } from 'clsx';
import { formatDuration } from '../utils/formatTime';

export function StatusBar() {
  const { status: activityStatus, idleSeconds } = useActivity();
  const [syncStatus, setSyncStatus] = useState<string>('disconnected');
  const [queueStats, setQueueStats] = useState<{ pending: number; items: unknown[] }>({ pending: 0, items: [] });
  const [isFlushing, setIsFlushing] = useState(false);

  useEffect(() => {
    // Initial loads
    window.worktrack.sync.getStatus().then((res) => {
      if (res.success && res.data) setSyncStatus(res.data.status);
    });

    window.worktrack.screenshots.getQueue().then((res) => {
      if (res.success && res.data) setQueueStats(res.data);
    });

    // Subscriptions
    const unsubSync = window.worktrack.sync.onStatusChanged((res) => setSyncStatus(res.status));
    
    // Poll queue stats periodically
    const queueInterval = setInterval(() => {
      window.worktrack.screenshots.getQueue().then((res) => {
        if (res.success && res.data) setQueueStats(res.data);
      });
    }, 5000);

    return () => {
      unsubSync();
      clearInterval(queueInterval);
    };
  }, []);

  const handleFlush = async () => {
    if (isFlushing || queueStats.pending === 0) return;
    setIsFlushing(true);
    await window.worktrack.screenshots.flushQueue();
    setIsFlushing(false);
    
    // Refresh instantly
    const res = await window.worktrack.screenshots.getQueue();
    if (res.success && res.data) setQueueStats(res.data);
  };

  // Status mapping
  const syncMap: Record<string, { icon: React.ReactNode; text: string; color: string }> = {
    connected: { icon: <Wifi className="w-3.5 h-3.5" />, text: 'Connected', color: 'text-green-500' },
    disconnected: { icon: <WifiOff className="w-3.5 h-3.5" />, text: 'Offline', color: 'text-muted-foreground' },
    connecting: { icon: <RefreshCw className="w-3.5 h-3.5 animate-spin" />, text: 'Connecting...', color: 'text-yellow-500' },
    error: { icon: <CloudOff className="w-3.5 h-3.5" />, text: 'Sync Error', color: 'text-destructive' },
  };

  const activityMap: Record<string, { text: string; color: string }> = {
    active: { text: 'Active', color: 'bg-green-500' },
    idle: { text: 'Idle', color: 'bg-yellow-500' },
    on_break: { text: 'On Break', color: 'bg-orange-500' },
    offline: { text: 'Offline', color: 'bg-slate-500' },
  };

  const syncInfo = syncMap[syncStatus] ?? syncMap.disconnected;
  const actInfo = activityMap[activityStatus] ?? activityMap.offline;

  return (
    <div className="h-8 flex items-center justify-between px-4 border-t border-border bg-sidebar text-xs text-muted-foreground select-none">
      <div className="flex items-center gap-4">
        {/* Sync Status */}
        <div className={clsx('flex items-center gap-1.5 font-medium', syncInfo.color)}>
          {syncInfo.icon}
          <span>{syncInfo.text}</span>
        </div>

        {/* Upload Queue */}
        {queueStats.pending > 0 && (
          <button 
            className="flex items-center gap-1.5 hover:text-foreground transition-colors disabled:opacity-50"
            onClick={handleFlush}
            disabled={isFlushing || syncStatus !== 'connected'}
            title={syncStatus === 'connected' ? 'Upload pending screenshots now' : 'Connect to internet to upload'}
          >
            <UploadCloud className={clsx("w-3.5 h-3.5", isFlushing && "animate-pulse text-primary")} />
            <span>{queueStats.pending} pending uploads</span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* Idle duration (if idle) */}
        {activityStatus === 'idle' && idleSeconds > 0 && (
          <span className="text-yellow-500/80 font-medium">
            Idle for {formatDuration(idleSeconds)}
          </span>
        )}

        {/* Activity Status */}
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5" />
          <span>{actInfo.text}</span>
          <div className={clsx('w-2 h-2 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)]', actInfo.color, activityStatus === 'active' && 'animate-pulse')} />
        </div>
      </div>
    </div>
  );
}
