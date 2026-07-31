import type { CrmFollowUpRuleTrigger, CrmTaskStatus, CrmTaskTypeCode } from "@prisma/client";

export const CRM_TASK_STATUSES: CrmTaskStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "DEFERRED",
  "OVERDUE",
];

export const CRM_TASK_TYPE_CODES: CrmTaskTypeCode[] = [
  "CALL",
  "EMAIL",
  "MEETING",
  "REVIEW",
  "RESEARCH",
  "FOLLOW_UP",
  "PROPOSAL",
  "DEMO",
  "ONBOARDING",
  "RENEWAL",
  "DATA_FIX",
  "OTHER",
];

export const DEFAULT_TASK_TYPE_LABELS: Record<CrmTaskTypeCode, string> = {
  CALL: "Call",
  EMAIL: "Email",
  MEETING: "Meeting",
  REVIEW: "Review",
  RESEARCH: "Research",
  FOLLOW_UP: "Follow-up",
  PROPOSAL: "Proposal",
  DEMO: "Demo",
  ONBOARDING: "Onboarding",
  RENEWAL: "Renewal",
  DATA_FIX: "Data fix",
  OTHER: "Other",
};

export const ACTIVE_TASK_STATUSES: CrmTaskStatus[] = ["OPEN", "IN_PROGRESS", "OVERDUE", "DEFERRED"];

export const TERMINAL_TASK_STATUSES: CrmTaskStatus[] = ["COMPLETED", "CANCELLED"];

export const FOLLOW_UP_RULE_TRIGGERS: CrmFollowUpRuleTrigger[] = [
  "NEW_LEAD_NO_OWNER",
  "QUALIFIED_LEAD_NO_TASK",
  "DEMO_REQUEST_NOT_CONTACTED",
  "MEETING_NO_NEXT_STEP",
  "PROPOSAL_NO_FOLLOW_UP",
  "TRIAL_ENDING",
  "OPPORTUNITY_INACTIVE",
  "RENEWAL_APPROACHING",
  "PAYMENT_FAILED",
  "LEAD_REPLIED_NO_TASK",
];

export const DEFAULT_REMINDER_MINUTES_BEFORE = 60;
export const MIN_REMINDER_INTERVAL_MINUTES = 240;
export const DEFAULT_OVERDUE_GRACE_HOURS = 1;
