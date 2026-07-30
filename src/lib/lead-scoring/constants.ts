export const SCORE_TYPES = ["FIT", "ENGAGEMENT", "NEGATIVE", "COMPOSITE"] as const;

export type ScoreType = (typeof SCORE_TYPES)[number];

export const SIGNAL_CATEGORIES = ["FIT", "ENGAGEMENT", "NEGATIVE"] as const;

export type SignalCategory = (typeof SIGNAL_CATEGORIES)[number];

export const FIT_SIGNALS = [
  "TARGET_INDUSTRY",
  "TARGET_COUNTRY",
  "COMPANY_SIZE_MATCH",
  "PRODUCT_INTEREST_MATCH",
  "REVENUE_BAND_MATCH",
  "EMPLOYEE_COUNT_MATCH",
  "ACCOUNT_TYPE_MATCH",
  "LANGUAGE_MATCH",
  "LIFECYCLE_STAGE_FIT",
  "TAG_FIT",
] as const;

export type FitSignal = (typeof FIT_SIGNALS)[number];

export const ENGAGEMENT_SIGNALS = [
  "EMAIL_OPEN",
  "EMAIL_CLICK",
  "PAGE_VIEW",
  "CONTENT_DOWNLOAD",
  "FORM_SUBMISSION",
  "DEMO_REQUESTED",
  "TRIAL_STARTED",
  "MEETING_BOOKED",
  "RECENT_ACTIVITY",
  "HIGH_EMAIL_ENGAGEMENT",
  "PRODUCT_EVENT",
  "CAMPAIGN_RESPONSE",
] as const;

export type EngagementSignal = (typeof ENGAGEMENT_SIGNALS)[number];

export const NEGATIVE_SIGNALS = [
  "EMAIL_UNSUBSCRIBED",
  "CONSENT_WITHDRAWN",
  "SUPPRESSED",
  "INACTIVE",
  "BOUNCED_EMAIL",
  "DISQUALIFIED_STATUS",
  "NEGATIVE_TAG",
  "COMPETITOR_TAG",
  "SUPPORT_ISSUE",
  "CHURNED_SUBSCRIPTION",
] as const;

export type NegativeSignal = (typeof NEGATIVE_SIGNALS)[number];

export const ALL_SIGNALS = [...FIT_SIGNALS, ...ENGAGEMENT_SIGNALS, ...NEGATIVE_SIGNALS] as const;

export type ScoringSignal = (typeof ALL_SIGNALS)[number];

export const PROHIBITED_ATTRIBUTES = [
  "race",
  "ethnicity",
  "gender",
  "sex",
  "age",
  "dateOfBirth",
  "birthDate",
  "religion",
  "disability",
  "sexualOrientation",
  "maritalStatus",
  "nationalOrigin",
  "postalCode",
  "zipCode",
  "homeAddress",
  "personalIncome",
  "creditScore",
  "healthStatus",
  "pregnancy",
  "geneticInformation",
] as const;

export type ProhibitedAttribute = (typeof PROHIBITED_ATTRIBUTES)[number];

export const QUALIFICATION_STATUSES = [
  "UNASSESSED",
  "NEEDS_INFO",
  "COLD",
  "WARM",
  "HOT",
  "QUALIFIED",
  "DISQUALIFIED",
] as const;

export type QualificationStatus = (typeof QUALIFICATION_STATUSES)[number];

export const RULE_OPERATORS = [
  "eq",
  "ne",
  "in",
  "not_in",
  "gt",
  "gte",
  "lt",
  "lte",
  "contains",
  "exists",
] as const;

export type RuleOperator = (typeof RULE_OPERATORS)[number];

export const DECAY_FORMULAS = ["LINEAR", "EXPONENTIAL"] as const;

export type DecayFormula = (typeof DECAY_FORMULAS)[number];

export const MODEL_STATUSES = [
  "DRAFT",
  "IN_REVIEW",
  "APPROVED",
  "ACTIVE",
  "PAUSED",
  "ARCHIVED",
] as const;

export type ModelStatus = (typeof MODEL_STATUSES)[number];

export const RULE_GROUP_LOGIC = ["AND", "OR"] as const;

export type RuleGroupLogic = (typeof RULE_GROUP_LOGIC)[number];

export const SCORE_VERSION = "1.0.0";

export const DEFAULT_SCORE_CAPS: Record<ScoreType, number> = {
  FIT: 100,
  ENGAGEMENT: 100,
  NEGATIVE: -50,
  COMPOSITE: 100,
};

export const DEFAULT_CATEGORY_CAPS: Record<SignalCategory, number> = {
  FIT: 60,
  ENGAGEMENT: 60,
  NEGATIVE: -30,
};

export const QUALIFICATION_THRESHOLDS: Record<
  Exclude<QualificationStatus, "UNASSESSED" | "NEEDS_INFO">,
  { min: number; max: number }
> = {
  COLD: { min: 0, max: 24 },
  WARM: { min: 25, max: 49 },
  HOT: { min: 50, max: 74 },
  QUALIFIED: { min: 75, max: 100 },
  DISQUALIFIED: { min: -100, max: -1 },
};

export const REQUIRED_FIT_FIELDS = [
  "country",
  "productInterest",
] as const;

export const REQUIRED_ENGAGEMENT_FIELDS = [
  "lastActivityAt",
] as const;

export const DEFAULT_DECAY_HALF_LIFE_DAYS = 30;

export const MAX_RULES_PER_MODEL = 100;
export const MAX_RULES_PER_GROUP = 25;
export const MAX_POINTS_PER_RULE = 50;

export const SCORING_DISCLAIMER =
  "Lead scores are deterministic rule-based calculations. No black-box AI scoring is applied.";

export const AI_ASSISTANT_DISCLAIMER =
  "AI suggestions are grounded explanations only. They do not modify scores or qualification status.";
