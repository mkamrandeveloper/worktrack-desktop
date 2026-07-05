import React, { useState } from 'react';
import { X, Loader2, AlertCircle, Clock, Camera } from 'lucide-react';
import { TeamMember } from '@shared/types';

interface Props {
  member: TeamMember;
  onClose: () => void;
  onSuccess: () => void;
}

export function AssignTaskModal({ member, onClose, onSuccess }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('1');
  const [deadline, setDeadline] = useState('');
  const [screenshotInterval, setScreenshotInterval] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError('Task title is required.'); return; }
    setError(null);
    setIsLoading(true);
    const result = await window.worktrack.manager.assignTask({
      title: title.trim(),
      description: description.trim(),
      assigneeId: member.id,
      estimatedHours: parseFloat(estimatedHours) || 1,
      deadline: deadline || undefined,
      customScreenshotInterval: screenshotInterval ? parseInt(screenshotInterval) : undefined,
    });
    setIsLoading(false);
    if (result.success) {
      onSuccess();
    } else {
      setError(result.error ?? 'Failed to assign task.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl animate-fade-in">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h3 className="font-semibold text-foreground">Assign Task</h3>
            <p className="text-xs text-muted-foreground mt-0.5">To: <span className="text-primary">{member.name}</span></p>
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
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Task Title *</label>
            <input id="inp-task-title" value={title} onChange={e => setTitle(e.target.value)}
              className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
              placeholder="e.g. Design the onboarding flow" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Description</label>
            <textarea id="inp-task-desc" value={description} onChange={e => setDescription(e.target.value)} rows={3}
              className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition resize-none"
              placeholder="Describe the task..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                <Clock className="inline w-3 h-3 mr-1" />
                Estimated Hours
              </label>
              <input id="inp-task-hours" type="number" min="0.5" step="0.5" value={estimatedHours} onChange={e => setEstimatedHours(e.target.value)}
                className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Deadline (optional)</label>
              <input id="inp-task-deadline" type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)}
                className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition" />
            </div>
          </div>
          <div className="bg-muted/50 border border-border rounded-xl p-4">
            <label className="block text-xs font-medium text-foreground mb-1">
              <Camera className="inline w-3 h-3 mr-1 text-primary" />
              Custom Screenshot Interval (mins)
            </label>
            <p className="text-xs text-muted-foreground mb-2">Leave blank to use the global org setting.</p>
            <input id="inp-task-screenshot-interval" type="number" min="1" max="60" value={screenshotInterval} onChange={e => setScreenshotInterval(e.target.value)}
              className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
              placeholder="e.g. 5" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 text-sm font-medium border border-border rounded-lg hover:bg-muted transition">
              Cancel
            </button>
            <button id="btn-assign-submit" type="submit" disabled={isLoading}
              className="flex-1 py-2.5 text-sm font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Assign Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
