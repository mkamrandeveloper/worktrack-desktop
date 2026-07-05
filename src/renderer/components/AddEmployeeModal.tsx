import React, { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle, UserPlus, Copy, CheckCircle2, Building2, Briefcase } from 'lucide-react';
import { Department } from '@shared/types';

interface AddEmployeeResult {
  employee: { id: string; name: string; email: string };
  credentials: { email: string; password: string };
}

interface Props {
  onClose: () => void;
  onSuccess: (result: AddEmployeeResult) => void;
}

export function AddEmployeeModal({ onClose, onSuccess }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [position, setPosition] = useState('');
  
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AddEmployeeResult | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Load departments for the dropdown
    window.worktrack.departments.list().then(res => {
      if (res.success && res.data) setDepartments(res.data);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) { setError('Name, email and password are required.'); return; }
    setError(null);
    setIsLoading(true);
    const payload = { name, email, password, departmentId, position };
    const res = await window.worktrack.manager.addEmployee(payload);
    setIsLoading(false);
    if (res.success && res.data) {
      setResult(res.data as AddEmployeeResult);
    } else {
      setError(res.error ?? 'Failed to add employee.');
    }
  };

  const copyCredentials = () => {
    if (!result) return;
    const text = `WorkTrack Login Credentials\nEmail: ${result.credentials.email}\nPassword: ${result.credentials.password}\nURL: http://localhost:3001`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={!result ? onClose : undefined} />
      <div className="relative bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card z-10">
          <div>
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-primary" />
              Add Team Member
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">Invite a new member to your organization</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center transition">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {!result ? (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {error && (
              <div className="flex items-center gap-2 text-destructive text-xs bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Full Name *</label>
                <input id="inp-emp-add-name" value={name} onChange={e => setName(e.target.value)}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                  placeholder="Jane Smith" required />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Work Email *</label>
                <input id="inp-emp-add-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                  placeholder="jane@company.com" required />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Department</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <select
                    value={departmentId}
                    onChange={e => setDepartmentId(e.target.value)}
                    className="w-full bg-input border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition appearance-none"
                  >
                    <option value="">No Department</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Job Position</label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input value={position} onChange={e => setPosition(e.target.value)}
                    className="w-full bg-input border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                    placeholder="Software Engineer" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Temporary Password *</label>
                <input id="inp-emp-add-password" type="text" value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition font-mono"
                  placeholder="Set a password for the employee" required />
                <p className="text-[11px] text-muted-foreground mt-1.5">The employee will be emailed these credentials automatically.</p>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-border mt-4">
              <button type="button" onClick={onClose}
                className="flex-1 py-2.5 text-sm font-medium border border-border rounded-lg hover:bg-muted transition">
                Cancel
              </button>
              <button id="btn-add-emp-submit" type="submit" disabled={isLoading}
                className="flex-1 py-2.5 text-sm font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><UserPlus className="w-4 h-4" /> Invite Member</>}
              </button>
            </div>
          </form>
        ) : (
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/20 rounded-xl p-4">
              <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground">{result.employee.name} added successfully!</p>
                <p className="text-xs text-muted-foreground mt-0.5">They will receive an email with login instructions.</p>
              </div>
            </div>
            <div className="bg-muted rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Login Credentials</p>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Email</span>
                <span className="text-sm font-medium text-foreground">{result.credentials.email}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Password</span>
                <span className="text-sm font-mono font-medium text-foreground">{result.credentials.password}</span>
              </div>
            </div>
            <button
              id="btn-copy-credentials"
              onClick={copyCredentials}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium border border-border rounded-lg hover:bg-muted transition"
            >
              {copied ? <><CheckCircle2 className="w-4 h-4 text-green-400" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy Credentials</>}
            </button>
            <button onClick={() => onSuccess(result)}
              className="w-full py-2.5 text-sm font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition">
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
