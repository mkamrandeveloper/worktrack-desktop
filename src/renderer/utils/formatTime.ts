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
 * Live countdown to a task deadline, down to the minute once it's close.
 */
export function formatDeadlineCountdown(iso: string): { label: string; isOverdue: boolean; isUrgent: boolean } {
  const diffMs = new Date(iso).getTime() - Date.now();
  const overdue = diffMs < 0;
  const abs = Math.abs(diffMs);

  const days = Math.floor(abs / 86400000);
  const hours = Math.floor((abs % 86400000) / 3600000);
  const minutes = Math.floor((abs % 3600000) / 60000);

  let span: string;
  if (days > 0) span = `${days}d ${hours}h`;
  else if (hours > 0) span = `${hours}h ${minutes}m`;
  else if (minutes > 0) span = `${minutes}m`;
  else span = 'a moment';

  return {
    label: overdue ? `Overdue by ${span}` : `${span} left`,
    isOverdue: overdue,
    isUrgent: !overdue && diffMs <= 86400000,
  };
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
