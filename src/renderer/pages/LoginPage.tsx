import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Activity, Loader2, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { clsx } from 'clsx';

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Email and password are required.');
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const { ok, error: err } = await login(email.trim(), password);
      if (ok) {
        navigate('/', { replace: true });
      } else {
        setError(err ?? 'Invalid email or password. Please try again.');
      }
    } catch {
      setError('Unable to connect to WorkTrack. Check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left Panel — Brand */}
      <div className="hidden lg:flex flex-col w-[45%] bg-gradient-to-br from-slate-900 via-slate-900 to-primary/20 p-12 relative overflow-hidden">
        {/* Decorative blobs */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-72 h-72 bg-accent/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center gap-3 z-10">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/40">
            <Activity className="w-6 h-6 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold text-foreground tracking-tight">WorkTrack</span>
        </div>

        <div className="flex-1 flex flex-col justify-center z-10">
          <h1 className="text-4xl font-bold text-foreground leading-tight mb-5">
            Productivity,<br />
            tracked <span className="text-primary">automatically.</span>
          </h1>
          <p className="text-muted-foreground text-base leading-relaxed max-w-sm">
            WorkTrack monitors your work sessions, captures screenshots, and syncs everything seamlessly — so you can focus on what matters.
          </p>

          <div className="mt-12 grid grid-cols-2 gap-5">
            {[
              { label: 'Automatic Tracking', desc: 'Smart timer starts with your task.' },
              { label: 'Screenshot Sync', desc: 'Compressed uploads to Google Drive.' },
              { label: 'Offline Support', desc: 'Data queued and synced on reconnect.' },
              { label: 'Cross Platform', desc: 'Windows, macOS, and Linux.' },
            ].map((feat) => (
              <div key={feat.label} className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                <div className="text-sm font-semibold text-foreground mb-1">{feat.label}</div>
                <div className="text-xs text-muted-foreground">{feat.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground z-10">
          v{import.meta.env.VITE_APP_VERSION ?? '1.0.0'} • Enterprise Grade Security
        </p>
      </div>

      {/* Right Panel — Login Form */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-12">
        {/* Mobile brand */}
        <div className="flex items-center gap-3 mb-10 lg:hidden">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/40">
            <Activity className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold tracking-tight">WorkTrack</span>
        </div>

        <div className="w-full max-w-sm animate-fade-in">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-2">Welcome back</h2>
            <p className="text-muted-foreground text-sm">
              Sign in to your WorkTrack account to start tracking.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium text-foreground">
                Work Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className={clsx(
                  'w-full h-11 px-4 rounded-lg border bg-input text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all',
                  error ? 'border-destructive focus:ring-destructive' : 'border-border'
                )}
                disabled={isLoading}
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium text-foreground">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={clsx(
                    'w-full h-11 px-4 pr-11 rounded-lg border bg-input text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all',
                    error ? 'border-destructive focus:ring-destructive' : 'border-border'
                  )}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 active:scale-95 transition-all shadow-lg shadow-primary/25 disabled:opacity-60 disabled:pointer-events-none flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-6">
            Don't have an account?{' '}
            <button
              id="btn-go-signup"
              type="button"
              onClick={() => navigate('/signup')}
              className="text-primary hover:underline font-medium"
            >
              Create or join an organization
            </button>
          </p>
          <p className="text-center text-xs text-muted-foreground mt-2">
            Invited as a client?{' '}
            <button
              id="btn-go-accept-invite"
              type="button"
              onClick={() => navigate('/accept-invite')}
              className="text-teal-500 hover:underline font-medium"
            >
              Accept an invitation
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
