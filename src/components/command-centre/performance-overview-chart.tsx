"use client";

import { useMemo, useState } from "react";
import { ChartBarGroup } from "@/components/marketing/chart-bar";
import type { PaidChartPoint } from "@/components/marketing/paid-performance-chart.types";
import { cn } from "@/lib/utils";

type OverviewMetric = "revenue" | "conversions" | "spend";

const METRIC_LABELS: Record<OverviewMetric, string> = {
  revenue: "Revenue",
  conversions: "Conversions",
  spend: "Spend",
};

type PerformanceOverviewChartProps = {
  data: {
    revenue: PaidChartPoint[];
    conversions: PaidChartPoint[];
    spend: PaidChartPoint[];
  };
  currency?: string;
  loading?: boolean;
  emptyMessage?: string;
};

function formatValue(metric: OverviewMetric, value: number, currency: string): string {
  if (metric === "conversions") {
    return value.toLocaleString("en-GB");
  }
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function PerformanceOverviewChart({
  data,
  currency = "GBP",
  loading = false,
  emptyMessage,
}: PerformanceOverviewChartProps) {
  const [visibleSeries, setVisibleSeries] = useState<Record<OverviewMetric, boolean>>({
    revenue: true,
    conversions: true,
    spend: true,
  });
  const [primaryMetric, setPrimaryMetric] = useState<OverviewMetric>("spend");

  const points = useMemo(() => data[primaryMetric] ?? [], [data, primaryMetric]);
  const chartPoints = useMemo(
    () =>
      points.map((point) => ({
        label: point.label,
        value: point.value,
        formattedValue: formatValue(primaryMetric, point.value, currency),
      })),
    [points, primaryMetric, currency],
  );

  const hasAnyData =
    data.revenue.length > 0 || data.conversions.length > 0 || data.spend.length > 0;

  if (loading) {
    return (
      <div className="h-64 min-h-[16rem] animate-pulse rounded-xl border border-border bg-surface-elevated" />
    );
  }

  if (!hasAnyData) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center rounded-xl border border-dashed border-border bg-surface-subtle p-6 text-center text-sm text-foreground-muted">
        {emptyMessage ??
          "Connect revenue and advertising sources to view performance trends for this period."}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(METRIC_LABELS) as OverviewMetric[]).map((metric) => (
          <button
            key={metric}
            type="button"
            onClick={() => {
              setPrimaryMetric(metric);
              setVisibleSeries((current) => ({ ...current, [metric]: !current[metric] }));
            }}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              visibleSeries[metric]
                ? "bg-surface-selected text-foreground"
                : "text-foreground-muted line-through opacity-60",
            )}
            aria-pressed={visibleSeries[metric]}
          >
            {METRIC_LABELS[metric]}
          </button>
        ))}
      </div>
      {visibleSeries[primaryMetric] ? (
        <ChartBarGroup
          points={chartPoints}
          ariaLabel={`Command Centre performance overview chart showing ${METRIC_LABELS[primaryMetric].toLowerCase()} by day for the selected period`}
        />
      ) : (
        <p className="text-sm text-foreground-muted">All series hidden. Select a metric to display.</p>
      )}
    </div>
  );
}
