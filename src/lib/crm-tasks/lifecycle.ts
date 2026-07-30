import type { CrmTaskStatus } from "@prisma/client";
import { ACTIVE_TASK_STATUSES, TERMINAL_TASK_STATUSES } from "@/lib/crm-tasks/constants";

export type TaskSnapshot = {
  id: string;
  status: CrmTaskStatus;
  dueDate: Date | null;
  deferredUntil: Date | null;
  ownerUserId: string | null;
};

export type TransitionResult = { valid: boolean; errors: string[]; nextStatus?: CrmTaskStatus };

const ALLOWED_TRANSITIONS: Record<CrmTaskStatus, CrmTaskStatus[]> = {
  OPEN: ["IN_PROGRESS", "COMPLETED", "CANCELLED", "DEFERRED", "OVERDUE"],
  IN_PROGRESS: ["OPEN", "COMPLETED", "CANCELLED", "DEFERRED", "OVERDUE"],
  OVERDUE: ["IN_PROGRESS", "COMPLETED", "CANCELLED", "DEFERRED"],
  DEFERRED: ["OPEN", "IN_PROGRESS", "CANCELLED", "OVERDUE"],
  COMPLETED: [],
  CANCELLED: [],
};

export function validateTaskTransition(task: TaskSnapshot, toStatus: CrmTaskStatus): TransitionResult {
  if (task.status === toStatus) return { valid: true, nextStatus: toStatus };
  if (TERMINAL_TASK_STATUSES.includes(task.status)) {
    return { valid: false, errors: [`Cannot transition from ${task.status}.`] };
  }
  if (!ALLOWED_TRANSITIONS[task.status].includes(toStatus)) {
    return { valid: false, errors: [`Transition from ${task.status} to ${toStatus} is not allowed.`] };
  }
  if (toStatus === "DEFERRED" && !task.deferredUntil) {
    return { valid: false, errors: ["Deferred tasks require a deferredUntil date."] };
  }
  return { valid: true, nextStatus: toStatus };
}

export function isTaskOverdue(task: TaskSnapshot, now = new Date()): boolean {
  if (!ACTIVE_TASK_STATUSES.includes(task.status) || !task.dueDate) return false;
  if (task.deferredUntil && task.deferredUntil > now) return false;
  return task.dueDate < now;
}

export function resolveDisplayStatus(task: TaskSnapshot, now = new Date()): CrmTaskStatus {
  if (TERMINAL_TASK_STATUSES.includes(task.status)) return task.status;
  if (task.status === "DEFERRED" && task.deferredUntil && task.deferredUntil > now) return "DEFERRED";
  return isTaskOverdue(task, now) ? "OVERDUE" : task.status;
}

export function canAssignTask(task: TaskSnapshot, actorUserId: string, actorRole: string): boolean {
  if (TERMINAL_TASK_STATUSES.includes(task.status)) return false;
  if (actorRole === "VIEWER") return false;
  if (["OWNER", "ADMIN"].includes(actorRole)) return true;
  return task.ownerUserId === actorUserId || task.ownerUserId === null;
}

export function canCompleteTask(task: TaskSnapshot): boolean {
  return ACTIVE_TASK_STATUSES.includes(task.status);
}
