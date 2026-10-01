import type { Task, TimerStatus } from '@shared/types';

interface TimerLike {
  taskId: string | null;
  status: TimerStatus;
  stopTimer: () => Promise<void>;
}

/**
 * Marks one of the current user's tasks complete — the only way a task gets
 * completed (the server allows it for the assignee only). If the timer is
 * tracking this task it's stopped first, so the session's hours are logged.
 */
export async function completeOwnTask(task: Pick<Task, 'id' | 'projectId'>, timer: TimerLike): Promise<{ ok: boolean; error?: string }> {
  const tracking = timer.taskId === task.id && ['running', 'paused', 'on_break'].includes(timer.status);
  if (tracking) await timer.stopTimer();
  if (!task.projectId) return { ok: false, error: 'This task is not part of a project.' };
  const res = await window.worktrack.projects.updateTask(task.projectId, task.id, { status: 'DONE' });
  return res.success ? { ok: true } : { ok: false, error: res.error ?? 'Could not complete the task.' };
}
