import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Building2, Users, ArrowRight, Loader2, AlertCircle, CheckCircle2, ChevronRight, Search } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';

type Flow = 'choose' | 'create-org' | 'join-org' | 'join-success';

interface OrgOption {
  id: string;
  name: string;
  teamSize: number;
}

const TEAM_SIZES = [
  { label: '1–5 people', value: 5 },
  { label: '6–15 people', value: 15 },
  { label: '16–50 people', value: 50 },
  { label: '51–100 people', value: 100 },
  { label: '100+ people', value: 999 },
];

export function SignupPage() {
  const navigate = useNavigate();
  const { signupCreateOrg, signupJoinOrg } = useAuthStore();

  const [flow, setFlow] = useState<Flow>('choose');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Create Org form
  const [managerName, setManagerName] = useState('');
  const [managerEmail, setManagerEmail] = useState('');
  const [managerPassword, setManagerPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [teamSize, setTeamSize] = useState(15);

  // Join Org form
  const [empName, setEmpName] = useState('');
  const [empEmail, setEmpEmail] = useState('');
  const [empPassword, setEmpPassword] = useState('');
  const [orgSearch, setOrgSearch] = useState('');
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<OrgOption | null>(null);
  const [orgsLoading, setOrgsLoading] = useState(false);

  useEffect(() => {
    if (flow === 'join-org') {
      setOrgsLoading(true);
      window.worktrack.auth.listOrgs().then((res) => {
        if (res.success && res.data) setOrgs(res.data);
        setOrgsLoading(false);
      }).catch(() => setOrgsLoading(false));
    }
  }, [flow]);

  const filteredOrgs = orgs.filter(o =>
    o.name.toLowerCase().includes(orgSearch.toLowerCase())
  );

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managerName || !managerEmail || !managerPassword || !orgName) {
      setError('Please fill in all fields.');
      return;
    }
    setError(null);
    setIsLoading(true);
    const { ok, error: err } = await signupCreateOrg({ name: managerName, email: managerEmail, password: managerPassword, orgName, teamSize });
    setIsLoading(false);
    if (ok) {
      navigate('/', { replace: true });
    } else {
      setError(err ?? 'Signup failed.');
    }
  };

  const handleJoinOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empName || !empEmail || !empPassword || !selectedOrg) {
      setError('Please fill in all fields and select an organization.');
      return;
    }
    setError(null);
    setIsLoading(true);
    const { ok, error: err } = await signupJoinOrg({ name: empName, email: empEmail, password: empPassword, organizationId: selectedOrg.id });
    setIsLoading(false);
    if (ok) {
      setFlow('join-success');
    } else {
      setError(err ?? 'Join request failed.');
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left brand panel */}
      <div className="hidden lg:flex flex-col w-[42%] bg-zinc-950 p-12 relative overflow-hidden">
        <div className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-[60%] right-[-10%] w-[60%] h-[60%] bg-violet-500/10 rounded-full blur-[120px] pointer-events-none" />
        
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="flex items-center gap-3 z-10">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shadow-[0_0_20px_rgba(var(--primary),0.4)]">
            <Activity className="w-7 h-7 text-white" />
          </div>
          <span className="text-2xl font-display font-bold text-white tracking-tight">WorkTrack</span>
        </motion.div>
        
        <div className="flex-1 flex flex-col justify-center z-10">
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }} className="text-5xl font-display font-bold text-white leading-[1.1] mb-6 whitespace-pre-line">
            {flow === 'create-org' ? 'Build your\nteam workspace.' : 'Join your\nteam today.'}
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }} className="text-zinc-400 text-lg font-medium leading-relaxed max-w-sm">
            {flow === 'create-org'
              ? 'Set up an organization, invite your team, and start tracking everyone\'s productivity automatically.'
              : 'Request access to your organization. The manager will approve your account and assign tasks to you.'}
          </motion.p>
          
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }} className="mt-12 space-y-5">
            {['Automatic time tracking', 'Per-employee screenshots', 'Google Drive integration', 'Real-time dashboards'].map((feat) => (
              <div key={feat} className="flex items-center gap-4 text-base font-medium text-zinc-300">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <CheckCircle2 size={14} className="text-primary" />
                </div>
                {feat}
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Right content panel */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-12 overflow-y-auto">
        
        <AnimatePresence mode="wait">
          {/* ── CHOOSE FLOW ── */}
          {flow === 'choose' && (
            <motion.div key="choose" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="w-full max-w-sm">
              <div className="flex items-center gap-3 mb-12 lg:hidden">
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                  <Activity className="w-6 h-6 text-white" />
                </div>
                <span className="text-2xl font-display font-bold tracking-tight text-foreground">WorkTrack</span>
              </div>
              
              <div className="mb-10 text-center lg:text-left">
                <h2 className="text-3xl font-display font-bold text-foreground tracking-tight mb-2">Create an account</h2>
                <p className="text-muted-foreground font-medium text-base">How would you like to join WorkTrack?</p>
              </div>
              
              <div className="space-y-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setFlow('create-org')}
                  className="w-full flex items-center gap-4 p-5 rounded-2xl border border-border bg-card shadow-sm hover:border-primary/50 transition-colors group"
                >
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                    <Building2 size={24} className="text-primary" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-display font-bold text-base text-foreground">Create an Organization</div>
                    <div className="text-sm font-medium text-muted-foreground mt-0.5">I'm a manager setting up a new team</div>
                  </div>
                  <ChevronRight size={20} className="text-muted-foreground group-hover:text-primary transition-colors" />
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setFlow('join-org')}
                  className="w-full flex items-center gap-4 p-5 rounded-2xl border border-border bg-card shadow-sm hover:border-violet-500/50 transition-colors group"
                >
                  <div className="w-14 h-14 rounded-xl bg-violet-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-violet-500/20 transition-colors">
                    <Users size={24} className="text-violet-500" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-display font-bold text-base text-foreground">Join Organization</div>
                    <div className="text-sm font-medium text-muted-foreground mt-0.5">I'm an employee joining my team</div>
                  </div>
                  <ChevronRight size={20} className="text-muted-foreground group-hover:text-violet-500 transition-colors" />
                </motion.button>
              </div>
              
              <p className="text-center text-sm font-medium text-muted-foreground mt-10">
                Already have an account?{' '}
                <button onClick={() => navigate('/login')} className="text-primary hover:underline font-bold">Sign in</button>
              </p>
            </motion.div>
          )}

          {/* ── CREATE ORG FLOW ── */}
          {flow === 'create-org' && (
            <motion.div key="create" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="w-full max-w-sm">
              <button onClick={() => setFlow('choose')} className="text-[11px] font-display font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground mb-8 flex items-center gap-1.5 transition-colors">
                <ChevronRight className="w-4 h-4 rotate-180" /> Back
              </button>
              <h2 className="text-3xl font-display font-bold text-foreground mb-2">Create workspace</h2>
              <p className="text-muted-foreground font-medium text-base mb-8">You'll be the manager and can invite your team.</p>
              
              <AnimatePresence>
                {error && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-6">
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium">
                      <AlertCircle size={18} className="shrink-0" />
                      {error}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              
              <form onSubmit={handleCreateOrg} className="space-y-5">
                <div className="space-y-1.5 group">
                  <label className="text-[11px] font-display font-bold uppercase tracking-widest text-muted-foreground">Organization Name</label>
                  <input id="inp-org-name" value={orgName} onChange={e => setOrgName(e.target.value)}
                    className="w-full h-12 px-4 rounded-xl border bg-card text-foreground font-medium placeholder:text-muted-foreground/60 text-base focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm group-hover:border-primary/50"
                    placeholder="Acme Corp" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-display font-bold uppercase tracking-widest text-muted-foreground">Team Size</label>
                  <div className="grid grid-cols-2 gap-2">
                    {TEAM_SIZES.map(s => (
                      <button key={s.value} type="button" onClick={() => setTeamSize(s.value)}
                        className={clsx(
                          "px-3 py-2.5 rounded-lg border text-[13px] font-bold transition-all shadow-sm",
                          teamSize === s.value ? 'border-primary bg-primary text-primary-foreground' : 'border-border/60 text-muted-foreground hover:border-primary/40 bg-card hover:bg-muted/50'
                        )}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="border-t border-border/60 pt-5 mt-2 space-y-5">
                  <div className="space-y-1.5 group">
                    <label className="text-[11px] font-display font-bold uppercase tracking-widest text-muted-foreground">Your Name</label>
                    <input id="inp-manager-name" value={managerName} onChange={e => setManagerName(e.target.value)}
                      className="w-full h-12 px-4 rounded-xl border bg-card text-foreground font-medium placeholder:text-muted-foreground/60 text-base focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm group-hover:border-primary/50"
                      placeholder="John Smith" />
                  </div>
                  <div className="space-y-1.5 group">
                    <label className="text-[11px] font-display font-bold uppercase tracking-widest text-muted-foreground">Work Email</label>
                    <input id="inp-manager-email" type="email" value={managerEmail} onChange={e => setManagerEmail(e.target.value)}
                      className="w-full h-12 px-4 rounded-xl border bg-card text-foreground font-medium placeholder:text-muted-foreground/60 text-base focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm group-hover:border-primary/50"
                      placeholder="john@company.com" />
                  </div>
                  <div className="space-y-1.5 group">
                    <label className="text-[11px] font-display font-bold uppercase tracking-widest text-muted-foreground">Password</label>
                    <input id="inp-manager-password" type="password" value={managerPassword} onChange={e => setManagerPassword(e.target.value)}
                      className="w-full h-12 px-4 rounded-xl border bg-card text-foreground font-medium placeholder:text-muted-foreground/60 text-base focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm group-hover:border-primary/50"
                      placeholder="••••••••" />
                  </div>
                </div>
                <button id="btn-submit-create-org" type="submit" disabled={isLoading}
                  className="w-full h-14 bg-primary text-primary-foreground rounded-xl text-base font-bold flex items-center justify-center gap-2 hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60 shadow-[0_4px_14px_0_rgba(var(--primary),0.39)] hover:shadow-[0_6px_20px_rgba(var(--primary),0.23)] mt-6">
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><span>Create Workspace</span><ArrowRight size={18} /></>}
                </button>
              </form>
            </motion.div>
          )}

          {/* ── JOIN ORG FLOW ── */}
          {flow === 'join-org' && (
            <motion.div key="join" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="w-full max-w-sm">
              <button onClick={() => setFlow('choose')} className="text-[11px] font-display font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground mb-8 flex items-center gap-1.5 transition-colors">
                <ChevronRight className="w-4 h-4 rotate-180" /> Back
              </button>
              <h2 className="text-3xl font-display font-bold text-foreground mb-2">Join organization</h2>
              <p className="text-muted-foreground font-medium text-base mb-8">Select your organization and send a join request.</p>
              
              <AnimatePresence>
                {error && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-6">
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium">
                      <AlertCircle size={18} className="shrink-0" />
                      {error}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              
              <form onSubmit={handleJoinOrg} className="space-y-5">
                <div className="space-y-1.5 group">
                  <label className="text-[11px] font-display font-bold uppercase tracking-widest text-muted-foreground">Your Name</label>
                  <input id="inp-emp-name" value={empName} onChange={e => setEmpName(e.target.value)}
                    className="w-full h-12 px-4 rounded-xl border bg-card text-foreground font-medium placeholder:text-muted-foreground/60 text-base focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all shadow-sm group-hover:border-violet-500/50"
                    placeholder="Your full name" />
                </div>
                <div className="space-y-1.5 group">
                  <label className="text-[11px] font-display font-bold uppercase tracking-widest text-muted-foreground">Email</label>
                  <input id="inp-emp-email" type="email" value={empEmail} onChange={e => setEmpEmail(e.target.value)}
                    className="w-full h-12 px-4 rounded-xl border bg-card text-foreground font-medium placeholder:text-muted-foreground/60 text-base focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all shadow-sm group-hover:border-violet-500/50"
                    placeholder="you@company.com" />
                </div>
                <div className="space-y-1.5 group">
                  <label className="text-[11px] font-display font-bold uppercase tracking-widest text-muted-foreground">Password</label>
                  <input id="inp-emp-password" type="password" value={empPassword} onChange={e => setEmpPassword(e.target.value)}
                    className="w-full h-12 px-4 rounded-xl border bg-card text-foreground font-medium placeholder:text-muted-foreground/60 text-base focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all shadow-sm group-hover:border-violet-500/50"
                    placeholder="••••••••" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-display font-bold uppercase tracking-widest text-muted-foreground">Select Organization</label>
                  <div className="relative mb-3 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input value={orgSearch} onChange={e => setOrgSearch(e.target.value)}
                      className="w-full h-12 pl-11 pr-4 rounded-xl border bg-card text-foreground font-medium placeholder:text-muted-foreground/60 text-base focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all shadow-sm group-hover:border-violet-500/50"
                      placeholder="Search organization..." />
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-xl border border-border bg-card/60 p-1.5 shadow-inner custom-scrollbar">
                    {orgsLoading && <div className="text-center py-8 text-sm font-medium text-muted-foreground">Loading organizations…</div>}
                    {!orgsLoading && filteredOrgs.length === 0 && (
                      <div className="text-center py-8 text-sm font-medium text-muted-foreground">No organizations found.</div>
                    )}
                    {filteredOrgs.map(org => (
                      <button key={org.id} type="button" onClick={() => setSelectedOrg(org)}
                        className={clsx(
                          "w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm transition-all",
                          selectedOrg?.id === org.id ? 'bg-violet-500 text-white shadow-md' : 'text-foreground hover:bg-muted font-medium'
                        )}>
                        <span className="font-bold">{org.name}</span>
                        <span className={clsx("text-xs font-bold", selectedOrg?.id === org.id ? "text-violet-200" : "text-muted-foreground")}>{org.teamSize} members</span>
                      </button>
                    ))}
                  </div>
                  {selectedOrg && (
                    <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-xs font-bold text-violet-500 mt-2 flex items-center gap-1.5">
                      <CheckCircle2 size={14} /> Selected: {selectedOrg.name}
                    </motion.p>
                  )}
                </div>
                <button id="btn-submit-join-org" type="submit" disabled={isLoading || !selectedOrg}
                  className="w-full h-14 bg-violet-600 text-white rounded-xl text-base font-bold flex items-center justify-center gap-2 hover:bg-violet-500 active:scale-[0.98] transition-all disabled:opacity-60 shadow-[0_4px_14px_0_rgba(124,58,237,0.39)] hover:shadow-[0_6px_20px_rgba(124,58,237,0.23)] mt-6">
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><span>Send Request</span><ArrowRight size={18} /></>}
                </button>
              </form>
            </motion.div>
          )}

          {/* ── JOIN SUCCESS ── */}
          {flow === 'join-success' && (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-sm text-center">
              <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-6 shadow-inner border border-emerald-500/20">
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              </div>
              <h2 className="text-3xl font-display font-bold text-foreground mb-3">Request Sent!</h2>
              <p className="text-muted-foreground font-medium text-base leading-relaxed mb-10">
                Your join request has been sent to <strong className="text-foreground">{selectedOrg?.name}</strong>'s manager.
                Once approved, you can log in with your credentials.
              </p>
              <button id="btn-go-login" onClick={() => navigate('/login')}
                className="w-full h-14 bg-primary text-primary-foreground rounded-xl text-base font-bold hover:bg-primary/90 transition-all shadow-[0_4px_14px_0_rgba(var(--primary),0.39)] hover:shadow-[0_6px_20px_rgba(var(--primary),0.23)]">
                Go to Login
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
