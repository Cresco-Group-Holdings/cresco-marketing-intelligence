/**
 * Reminder contract for future notification jobs.
 * Notification workers should query tasks/approvals matching these criteria.
 */
export type TaskReminderCandidate = {
  taskId: string;
  organisationId: string;
  brandId: string | null;
  assigneeUserId: string | null;
  reporterUserId: string;
  title: string;
  dueAt: string;
  reminderType: "DUE_SOON" | "OVERDUE";
  hoursUntilDue: number;
};

export type ApprovalReminderCandidate = {
  approvalRequestId: string;
  organisationId: string;
  brandId: string | null;
  requesterUserId: string;
  title: string;
  type: string;
  createdAt: string;
  reminderType: "PENDING_REVIEW";
  hoursPending: number;
};

export const REMINDER_DUE_SOON_HOURS = 24;

export function buildTaskReminderCandidate(input: {
  id: string;
  organisationId: string;
  brandId: string | null;
  assigneeUserId: string | null;
  reporterUserId: string;
  title: string;
  dueAt: Date;
  now?: Date;
}): TaskReminderCandidate | null {
  const now = input.now ?? new Date();
  const hoursUntilDue = (input.dueAt.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursUntilDue < 0) {
    return {
      taskId: input.id,
      organisationId: input.organisationId,
      brandId: input.brandId,
      assigneeUserId: input.assigneeUserId,
      reporterUserId: input.reporterUserId,
      title: input.title,
      dueAt: input.dueAt.toISOString(),
      reminderType: "OVERDUE",
      hoursUntilDue,
    };
  }

  if (hoursUntilDue <= REMINDER_DUE_SOON_HOURS) {
    return {
      taskId: input.id,
      organisationId: input.organisationId,
      brandId: input.brandId,
      assigneeUserId: input.assigneeUserId,
      reporterUserId: input.reporterUserId,
      title: input.title,
      dueAt: input.dueAt.toISOString(),
      reminderType: "DUE_SOON",
      hoursUntilDue,
    };
  }

  return null;
}

export function buildApprovalReminderCandidate(input: {
  id: string;
  organisationId: string;
  brandId: string | null;
  requesterUserId: string;
  title: string;
  type: string;
  createdAt: Date;
  now?: Date;
}): ApprovalReminderCandidate {
  const now = input.now ?? new Date();
  const hoursPending = (now.getTime() - input.createdAt.getTime()) / (1000 * 60 * 60);
  return {
    approvalRequestId: input.id,
    organisationId: input.organisationId,
    brandId: input.brandId,
    requesterUserId: input.requesterUserId,
    title: input.title,
    type: input.type,
    createdAt: input.createdAt.toISOString(),
    reminderType: "PENDING_REVIEW",
    hoursPending,
  };
}
