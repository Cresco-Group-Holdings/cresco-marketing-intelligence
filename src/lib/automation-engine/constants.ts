export const AUTOMATION_EVENT_TYPES = [
  "CAMPAIGN_ACTIVATED",
  "CONTENT_ENTERED_REVIEW",
  "DEADLINE_APPROACHING",
  "LEAD_SCORE_THRESHOLD",
  "KPI_BELOW_TARGET",
  "MANUAL",
  "AUTOMATION_COMPLETED",
  "PUBLICATION_FAILED",
  "PUBLICATION_SUCCEEDED",
  "PUBLICATION_REAUTH_REQUIRED",
  "LEAD_CREATED",
  "LEAD_QUALIFIED",
  "BUDGET_THRESHOLD_REACHED",
  "PROVIDER_SYNC_FAILED",
  "ANALYTICS_THRESHOLD_BREACHED",
] as const;

export const AUTOMATION_ACTION_TYPES = [
  "CREATE_TASK",
  "UPDATE_CAMPAIGN_STATUS",
  "ASSIGN_USER",
  "REQUEST_APPROVAL",
  "CREATE_NOTIFICATION",
  "ADD_CRM_ACTIVITY",
  "UPDATE_LEAD_STATUS",
  "CREATE_CALENDAR_EVENT",
] as const;

export const AUTOMATION_CONDITION_FIELDS = [
  "campaign.status",
  "content.status",
  "content.upcomingCount",
  "lead.score",
  "lead.status",
  "kpi.variancePercent",
  "deadline.daysUntil",
  "event.resourceType",
] as const;

export const AUTOMATION_CONDITION_OPERATORS = [
  "equals",
  "not_equals",
  "greater_than",
  "less_than",
  "greater_or_equal",
  "less_or_equal",
  "in",
  "exists",
] as const;

export const ALLOWED_CAMPAIGN_STATUS_TRANSITIONS: Record<string, string[]> = {
  PLANNED: ["ACTIVE", "CANCELLED"],
  ACTIVE: ["PAUSED", "COMPLETED", "CANCELLED"],
  PAUSED: ["ACTIVE", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export const MAX_TRIGGER_DEPTH = 3;
export const MAX_ACTIONS_PER_EXECUTION = 20;
export const DEFAULT_DAILY_EXECUTION_LIMIT = 500;
export const DEFAULT_MONTHLY_QUOTA = 5000;
export const DEFAULT_ACTION_RETRIES = 3;

export type AutomationEventType = (typeof AUTOMATION_EVENT_TYPES)[number];
export type AutomationActionType = (typeof AUTOMATION_ACTION_TYPES)[number];
