import { ReactNode } from 'react';
import { clsx } from 'clsx';

type BadgeVariant =
  | 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info'
  | 'active' | 'idle' | 'offline' | 'break' | 'overtime' | 'clocked_out';

const variantMap: Record<BadgeVariant, string> = {
  default:     'bg-muted text-muted-foreground border-border',
  primary:     'bg-primary/10 text-primary border-primary/30',
  success:     'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  warning:     'bg-amber-500/10 text-amber-400 border-amber-500/30',
  danger:      'bg-rose-500/10 text-rose-400 border-rose-500/30',
  info:        'bg-sky-500/10 text-sky-400 border-sky-500/30',
  active:      'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  idle:        'bg-amber-500/10 text-amber-400 border-amber-500/30',
  offline:     'bg-muted text-muted-foreground border-border',
  break:       'bg-sky-500/10 text-sky-400 border-sky-500/30',
  overtime:    'bg-violet-500/10 text-violet-400 border-violet-500/30',
  clocked_out: 'bg-muted/50 text-muted-foreground/60 border-border',
};

const dotColorMap: Record<BadgeVariant, string> = {
  default: 'bg-muted-foreground', primary: 'bg-primary',
  success: 'bg-emerald-500', warning: 'bg-amber-500', danger: 'bg-rose-500', info: 'bg-sky-500',
  active: 'bg-emerald-400', idle: 'bg-amber-400', offline: 'bg-zinc-500',
  break: 'bg-sky-400', overtime: 'bg-violet-400', clocked_out: 'bg-zinc-600',
};

const labelMap: Record<BadgeVariant, string> = {
  default: '', primary: '', success: 'Active', warning: 'Warning', danger: 'Error', info: 'Info',
  active: 'Working', idle: 'Idle', offline: 'Offline',
  break: 'On Break', overtime: 'Overtime', clocked_out: 'Clocked Out',
};

interface StatusBadgeProps {
  variant?: BadgeVariant;
  /** Alias for `variant` — used by dashboard callers. */
  status?: BadgeVariant;
  label?: string;
  children?: ReactNode;
  dot?: boolean;
  pulse?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function StatusBadge({ variant, status, label, children, dot = false, pulse = false, size = 'md', className }: StatusBadgeProps) {
  const resolvedVariant = status ?? variant ?? 'default';
  const displayLabel = children ?? label ?? labelMap[resolvedVariant];
  return (
    <span className={clsx(
      'inline-flex items-center gap-1.5 border rounded-full font-medium',
      size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1',
      variantMap[resolvedVariant],
      className,
    )}>
      {dot && (
        <span className={clsx(
          'rounded-full shrink-0',
          size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2',
          dotColorMap[resolvedVariant],
          pulse && resolvedVariant === 'active' && 'animate-pulse',
        )} />
      )}
      {displayLabel}
    </span>
  );
}
