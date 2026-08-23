"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export type MetricTrend = "positive" | "negative" | "neutral";

export type MarketingMetric = {
  label: string;
  value: string;
  change?: number | null;
  comparisonLabel?: string;
  trend?: MetricTrend;
  loading?: boolean;
  sparkline?: number[];
  state?: "loading" | "empty" | "partial" | "stale" | "normal";
  stateMessage?: string;
};

type MarketingMetricCardProps = {
  metric: MarketingMetric;
  accent?: "paid" | "organic" | "neutral";
  className?: string;
};

function getTrend(metric: MarketingMetric): MetricTrend {
  if (metric.trend) {
    return metric.trend;
  }
  if (metric.change == null) {
    return "neutral";
  }
  if (metric.change > 0) {
    return "positive";
  }
  if (metric.change < 0) {
    return "negative";
  }
  return "neutral";
}

export function MarketingMetricCard({ metric, accent = "neutral", className }: MarketingMetricCardProps) {
  const trend = getTrend(metric);
  const changeLabel =
    metric.change == null ? null : `${metric.change > 0 ? "+" : ""}${metric.change.toFixed(1)}%`;

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-surface-elevated p-4 shadow-sm",
        accent === "paid" && "border-paid-accent/20",
        accent === "organic" && "border-organic-accent/20",
        className,
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-foreground-subtle">
        {metric.label}
      </p>
      {metric.loading ? (
        <div className="mt-3 h-8 w-24 animate-pulse rounded bg-surface-hover" />
      ) : (
        <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{metric.value}</p>
      )}
      {changeLabel ? (
        <div className="mt-2 flex items-center gap-2 text-xs">
          <span
            className={cn(
              "inline-flex items-center gap-1 font-medium",
              trend === "positive" && "text-success",
              trend === "negative" && "text-danger",
              trend === "neutral" && "text-foreground-subtle",
            )}
          >
            {trend === "positive" ? (
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            ) : null}
            {trend === "negative" ? (
              <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />
            ) : null}
            {trend === "neutral" ? <Minus className="h-3.5 w-3.5" aria-hidden="true" /> : null}
            {changeLabel}
          </span>
          {metric.comparisonLabel ? (
            <span className="text-foreground-subtle">{metric.comparisonLabel}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function ExecutiveKpiStrip({
  metrics,
  accent = "neutral",
  mobilePriorityLabels,
}: {
  metrics: MarketingMetric[];
  accent?: "paid" | "organic" | "neutral";
  mobilePriorityLabels?: string[];
}) {
  const orderedMetrics =
    mobilePriorityLabels && mobilePriorityLabels.length > 0
      ? [
          ...metrics.filter((metric) => mobilePriorityLabels.includes(metric.label)),
          ...metrics.filter((metric) => !mobilePriorityLabels.includes(metric.label)),
        ]
      : metrics;

  return (
    <section
      aria-label="Executive KPIs"
      className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 2xl:grid-cols-6"
    >
      {orderedMetrics.map((metric) => (
        <MarketingMetricCard key={metric.label} metric={metric} accent={accent} />
      ))}
    </section>
  );
}
