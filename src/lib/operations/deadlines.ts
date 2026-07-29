import type { ContentDeadlineStatus } from "@prisma/client";
import { DUE_SOON_WINDOW_MS } from "@/lib/operations/constants";

export function computeDeadlineStatus(
  dueAt: Date,
  completedAt: Date | null | undefined,
  now = new Date(),
): ContentDeadlineStatus {
  if (completedAt) {
    return "COMPLETED";
  }
  if (dueAt.getTime() < now.getTime()) {
    return "OVERDUE";
  }
  if (dueAt.getTime() - now.getTime() <= DUE_SOON_WINDOW_MS) {
    return "DUE_SOON";
  }
  return "UPCOMING";
}

export function isOverdue(dueAt: Date, completedAt: Date | null | undefined, now = new Date()) {
  return !completedAt && dueAt.getTime() < now.getTime();
}
