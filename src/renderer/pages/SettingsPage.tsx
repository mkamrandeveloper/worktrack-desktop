import React, { useEffect, useState } from 'react';
import {
  Moon, Sun, Monitor, Bell, RefreshCw, Power, Globe, 
  Shield, Building2, Camera, Info, CheckCircle2, KeyRound, Eye, EyeOff, AlertCircle
} from 'lucide-react';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import { Theme, Language } from '@shared/types';
import { clsx } from 'clsx';
import { Card, Button } from '../components/ui/primitives';
import { ScreenshotIntervalControl, DEFAULT_SCREENSHOT_INTERVAL } from '../components/ScreenshotIntervalControl';
import { motion } from 'framer-motion';
import { useSnackbarStore } from '../store/snackbarStore';

// ── Small Components ──────────────────────────────────────────────────────────

function SettingRow({
  icon,
  label,
  description,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between py-5 gap-4">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20 shadow-inner">
          {icon}
        </div>
        <div>
          <div className="text-base font-semibold text-foreground">{label}</div>
          {description && (
            <div className="text-sm font-medium text-muted-foreground mt-0.5 max-w-[400px]">{description}</div>
          )}
        </div>
      </div>
      <div className="shrink-0 sm:ml-6 ml-14">{children}</div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={clsx(
        'relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-sm active:scale-95 duration-300 border',
        checked ? 'bg-primary border-primary' : 'bg-secondary/50 border-border'
      )}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className={clsx(
          'inline-block h-5 w-5 rounded-full bg-white shadow-sm',
          checked ? 'ml-[22px]' : 'ml-[3px]'
        )}
      />
    </button>
  );
}

// ── Section Wrapper ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-10">
      <h2 className="text-sm font-display font-bold uppercase tracking-wider text-muted-foreground mb-4 px-2">
        {title}
      </h2>
      <Card className="divide-y divide-border/50 px-7 shadow-sm bg-card/60">
        {children}
      </Card>
    </div>
  );
}

// ── Change password ───────────────────────────────────────────────────────────

function PasswordField({ id, label, value, onChange, show, autoComplete }: {
  id: string; label: string; value: string; onChange: (v: string) => void; show: boolean; autoComplete: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-[11px] font-display font-bold uppercase tracking-widest text-muted-foreground">{label}</label>
      <input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        className="w-full h-11 bg-card border border-border rounded-xl px-4 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition shadow-sm"
      />
    </div>
  );
}

