import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { clsx } from 'clsx';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: { value: number; label?: string };
  color?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  loading?: boolean;
  className?: string;
}

const colorMap = {
  default: 'from-card to-card border-border',
  primary: 'from-primary/5 to-primary/10 border-primary/20',
  success: 'from-emerald-500/5 to-emerald-500/10 border-emerald-500/20',
  warning: 'from-amber-500/5 to-amber-500/10 border-amber-500/20',
  danger: 'from-rose-500/5 to-rose-500/10 border-rose-500/20',
};

const iconColorMap = {
  default: 'bg-muted text-muted-foreground',
  primary: 'bg-primary/10 text-primary',
  success: 'bg-emerald-500/10 text-emerald-500',
  warning: 'bg-amber-500/10 text-amber-500',
  danger: 'bg-rose-500/10 text-rose-500',
};

export function KPICard({
  title, value, subtitle, icon, trend, color = 'default', loading, className,
}: KPICardProps) {
  const trendUp = trend && trend.value > 0;
  const trendDown = trend && trend.value < 0;

  if (loading) {
    return (
      <div className={clsx('bg-card border border-border rounded-xl p-5 animate-pulse', className)}>
        <div className="h-4 w-24 bg-muted rounded mb-3" />
        <div className="h-8 w-20 bg-muted rounded mb-2" />
        <div className="h-3 w-16 bg-muted rounded" />
      </div>
    );
  }

  return (
    <div className={clsx(
      'relative overflow-hidden rounded-xl border p-5 bg-gradient-to-br transition-all duration-200 hover:shadow-lg hover:shadow-black/10 hover:-translate-y-0.5',
      colorMap[color],
      className,
    )}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
        {icon && (
          <div className={clsx('w-9 h-9 rounded-lg flex items-center justify-center', iconColorMap[color])}>
            {icon}
          </div>
        )}
      </div>

      <div className="text-3xl font-bold tracking-tight mb-1">{value}</div>

      <div className="flex items-center gap-2">
        {trend && (
          <div className={clsx(
            'flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-md',
            trendUp ? 'text-emerald-400 bg-emerald-400/10' :
            trendDown ? 'text-rose-400 bg-rose-400/10' :
            'text-muted-foreground bg-muted',
          )}>
            {trendUp ? <TrendingUp className="w-3 h-3" /> :
             trendDown ? <TrendingDown className="w-3 h-3" /> :
             <Minus className="w-3 h-3" />}
            {Math.abs(trend.value)}%
          </div>
        )}
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>

      {/* Decorative glow */}
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-gradient-to-br from-white/5 to-transparent blur-xl pointer-events-none" />
    </div>
  );
}
