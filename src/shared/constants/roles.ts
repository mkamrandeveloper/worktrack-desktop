import type { UserRole } from '../types';

/**
 * Who may assign a task to whom (mirrors the backend's taskAssignment.js).
 * Everyone listed may also assign tasks to themselves.
 */
export const ASSIGNABLE_TASK_ROLES: Partial<Record<UserRole, UserRole[]>> = {
  OWNER: ['ADMIN', 'MANAGER', 'EMPLOYEE'],
  ADMIN: ['MANAGER', 'EMPLOYEE'],
  MANAGER: ['EMPLOYEE'],
};

/** True if `actor` may assign a task to `assignee`. */
export function canAssignTaskTo(
  actor: { id: string; role: UserRole } | null | undefined,
  assignee: { id: string; role: UserRole }
): boolean {
  if (!actor) return false;
  if (actor.id === assignee.id) return true;
  return (ASSIGNABLE_TASK_ROLES[actor.role] ?? []).includes(assignee.role);
}

/**
 * Whose timesheets, screenshots, reports and Drive folders a person may see
 * (mirrors the backend's utils/visibility.js). Everyone sees themselves.
 */
export const VISIBLE_ROLES: Partial<Record<UserRole, UserRole[]>> = {
  OWNER: ['OWNER', 'ADMIN', 'MANAGER', 'EMPLOYEE'],
  ADMIN: ['ADMIN', 'MANAGER', 'EMPLOYEE'],
  MANAGER: ['EMPLOYEE'],
  EMPLOYEE: [],
};

/** True if `viewer` may see `member`'s timesheets/screenshots/reports. */
export function canSeeMember(
  viewer: { id: string; role: UserRole } | null | undefined,
  member: { id: string; role: UserRole }
): boolean {
  if (!viewer) return false;
  if (viewer.id === member.id) return true;
  return (VISIBLE_ROLES[viewer.role] ?? []).includes(member.role);
}
