export const ADVERTISING_EXPERIMENT_STATUSES = [
  "DRAFT",
  "READY",
  "RUNNING",
  "PAUSED",
  "COMPLETED",
  "INCONCLUSIVE",
  "CANCELLED",
  "ARCHIVED",
] as const;

export const SUPPORTED_EXPERIMENT_TYPES = [
  "CREATIVE",
  "HEADLINE",
  "COPY",
  "CTA",
  "AUDIENCE",
  "LANDING_PAGE",
  "OFFER",
  "PLACEMENT",
] as const;

export const FEATURE_FLAGGED_EXPERIMENT_TYPES = [
  "BIDDING_STRATEGY",
  "BUDGET_ALLOCATION",
  "CAMPAIGN_STRUCTURE",
] as const;

export const VARIANT_TYPES = ["CONTROL", "TREATMENT", "MULTI_VARIANT"] as const;

export const ALLOCATION_TYPES = [
  "EQUAL",
  "WEIGHTED",
  "PROVIDER_NATIVE",
  "SEQUENTIAL",
  "MANUAL",
] as const;

export const SUPPORTED_METRICS = [
  "impressions",
  "clicks",
  "ctr",
  "cpc",
  "conversions",
  "conversion_rate",
  "cpa",
  "revenue",
  "roas",
  "qualified_leads",
  "trial_starts",
  "subscriptions",
] as const;

export const DECISION_OUTCOMES = [
  "ADOPT_VARIANT",
  "KEEP_CONTROL",
  "CONTINUE_TEST",
  "RUN_FOLLOWUP",
  "INCONCLUSIVE",
  "INVALID_TEST",
  "STOP_FOR_SAFETY",
] as const;

export const VALIDITY_CHECK_TYPES = {
  INSUFFICIENT_VOLUME: "INSUFFICIENT_VOLUME",
  UNEQUAL_DELIVERY: "UNEQUAL_DELIVERY",
  CAMPAIGN_CHANGE_DURING_TEST: "CAMPAIGN_CHANGE_DURING_TEST",
  AUDIENCE_OVERLAP: "AUDIENCE_OVERLAP",
  TRACKING_FAILURE: "TRACKING_FAILURE",
  INCONSISTENT_ATTRIBUTION: "INCONSISTENT_ATTRIBUTION",
  MISSING_CONVERSION_DATA: "MISSING_CONVERSION_DATA",
  MAJOR_BUDGET_CHANGE: "MAJOR_BUDGET_CHANGE",
  EARLY_STOPPING_RISK: "EARLY_STOPPING_RISK",
  STALE_DATA: "STALE_DATA",
  VARIANT_NOT_DELIVERED: "VARIANT_NOT_DELIVERED",
  NO_RANDOMISATION: "NO_RANDOMISATION",
} as const;

export const RANDOMISATION_DISCLAIMER =
  "Advertising platforms may not guarantee random audience assignment. Do not treat delivery splits as randomised controlled trials unless the provider explicitly supports it.";

export const ANALYSIS_DISCLAIMER =
  "Confidence intervals use a documented normal-approximation method. This does not constitute statistical significance without meeting validity prerequisites.";

export const MIN_PERCENTAGE_DIFFERENCE = 5;
export const DELIVERY_IMBALANCE_RATIO = 3;
export const STALE_DATA_HOURS = 48;
