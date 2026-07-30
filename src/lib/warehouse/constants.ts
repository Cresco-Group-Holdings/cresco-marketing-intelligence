import type { MarketingDataProvider } from "@prisma/client";

export const TOP_LEVEL_CHANNELS = [
  "ORGANIC_SEARCH",
  "PAID_SEARCH",
  "ORGANIC_SOCIAL",
  "PAID_SOCIAL",
  "EMAIL",
  "DIRECT",
  "REFERRAL",
  "AFFILIATE",
  "DISPLAY",
  "VIDEO",
  "OTHER",
] as const;

export type TopLevelChannel = (typeof TOP_LEVEL_CHANNELS)[number];

export const FRESHNESS_STATES = ["FRESH", "STALE", "CRITICAL", "UNKNOWN"] as const;

export type FreshnessState = (typeof FRESHNESS_STATES)[number];

export const WAREHOUSE_DEFAULT_QUERY_DAYS = 30;
export const WAREHOUSE_MAX_QUERY_DAYS = 366;
export const WAREHOUSE_DEFAULT_LIST_LIMIT = 25;
export const WAREHOUSE_MAX_LIST_LIMIT = 200;
export const WAREHOUSE_MAX_BATCH_SIZE = 5_000;
export const WAREHOUSE_MAX_IMPORT_ROWS = 10_000;

export const CHANNEL_CLASSIFICATION_RULE_VERSION = "2026-07-30.1";

export const DEFAULT_SOURCE_DEFINITIONS: Array<{
  provider: MarketingDataProvider;
  key: string;
  displayName: string;
  description: string;
  category: string;
  capabilities: Array<
    "METRICS" | "EVENTS" | "DIMENSIONS" | "REVENUE" | "COST" | "LEADS" | "AUDIENCES" | "CONTENT"
  >;
}> = [
  {
    provider: "GA4",
    key: "ga4",
    displayName: "Google Analytics 4",
    description: "Web and app analytics",
    category: "analytics",
    capabilities: ["METRICS", "EVENTS", "DIMENSIONS"],
  },
  {
    provider: "GOOGLE_SEARCH_CONSOLE",
    key: "gsc",
    displayName: "Google Search Console",
    description: "Organic search performance",
    category: "seo",
    capabilities: ["METRICS", "DIMENSIONS"],
  },
  {
    provider: "GOOGLE_ADS",
    key: "google-ads",
    displayName: "Google Ads",
    description: "Paid search and display",
    category: "advertising",
    capabilities: ["METRICS", "COST", "DIMENSIONS"],
  },
  {
    provider: "META",
    key: "meta",
    displayName: "Meta Ads",
    description: "Facebook and Instagram advertising",
    category: "advertising",
    capabilities: ["METRICS", "COST", "DIMENSIONS", "AUDIENCES"],
  },
  {
    provider: "INSTAGRAM",
    key: "instagram",
    displayName: "Instagram",
    description: "Organic Instagram insights",
    category: "social",
    capabilities: ["METRICS", "CONTENT"],
  },
  {
    provider: "LINKEDIN",
    key: "linkedin",
    displayName: "LinkedIn",
    description: "Organic and paid LinkedIn",
    category: "social",
    capabilities: ["METRICS", "COST", "CONTENT"],
  },
  {
    provider: "TIKTOK",
    key: "tiktok",
    displayName: "TikTok",
    description: "Organic and paid TikTok",
    category: "social",
    capabilities: ["METRICS", "COST", "CONTENT"],
  },
  {
    provider: "YOUTUBE",
    key: "youtube",
    displayName: "YouTube",
    description: "Channel and video analytics",
    category: "social",
    capabilities: ["METRICS", "CONTENT"],
  },
  {
    provider: "X",
    key: "x",
    displayName: "X",
    description: "Organic X analytics",
    category: "social",
    capabilities: ["METRICS", "CONTENT"],
  },
  {
    provider: "STRIPE",
    key: "stripe",
    displayName: "Stripe",
    description: "Revenue and transactions",
    category: "revenue",
    capabilities: ["REVENUE", "EVENTS"],
  },
  {
    provider: "EMAIL_PROVIDER",
    key: "email",
    displayName: "Email provider",
    description: "Campaign and engagement metrics",
    category: "email",
    capabilities: ["METRICS", "EVENTS", "AUDIENCES"],
  },
  {
    provider: "CRM_PROVIDER",
    key: "crm",
    displayName: "CRM",
    description: "Lead and pipeline data",
    category: "crm",
    capabilities: ["LEADS", "EVENTS"],
  },
  {
    provider: "FIRST_PARTY",
    key: "first-party",
    displayName: "First-party tracking",
    description: "On-site events and sessions",
    category: "first_party",
    capabilities: ["EVENTS", "METRICS"],
  },
  {
    provider: "MANUAL_IMPORT",
    key: "manual-import",
    displayName: "Manual import",
    description: "CSV and spreadsheet uploads",
    category: "import",
    capabilities: ["METRICS", "EVENTS", "COST", "REVENUE"],
  },
  {
    provider: "SOCIAL_BRIDGE",
    key: "social-bridge",
    displayName: "Social analytics bridge",
    description: "Stage 2 social metrics ETL",
    category: "bridge",
    capabilities: ["METRICS", "CONTENT"],
  },
];
