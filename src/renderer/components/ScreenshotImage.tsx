import { useState, useEffect } from 'react';
import { MaterialIcon } from './ui/MaterialIcon';
import { clsx } from 'clsx';

/** Fetches and renders one screenshot's image via the authenticated main-process proxy. */
export function ScreenshotImage({ screenshotId, className }: { screenshotId: string; className?: string }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setStatus('loading');
    window.worktrack.screenshots.getImage(screenshotId).then((res) => {
      if (!alive) return;
      if (res.success && res.data) {
        setSrc(res.data.dataUrl);
        setStatus('ready');
      } else {
        setStatus('error');
      }
    });
    return () => { alive = false; };
  }, [screenshotId]);

  if (status === 'ready' && src) {
    return <img src={src} alt="" className={clsx('w-full h-full object-cover', className)} />;
  }

  return (
    <div className={clsx('w-full h-full flex items-center justify-center', status === 'error' ? 'text-muted-foreground' : 'text-muted-foreground/50 animate-pulse', className)}>
      <MaterialIcon name={status === 'error' ? 'broken_image' : 'image'} size={20} />
    </div>
  );
}
