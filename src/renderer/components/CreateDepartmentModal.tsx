import React, { useState } from 'react';
import { X, Loader2, AlertCircle, Building2 } from 'lucide-react';
import { Department } from '@shared/types';

interface Props {
  onClose: () => void;
  onSuccess: (department: Department) => void;
}

export function CreateDepartmentModal({ onClose, onSuccess }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Department name is required.'); return; }
    setError(null);
    setIsLoading(true);
    const res = await window.worktrack.departments.create({ name: name.trim(), description: description.trim() || undefined });
    setIsLoading(false);
    if (res.success && res.data) {
      onSuccess(res.data);
    } else {
      setError(res.error ?? 'Failed to create department.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl animate-fade-in">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              New Department
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">Group your employees into a logical team</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center transition">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 text-destructive text-xs bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Department Name *</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
              placeholder="Engineering" required autoFocus />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition resize-none"
              rows={3} placeholder="What does this team work on?" />
          </div>

          <div className="flex gap-3 pt-4 border-t border-border mt-4">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 text-sm font-medium border border-border rounded-lg hover:bg-muted transition">
              Cancel
            </button>
            <button type="submit" disabled={isLoading}
              className="flex-1 py-2.5 text-sm font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Department'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
