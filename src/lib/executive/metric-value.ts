import type { MetricComparison, MetricValue } from "@/lib/executive/types";

export function availableMetric(
  value: number,
  options?: Partial<Omit<MetricValue, "available" | "value">>,
): MetricValue {
  return { available: true, value, ...options };
}

export function unavailableMetric(reason: string, options?: Partial<MetricValue>): MetricValue {
  return {
    available: false,
    value: null,
    unavailableReason: reason,
    ...options,
  };
}

export function compareMetrics(
  current: MetricValue,
  previous: MetricValue,
): MetricComparison {
  const changeAbsolute =
    current.available && previous.available && current.value != null && previous.value != null
      ? current.value - previous.value
      : null;

  let changePercent: number | null = null;
  if (
    changeAbsolute != null &&
    previous.available &&
    previous.value != null &&
    previous.value !== 0
  ) {
    changePercent = (changeAbsolute / previous.value) * 100;
  }

  return {
    ...current,
    previous,
    changeAbsolute,
    changePercent: changePercent != null ? Math.round(changePercent * 100) / 100 : null,
  };
}

export function formatMetricDisplay(metric: MetricValue, suffix = ""): string {
  if (!metric.available || metric.value == null) return "Unavailable";
  const formatted = metric.value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  const currency = metric.currency ? ` ${metric.currency}` : "";
  return `${formatted}${currency}${suffix}`;
}
