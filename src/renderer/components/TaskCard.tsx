import { AlertCircle } from 'lucide-react';
import { Task } from '@shared/types';
import { formatDeadline, hoursToSeconds, calcProgress } from '../utils/formatTime';
import { Card, Badge } from './ui/primitives';
import { clsx } from 'clsx';

interface TaskCardProps {
  task: Task;
  isSelected?: boolean;
  onSelect?: (taskId: string) => void;
  className?: string;
}

export function TaskCard({ task, isSelected, onSelect, className }: TaskCardProps) {
  const { label: deadlineLabel, isOverdue, isUrgent } = task.deadline
    ? formatDeadline(task.deadline)
    : { label: 'No deadline', isOverdue: false, isUrgent: false };

  const priorityColors: Record<string, string> = {
    low: 'bg-slate-500/10 text-slate-400',
    medium: 'bg-blue-500/10 text-blue-400',
    high: 'bg-orange-500/10 text-orange-400',
    critical: 'bg-red-500/10 text-red-400 border border-red-500/20',
  };
  const priorityKey = task.priority.toLowerCase();

  // Mock progress for UI demo — replace with real session data later
  const progress = calcProgress(3600 * 2, hoursToSeconds(task.estimatedHours));

  return (
    <Card
      className={clsx(
        'p-5 transition-all hover:border-primary/50 group',
        isSelected && 'border-primary ring-1 ring-primary glowing bg-accent/50',
        className
      )}
      onClick={() => onSelect?.(task.id)}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex gap-2 items-center">
          <Badge className={priorityColors[priorityKey]}>
            {priorityKey.charAt(0).toUpperCase() + priorityKey.slice(1)}
          </Badge>
          <span className="text-xs text-muted-foreground font-medium bg-secondary/50 px-2 py-0.5 rounded-full">
            {task.projectName}
          </span>
        </div>
        {task.deadline && (
          <div className={clsx('flex items-center gap-1.5 text-xs font-medium', isOverdue ? 'text-destructive' : isUrgent ? 'text-orange-400' : 'text-muted-foreground')}>
            <AlertCircle className="w-3.5 h-3.5" />
            {deadlineLabel}
          </div>
        )}
      </div>

      <h3 className="font-semibold text-base mb-1 line-clamp-1 group-hover:text-primary transition-colors">
        {task.title}
      </h3>
      <p className="text-sm text-muted-foreground line-clamp-2 mb-4 h-10">
        {task.description}
      </p>

      <div className="space-y-2 mt-auto">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Progress</span>
          <span>{progress}%</span>
        </div>
        <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </Card>
  );
}
