export const BUDGET_LIMIT_LEVELS = [
  "ORGANISATION",
  "PROJECT",
  "BRAND",
  "PROVIDER",
  "ACCOUNT",
  "CAMPAIGN",
  "EXPERIMENT",
  "DAY",
  "WEEK",
  "MONTH",
  "BILLING_CYCLE",
] as const;

export const BUDGET_PERIOD_TYPES = ["DAILY", "WEEKLY", "MONTHLY", "BILLING_CYCLE", "LIFETIME"] as const;

export const BUDGET_ALERT_TYPES = [
  "SPEND_SPIKE",
  "OVERSPEND_RISK",
  "BUDGET_EXHAUSTED",
  "SPEND_AFTER_END_DATE",
  "SPEND_WITHOUT_TRACKING",
  "SPEND_WITHOUT_CONVERSIONS",
  "CURRENCY_MISMATCH",
  "PROVIDER_DATA_STALE",
  "DAILY_CHANGE_ABOVE_POLICY",
  "UNEXPECTED_PROVIDER_BUDGET_CHANGE",
] as const;

export const CHANGE_REQUEST_TYPES = [
  "INCREASE_BUDGET",
  "DECREASE_BUDGET",
  "MOVE_BUDGET",
  "EXTEND_SCHEDULE",
  "PAUSE_CAMPAIGN",
  "RESUME_CAMPAIGN",
] as const;

export const AI_RECOMMENDATION_TYPES = [
  "REDUCE_SPEND",
  "INCREASE_THROUGH_APPROVAL",
  "REALLOCATE_BUDGET",
  "INVESTIGATE_CAMPAIGN",
  "PAUSE_LOW_QUALITY_TRAFFIC",
  "EXTEND_WINNING_EXPERIMENT",
] as const;

export const DEFAULT_ADMIN_APPROVAL_THRESHOLD_PCT = 10;
export const DEFAULT_OWNER_APPROVAL_THRESHOLD_PCT = 25;
export const DEFAULT_HARD_LIMIT_PCT = 50;
export const DEFAULT_DAILY_CHANGE_LIMIT_PCT = 20;
export const OVERSPEND_RISK_THRESHOLD_PCT = 10;
export const UNDERSPEND_RISK_THRESHOLD_PCT = 20;
export const SPEND_SPIKE_THRESHOLD_PCT = 50;
export const STALE_PROVIDER_DATA_HOURS = 48;

export const SPEND_INCREASE_DISCLAIMER =
  "Budget increases are never applied autonomously. All increases require explicit human approval through the change request workflow.";

export const AI_RECOMMENDATION_DISCLAIMER =
  "AI recommendations are advisory only. They require evidence, uncertainty disclosure, budget impact, measurement plan, and explicit human approval before any action.";
