import { useState, useEffect } from 'react';
import {
  X, Loader2, AlertCircle, ChevronLeft, ChevronRight, Check,
  FileText, UserRound, Users, Flag, CalendarClock, Briefcase, Mail, CheckCircle2,
} from 'lucide-react';
import { TeamMember, ProjectPriority } from '@shared/types';
import { clsx } from 'clsx';

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

const PRIORITIES: { value: ProjectPriority; label: string; color: string }[] = [
  { value: 'LOW', label: 'Low', color: 'border-slate-500/40 text-slate-400 bg-slate-500/10' },
  { value: 'MEDIUM', label: 'Medium', color: 'border-blue-500/40 text-blue-400 bg-blue-500/10' },
  { value: 'HIGH', label: 'High', color: 'border-orange-500/40 text-orange-400 bg-orange-500/10' },
  { value: 'URGENT', label: 'Urgent', color: 'border-red-500/40 text-red-400 bg-red-500/10' },
];

const STEPS = [
  { n: 1, title: 'Basics', icon: FileText },
  { n: 2, title: 'Client', icon: UserRound },
  { n: 3, title: 'Team', icon: Users },
  { n: 4, title: 'Priority', icon: Flag },
  { n: 5, title: 'Due Date', icon: CalendarClock },
  { n: 6, title: 'Review', icon: Check },
];

export function CreateProjectWizard({ onClose, onCreated }: Props) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [priority, setPriority] = useState<ProjectPriority>('MEDIUM');
  const [deadline, setDeadline] = useState('');

  const [team, setTeam] = useState<TeamMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    window.worktrack.manager.getTeam().then((res) => {
      if (res.success && res.data) setTeam(res.data.members ?? []);
    });
  }, []);

  const canNext = () => {
    if (step === 1) return name.trim().length > 0;
    if (step === 2) return clientEmail.trim() === '' || /.+@.+\..+/.test(clientEmail);
    return true;
  };

  const next = () => {
    setError(null);
    if (step === 1 && !name.trim()) { setError('Project name is required.'); return; }
    if (step === 2 && clientEmail && !/.+@.+\..+/.test(clientEmail)) { setError('Enter a valid client email.'); return; }
    setStep((s) => Math.min(6, s + 1));
  };
  const back = () => { setError(null); setStep((s) => Math.max(1, s - 1)); };

  const toggleMember = (id: string) =>
    setMemberIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const handleCreate = async () => {
    setError(null);
    setIsCreating(true);
    const res = await window.worktrack.projects.create({
      name: name.trim(),
      description: description.trim() || undefined,
      clientName: clientName.trim() || undefined,
      clientEmail: clientEmail.trim() || undefined,
      priority,
      deadline: deadline || undefined,
      memberIds,
    });
    setIsCreating(false);
    if (res.success) {
      onCreated();
    } else {
      setError(res.error ?? 'Failed to create project.');
    }
  };

  const memberName = (id: string) => team.find((m) => m.id === id)?.name ?? id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl animate-fade-in max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-primary" /> New Project
          </h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center transition">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = s.n === step;
            const done = s.n < step;
            return (
              <div key={s.n} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1">
                  <div className={clsx(
                    'w-8 h-8 rounded-full flex items-center justify-center border transition-colors',
                    done ? 'bg-primary border-primary text-primary-foreground'
                      : active ? 'border-primary text-primary bg-primary/10'
                      : 'border-border text-muted-foreground'
                  )}>
                    {done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <span className={clsx('text-[10px] font-medium', active ? 'text-primary' : 'text-muted-foreground')}>{s.title}</span>
                </div>
                {i < STEPS.length - 1 && <div className={clsx('h-0.5 flex-1 mx-1 -mt-4', s.n < step ? 'bg-primary' : 'bg-border')} />}
              </div>
            );
          })}
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 min-h-[240px]">
          {error && (
            <div className="flex items-center gap-2 text-destructive text-xs bg-destructive/10 border border-destructive/20 rounded-lg p-3 mb-4">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Project Name *</label>
                <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                  placeholder="Website Redesign" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition resize-none"
                  placeholder="What is this project about?" />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">Add a client to automatically send them a portal invitation when the project is created. Leave blank to skip.</p>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Client Name</label>
                <input value={clientName} onChange={(e) => setClientName(e.target.value)}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                  placeholder="Acme Corp" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Client Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)}
                    className="w-full bg-input border border-border rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                    placeholder="client@acme.com" />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <label className="block text-xs font-medium text-muted-foreground">Assign Employees</label>
              {team.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No team members available to assign.</p>
              ) : (
                <div className="space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar">
                  {team.map((m) => {
                    const selected = memberIds.includes(m.id);
                    return (
                      <button key={m.id} onClick={() => toggleMember(m.id)}
                        className={clsx(
                          'w-full flex items-center gap-3 p-2.5 rounded-lg border text-left transition',
                          selected ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/50'
                        )}>
                        <div className={clsx('w-5 h-5 rounded-md border flex items-center justify-center shrink-0', selected ? 'bg-primary border-primary' : 'border-border')}>
                          {selected && <Check className="w-3.5 h-3.5 text-primary-foreground" />}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{m.name}</div>
                          <div className="text-xs text-muted-foreground truncate">{m.email}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="text-xs text-muted-foreground">{memberIds.length} selected</p>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <label className="block text-xs font-medium text-muted-foreground">Priority</label>
              <div className="grid grid-cols-2 gap-3">
                {PRIORITIES.map((p) => (
                  <button key={p.value} onClick={() => setPriority(p.value)}
                    className={clsx(
                      'py-4 rounded-lg border-2 font-semibold text-sm transition-all',
                      priority === p.value ? p.color + ' ring-2 ring-offset-2 ring-offset-card' : 'border-border text-muted-foreground hover:border-muted-foreground/40'
                    )}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-3">
              <label className="block text-xs font-medium text-muted-foreground">Due Date</label>
              <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)}
                className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition" />
              <p className="text-xs text-muted-foreground">Optional — set a target completion date for the project.</p>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-foreground mb-2">Review &amp; Create</p>
              {[
                ['Name', name || '—'],
                ['Description', description || '—'],
                ['Client', clientName || clientEmail ? `${clientName || 'Client'}${clientEmail ? ` · ${clientEmail}` : ''}` : 'None'],
                ['Team', memberIds.length ? memberIds.map(memberName).join(', ') : 'None'],
                ['Priority', PRIORITIES.find((p) => p.value === priority)?.label ?? priority],
                ['Due Date', deadline || 'None'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-2 border-b border-border/60">
                  <span className="text-xs text-muted-foreground shrink-0">{k}</span>
                  <span className="text-sm text-foreground text-right truncate">{v}</span>
                </div>
              ))}
              {clientEmail && (
                <div className="flex items-center gap-2 text-xs text-teal-400 bg-teal-500/10 border border-teal-500/20 rounded-lg p-3 mt-2">
                  <Mail className="w-4 h-4 shrink-0" /> An invitation will be emailed to {clientEmail} automatically.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-5 border-t border-border">
          <button onClick={step === 1 ? onClose : back}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-muted transition">
            {step === 1 ? 'Cancel' : <><ChevronLeft className="w-4 h-4" /> Back</>}
          </button>
          {step < 6 ? (
            <button onClick={next} disabled={!canNext()}
              className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition">
              Next <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={handleCreate} disabled={isCreating}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-60 transition">
              {isCreating ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : <><CheckCircle2 className="w-4 h-4" /> Create Project</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
