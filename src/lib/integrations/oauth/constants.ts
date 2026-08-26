export const OAUTH_TRANSACTION_TTL_MS = 10 * 60 * 1000;

export const STAGE_12_OAUTH_PROVIDER_KEYS = [
  "google-analytics",
  "google-search-console",
  "google-ads",
  "meta",
  "meta-ads",
  "linkedin",
  "linkedin-ads",
  "tiktok",
  "tiktok-ads",
  "youtube",
  "x",
  "microsoft-ads",
  "hubspot",
  "mailchimp",
  "slack",
] as const;

export type Stage12OAuthProviderKey = (typeof STAGE_12_OAUTH_PROVIDER_KEYS)[number];

export const INTEGRATIONS_CALLBACK_PATH = "/api/integrations/oauth";

export const INTEGRATIONS_RETURN_PATH_PREFIXES = [
  "/integrations",
  "/settings",
  "/connectors",
] as const;

export const CAPABILITY_SCOPE_MAP: Record<string, string[]> = {
  ANALYTICS_PULL: ["analytics.readonly", "https://www.googleapis.com/auth/analytics.readonly"],
  ADVERTISING_REPORT: ["ads.read", "ads_management"],
  ADVERTISING_MANAGE: ["ads.manage", "ads_management"],
  PUBLISHING: ["publish", "pages_manage_posts"],
  OAUTH_CONNECT: [],
  EMAIL_SEND: ["email.send"],
};
