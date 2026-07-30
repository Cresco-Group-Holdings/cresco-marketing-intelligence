export const GA4_ADMIN_API_BASE = "https://analyticsadmin.googleapis.com/v1beta";
export const GA4_DATA_API_BASE = "https://analyticsdata.googleapis.com/v1beta";
export const GA4_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GA4_OAUTH_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
export const GA4_OAUTH_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

export const GA4_READONLY_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";

export const GA4_DEFAULT_BACKFILL_DAYS = 90;
export const GA4_RECONCILIATION_DAYS = 3;
export const GA4_MAX_REPORT_ROWS = 10_000;
export const GA4_REPORT_PAGE_SIZE = 10_000;

export const GA4_TRANSFORMATION_VERSION = "2026-07-30.1";

export const GA4_METRIC_MAP: Record<string, string> = {
  totalUsers: "users",
  activeUsers: "active_users",
  newUsers: "new_users",
  sessions: "sessions",
  engagedSessions: "engaged_sessions",
  engagementRate: "engagement_rate",
  screenPageViews: "pageviews",
  eventCount: "events",
  keyEvents: "conversions",
  purchaseRevenue: "revenue",
};

export const GA4_DIMENSION_FIELDS = [
  "date",
  "sessionSource",
  "sessionMedium",
  "sessionCampaignName",
  "landingPagePlusQueryString",
  "pagePath",
  "deviceCategory",
  "country",
] as const;
