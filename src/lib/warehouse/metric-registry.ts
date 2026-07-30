import type { MarketingMetricAggregation, MarketingMetricDataType } from "@prisma/client";

export type WarehouseMetricDefinition = {
  canonicalKey: string;
  displayName: string;
  description: string;
  unit?: string;
  dataType: MarketingMetricDataType;
  aggregation: MarketingMetricAggregation;
  isCumulative: boolean;
};

export const DEFAULT_METRIC_DEFINITIONS: WarehouseMetricDefinition[] = [
  {
    canonicalKey: "sessions",
    displayName: "Sessions",
    description: "Distinct browsing sessions",
    unit: "count",
    dataType: "INTEGER",
    aggregation: "SUM",
    isCumulative: false,
  },
  {
    canonicalKey: "users",
    displayName: "Users",
    description: "Distinct users",
    unit: "count",
    dataType: "INTEGER",
    aggregation: "SUM",
    isCumulative: false,
  },
  {
    canonicalKey: "pageviews",
    displayName: "Page views",
    description: "Total page views",
    unit: "count",
    dataType: "INTEGER",
    aggregation: "SUM",
    isCumulative: false,
  },
  {
    canonicalKey: "impressions",
    displayName: "Impressions",
    description: "Ad or content impressions",
    unit: "count",
    dataType: "INTEGER",
    aggregation: "SUM",
    isCumulative: true,
  },
  {
    canonicalKey: "clicks",
    displayName: "Clicks",
    description: "Link or ad clicks",
    unit: "count",
    dataType: "INTEGER",
    aggregation: "SUM",
    isCumulative: true,
  },
  {
    canonicalKey: "conversions",
    displayName: "Conversions",
    description: "Goal completions",
    unit: "count",
    dataType: "INTEGER",
    aggregation: "SUM",
    isCumulative: false,
  },
  {
    canonicalKey: "revenue",
    displayName: "Revenue",
    description: "Attributed revenue",
    unit: "currency",
    dataType: "CURRENCY",
    aggregation: "SUM",
    isCumulative: false,
  },
  {
    canonicalKey: "cost",
    displayName: "Cost",
    description: "Media spend",
    unit: "currency",
    dataType: "CURRENCY",
    aggregation: "SUM",
    isCumulative: false,
  },
  {
    canonicalKey: "ctr",
    displayName: "Click-through rate",
    description: "Clicks divided by impressions",
    unit: "percentage",
    dataType: "PERCENTAGE",
    aggregation: "AVG",
    isCumulative: false,
  },
  {
    canonicalKey: "engagement_rate",
    displayName: "Engagement rate",
    description: "Engagements divided by impressions",
    unit: "percentage",
    dataType: "PERCENTAGE",
    aggregation: "AVG",
    isCumulative: false,
  },
];

export function metricDefinitionByKey(key: string) {
  return DEFAULT_METRIC_DEFINITIONS.find((definition) => definition.canonicalKey === key);
}
