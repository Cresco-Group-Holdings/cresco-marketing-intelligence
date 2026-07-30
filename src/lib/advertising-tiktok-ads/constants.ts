export const SUPPORTED_TIKTOK_OBJECTIVES = [
  "TRAFFIC",
  "VIDEO_VIEWS",
  "LEAD_GENERATION",
  "WEB_CONVERSIONS",
] as const;

export type TikTokObjective = (typeof SUPPORTED_TIKTOK_OBJECTIVES)[number];

export const TIKTOK_OBJECTIVE_TRANSLATION: Record<string, { tiktok: string; label: string }> = {
  WEBSITE_TRAFFIC: { tiktok: "TRAFFIC", label: "Traffic" },
  VIDEO_VIEWS: { tiktok: "VIDEO_VIEWS", label: "Video views" },
  LEAD_GENERATION: { tiktok: "LEAD_GENERATION", label: "Lead generation" },
  PURCHASES: { tiktok: "WEB_CONVERSIONS", label: "Website conversions" },
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

export const TIKTOK_RESOURCE_TYPES = ["CAMPAIGN", "AD_GROUP", "AD", "CREATIVE"] as const;

export const SUPPORTED_CREATIVE_FORMATS = ["SHORT_VIDEO"] as const;

export const DEFAULT_DAILY_BUDGET_CHANGE_LIMIT_PERCENT = 20;
export const BUDGET_EMERGENCY_PAUSE_THRESHOLD_PERCENT = 150;
export const TIKTOK_MIN_DAILY_BUDGET_CENTS = 2000;
