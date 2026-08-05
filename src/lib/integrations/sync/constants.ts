export const SYNC_RESOURCE_TYPES = [
  "provider_account",
  "campaign",
  "ad_group",
  "ad_set",
  "advert",
  "creative",
  "metric_daily",
  "social_post",
  "content_performance",
  "contact",
  "company",
  "email_campaign",
  "email_performance",
] as const;

export type SyncResourceType = (typeof SYNC_RESOURCE_TYPES)[number];

export const STAGE_13_SYNC_PROVIDER_KEYS = [
  "google-ads",
  "meta-ads",
  "linkedin-ads",
  "tiktok-ads",
  "microsoft-ads",
  "google-analytics",
  "google-search-console",
  "hubspot",
  "mailchimp",
  "meta",
  "linkedin",
  "tiktok",
] as const;

export type Stage13SyncProviderKey = (typeof STAGE_13_SYNC_PROVIDER_KEYS)[number];

export const PROVIDER_DEFAULT_RESOURCE_TYPES: Record<string, SyncResourceType[]> = {
  "google-ads": ["provider_account", "campaign", "ad_group", "advert", "metric_daily"],
  "meta-ads": ["provider_account", "campaign", "ad_set", "advert", "creative", "metric_daily"],
  "linkedin-ads": ["provider_account", "campaign", "ad_group", "advert", "metric_daily"],
  "tiktok-ads": ["provider_account", "campaign", "ad_group", "advert", "metric_daily"],
  "microsoft-ads": ["provider_account", "campaign", "ad_group", "advert", "metric_daily"],
  "google-analytics": ["provider_account", "metric_daily", "content_performance"],
  "google-search-console": ["provider_account", "metric_daily", "content_performance"],
  hubspot: ["provider_account", "contact", "company", "email_campaign", "email_performance"],
  mailchimp: ["provider_account", "email_campaign", "email_performance"],
  meta: ["provider_account", "social_post", "content_performance", "metric_daily"],
  linkedin: ["provider_account", "social_post", "content_performance", "metric_daily"],
  tiktok: ["provider_account", "social_post", "content_performance", "metric_daily"],
};

export const DEFAULT_BACKFILL_DAYS = 90;
export const DEFAULT_DATA_DELAY_DAYS = 1;
export const DEFAULT_RECONCILIATION_DAYS = 7;
export const MAX_SYNC_PAGE_SIZE = 100;
