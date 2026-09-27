import { useEffect, useState } from 'react';
import { Activity, CheckCircle2 } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuthStore } from '../store/authStore';
import { Button } from './ui/primitives';

export const DEFAULT_SCREENSHOT_INTERVAL = 5;

/**
 * Edits the org-wide screenshot interval (Owner / Admin / Manager). The saved
 * value flows back through the auth store's organization, and the backend
 * pushes it to every running desktop app in the org.
 */
export function ScreenshotIntervalControl({ className }: { className?: string }) {
  const { organization } = useAuthStore();
  const current = organization?.screenshotInterval ?? DEFAULT_SCREENSHOT_INTERVAL;

  const [value, setValue] = useState(String(current));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pull the latest value from the server (another manager may have changed it).
  useEffect(() => { window.worktrack.manager.getOrgSettings(); }, []);
  // Reflect outside changes in the input.
  useEffect(() => { setValue(String(current)); }, [current]);

  const handleSave = async () => {
    const minutes = Number(value);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 60) {
      setError('Enter a whole number of minutes from 1 to 60.');
      return;
    }
    setError(null);
    setSaving(true);
    const res = await window.worktrack.manager.updateOrgSettings({ screenshotInterval: minutes });
    setSaving(false);
    if (!res.success) {
      setError(res.error ?? 'Could not save the interval.');
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className={className}>
      <div className="flex items-end gap-4 bg-muted/30 p-5 rounded-2xl border border-border/50">
        <div className="flex-1">
          <label htmlFor="inp-screenshot-interval" className="block font-display font-bold text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
            Interval (minutes)
          </label>
          <input
            id="inp-screenshot-interval"
            type="number"
            min="1"
            max="60"
            step="1"
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
            className={clsx(
              'w-full bg-card border rounded-xl px-4 py-2.5 text-base font-semibold text-foreground focus:outline-none focus:ring-2 transition shadow-sm',
              error ? 'border-destructive focus:ring-destructive/40' : 'border-border focus:ring-primary/50 focus:border-primary'
            )}
          />
        </div>
        <Button
          id="btn-save-interval"
          onClick={handleSave}
          disabled={saving || String(current) === value}
          className="px-6 py-2.5 h-[46px]"
        >
          {saving ? <Activity size={18} className="animate-spin" /> : saved ? <><CheckCircle2 size={18} className="mr-1.5" /> Saved</> : 'Save'}
        </Button>
      </div>
      {error && <p className="text-sm font-medium text-destructive mt-3 px-2">{error}</p>}
      <p className="text-xs font-medium text-muted-foreground mt-3 px-2">
        Default is every {DEFAULT_SCREENSHOT_INTERVAL} minutes. Changes apply to all team members' apps immediately.
      </p>
    </div>
  );
}
