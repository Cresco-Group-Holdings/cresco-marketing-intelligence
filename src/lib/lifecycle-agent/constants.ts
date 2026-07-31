export const BRIEF_TYPES = [
  "DAILY_SALES",
  "WEEKLY_PIPELINE",
  "TRIAL_RISK",
  "RENEWAL",
  "LIFECYCLE_HEALTH",
] as const;

export const FINDING_TYPES = [
  "NO_OWNER",
  "NO_NEXT_ACTION",
  "OVERDUE_TASK",
  "STALE_OPPORTUNITY",
  "STALE_LEAD",
  "CLOSE_DATE_PASSED",
  "TRIAL_ENDING_SOON",
  "TRIAL_INACTIVE",
  "RENEWAL_APPROACHING",
  "RENEWAL_AT_RISK",
  "CHURN_SIGNAL",
  "LOW_ENGAGEMENT",
  "MISSING_DECISION_MAKER",
  "MISSING_VALUE",
  "STAGE_DURATION_EXCEEDED",
  "STAGE_REVERSAL",
  "CONSENT_RESTRICTED",
  "SUPPRESSED_CONTACT",
  "DATA_STALE",
  "INSUFFICIENT_CRM_DATA",
  "STRONG_ENGAGEMENT",
  "HEALTHY_PIPELINE",
  "OTHER",
] as const;

export const RECOMMENDATION_TYPES = [
  "ASSIGN_OWNER",
  "CREATE_FOLLOW_UP_TASK",
  "SCHEDULE_CALL",
  "SCHEDULE_MEETING",
  "DRAFT_EMAIL",
  "REVIEW_PROPOSAL",
  "TRIAL_CHECK_IN",
  "RENEWAL_OUTREACH",
  "RE_ENGAGE",
  "ESCALATE_TO_MANAGER",
  "UPDATE_PIPELINE_STAGE",
  "COLLECT_MISSING_INFO",
  "WAIT_FOR_MORE_DATA",
  "REVIEW_CONSENT",
  "INFORMATION_ONLY",
] as const;

export const DRAFT_TYPES = [
  "EMAIL",
  "CALL_SCRIPT",
  "MEETING_AGENDA",
  "RENEWAL_OUTREACH",
  "TRIAL_CHECK_IN",
  "FOLLOW_UP",
] as const;

export const ACTION_CLASSES = [
  "INFORMATION_ONLY",
  "CREATE_TASK",
  "DRAFT_MESSAGE",
  "REQUEST_STAGE_CHANGE",
  "REQUEST_OWNER_ASSIGNMENT",
  "REQUEST_MEETING",
] as const;

export const BLOCKED_AUTONOMOUS_ACTIONS = [
  "AUTO_SEND_MESSAGE",
  "AUTO_PRICE_CHANGE",
  "AUTO_DISCOUNT",
  "AUTO_DEAL_WON",
  "AUTO_LIFECYCLE_CHANGE",
  "AUTO_STAGE_CHANGE",
] as const;

export const MATERIAL_ACTION_CLASSES = [
  "REQUEST_STAGE_CHANGE",
  "REQUEST_OWNER_ASSIGNMENT",
] as const;

export const FEEDBACK_STATUSES = [
  "ACCEPTED",
  "REJECTED",
  "DEFERRED",
  "IMPLEMENTED",
  "OUTCOME_MEASURED",
  "OUTCOME_UNAVAILABLE",
] as const;

export const PROHIBITED_COMMERCIAL_ACTIONS = [
  "AUTO_SEND_MESSAGE",
  "AUTO_PRICE_CHANGE",
  "AUTO_DISCOUNT",
  "AUTO_DEAL_WON",
  "FABRICATED_URGENCY",
  "UNVERIFIED_PRICING",
  "UNVERIFIED_DISCOUNT",
  "FABRICATED_PROMISE",
] as const;

export const STALE_CRM_DATA_HOURS = 48;
export const STALE_OPPORTUNITY_DAYS = 14;
export const STALE_LEAD_DAYS = 21;
export const TRIAL_ENDING_WARNING_DAYS = 7;
export const RENEWAL_APPROACHING_DAYS = 30;
export const LOW_ENGAGEMENT_DAYS = 30;
export const MIN_ACTIVITY_COUNT_FOR_CONFIDENCE = 3;

export const LIFECYCLE_DISCLAIMER =
  "Recommendations are evidence-grounded proposals only. No messages are sent, deals are not closed, and lifecycle stages are not changed without explicit human approval.";

export const NO_AUTONOMOUS_ACTION_DISCLAIMER =
  "The lifecycle agent must not autonomously send messages, change pricing, mark deals as won, or apply material CRM changes.";

export const CHURN_LIKELIHOOD_DISCLAIMER =
  "Churn likelihood indicators are heuristic estimates based on observable CRM signals. They are not proven facts or predictions.";

export const PURCHASE_LIKELIHOOD_DISCLAIMER =
  "Purchase likelihood indicators are heuristic estimates based on observable CRM signals. They are not proven facts or predictions.";

export const PREDICTIVE_SIGNAL_DISCLAIMER =
  "All likelihood scores (churn, purchase, renewal risk) are transparent rule-based estimates, not opaque ML predictions or proven outcomes.";
