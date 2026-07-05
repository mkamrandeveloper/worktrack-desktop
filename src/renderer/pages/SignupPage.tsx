import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Building2, Users, ArrowRight, Loader2, AlertCircle, CheckCircle2, ChevronRight, Search } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

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
      <div className="hidden lg:flex flex-col w-[42%] bg-gradient-to-br from-slate-900 via-slate-900 to-primary/20 p-12 relative overflow-hidden">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-72 h-72 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-center gap-3 z-10">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/40">
            <Activity className="w-6 h-6 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold text-foreground tracking-tight">WorkTrack</span>
        </div>
        <div className="flex-1 flex flex-col justify-center z-10">
          <h1 className="text-4xl font-bold text-foreground leading-tight mb-5">
            {flow === 'create-org' ? 'Build your\nteam workspace.' : 'Join your\nteam today.'}
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">
            {flow === 'create-org'
              ? 'Set up an organization, invite your team, and start tracking everyone\'s productivity automatically.'
              : 'Request access to your organization. The manager will approve your account and assign tasks to you.'}
          </p>
          <div className="mt-10 space-y-4">
            {['Automatic time tracking', 'Per-employee screenshots', 'Google Drive integration', 'Real-time dashboards'].map((feat) => (
              <div key={feat} className="flex items-center gap-3 text-sm text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                {feat}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right content panel */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-12 overflow-y-auto">
        {/* ── CHOOSE FLOW ── */}
        {flow === 'choose' && (
          <div className="w-full max-w-sm animate-fade-in">
            <div className="flex items-center gap-3 mb-10 lg:hidden">
              <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
                <Activity className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold tracking-tight">WorkTrack</span>
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Create an account</h2>
            <p className="text-muted-foreground text-sm mb-8">How would you like to join WorkTrack?</p>
            <div className="space-y-4">
              <button
                id="btn-create-org"
                onClick={() => setFlow('create-org')}
                className="w-full flex items-center gap-4 p-5 rounded-xl border border-border bg-card hover:bg-muted hover:border-primary/50 transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-foreground text-sm">Create an Organization</div>
                  <div className="text-xs text-muted-foreground mt-0.5">I'm a manager setting up a new team</div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
              <button
                id="btn-join-org"
                onClick={() => setFlow('join-org')}
                className="w-full flex items-center gap-4 p-5 rounded-xl border border-border bg-card hover:bg-muted hover:border-primary/50 transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-violet-500/20 transition-colors">
                  <Users className="w-6 h-6 text-violet-400" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-foreground text-sm">Request to Join Organization</div>
                  <div className="text-xs text-muted-foreground mt-0.5">I'm an employee joining my team</div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-violet-400 transition-colors" />
              </button>
            </div>
            <p className="text-center text-sm text-muted-foreground mt-8">
              Already have an account?{' '}
              <button onClick={() => navigate('/login')} className="text-primary hover:underline font-medium">Sign in</button>
            </p>
          </div>
        )}

        {/* ── CREATE ORG FLOW ── */}
        {flow === 'create-org' && (
          <div className="w-full max-w-sm animate-fade-in">
            <button onClick={() => setFlow('choose')} className="text-xs text-muted-foreground hover:text-foreground mb-6 flex items-center gap-1 transition-colors">
              ← Back
            </button>
            <h2 className="text-2xl font-bold text-foreground mb-1">Create your organization</h2>
            <p className="text-muted-foreground text-sm mb-7">You'll be the manager and can invite your team.</p>
            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 border border-destructive/20 rounded-lg p-3 mb-5">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}
            <form onSubmit={handleCreateOrg} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Organization Name</label>
                <input id="inp-org-name" value={orgName} onChange={e => setOrgName(e.target.value)}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                  placeholder="Acme Corp" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Team Size</label>
                <div className="grid grid-cols-2 gap-2">
                  {TEAM_SIZES.map(s => (
                    <button key={s.value} type="button" onClick={() => setTeamSize(s.value)}
                      className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all ${teamSize === s.value ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="border-t border-border pt-4">
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Your Name</label>
                <input id="inp-manager-name" value={managerName} onChange={e => setManagerName(e.target.value)}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                  placeholder="John Smith" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Work Email</label>
                <input id="inp-manager-email" type="email" value={managerEmail} onChange={e => setManagerEmail(e.target.value)}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                  placeholder="john@company.com" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Password</label>
                <input id="inp-manager-password" type="password" value={managerPassword} onChange={e => setManagerPassword(e.target.value)}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                  placeholder="••••••••" />
              </div>
              <button id="btn-submit-create-org" type="submit" disabled={isLoading}
                className="w-full bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60">
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Create Organization</span><ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>
          </div>
        )}

        {/* ── JOIN ORG FLOW ── */}
        {flow === 'join-org' && (
          <div className="w-full max-w-sm animate-fade-in">
            <button onClick={() => setFlow('choose')} className="text-xs text-muted-foreground hover:text-foreground mb-6 flex items-center gap-1 transition-colors">
              ← Back
            </button>
            <h2 className="text-2xl font-bold text-foreground mb-1">Join an organization</h2>
            <p className="text-muted-foreground text-sm mb-7">Select your organization and send a join request to the manager.</p>
            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 border border-destructive/20 rounded-lg p-3 mb-5">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}
            <form onSubmit={handleJoinOrg} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Your Name</label>
                <input id="inp-emp-name" value={empName} onChange={e => setEmpName(e.target.value)}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                  placeholder="Your full name" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email</label>
                <input id="inp-emp-email" type="email" value={empEmail} onChange={e => setEmpEmail(e.target.value)}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                  placeholder="you@company.com" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Password</label>
                <input id="inp-emp-password" type="password" value={empPassword} onChange={e => setEmpPassword(e.target.value)}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                  placeholder="••••••••" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Select Organization</label>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input value={orgSearch} onChange={e => setOrgSearch(e.target.value)}
                    className="w-full bg-input border border-border rounded-lg pl-8 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                    placeholder="Search organization..." />
                </div>
                <div className="max-h-44 overflow-y-auto space-y-1 rounded-lg border border-border bg-card p-1">
                  {orgsLoading && <div className="text-center py-6 text-xs text-muted-foreground">Loading organizations…</div>}
                  {!orgsLoading && filteredOrgs.length === 0 && (
                    <div className="text-center py-6 text-xs text-muted-foreground">No organizations found.</div>
                  )}
                  {filteredOrgs.map(org => (
                    <button key={org.id} type="button" onClick={() => setSelectedOrg(org)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all ${selectedOrg?.id === org.id ? 'bg-primary/10 text-primary border border-primary/30' : 'text-foreground hover:bg-muted'}`}>
                      <span className="font-medium">{org.name}</span>
                      <span className="text-xs text-muted-foreground">{org.teamSize} members</span>
                    </button>
                  ))}
                </div>
                {selectedOrg && (
                  <p className="text-xs text-primary mt-1.5">✓ Selected: <strong>{selectedOrg.name}</strong></p>
                )}
              </div>
              <button id="btn-submit-join-org" type="submit" disabled={isLoading || !selectedOrg}
                className="w-full bg-violet-600 text-white rounded-lg py-2.5 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-violet-500 active:scale-[0.98] transition-all disabled:opacity-60">
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Send Join Request</span><ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>
          </div>
        )}

        {/* ── JOIN SUCCESS ── */}
        {flow === 'join-success' && (
          <div className="w-full max-w-sm text-center animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 className="w-9 h-9 text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-3">Request Sent!</h2>
            <p className="text-muted-foreground text-sm leading-relaxed mb-8">
              Your join request has been sent to <strong>{selectedOrg?.name}</strong>'s manager.
              Once approved, you can log in with your credentials.
            </p>
            <button id="btn-go-login" onClick={() => navigate('/login')}
              className="w-full bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-semibold hover:bg-primary/90 transition-all">
              Go to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
