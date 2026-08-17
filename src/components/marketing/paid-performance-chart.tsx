"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  PaidChartMetric,
  PaidChartPoint,
} from "@/components/marketing/paid-performance-chart.types";

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
  const maxValue = useMemo(() => Math.max(...points.map((point) => point.value), 1), [points]);

  if (loading) {
    return <div className="h-64 animate-pulse rounded-xl border border-border bg-surface-elevated" />;
  }

  if (points.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface-elevated p-6 text-sm text-foreground-muted">
        {emptyMessage ?? "Connect paid advertising accounts to view performance trends."}
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

      <div
        className="mt-6 flex h-48 items-end gap-2 sm:gap-3"
        role="img"
        aria-label={`${METRIC_LABELS[metric]} chart`}
      >
        {points.map((point) => {
          const height = Math.max((point.value / maxValue) * 100, 4);
          return (
            <div key={point.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div className="flex h-40 w-full items-end">
                <div
                  className={cn("w-full rounded-t-md bg-paid-accent/80 transition-all")}
                  style={{ height: `${height}%` }}
                  title={`${point.label}: ${formatValue(metric, point.value, currency)}`}
                />
              </div>
              <span className="truncate text-[10px] text-foreground-subtle sm:text-xs">
                {point.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export type {
  PaidChartMetric,
  PaidChartPoint,
} from "@/components/marketing/paid-performance-chart.types";
