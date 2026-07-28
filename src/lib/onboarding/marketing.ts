import { MarketingChannel, MarketingObjectiveType } from "@prisma/client";

export const MARKETING_OBJECTIVE_LABELS: Record<MarketingObjectiveType, string> = {
  BRAND_AWARENESS: "Brand awareness",
  WEBSITE_TRAFFIC: "Website traffic",
  LEAD_GENERATION: "Lead generation",
  DEMO_BOOKINGS: "Demo bookings",
  TRIAL_SIGNUPS: "Trial sign-ups",
  PAID_SUBSCRIPTIONS: "Paid subscriptions",
  COMMUNITY_GROWTH: "Community growth",
  EMAIL_LIST_GROWTH: "Email list growth",
  SEO_GROWTH: "SEO growth",
  CUSTOMER_RETENTION: "Customer retention",
};

export const MARKETING_CHANNEL_LABELS: Record<MarketingChannel, string> = {
  WEBSITE: "Website",
  SEO: "SEO",
  GOOGLE_ADS: "Google Ads",
  LINKEDIN: "LinkedIn",
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
  FACEBOOK: "Facebook",
  YOUTUBE: "YouTube",
  X: "X",
  EMAIL: "Email",
};

export const MARKETING_CHANNELS = Object.values(MarketingChannel);

export const MARKETING_OBJECTIVE_TYPES = Object.values(MarketingObjectiveType);

export const TARGET_PERIOD_OPTIONS = [
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annual", label: "Annual" },
] as const;
