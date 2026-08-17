import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Activity, Loader2, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

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
      <div className="hidden lg:flex flex-col w-[45%] bg-zinc-950 p-12 relative overflow-hidden">
        {/* Decorative blobs */}
        <div className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-[60%] right-[-10%] w-[60%] h-[60%] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="flex items-center gap-3 z-10">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shadow-[0_0_20px_rgba(var(--primary),0.4)]">
            <Activity className="w-7 h-7 text-white" />
          </div>
          <span className="text-2xl font-display font-bold text-white tracking-tight">WorkTrack</span>
        </motion.div>

        <div className="flex-1 flex flex-col justify-center z-10 mt-10">
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }} className="text-5xl font-display font-bold text-white leading-[1.1] mb-6">
            Productivity,<br />
            tracked <span className="text-primary drop-shadow-[0_0_15px_rgba(var(--primary),0.5)]">automatically.</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }} className="text-zinc-400 text-lg font-medium leading-relaxed max-w-sm">
            WorkTrack monitors your work sessions, captures screenshots, and syncs everything seamlessly — so you can focus on what matters.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }} className="mt-14 grid grid-cols-2 gap-5">
            {[
              { label: 'Automatic Tracking', desc: 'Smart timer starts with your task.' },
              { label: 'Screenshot Sync', desc: 'Compressed uploads to Google Drive.' },
              { label: 'Offline Support', desc: 'Data queued and synced on reconnect.' },
              { label: 'Cross Platform', desc: 'Windows, macOS, and Linux.' },
            ].map((feat, i) => (
              <motion.div whileHover={{ y: -5 }} key={feat.label} className="bg-white/5 backdrop-blur-md rounded-2xl p-5 border border-white/10 transition-all">
                <div className="text-sm font-display font-bold text-white mb-2 uppercase tracking-wider">{feat.label}</div>
                <div className="text-sm text-zinc-400 font-medium">{feat.desc}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.4 }} className="text-sm font-mono font-bold text-zinc-500 z-10 uppercase tracking-widest mt-10">
          v{import.meta.env.VITE_APP_VERSION ?? '1.0.0'} • Enterprise Grade Security
        </motion.p>
      </div>

      {/* Right Panel — Login Form */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-12 relative overflow-hidden bg-background">
        
        {/* Mobile brand */}
        <div className="flex items-center gap-3 mb-12 lg:hidden relative z-10">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/40">
            <Activity className="w-6 h-6 text-primary-foreground" />
          </div>
          <span className="text-2xl font-display font-bold tracking-tight text-foreground">WorkTrack</span>
        </div>

        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }} className="w-full max-w-sm relative z-10">
          <div className="mb-10 text-center lg:text-left">
            <h2 className="text-3xl font-display font-bold text-foreground tracking-tight mb-2">Welcome back</h2>
            <p className="text-muted-foreground font-medium text-base">
              Sign in to your WorkTrack account.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            
            <div className="space-y-2 relative group">
              <label htmlFor="email" className="text-[11px] font-display font-bold uppercase tracking-widest text-muted-foreground">
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
                  'w-full h-14 px-5 rounded-xl border bg-card text-foreground font-medium placeholder:text-muted-foreground/60 text-base focus:outline-none focus:ring-2 transition-all shadow-sm group-hover:border-primary/50',
                  error ? 'border-destructive focus:ring-destructive/50' : 'border-border/60 focus:ring-primary/20 focus:border-primary'
                )}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2 relative group">
              <label htmlFor="password" className="text-[11px] font-display font-bold uppercase tracking-widest text-muted-foreground flex justify-between">
                Password
                <a href="#" className="text-primary hover:underline normal-case tracking-normal font-semibold">Forgot?</a>
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
                    'w-full h-14 px-5 pr-14 rounded-xl border bg-card text-foreground font-medium placeholder:text-muted-foreground/60 text-base focus:outline-none focus:ring-2 transition-all shadow-sm group-hover:border-primary/50',
                    error ? 'border-destructive focus:ring-destructive/50' : 'border-border/60 focus:ring-primary/20 focus:border-primary'
                  )}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium">
                    <AlertCircle size={18} className="shrink-0" />
                    {error}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-14 rounded-xl bg-primary text-primary-foreground font-bold text-base hover:bg-primary/90 active:scale-[0.98] transition-all shadow-[0_4px_14px_0_rgba(var(--primary),0.39)] hover:shadow-[0_6px_20px_rgba(var(--primary),0.23)] disabled:opacity-60 disabled:pointer-events-none flex items-center justify-center gap-2 mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="mt-10 space-y-4 text-center">
            <p className="text-sm font-medium text-muted-foreground">
              Don't have an account?{' '}
              <button
                id="btn-go-signup"
                type="button"
                onClick={() => navigate('/signup')}
                className="text-primary hover:underline font-bold"
              >
                Create or join workspace
              </button>
            </p>
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border"></div></div>
              <div className="relative flex justify-center text-xs"><span className="bg-background px-2 text-muted-foreground font-display font-bold uppercase tracking-wider">OR</span></div>
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              Invited as a client?{' '}
              <button
                id="btn-go-accept-invite"
                type="button"
                onClick={() => navigate('/accept-invite')}
                className="text-emerald-500 hover:underline font-bold"
              >
                Accept invitation
              </button>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
