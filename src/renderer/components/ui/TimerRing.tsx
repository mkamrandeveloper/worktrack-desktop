import { clsx } from 'clsx';
import { formatDuration, calcProgress, hoursToSeconds } from '../../utils/formatTime';

export type TimerRingStatus = 'idle' | 'running' | 'paused' | 'on_break' | 'stopped';

interface TimerRingProps {
  status: TimerRingStatus;
  workSeconds: number;
  breakSeconds: number;
  /** Task estimate; the ring fills toward it (8h when unknown). */
  estimatedHours?: number;
  taskTitle?: string | null;
  size?: 'lg' | 'sm';
  className?: string;
}

const CIRCUMFERENCE = 283; // 2π·45 in the 100×100 viewBox

/**
 * The circular task timer. Used for the employee's own timer and, with the same
 * rules, for each employee's live timer on the manager dashboard.
 */
export function TimerRing({ status, workSeconds, breakSeconds, estimatedHours, taskTitle, size = 'lg', className }: TimerRingProps) {
  const onBreak = status === 'on_break';
  const paused = status === 'paused';
  const running = status === 'running';
  const active = running || onBreak || paused;
  const progress = calcProgress(workSeconds, hoursToSeconds(estimatedHours || 8));
  const offset = CIRCUMFERENCE - (progress / 100) * CIRCUMFERENCE;
  const lg = size === 'lg';

  return (
    <div className={clsx('relative shrink-0', lg ? 'w-56 h-56 md:w-64 md:h-64' : 'w-36 h-36', className)}>
      <svg className={clsx('w-full h-full circular-progress', lg ? 'drop-shadow-xl' : 'drop-shadow-md')} viewBox="0 0 100 100">
        <circle cx="50" cy="50" fill="none" r="45" stroke="hsl(var(--border))" strokeWidth="2.5" />
        <circle
          cx="50" cy="50" fill="none" r="45"
          stroke={onBreak ? '#f59e0b' : 'hsl(var(--primary))'}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={active ? offset : CIRCUMFERENCE}
          strokeLinecap="round" strokeWidth="3.5"
          className="transition-all duration-1000 ease-in-out"
        />
      </svg>
      <div className={clsx('absolute inset-0 flex flex-col items-center justify-center text-center', lg ? 'p-4' : 'p-3')}>
        <span className={clsx(
          'font-display font-bold uppercase text-secondary',
          lg ? 'text-[11px] tracking-[0.2em] mb-2' : 'text-[9px] tracking-[0.15em] mb-1'
        )}>
          {onBreak ? 'ON BREAK' : paused ? 'PAUSED' : running ? 'RECORDING' : 'READY'}
        </span>
        <span className={clsx(
          'font-mono font-bold text-foreground tracking-tight',
          lg ? 'text-4xl md:text-5xl drop-shadow-sm' : 'text-xl'
        )}>
          {formatDuration(onBreak ? breakSeconds : workSeconds)}
        </span>
        <span className={clsx(
          'font-medium text-muted-foreground max-w-full truncate',
          lg ? 'text-xs mt-2 px-4' : 'text-[10px] mt-1 px-2'
        )}>
          {taskTitle ?? 'No task selected'}
        </span>
      </div>
    </div>
  );
}
