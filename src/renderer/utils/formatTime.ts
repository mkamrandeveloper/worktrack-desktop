/**
 * Formats seconds into HH:MM:SS
 */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

/**
 * Formats seconds into a human-readable string like "2h 34m"
 */
export function formatDurationHuman(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Formats an ISO date string into a short date like "Jun 30"
 */
export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Returns how many days until a deadline, as a string.
 */
export function formatDeadline(iso: string): { label: string; isOverdue: boolean; isUrgent: boolean } {
  const deadline = new Date(iso);
  const now = new Date();
  const diffMs = deadline.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { label: `${Math.abs(diffDays)}d overdue`, isOverdue: true, isUrgent: false };
  if (diffDays === 0) return { label: 'Due today', isOverdue: false, isUrgent: true };
  if (diffDays === 1) return { label: 'Due tomorrow', isOverdue: false, isUrgent: true };
  if (diffDays <= 7) return { label: `${diffDays}d left`, isOverdue: false, isUrgent: true };
  return { label: `${diffDays}d left`, isOverdue: false, isUrgent: false };
}

/**
 * Converts hours to seconds.
 */
export function hoursToSeconds(hours: number): number {
  return Math.round(hours * 3600);
}

/**
 * Calculates progress percentage (clamped 0-100).
 */
export function calcProgress(elapsed: number, estimated: number): number {
  if (estimated <= 0) return 0;
  return Math.min(Math.round((elapsed / estimated) * 100), 100);
}
