"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChartBarGroup } from "@/components/marketing/chart-bar";

export type PaidChartMetric = "spend" | "revenue" | "conversions" | "roas" | "cpa";

export type PaidChartPoint = {
  label: string;
  value: number;
};

const METRIC_LABELS: Record<PaidChartMetric, string> = {
  spend: "Spend",
  revenue: "Revenue",
  conversions: "Conversions",
  roas: "ROAS",
  cpa: "CPA",
};

type PaidPerformanceChartProps = {
  data: Record<PaidChartMetric, PaidChartPoint[]>;
  currency?: string;
  loading?: boolean;
  emptyMessage?: string;
};

function formatValue(metric: PaidChartMetric, value: number, currency: string): string {
  if (metric === "conversions") {
    return value.toLocaleString();
  }
  if (metric === "roas") {
    return `${value.toFixed(2)}x`;
  }
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function PaidPerformanceChart({
  data,
  currency = "GBP",
  loading = false,
  emptyMessage,
}: PaidPerformanceChartProps) {
  const [metric, setMetric] = useState<PaidChartMetric>("spend");
  const points = useMemo(() => data[metric] ?? [], [data, metric]);
  const chartPoints = useMemo(
    () =>
      points.map((point) => ({
        label: point.label,
        value: point.value,
        formattedValue: formatValue(metric, point.value, currency),
      })),
    [points, metric, currency],
  );

  if (loading) {
    return <div className="h-64 min-h-[16rem] animate-pulse rounded-xl border border-border bg-surface-elevated" />;
  }

  if (points.length === 0) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center rounded-xl border border-dashed border-border bg-surface-elevated p-6 text-center text-sm text-foreground-muted">
        {emptyMessage ?? "No performance data for this period."}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface-elevated p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Paid performance trend</h3>
          <p className="text-xs text-foreground-muted">
            Metric series for the selected global date range.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(METRIC_LABELS) as PaidChartMetric[]).map((option) => (
            <Button
              key={option}
              type="button"
              size="sm"
              variant={metric === option ? "paid" : "outline"}
              onClick={() => setMetric(option)}
            >
              {METRIC_LABELS[option]}
            </Button>
          ))}
        </div>
      </div>

      <div className="mt-6 min-h-[12rem]">
        <ChartBarGroup
          points={chartPoints}
          accentClassName="bg-paid-accent/80 hover:bg-paid-accent"
          ariaLabel={`${METRIC_LABELS[metric]} chart`}
        />
      </div>
    </div>
  );
}
