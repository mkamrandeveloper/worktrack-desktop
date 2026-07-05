import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, FolderKanban, Loader2, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { clsx } from 'clsx';

/**
 * Client invitation acceptance. A client pastes the invitation code from their
 * email, sets a name + password, and is logged straight into the read-only
 * project portal.
 */
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
    <div className="min-h-screen flex items-center justify-center bg-background px-8 py-12">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-teal-500 flex items-center justify-center shadow-lg shadow-teal-500/40">
            <FolderKanban className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">WorkTrack</span>
        </div>

        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-2">Accept your invitation</h2>
          <p className="text-muted-foreground text-sm">
            Enter the invitation code from your email and choose a password to access your project portal.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="token" className="text-sm font-medium text-foreground">Invitation Code</label>
            <input
              id="token"
              type="text"
              autoFocus
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste the code from your email"
              className={clsx(
                'w-full h-11 px-4 rounded-lg border bg-input text-foreground placeholder:text-muted-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all',
                error ? 'border-destructive focus:ring-destructive' : 'border-border'
              )}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="name" className="text-sm font-medium text-foreground">Your Name <span className="text-muted-foreground font-normal">(optional)</span></label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Client"
              className="w-full h-11 px-4 rounded-lg border border-border bg-input text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
              disabled={isLoading}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium text-foreground">Set a Password</label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className={clsx(
                  'w-full h-11 px-4 pr-11 rounded-lg border bg-input text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all',
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

          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-11 rounded-lg bg-teal-500 text-white font-semibold text-sm hover:bg-teal-500/90 active:scale-95 transition-all shadow-lg shadow-teal-500/25 disabled:opacity-60 disabled:pointer-events-none flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Setting up your portal...
              </>
            ) : (
              'Accept & Continue'
            )}
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Already have an account?{' '}
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="text-teal-500 hover:underline font-medium"
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}
