import React from 'react';
import { clsx } from 'clsx';
import { motion, HTMLMotionProps } from 'framer-motion';

// --- Button ---

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'glass';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', isLoading, children, className, disabled, ...props }, ref) => {
    const base = 'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:pointer-events-none select-none relative overflow-hidden';

    const variants = {
      primary: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-premium',
      secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
      ghost: 'hover:bg-accent hover:text-accent-foreground',
      danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm',
      outline: 'border border-border hover:bg-accent hover:text-accent-foreground',
      glass: 'bg-white/10 dark:bg-white/5 backdrop-blur-md border border-white/20 hover:bg-white/20 text-foreground shadow-glass',
    };

    const sizes = {
      sm: 'h-8 px-3 text-xs',
      md: 'h-10 px-4 text-sm',
      lg: 'h-12 px-6 text-base',
      icon: 'h-10 w-10',
    };

    return (
      <motion.button
        ref={ref}
        whileHover={{ scale: disabled || isLoading ? 1 : 1.02 }}
        whileTap={{ scale: disabled || isLoading ? 1 : 0.96 }}
        className={clsx(base, variants[variant], sizes[size], className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <motion.span 
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin absolute" 
          />
        ) : null}
        <span className={clsx("flex items-center gap-2", isLoading && "opacity-0")}>
          {children}
        </span>
      </motion.button>
    );
  }
);
Button.displayName = 'Button';

// --- Badge ---

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline';
  className?: string;
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  const variants = {
    default: 'bg-secondary text-secondary-foreground',
    success: 'bg-green-500/15 text-green-500 dark:text-green-400 border border-green-500/30',
    warning: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border border-yellow-500/30',
    danger: 'bg-red-500/15 text-red-500 dark:text-red-400 border border-red-500/30',
    info: 'bg-blue-500/15 text-blue-500 dark:text-blue-400 border border-blue-500/30',
    outline: 'border border-border text-foreground',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

// --- Card ---

interface CardProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  className?: string;
  glowing?: boolean;
  interactive?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ children, className, glowing, interactive, onClick, ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        whileHover={interactive || onClick ? { y: -2, boxShadow: 'var(--tw-shadow-premium-hover)' } : {}}
        onClick={onClick}
        className={clsx(
          'rounded-2xl border border-border bg-card/60 backdrop-blur-xl text-card-foreground transition-shadow duration-300',
          glowing ? 'shadow-premium border-primary/20' : 'shadow-sm',
          (interactive || onClick) && 'cursor-pointer hover:border-border/80',
          className
        )}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);
Card.displayName = 'Card';

// --- Separator ---

export function Separator({ className }: { className?: string }) {
  return <div className={clsx('h-px bg-border/50', className)} />;
}
