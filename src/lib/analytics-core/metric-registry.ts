import type { AnalyticsMetricDataType, AnalyticsMetricKind } from "@prisma/client";
import {
  ALL_METRIC_KEYS,
  ANALYTICS_METRIC_KEYS,
  BASE_METRIC_KEYS,
  DERIVED_METRIC_KEYS,
} from "@/lib/analytics-core/constants";

export type AnalyticsMetricDefinitionSeed = {
  metricKey: string;
  displayName: string;
  description: string;
  kind: AnalyticsMetricKind;
  dataType: AnalyticsMetricDataType;
  unit?: string;
  isCumulative: boolean;
  formulaKey?: string;
};

export const DEFAULT_ANALYTICS_METRIC_DEFINITIONS: AnalyticsMetricDefinitionSeed[] = [
  {
    metricKey: ANALYTICS_METRIC_KEYS.IMPRESSIONS,
    displayName: "Impressions",
    description: "Ad or content impressions",
    kind: "BASE",
    dataType: "INTEGER",
    unit: "count",
    isCumulative: true,
  },
  {
    metricKey: ANALYTICS_METRIC_KEYS.REACH,
    displayName: "Reach",
    description: "Unique users reached",
    kind: "BASE",
    dataType: "INTEGER",
    unit: "count",
    isCumulative: false,
  },
  {
    metricKey: ANALYTICS_METRIC_KEYS.CLICKS,
    displayName: "Clicks",
    description: "Link or ad clicks",
    kind: "BASE",
    dataType: "INTEGER",
    unit: "count",
    isCumulative: true,
  },
  {
    metricKey: ANALYTICS_METRIC_KEYS.SESSIONS,
    displayName: "Sessions",
    description: "Distinct browsing sessions",
    kind: "BASE",
    dataType: "INTEGER",
    unit: "count",
    isCumulative: false,
  },
  {
    metricKey: ANALYTICS_METRIC_KEYS.ENGAGEMENT,
    displayName: "Engagement",
    description: "Total engagement actions",
    kind: "BASE",
    dataType: "INTEGER",
    unit: "count",
    isCumulative: true,
  },
  {
    metricKey: ANALYTICS_METRIC_KEYS.LEADS,
    displayName: "Leads",
    description: "Captured leads",
    kind: "BASE",
    dataType: "INTEGER",
    unit: "count",
    isCumulative: false,
  },
  {
    metricKey: ANALYTICS_METRIC_KEYS.CONVERSIONS,
    displayName: "Conversions",
    description: "Goal completions",
    kind: "BASE",
    dataType: "INTEGER",
    unit: "count",
    isCumulative: false,
  },
  {
    metricKey: ANALYTICS_METRIC_KEYS.SPEND,
    displayName: "Spend",
    description: "Media spend",
    kind: "BASE",
    dataType: "CURRENCY",
    unit: "currency",
    isCumulative: true,
  },
  {
    metricKey: ANALYTICS_METRIC_KEYS.REVENUE,
    displayName: "Revenue",
    description: "Attributed revenue",
    kind: "BASE",
    dataType: "CURRENCY",
    unit: "currency",
    isCumulative: false,
  },
  {
    metricKey: ANALYTICS_METRIC_KEYS.CTR,
    displayName: "CTR",
    description: "Click-through rate (clicks / impressions)",
    kind: "DERIVED",
    dataType: "PERCENTAGE",
    unit: "percentage",
    isCumulative: false,
    formulaKey: "ctr",
  },
  {
    metricKey: ANALYTICS_METRIC_KEYS.CPC,
    displayName: "CPC",
    description: "Cost per click (spend / clicks)",
    kind: "DERIVED",
    dataType: "CURRENCY",
    unit: "currency",
    isCumulative: false,
    formulaKey: "cpc",
  },
  {
    metricKey: ANALYTICS_METRIC_KEYS.CPM,
    displayName: "CPM",
    description: "Cost per mille (spend / impressions * 1000)",
    kind: "DERIVED",
    dataType: "CURRENCY",
    unit: "currency",
    isCumulative: false,
    formulaKey: "cpm",
  },
  {
    metricKey: ANALYTICS_METRIC_KEYS.CPL,
    displayName: "CPL",
    description: "Cost per lead (spend / leads)",
    kind: "DERIVED",
    dataType: "CURRENCY",
    unit: "currency",
    isCumulative: false,
    formulaKey: "cpl",
  },
  {
    metricKey: ANALYTICS_METRIC_KEYS.CPA,
    displayName: "CPA",
    description: "Cost per acquisition (spend / conversions)",
    kind: "DERIVED",
    dataType: "CURRENCY",
    unit: "currency",
    isCumulative: false,
    formulaKey: "cpa",
  },
  {
    metricKey: ANALYTICS_METRIC_KEYS.ROAS,
    displayName: "ROAS",
    description: "Return on ad spend (revenue / spend)",
    kind: "DERIVED",
    dataType: "RATIO",
    unit: "ratio",
    isCumulative: false,
    formulaKey: "roas",
  },
  {
    metricKey: ANALYTICS_METRIC_KEYS.CONVERSION_RATE,
    displayName: "Conversion rate",
    description: "Conversions divided by sessions (fallback: clicks)",
    kind: "DERIVED",
    dataType: "PERCENTAGE",
    unit: "percentage",
    isCumulative: false,
    formulaKey: "conversion_rate",
  },
];

export function isBaseMetricKey(metricKey: string): boolean {
  return (BASE_METRIC_KEYS as readonly string[]).includes(metricKey);
}

export function isDerivedMetricKey(metricKey: string): boolean {
  return (DERIVED_METRIC_KEYS as readonly string[]).includes(metricKey);
}

export function isKnownMetricKey(metricKey: string): boolean {
  return (ALL_METRIC_KEYS as readonly string[]).includes(metricKey);
}

export function metricDefinitionByKey(metricKey: string) {
  return DEFAULT_ANALYTICS_METRIC_DEFINITIONS.find((definition) => definition.metricKey === metricKey);
}
