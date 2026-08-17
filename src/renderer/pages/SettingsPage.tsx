import React, { useEffect, useState } from 'react';
import {
  Moon, Sun, Monitor, Bell, RefreshCw, Power, Globe, 
  Shield, Building2, Camera, Info, CheckCircle2
} from 'lucide-react';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import { Theme, Language } from '@shared/types';
import { clsx } from 'clsx';
import { Card, Button } from '../components/ui/primitives';
import { motion } from 'framer-motion';

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

// ── Main Page ─────────────────────────────────────────────────────────────────

export function SettingsPage() {
  const { settings, loadSettings, updateSettings, toggleStartup } = useSettingsStore();
  const { organization } = useAuthStore();
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
  }, []);

  const handleThemeChange = async (theme: Theme) => {
    await updateSettings({ theme });
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else if (theme === 'light') root.classList.remove('dark');
    else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      prefersDark ? root.classList.add('dark') : root.classList.remove('dark');
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

          <SettingRow
            icon={<Camera size={20} />}
            label="Screenshot Interval"
            description="Configured by your organization."
          >
            <div className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded-lg border border-border/50">
              <span className="text-sm font-semibold text-foreground">
                Every {organization?.screenshotInterval ?? 5} min
              </span>
              <Shield size={14} className="text-muted-foreground" />
            </div>
          </SettingRow>

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
