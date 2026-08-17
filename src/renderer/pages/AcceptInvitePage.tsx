import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, FolderKanban, Loader2, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

export function AcceptInvitePage() {
  const navigate = useNavigate();
  const { acceptClientInvite } = useAuthStore();

  const [token, setToken] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim() || !password.trim()) {
      setError('Invitation code and password are required.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const { ok, error: err } = await acceptClientInvite({
        token: token.trim(),
        password,
        name: name.trim() || undefined,
      });
      if (ok) {
        navigate('/client-portal', { replace: true });
      } else {
        setError(err ?? 'Could not accept the invitation. Check your code and try again.');
      }
    } catch {
      setError('Unable to connect to WorkTrack. Check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-8 py-12 relative overflow-hidden">
      {/* Decorative background blur */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] max-w-[800px] max-h-[800px] bg-teal-500/5 rounded-full blur-[100px] pointer-events-none" />
      
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-sm relative z-10">
        
        <div className="flex items-center gap-3 mb-10 justify-center">
          <div className="w-12 h-12 rounded-xl bg-teal-500 flex items-center justify-center shadow-lg shadow-teal-500/30">
            <FolderKanban className="w-6 h-6 text-white" />
          </div>
          <span className="text-3xl font-display font-bold tracking-tight text-foreground">WorkTrack</span>
        </div>

        <div className="mb-10 text-center">
          <h2 className="text-3xl font-display font-bold text-foreground tracking-tight mb-2">Accept invitation</h2>
          <p className="text-muted-foreground font-medium text-base">
            Enter your code to access your portal.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          
          <div className="space-y-2 group">
            <label htmlFor="token" className="text-[11px] font-display font-bold uppercase tracking-widest text-muted-foreground">Invitation Code</label>
            <input
              id="token"
              type="text"
              autoFocus
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste the code from your email"
              className={clsx(
                'w-full h-14 px-5 rounded-xl border bg-card text-foreground font-medium placeholder:text-muted-foreground/60 text-base focus:outline-none focus:ring-2 transition-all shadow-sm group-hover:border-teal-500/50',
                error ? 'border-destructive focus:ring-destructive/50' : 'border-border/60 focus:ring-teal-500/20 focus:border-teal-500'
              )}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2 group">
            <label htmlFor="name" className="text-[11px] font-display font-bold uppercase tracking-widest text-muted-foreground">Your Name <span className="opacity-70 font-normal lowercase tracking-normal">(optional)</span></label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Client"
              className="w-full h-14 px-5 rounded-xl border border-border/60 bg-card text-foreground font-medium placeholder:text-muted-foreground/60 text-base focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all shadow-sm group-hover:border-teal-500/50"
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2 group">
            <label htmlFor="password" className="text-[11px] font-display font-bold uppercase tracking-widest text-muted-foreground">Set a Password</label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className={clsx(
                  'w-full h-14 px-5 pr-14 rounded-xl border bg-card text-foreground font-medium placeholder:text-muted-foreground/60 text-base focus:outline-none focus:ring-2 transition-all shadow-sm group-hover:border-teal-500/50',
                  error ? 'border-destructive focus:ring-destructive/50' : 'border-border/60 focus:ring-teal-500/20 focus:border-teal-500'
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
            className="w-full h-14 rounded-xl bg-teal-500 text-white font-bold text-base hover:bg-teal-600 active:scale-[0.98] transition-all shadow-[0_4px_14px_0_rgba(20,184,166,0.39)] hover:shadow-[0_6px_20px_rgba(20,184,166,0.23)] disabled:opacity-60 disabled:pointer-events-none flex items-center justify-center gap-2 mt-4"
          >
            {isLoading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Setting up...
              </>
            ) : (
              <>
                Accept & Continue <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <p className="text-center text-sm font-medium text-muted-foreground mt-10">
          Already have an account?{' '}
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="text-teal-500 hover:underline font-bold"
          >
            Sign in
          </button>
        </p>
      </motion.div>
    </div>
  );
}