/** Lets any signed-in user change their own password at any time. */
function ChangePasswordForm() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!current || !next || !confirm) return setError('Fill in all three fields.');
    if (next.length < 8) return setError('New password must be at least 8 characters.');
    if (next !== confirm) return setError('The new passwords don\'t match.');
    if (next === current) return setError('New password must be different from the current one.');
    setSaving(true);
    const res = await window.worktrack.auth.changePassword({ currentPassword: current, newPassword: next });
    setSaving(false);
    if (!res.success) return setError(res.error ?? 'Could not change the password.');
    setCurrent(''); setNext(''); setConfirm('');
    useSnackbarStore.getState().show('Password changed successfully', 'Other devices have been signed out');
  };

  return (
    <form onSubmit={submit} className="py-5 space-y-4">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20 shadow-inner">
          <KeyRound size={20} />
        </div>
        <div>
          <div className="text-base font-semibold text-foreground">Change Password</div>
          <div className="text-sm font-medium text-muted-foreground mt-0.5 max-w-[460px]">
            Use at least 8 characters. Changing it signs you out on your other devices; you stay signed in here.
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:pl-14">
        <PasswordField id="pw-current" label="Current password" value={current} onChange={setCurrent} show={show} autoComplete="current-password" />
        <PasswordField id="pw-new" label="New password" value={next} onChange={setNext} show={show} autoComplete="new-password" />
        <PasswordField id="pw-confirm" label="Confirm new password" value={confirm} onChange={setConfirm} show={show} autoComplete="new-password" />
      </div>
      {error && (
        <p className="sm:pl-14 flex items-center gap-2 text-sm font-medium text-destructive">
          <AlertCircle size={14} className="shrink-0" /> {error}
        </p>
      )}
      <div className="sm:pl-14 flex items-center gap-3">
        <Button type="submit" disabled={saving} className="rounded-full">
          {saving ? <RefreshCw size={16} className="animate-spin mr-2" /> : <KeyRound size={16} className="mr-2" />}
          Update Password
        </Button>
        <button type="button" onClick={() => setShow((v) => !v)} className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
          {show ? <EyeOff size={16} /> : <Eye size={16} />} {show ? 'Hide' : 'Show'} passwords
        </button>
      </div>
    </form>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function SettingsPage() {
  const { settings, loadSettings, updateSettings, toggleStartup } = useSettingsStore();
  const { organization, isManagerOrAbove } = useAuthStore();
  const [appVersion, setAppVersion] = useState<string>('--');
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'downloaded' | 'upToDate'>('idle');

  useEffect(() => {
    loadSettings();
    window.worktrack.system.getVersion().then((res) => {
      if (res.success && res.data) setAppVersion(res.data.version);
    });

    const unsubUpdate = window.worktrack.system.onUpdateAvailable((_info) => {
      setUpdateStatus('available');
    });
    const unsubDownloaded = window.worktrack.system.onUpdateDownloaded((_info) => {
      setUpdateStatus('downloaded');
    });
    return () => {
      unsubUpdate();
      unsubDownloaded();
    };
  }, [loadSettings]);

  const handleThemeChange = async (theme: Theme) => {
    await updateSettings({ theme });
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else if (theme === 'light') root.classList.remove('dark');
    else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
    }
  };

  const handleCheckUpdate = async () => {
    setUpdateStatus('checking');
    await window.worktrack.system.checkUpdate();
    setTimeout(() => {
      setUpdateStatus((s) => s === 'checking' ? 'upToDate' : s);
    }, 5000);
  };

  const handleInstallUpdate = async () => {
    await window.worktrack.system.installUpdate();
  };

  const themeOptions: Array<{ key: Theme; icon: React.ReactNode; label: string }> = [
    { key: 'dark', icon: <Moon size={16} />, label: 'Dark' },
    { key: 'light', icon: <Sun size={16} />, label: 'Light' },
    { key: 'system', icon: <Monitor size={16} />, label: 'System' },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-8 animate-fade-in bg-background">
      <div className="max-w-3xl mx-auto space-y-10 pb-24">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">Settings</h1>
          <p className="text-muted-foreground font-medium text-sm mt-1">
            Manage your preferences and account options.
          </p>
        </div>

        {/* Appearance */}
        <Section title="Security">
          <ChangePasswordForm />
        </Section>

        <Section title="Appearance">
          <SettingRow
            icon={<Sun size={20} />}
            label="Theme"
            description="Choose how WorkTrack looks on your screen."
          >
            <div className="flex gap-1.5 p-1.5 rounded-xl bg-card border border-border/60 shadow-sm">
              {themeOptions.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => handleThemeChange(opt.key)}
                  className={clsx(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all',
                    settings.theme === opt.key
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  )}
                >
                  {opt.icon}
                  {opt.label}
                </button>
              ))}
            </div>
          </SettingRow>

          <SettingRow
            icon={<Globe size={20} />}
            label="Language"
            description="Interface language for WorkTrack Desktop."
          >
            <select
              value={settings.language}
              onChange={(e) => updateSettings({ language: e.target.value as Language })}
              className="h-11 px-4 pr-8 rounded-xl border border-border bg-card text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-300 shadow-sm hover:border-border cursor-pointer appearance-none"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px' }}
            >
              <option value="en">English (US)</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
              <option value="ar">العربية</option>
            </select>
          </SettingRow>
        </Section>

        {/* System */}
        <Section title="System">
          <SettingRow
            icon={<Power size={20} />}
            label="Launch on Startup"
            description="Automatically start WorkTrack when you log in."
          >
            <Toggle
              checked={settings.launchOnStartup}
              onChange={(v) => toggleStartup(v)}
            />
          </SettingRow>

          <SettingRow
            icon={<Monitor size={20} />}
            label="Minimize to Tray on Close"
            description="Keep WorkTrack running in the background when the window is closed."
          >
            <Toggle
              checked={settings.minimizeToTray}
              onChange={(v) => updateSettings({ minimizeToTray: v })}
            />
          </SettingRow>
        </Section>

        {/* Notifications */}
        <Section title="Notifications">
          <SettingRow
            icon={<Bell size={20} />}
            label="Desktop Notifications"
            description="Show system notifications for important events."
          >
            <Toggle
              checked={settings.showDesktopNotifications}
              onChange={(v) => updateSettings({ showDesktopNotifications: v })}
            />
          </SettingRow>

          <SettingRow
            icon={<Bell size={20} />}
            label="Task Assigned"
            description="Notify when a new task is assigned to you."
          >
            <Toggle
              checked={settings.notifyOnTaskAssigned}
              onChange={(v) => updateSettings({ notifyOnTaskAssigned: v })}
              disabled={!settings.showDesktopNotifications}
            />
          </SettingRow>

          <SettingRow
            icon={<Bell size={20} />}
            label="Deadline Reminders"
            description={`Notify ${settings.deadlineReminderHours}h before task deadline.`}
          >
            <Toggle
              checked={settings.notifyOnDeadlineReminder}
              onChange={(v) => updateSettings({ notifyOnDeadlineReminder: v })}
              disabled={!settings.showDesktopNotifications}
            />
          </SettingRow>

          <SettingRow
            icon={<Bell size={20} />}
            label="Screenshot Upload Failures"
            description="Alert when a screenshot fails to upload."
          >
            <Toggle
              checked={settings.notifyOnScreenshotFailed}
              onChange={(v) => updateSettings({ notifyOnScreenshotFailed: v })}
              disabled={!settings.showDesktopNotifications}
            />
          </SettingRow>
        </Section>

        {/* Updates */}
        <Section title="Updates">
          <SettingRow
            icon={<RefreshCw size={20} />}
            label="Automatic Updates"
            description="Download and install updates automatically in the background."
          >
            <Toggle
              checked={settings.autoUpdate}
              onChange={(v) => updateSettings({ autoUpdate: v })}
            />
          </SettingRow>

          <SettingRow
            icon={<Info size={20} />}
            label="Check for Updates"
            description={`Current version: v${appVersion}`}
          >
            <Button
              variant={updateStatus === 'upToDate' ? 'outline' : 'primary'}
              onClick={updateStatus === 'downloaded' ? handleInstallUpdate : handleCheckUpdate}
              disabled={updateStatus === 'checking' || updateStatus === 'available'}
              className="rounded-full shadow-sm"
            >
              {updateStatus === 'checking' && <RefreshCw size={16} className="animate-spin mr-2" />}
              {updateStatus === 'upToDate' && <CheckCircle2 size={16} className="mr-2 text-emerald-500" />}
              {updateStatus === 'downloaded' ? '⬇ Install Update'
                : updateStatus === 'available' ? 'Downloading…'
                : updateStatus === 'upToDate' ? 'Up to Date'
                : 'Check Now'}
            </Button>
          </SettingRow>
        </Section>

        {/* Screenshot Verification */}
        <Section title="Troubleshooting">
          <SettingRow
            icon={<Camera size={20} />}
            label="Test Screenshots"
            description="Verify that screenshots are being captured and uploaded to Google Drive properly."
          >
            <Button
              variant="secondary"
              onClick={async () => {
                await window.worktrack.screenshots.test();
                alert('Test screenshot requested! It will capture in the background and upload to Drive.');
              }}
              className="rounded-full"
            >
              <Camera size={16} className="mr-2" />
              Capture & Upload Test
            </Button>
          </SettingRow>
        </Section>

        {/* Organization Settings — Read Only */}
        <Section title="Organization (Read-Only)">
          <SettingRow
            icon={<Building2 size={20} />}
            label="Organization"
            description="Managed by your administrator."
          >
            <span className="text-base font-bold text-foreground">
              {organization?.name ?? '—'}
            </span>
          </SettingRow>

          {isManagerOrAbove() ? (
            // Owner / Admin / Manager set the interval for the whole organization.
            <div className="py-5">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20 shadow-inner">
                  <Camera size={20} />
                </div>
                <div>
                  <div className="text-base font-semibold text-foreground">Screenshot Interval</div>
                  <div className="text-sm font-medium text-muted-foreground mt-0.5 max-w-[400px]">How often screenshots are captured for everyone in your organization.</div>
                </div>
              </div>
              <ScreenshotIntervalControl />
            </div>
          ) : (
            <SettingRow
              icon={<Camera size={20} />}
              label="Screenshot Interval"
              description="Configured by your organization."
            >
              <div className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded-lg border border-border/50">
                <span className="text-sm font-semibold text-foreground">
                  Every {organization?.screenshotInterval ?? DEFAULT_SCREENSHOT_INTERVAL} min
                </span>
                <Shield size={14} className="text-muted-foreground" />
              </div>
            </SettingRow>
          )}

          <SettingRow
            icon={<Monitor size={20} />}
            label="Monitor Capture"
            description="Which displays are captured for screenshots."
          >
            <span className="text-sm font-semibold text-foreground capitalize bg-muted/50 px-3 py-1.5 rounded-lg border border-border/50">
              {organization?.screenshotMonitors ?? 'Primary'}
            </span>
          </SettingRow>
        </Section>

        {/* Security Info */}
        <div className="flex items-start gap-4 p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
          <Shield size={24} className="shrink-0 mt-0.5" />
          <div>
            <span className="font-display font-bold uppercase tracking-wider text-sm">Secure by Design</span>
            <p className="font-medium text-sm mt-1 opacity-90 leading-relaxed">
              All data is encrypted at rest. Screenshots are compressed and uploaded over HTTPS. Tokens are stored encrypted locally.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
