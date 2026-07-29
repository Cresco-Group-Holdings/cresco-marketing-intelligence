import type { SocialReportSectionType, SocialReportType } from "@prisma/client";

export const REPORT_TYPE_LABELS: Record<SocialReportType, string> = {
  WEEKLY_PERFORMANCE: "Weekly performance",
  MONTHLY_PERFORMANCE: "Monthly performance",
  CAMPAIGN_REPORT: "Campaign report",
  CHANNEL_REPORT: "Channel report",
  CONTENT_REPORT: "Content report",
  EXECUTIVE_SUMMARY: "Executive summary",
  CLIENT_REPORT: "Client report",
};

export const SECTION_TYPE_LABELS: Record<SocialReportSectionType, string> = {
  OVERVIEW: "Overview",
  PUBLISHING: "Posts published",
  REACH_IMPRESSIONS: "Reach and impressions",
  ENGAGEMENT: "Engagement",
  VIDEO_PERFORMANCE: "Video performance",
  FOLLOWER_GROWTH: "Follower growth",
  TOP_CONTENT: "Top-performing content",
  WEAK_CONTENT: "Weak-performing content",
  LEADS: "Lead creation",
  CAMPAIGN_OUTCOMES: "Campaign outcomes",
  RECOMMENDATIONS: "Recommendations",
  DATA_LIMITATIONS: "Data limitations",
  CUSTOM_NOTES: "Custom notes",
  AI_NARRATIVE: "Executive narrative",
};

export const DEFAULT_REPORT_SECTIONS: SocialReportSectionType[] = [
  "OVERVIEW",
  "PUBLISHING",
  "REACH_IMPRESSIONS",
  "ENGAGEMENT",
  "VIDEO_PERFORMANCE",
  "FOLLOWER_GROWTH",
  "TOP_CONTENT",
  "WEAK_CONTENT",
  "LEADS",
  "RECOMMENDATIONS",
  "DATA_LIMITATIONS",
];

export const DEFAULT_SELECTED_METRICS = [
  "impressions",
  "reach",
  "engagements",
  "engagementRate",
  "views",
  "videoViews",
  "clicks",
  "followerGrowth",
  "postsPublished",
  "leadsCreated",
] as const;

export const SHARE_TOKEN_BYTES = 24;
export const DEFAULT_SHARE_EXPIRY_DAYS = 30;
