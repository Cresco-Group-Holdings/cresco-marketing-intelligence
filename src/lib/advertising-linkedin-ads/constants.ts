export const SUPPORTED_LINKEDIN_OBJECTIVES = [
  "WEBSITE_VISITS",
  "LEAD_GENERATION",
  "ENGAGEMENT",
] as const;

export type LinkedInObjective = (typeof SUPPORTED_LINKEDIN_OBJECTIVES)[number];

export const LINKEDIN_OBJECTIVE_TRANSLATION: Record<string, { linkedIn: string; label: string }> = {
  WEBSITE_TRAFFIC: { linkedIn: "WEBSITE_VISITS", label: "Website visits" },
  LEAD_GENERATION: { linkedIn: "LEAD_GENERATION", label: "Lead generation" },
  ENGAGEMENT: { linkedIn: "ENGAGEMENT", label: "Engagement" },
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

export const LINKEDIN_RESOURCE_TYPES = ["CAMPAIGN_GROUP", "CAMPAIGN", "CREATIVE", "AD"] as const;

export const SUPPORTED_CREATIVE_FORMATS = ["SINGLE_IMAGE", "VIDEO", "LEAD_FORM"] as const;

export const DEFAULT_DAILY_BUDGET_CHANGE_LIMIT_PERCENT = 20;
export const BUDGET_EMERGENCY_PAUSE_THRESHOLD_PERCENT = 150;
export const LINKEDIN_MIN_DAILY_BUDGET_CENTS = 1000;

export const MATERIAL_CHANGE_FIELDS = [
  "budget",
  "audience",
  "destination",
  "creative",
  "schedule",
  "objective",
] as const;
