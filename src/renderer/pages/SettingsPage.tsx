import React, { useEffect, useState } from 'react';
import {
  Moon,
  Sun,
  Monitor,
  Bell,
  RefreshCw,
  Power,
  Globe,
  Shield,
  Building2,
  Camera,
  Info,
} from 'lucide-react';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import { Theme, Language } from '@shared/types';
import { clsx } from 'clsx';
import { Card } from '../components/ui/primitives';

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
    <div className="flex items-center justify-between py-4">
      <div className="flex items-start gap-4">
        <div className="p-2 rounded-lg bg-secondary text-secondary-foreground shrink-0 mt-0.5">
          {icon}
        </div>
        <div>
          <div className="text-sm font-medium text-foreground">{label}</div>
          {description && (
            <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
          )}
        </div>
      </div>
      <div className="shrink-0 ml-6">{children}</div>
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
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-sm active:scale-95 duration-300',
        checked ? 'bg-primary' : 'bg-secondary'
      )}
    >
      <span
        className={clsx(
          'inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-300',
          checked ? 'translate-x-5.5' : 'translate-x-0.5'
        )}
      />
    </button>
  );
}

// ── Section Wrapper ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 px-2">
        {title}
      </h2>
      <Card className="divide-y divide-border/60 px-6">
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

    // 'available' only means a newer version exists and has started
    // downloading in the background — it isn't installable yet. The actual
    // "Install Update" action only becomes valid once onUpdateDownloaded
    // fires; previously the button relabeled itself at the 'available'
    // stage but stayed wired to handleCheckUpdate, so clicking it just
    // re-triggered a check instead of ever installing anything.
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
    // Apply to DOM
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
    { key: 'dark', icon: <Moon className="w-4 h-4" />, label: 'Dark' },
    { key: 'light', icon: <Sun className="w-4 h-4" />, label: 'Light' },
    { key: 'system', icon: <Monitor className="w-4 h-4" />, label: 'System' },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-8 animate-fade-in">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your preferences and account options.
          </p>
        </div>

        {/* Appearance */}
        <Section title="Appearance">
          <SettingRow
            icon={<Sun className="w-4 h-4" />}
            label="Theme"
            description="Choose how WorkTrack looks on your screen."
          >
            <div className="flex gap-1 p-1 rounded-lg bg-secondary">
              {themeOptions.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => handleThemeChange(opt.key)}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                    settings.theme === opt.key
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {opt.icon}
                  {opt.label}
                </button>
              ))}
            </div>
          </SettingRow>

          <SettingRow
            icon={<Globe className="w-4 h-4" />}
            label="Language"
            description="Interface language for WorkTrack Desktop."
          >
            <select
              value={settings.language}
              onChange={(e) => updateSettings({ language: e.target.value as Language })}
              className="h-10 px-4 rounded-xl border border-border bg-input text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-300 shadow-sm hover:border-secondary/50"
            >
              <option value="en">English</option>
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
            icon={<Power className="w-4 h-4" />}
            label="Launch on Startup"
            description="Automatically start WorkTrack when you log in."
          >
            <Toggle
              checked={settings.launchOnStartup}
              onChange={(v) => toggleStartup(v)}
            />
          </SettingRow>

          <SettingRow
            icon={<Monitor className="w-4 h-4" />}
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
            icon={<Bell className="w-4 h-4" />}
            label="Desktop Notifications"
            description="Show system notifications for important events."
          >
            <Toggle
              checked={settings.showDesktopNotifications}
              onChange={(v) => updateSettings({ showDesktopNotifications: v })}
            />
          </SettingRow>

          <SettingRow
            icon={<Bell className="w-4 h-4" />}
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
            icon={<Bell className="w-4 h-4" />}
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
            icon={<Bell className="w-4 h-4" />}
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
            icon={<RefreshCw className="w-4 h-4" />}
            label="Automatic Updates"
            description="Download and install updates automatically in the background."
          >
            <Toggle
              checked={settings.autoUpdate}
              onChange={(v) => updateSettings({ autoUpdate: v })}
            />
          </SettingRow>

          <SettingRow
            icon={<Info className="w-4 h-4" />}
            label="Check for Updates"
            description={`Current version: v${appVersion}`}
          >
            <button
              onClick={updateStatus === 'downloaded' ? handleInstallUpdate : handleCheckUpdate}
              disabled={updateStatus === 'checking' || updateStatus === 'available'}
              className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold border border-border rounded-xl hover:bg-accent hover:text-foreground transition-all duration-300 hover:shadow-sm hover:-translate-y-0.5 active:scale-95 disabled:opacity-50"
            >
              {updateStatus === 'checking' && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              {updateStatus === 'downloaded' ? '⬇ Install Update'
                : updateStatus === 'available' ? 'Downloading…'
                : updateStatus === 'upToDate' ? '✓ Up to Date'
                : 'Check Now'}
            </button>
          </SettingRow>
        </Section>

        {/* Screenshot Verification */}
        <Section title="Screenshot Verification">
          <SettingRow
            icon={<Camera className="w-4 h-4" />}
            label="Test Screenshots"
            description="Verify that screenshots are being captured and uploaded to Google Drive properly."
          >
            <button
              onClick={async () => {
                await window.worktrack.screenshots.test();
                alert('Test screenshot requested! It will capture in the background and upload to Drive.');
              }}
              className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold border border-border rounded-xl hover:bg-accent hover:text-foreground transition-all duration-300 hover:shadow-sm hover:-translate-y-0.5 active:scale-95"
            >
              Capture & Upload Test
            </button>
          </SettingRow>
        </Section>

        {/* Organization Settings — Read Only */}
        <Section title="Organization (Read-Only)">
          <SettingRow
            icon={<Building2 className="w-4 h-4" />}
            label="Organization"
            description="Managed by your administrator."
          >
            <span className="text-sm font-medium text-foreground">
              {organization?.name ?? '—'}
            </span>
          </SettingRow>

          <SettingRow
            icon={<Camera className="w-4 h-4" />}
            label="Screenshot Interval"
            description="Configured by your organization."
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">
                Every {organization?.screenshotInterval ?? 5} minutes
              </span>
              <Shield className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
          </SettingRow>

          <SettingRow
            icon={<Camera className="w-4 h-4" />}
            label="Monitor Capture"
            description="Which displays are captured for screenshots."
          >
            <span className="text-sm font-medium text-foreground capitalize">
              {organization?.screenshotMonitors ?? 'Primary'}
            </span>
          </SettingRow>
        </Section>

        {/* Security Info */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-green-500/5 border border-green-500/20 text-sm text-green-400">
          <Shield className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Secure by Design</span>
            <p className="text-green-400/70 text-xs mt-0.5">
              All data is encrypted at rest. Screenshots are compressed and uploaded over HTTPS. Tokens are stored encrypted locally.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
