export const SUPPORTED_CAMPAIGN_TYPES = ["SEARCH"] as const;
export type SupportedCampaignType = (typeof SUPPORTED_CAMPAIGN_TYPES)[number];

export const FEATURE_FLAGGED_CAMPAIGN_TYPES = [
  "DISPLAY",
  "VIDEO",
  "PERFORMANCE_MAX",
  "SHOPPING",
] as const;

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

export const GOOGLE_ADS_RESOURCE_TYPES = [
  "CAMPAIGN_BUDGET",
  "CAMPAIGN",
  "AD_GROUP",
  "AD",
  "KEYWORD",
  "NEGATIVE_KEYWORD",
  "ASSET",
] as const;

export const DEFAULT_DAILY_BUDGET_CHANGE_LIMIT_PERCENT = 20;

export const BUDGET_EMERGENCY_PAUSE_THRESHOLD_PERCENT = 150;

export const GOOGLE_ADS_MIN_DAILY_BUDGET_MICROS = 1_000_000; // $1 equivalent minimum guardrail

export const SUPPORTED_BIDDING_STRATEGIES = ["MANUAL_CPC", "MAXIMIZE_CLICKS"] as const;

export const SUPPORTED_NETWORK_SETTINGS = {
  targetGoogleSearch: true,
  targetSearchNetwork: true,
  targetContentNetwork: false,
  targetPartnerSearchNetwork: false,
} as const;
