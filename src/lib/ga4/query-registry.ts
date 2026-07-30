export type Ga4QueryDefinition = {
  key: string;
  displayName: string;
  description: string;
  dimensions: string[];
  metrics: string[];
  maxDateRangeDays: number;
  entityTypes: Array<"channel" | "campaign" | "landing_page" | "session_aggregate">;
};

const DAILY_CHANNEL: Ga4QueryDefinition = {
  key: "daily_channel",
  displayName: "Daily channel performance",
  description: "Sessions and users by date, source, medium, and campaign",
  dimensions: ["date", "sessionSource", "sessionMedium", "sessionCampaignName"],
  metrics: [
    "totalUsers",
    "activeUsers",
    "newUsers",
    "sessions",
    "engagedSessions",
    "engagementRate",
    "screenPageViews",
    "eventCount",
    "keyEvents",
    "purchaseRevenue",
  ],
  maxDateRangeDays: 90,
  entityTypes: ["channel", "campaign", "session_aggregate"],
};

const DAILY_LANDING_PAGE: Ga4QueryDefinition = {
  key: "daily_landing_page",
  displayName: "Daily landing page performance",
  description: "Sessions and engagement by landing page",
  dimensions: ["date", "landingPagePlusQueryString", "sessionSource", "sessionMedium"],
  metrics: [
    "sessions",
    "engagedSessions",
    "screenPageViews",
    "totalUsers",
    "keyEvents",
  ],
  maxDateRangeDays: 90,
  entityTypes: ["landing_page", "session_aggregate"],
};

const DAILY_PAGE_PATH: Ga4QueryDefinition = {
  key: "daily_page_path",
  displayName: "Daily page path performance",
  description: "Page views and engagement by path",
  dimensions: ["date", "pagePath", "deviceCategory"],
  metrics: ["screenPageViews", "sessions", "engagedSessions", "eventCount"],
  maxDateRangeDays: 31,
  entityTypes: ["session_aggregate"],
};

const DAILY_DEVICE_GEO: Ga4QueryDefinition = {
  key: "daily_device_geo",
  displayName: "Daily device and country breakdown",
  description: "Users and sessions by device and country",
  dimensions: ["date", "deviceCategory", "country"],
  metrics: ["totalUsers", "sessions", "engagedSessions", "screenPageViews"],
  maxDateRangeDays: 90,
  entityTypes: ["session_aggregate"],
};

export const GA4_QUERY_DEFINITIONS: Ga4QueryDefinition[] = [
  DAILY_CHANNEL,
  DAILY_LANDING_PAGE,
  DAILY_PAGE_PATH,
  DAILY_DEVICE_GEO,
];

const DEFINITION_MAP = new Map(GA4_QUERY_DEFINITIONS.map((def) => [def.key, def]));

export function getGa4QueryDefinition(key: string): Ga4QueryDefinition | null {
  return DEFINITION_MAP.get(key) ?? null;
}

export function validateGa4DateRange(
  definition: Ga4QueryDefinition,
  startDate: string,
  endDate: string,
): { valid: boolean; reason?: string } {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { valid: false, reason: "Invalid date format. Use YYYY-MM-DD." };
  }
  if (start > end) {
    return { valid: false, reason: "Start date must be before end date." };
  }
  const days = Math.ceil((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (days > definition.maxDateRangeDays) {
    return {
      valid: false,
      reason: `Date range exceeds maximum of ${definition.maxDateRangeDays} days for ${definition.key}.`,
    };
  }
  return { valid: true };
}

export function assertValidGa4Query(
  definitionKey: string,
  startDate: string,
  endDate: string,
): Ga4QueryDefinition {
  const definition = getGa4QueryDefinition(definitionKey);
  if (!definition) {
    throw new Error(`Unknown GA4 query definition: ${definitionKey}`);
  }
  const range = validateGa4DateRange(definition, startDate, endDate);
  if (!range.valid) {
    throw new Error(range.reason ?? "Invalid GA4 date range.");
  }
  return definition;
}

/** Reject custom dimension/metric combinations outside the registry. */
export function isAllowedGa4Query(
  dimensions: string[],
  metrics: string[],
): { allowed: boolean; reason?: string } {
  const match = GA4_QUERY_DEFINITIONS.find(
    (def) =>
      def.dimensions.length === dimensions.length &&
      def.dimensions.every((dim, index) => dim === dimensions[index]) &&
      def.metrics.length === metrics.length &&
      def.metrics.every((metric, index) => metric === metrics[index]),
  );
  if (!match) {
    return {
      allowed: false,
      reason: "Arbitrary GA4 queries are not permitted. Use a predefined query definition.",
    };
  }
  return { allowed: true };
}
