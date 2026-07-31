export type GscQueryDefinition = {
  key: string;
  displayName: string;
  dimensions: string[];
  grain: "query" | "page" | "query_page" | "device" | "country" | "aggregate";
  maxDateRangeDays: number;
};

const DAILY_QUERY: GscQueryDefinition = {
  key: "daily_query",
  displayName: "Daily query performance",
  dimensions: ["date", "query"],
  grain: "query",
  maxDateRangeDays: 480,
};

const DAILY_PAGE: GscQueryDefinition = {
  key: "daily_page",
  displayName: "Daily landing page performance",
  dimensions: ["date", "page"],
  grain: "page",
  maxDateRangeDays: 480,
};

const DAILY_QUERY_PAGE: GscQueryDefinition = {
  key: "daily_query_page",
  displayName: "Daily query-page relationships",
  dimensions: ["date", "query", "page"],
  grain: "query_page",
  maxDateRangeDays: 90,
};

const DAILY_DEVICE_COUNTRY: GscQueryDefinition = {
  key: "daily_device_country",
  displayName: "Daily device and country breakdown",
  dimensions: ["date", "device", "country"],
  grain: "device",
  maxDateRangeDays: 480,
};

const DAILY_SEARCH_APPEARANCE: GscQueryDefinition = {
  key: "daily_search_appearance",
  displayName: "Daily search appearance",
  dimensions: ["date", "searchAppearance"],
  grain: "aggregate",
  maxDateRangeDays: 90,
};

export const GSC_QUERY_DEFINITIONS: GscQueryDefinition[] = [
  DAILY_QUERY,
  DAILY_PAGE,
  DAILY_QUERY_PAGE,
  DAILY_DEVICE_COUNTRY,
  DAILY_SEARCH_APPEARANCE,
];

const DEFINITION_MAP = new Map(GSC_QUERY_DEFINITIONS.map((def) => [def.key, def]));

export function getGscQueryDefinition(key: string): GscQueryDefinition | null {
  return DEFINITION_MAP.get(key) ?? null;
}

export function validateGscDateRange(
  definition: GscQueryDefinition,
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

export function isAllowedGscQuery(dimensions: string[]): { allowed: boolean; reason?: string } {
  const match = GSC_QUERY_DEFINITIONS.find(
    (def) =>
      def.dimensions.length === dimensions.length &&
      def.dimensions.every((dim, index) => dim === dimensions[index]),
  );
  if (!match) {
    return {
      allowed: false,
      reason: "Arbitrary Search Console queries are not permitted.",
    };
  }
  return { allowed: true };
}
