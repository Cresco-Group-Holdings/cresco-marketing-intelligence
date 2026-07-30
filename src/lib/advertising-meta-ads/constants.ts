export const SUPPORTED_META_OBJECTIVES = [
  "TRAFFIC",
  "ENGAGEMENT",
  "LEADS",
  "SALES",
  "VIDEO_VIEWS",
  "AWARENESS",
] as const;

export type MetaObjective = (typeof SUPPORTED_META_OBJECTIVES)[number];

export const OBJECTIVE_TRANSLATION: Record<string, { meta: string; label: string }> = {
  WEBSITE_TRAFFIC: { meta: "OUTCOME_TRAFFIC", label: "Traffic" },
  LEAD_GENERATION: { meta: "OUTCOME_LEADS", label: "Leads" },
  PURCHASES: { meta: "OUTCOME_SALES", label: "Sales / conversions" },
  VIDEO_VIEWS: { meta: "OUTCOME_AWARENESS", label: "Video views" },
  BRAND_AWARENESS: { meta: "OUTCOME_AWARENESS", label: "Awareness" },
  ENGAGEMENT: { meta: "OUTCOME_ENGAGEMENT", label: "Engagement" },
};

export const REQUIRED_LAUNCH_APPROVAL_TYPES = [
  "CAMPAIGN",
  "CREATIVE",
  "COMPLIANCE",
  "BUDGET",
  "CONVERSION",
  "ACCOUNT_PERMISSION",
  "PROVIDER_VALIDATION",
  "FINAL_LAUNCH",
] as const;

export type LaunchApprovalType = (typeof REQUIRED_LAUNCH_APPROVAL_TYPES)[number];

export const META_RESOURCE_TYPES = [
  "CAMPAIGN",
  "AD_SET",
  "AD",
  "AD_CREATIVE",
  "AUDIENCE",
] as const;

export const DEFAULT_DAILY_BUDGET_CHANGE_LIMIT_PERCENT = 20;
export const BUDGET_EMERGENCY_PAUSE_THRESHOLD_PERCENT = 150;
export const META_MIN_DAILY_BUDGET_CENTS = 100;

export const SUPPORTED_CREATIVE_FORMATS = [
  "SINGLE_IMAGE",
  "CAROUSEL",
  "SHORT_VIDEO",
  "REEL",
  "STORY",
  "FEED",
  "LEAD_FORM",
] as const;

export const FEATURE_FLAGGED_OBJECTIVES = ["APP_PROMOTION", "MESSAGES"] as const;
