export const AUTOMATION_STATUSES = [
  "DRAFT",
  "IN_REVIEW",
  "APPROVED",
  "ACTIVE",
  "PAUSED",
  "STOPPED",
  "ARCHIVED",
] as const;

export type AutomationStatus = (typeof AUTOMATION_STATUSES)[number];

export const TRIGGER_TYPES = [
  "FORM_SUBMITTED",
  "LEAD_CREATED",
  "LEAD_STATUS_CHANGED",
  "LIFECYCLE_CHANGED",
  "PIPELINE_STAGE_CHANGED",
  "EMAIL_EVENT",
  "WEBSITE_EVENT",
  "CONTENT_DOWNLOADED",
  "DEMO_REQUESTED",
  "TRIAL_STARTED",
  "TRIAL_ENDING",
  "SUBSCRIPTION_STARTED",
  "PAYMENT_FAILED",
  "SUBSCRIPTION_CANCELLED",
  "CUSTOMER_INACTIVE",
  "DATE_REACHED",
  "MANUAL_ENROLLMENT",
  "SCHEDULED_SEGMENT_CHECK",
] as const;

export type TriggerType = (typeof TRIGGER_TYPES)[number];

export const ACTION_TYPES = [
  "SEND_EMAIL",
  "CREATE_TASK",
  "ASSIGN_OWNER",
  "UPDATE_LEAD_STATUS",
  "UPDATE_LIFECYCLE",
  "APPLY_TAG",
  "REMOVE_TAG",
  "CREATE_OPPORTUNITY_PROPOSAL",
  "ADD_TO_AUDIENCE",
  "REMOVE_FROM_AUDIENCE",
  "SEND_INTERNAL_NOTIFICATION",
  "WAIT",
  "BRANCH",
  "END",
  "WEBHOOK",
] as const;

export type ActionType = (typeof ACTION_TYPES)[number];

export const CONDITION_FIELDS = [
  "LIFECYCLE",
  "LEAD_STATUS",
  "OPPORTUNITY_STAGE",
  "PRODUCT",
  "COUNTRY",
  "LANGUAGE",
  "CONSENT",
  "SOURCE",
  "CAMPAIGN",
  "ACTIVITY",
  "EMAIL_ENGAGEMENT",
  "PRODUCT_EVENT",
  "SUBSCRIPTION_STATE",
  "DATE",
  "OWNER",
  "TAG",
] as const;

export type ConditionField = (typeof CONDITION_FIELDS)[number];

export const CONDITION_OPERATORS = [
  "eq",
  "ne",
  "in",
  "not_in",
  "gt",
  "lt",
  "contains",
  "exists",
] as const;

export type ConditionOperator = (typeof CONDITION_OPERATORS)[number];

export const EXIT_REASONS = [
  "CUSTOMER_CONVERTED",
  "CONSENT_WITHDRAWN",
  "LEAD_SUPPRESSED",
  "OPPORTUNITY_LOST",
  "SUBSCRIPTION_STARTED",
  "SUPPORT_ISSUE_OPENED",
  "MANUAL_REMOVAL",
  "GOAL_ACHIEVED",
  "MAX_DURATION_REACHED",
  "AUTOMATION_STOPPED",
  "ERROR",
] as const;

export type ExitReason = (typeof EXIT_REASONS)[number];

export const REPEAT_POLICIES = [
  "ONE_TIME",
  "ALLOW_REPEAT",
  "ALLOW_AFTER_COMPLETION",
] as const;

export type RepeatPolicy = (typeof REPEAT_POLICIES)[number];

export const DELAY_TYPES = [
  "FIXED_DURATION",
  "UNTIL_DATETIME",
  "UNTIL_BUSINESS_DAY",
  "UNTIL_DAYPART",
  "WAIT_FOR_EVENT",
  "WAIT_FOR_CONDITION",
] as const;

export type DelayType = (typeof DELAY_TYPES)[number];

export const NODE_TYPES = [
  "TRIGGER",
  "CONDITION",
  "DELAY",
  "ACTION",
  "BRANCH",
  "GOAL",
  "EXIT",
  "END",
] as const;

export type NodeType = (typeof NODE_TYPES)[number];

export const ENROLLMENT_SOURCES = ["TRIGGER", "MANUAL", "API", "TEST"] as const;

export type EnrollmentSource = (typeof ENROLLMENT_SOURCES)[number];

export const HIGH_RISK_ACTION_TYPES: ActionType[] = [
  "SEND_EMAIL",
  "WEBHOOK",
  "CREATE_OPPORTUNITY_PROPOSAL",
  "UPDATE_LEAD_STATUS",
  "UPDATE_LIFECYCLE",
];

export const DISABLED_WITHOUT_APPROVAL: ActionType[] = [
  "WEBHOOK",
  "CREATE_OPPORTUNITY_PROPOSAL",
];

export const FREQUENCY_LIMITS: Record<string, { perDay: number; perWeek: number }> = {
  SEND_EMAIL: { perDay: 3, perWeek: 10 },
  WEBHOOK: { perDay: 10, perWeek: 50 },
  CREATE_TASK: { perDay: 5, perWeek: 25 },
  CREATE_OPPORTUNITY_PROPOSAL: { perDay: 2, perWeek: 5 },
  SEND_INTERNAL_NOTIFICATION: { perDay: 10, perWeek: 50 },
  UPDATE_LEAD_STATUS: { perDay: 5, perWeek: 20 },
  UPDATE_LIFECYCLE: { perDay: 3, perWeek: 10 },
};

export const DEFAULT_ACTION_FREQUENCY = { perDay: 20, perWeek: 100 };

export const MAX_GRAPH_NODES = 100;
export const MAX_GRAPH_DEPTH = 50;
export const MAX_PATH_COUNT = 20;
export const CYCLE_DETECTION_BOUND = 1_000;
export const MAX_AUTOMATION_RECURSION_DEPTH = 3;
export const DEFAULT_AUTOMATION_TIMEZONE = "UTC";

export const REQUIRED_APPROVAL_BINDINGS = [
  "TRIGGER",
  "CONDITION_GRAPH",
  "ACTION_GRAPH",
  "TEMPLATES",
  "DELAYS",
  "FREQUENCY_LIMITS",
  "EXIT_RULES",
] as const;

export type ApprovalBindingType = (typeof REQUIRED_APPROVAL_BINDINGS)[number];

export const WEBHOOK_ALLOWLIST = [
  "https://api.cresco.example/webhooks/automation",
  "https://hooks.slack.com/services/",
] as const;

export const METRIC_LIMITATIONS = {
  conversions: "Conversions require attributable tracking setup.",
  revenue: "Revenue attribution is estimate-based where journey data is incomplete.",
  emailEngagement: "Email engagement metrics may be affected by privacy features and tracking policy.",
} as const;
