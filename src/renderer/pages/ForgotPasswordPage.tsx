import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, KeyRound, Loader2, AlertCircle, ArrowRight, ChevronLeft, MailCheck } from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

const inputClass = (hasError: boolean) => clsx(
  'w-full h-14 px-5 rounded-xl border bg-card text-foreground font-medium placeholder:text-muted-foreground/60 text-base focus:outline-none focus:ring-2 transition-all shadow-sm',
  hasError ? 'border-destructive focus:ring-destructive/50' : 'border-border/60 focus:ring-primary/20 focus:border-primary'
);
const labelClass = 'text-[11px] font-display font-bold uppercase tracking-widest text-muted-foreground';

/**
 * Forgot password: 1) enter your email → a 6-digit code is emailed;
 * 2) enter the code and a new password → back to sign in.
 */
export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [email, setEmail] = useState((location.state as { email?: string } | null)?.email ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const requestCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!/.+@.+\..+/.test(email.trim())) { setError('Enter the email you sign in with.'); return; }
    setError(null); setIsLoading(true);
    const res = await window.worktrack.auth.forgotPassword({ email: email.trim() });
    setIsLoading(false);
    if (!res.success) { setError(res.error ?? 'Could not send the code. Try again.'); return; }
    setStep('reset');
    setInfo(`If an account exists for ${email.trim()}, a 6-digit code is on its way. Check your inbox (and spam).`);
  };

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code.trim())) { setError('Enter the 6-digit code from the email.'); return; }
    if (password.length < 8) { setError('New password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('The new passwords don\'t match.'); return; }
    setError(null); setIsLoading(true);
    const res = await window.worktrack.auth.resetPassword({ email: email.trim(), code: code.trim(), newPassword: password });
    setIsLoading(false);
    if (!res.success) { setError(res.error ?? 'Could not reset the password.'); return; }
    navigate('/login', { replace: true, state: { email: email.trim(), passwordReset: true } });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-8 py-12 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] max-w-[800px] max-h-[800px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="w-full max-w-sm relative z-10">
        <button onClick={() => navigate('/login')} className="flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors mb-8">
          <ChevronLeft size={16} /> Back to sign in
        </button>

        <div className="mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-5">
            {step === 'email' ? <KeyRound size={22} /> : <MailCheck size={22} />}
          </div>
          <h2 className="text-3xl font-display font-bold text-foreground tracking-tight mb-2">
            {step === 'email' ? 'Forgot your password?' : 'Set a new password'}
          </h2>
          <p className="text-muted-foreground font-medium text-base">
            {step === 'email'
              ? 'Enter your work email and we\'ll send you a 6-digit code to reset it.'
              : 'Enter the code from the email and choose a new password.'}
          </p>
        </div>

        {info && step === 'reset' && (
          <div className="flex items-start gap-3 p-4 mb-6 rounded-xl bg-primary/10 border border-primary/20 text-sm font-medium text-foreground">
            <MailCheck size={18} className="shrink-0 mt-0.5 text-primary" /> {info}
          </div>
        )}

        {step === 'email' ? (
          <form onSubmit={requestCode} className="space-y-6" noValidate>
            <div className="space-y-2">
              <label htmlFor="fp-email" className={labelClass}>Work Email</label>
              <input id="fp-email" type="email" autoFocus autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com" className={inputClass(!!error)} disabled={isLoading} />
            </div>
            <ErrorBox error={error} />
            <SubmitButton loading={isLoading} label="Send reset code" />
          </form>
        ) : (
          <form onSubmit={resetPassword} className="space-y-5" noValidate>
            <div className="space-y-2">
              <label htmlFor="fp-code" className={labelClass}>6-digit code</label>
              <input id="fp-code" inputMode="numeric" autoFocus autoComplete="one-time-code" maxLength={6} value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="123456"
                className={clsx(inputClass(!!error), 'font-mono tracking-[0.5em] text-center text-xl')} disabled={isLoading} />
            </div>
            <div className="space-y-2">
              <label htmlFor="fp-new" className={labelClass}>New password</label>
              <div className="relative">
                <input id="fp-new" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={password}
                  onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" className={clsx(inputClass(!!error), 'pr-14')} disabled={isLoading} />
                <button type="button" onClick={() => setShowPassword((s) => !s)} tabIndex={-1}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="fp-confirm" className={labelClass}>Confirm new password</label>
              <input id="fp-confirm" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={confirm}
                onChange={(e) => setConfirm(e.target.value)} className={inputClass(!!error)} disabled={isLoading} />
            </div>
            <ErrorBox error={error} />
            <SubmitButton loading={isLoading} label="Reset password" />
            <p className="text-sm text-center font-medium text-muted-foreground">
              Didn't get it?{' '}
              <button type="button" onClick={() => requestCode()} disabled={isLoading} className="text-primary hover:underline font-bold disabled:opacity-50">
                Send a new code
              </button>
            </p>
          </form>
        )}
      </motion.div>
    </div>
  );
}

function ErrorBox({ error }: { error: string | null }) {
  return (
    <AnimatePresence>
      {error && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium">
            <AlertCircle size={18} className="shrink-0" /> {error}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SubmitButton({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button type="submit" disabled={loading}
      className="w-full h-14 rounded-xl bg-primary text-primary-foreground font-bold text-base hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60 disabled:pointer-events-none flex items-center justify-center gap-2">
      {loading ? <Loader2 size={20} className="animate-spin" /> : <>{label} <ArrowRight size={18} /></>}
    </button>
  );
}
