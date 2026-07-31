export const METRIC_GROUP_BY_ALLOWLIST = [
  "metricKey",
  "provider",
  "source",
  "marketingChannelId",
  "marketingCampaignId",
  "marketingAccountId",
  "periodGrain",
] as const;

export const METRIC_SORT_ALLOWLIST = [
  "observedAt",
  "metricValue",
  "metricKey",
  "createdAt",
] as const;

export const EVENT_GROUP_BY_ALLOWLIST = [
  "eventName",
  "provider",
  "source",
  "marketingCampaignId",
] as const;

export const EVENT_SORT_ALLOWLIST = ["occurredAt", "eventName", "createdAt"] as const;

export const AGGREGATE_GROUP_BY_ALLOWLIST = [
  "metricKey",
  "dimensionKey",
  "dimensionValue",
  "aggregateDate",
] as const;

export const AGGREGATE_SORT_ALLOWLIST = ["aggregateDate", "value", "metricKey"] as const;

export type MetricGroupBy = (typeof METRIC_GROUP_BY_ALLOWLIST)[number];
export type MetricSort = (typeof METRIC_SORT_ALLOWLIST)[number];
export type EventGroupBy = (typeof EVENT_GROUP_BY_ALLOWLIST)[number];
export type EventSort = (typeof EVENT_SORT_ALLOWLIST)[number];

export function assertAllowlisted<T extends readonly string[]>(
  value: string | undefined,
  allowlist: T,
  field: string,
): T[number] | undefined {
  if (!value) return undefined;
  if ((allowlist as readonly string[]).includes(value)) {
    return value as T[number];
  }
  throw new Error(`Invalid ${field}: ${value}`);
}

export function assertAllowlistedList<T extends readonly string[]>(
  values: string[] | undefined,
  allowlist: T,
  field: string,
): T[number][] {
  if (!values?.length) return [];
  return values.map((value) => {
    if (!(allowlist as readonly string[]).includes(value)) {
      throw new Error(`Invalid ${field}: ${value}`);
    }
    return value as T[number];
  });
}
