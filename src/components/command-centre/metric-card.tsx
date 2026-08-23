import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

type TrendIndicatorProps = {
  change?: number | null;
  comparisonLabel?: string;
  invertColors?: boolean;
  className?: string;
};

export function TrendIndicator({
  change,
  comparisonLabel,
  invertColors = false,
  className,
}: TrendIndicatorProps) {
  if (change == null) {
    return comparisonLabel ? (
      <span className={cn("text-xs text-foreground-subtle", className)}>{comparisonLabel}</span>
    ) : null;
  }

  const isPositive = change > 0;
  const isNegative = change < 0;
  const isGood = invertColors ? isNegative : isPositive;
  const isBad = invertColors ? isPositive : isNegative;

  return (
    <div className={cn("flex items-center gap-2 text-xs", className)}>
      <span
        className={cn(
          "inline-flex items-center gap-1 font-medium",
          isGood && "text-success",
          isBad && "text-danger",
          !isGood && !isBad && "text-foreground-subtle",
        )}
      >
        {isPositive ? (
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        ) : null}
        {isNegative ? (
          <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />
        ) : null}
        {!isPositive && !isNegative ? (
          <Minus className="h-3.5 w-3.5" aria-hidden="true" />
        ) : null}
        {change > 0 ? "+" : ""}
        {change.toFixed(1)}%
      </span>
      {comparisonLabel ? (
        <span className="text-foreground-subtle">{comparisonLabel}</span>
      ) : null}
    </div>
  );
}

function Sparkline({ values, className }: { values: number[]; className?: string }) {
  if (values.length < 2) {
    return null;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const width = 64;
  const height = 24;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn("h-6 w-16 text-foreground-subtle", className)}
      aria-hidden="true"
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export type MetricCardData = {
  label: string;
  value: string;
  change?: number | null;
  comparisonLabel?: string;
  sparkline?: number[];
  state?: "loading" | "empty" | "partial" | "stale" | "normal";
  stateMessage?: string;
  invertTrend?: boolean;
};

export function MetricCard({
  metric,
  className,
}: {
  metric: MetricCardData;
  className?: string;
}) {
  const isLoading = metric.state === "loading";
  const isEmpty = metric.state === "empty";
  const isStale = metric.state === "stale";

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-surface-elevated p-4 shadow-sm",
        isStale && "border-warning/30",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-foreground-subtle">
          {metric.label}
        </p>
        {metric.sparkline && metric.sparkline.length > 1 ? (
          <Sparkline values={metric.sparkline} />
        ) : null}
      </div>

      {isLoading ? (
        <div className="mt-3 h-8 w-24 animate-pulse rounded bg-surface-hover" />
      ) : (
        <p
          className={cn(
            "mt-2 text-2xl font-semibold tracking-tight",
            isEmpty ? "text-foreground-muted" : "text-foreground",
          )}
        >
          {metric.value}
        </p>
      )}

      {metric.stateMessage ? (
        <p className="mt-1 text-xs text-foreground-muted">{metric.stateMessage}</p>
      ) : null}

      <TrendIndicator
        change={metric.change}
        comparisonLabel={metric.comparisonLabel}
        invertColors={metric.invertTrend}
        className="mt-2"
      />
    </div>
  );
}

export function MetricCardGrid({ metrics }: { metrics: MetricCardData[] }) {
  return (
    <section
      aria-label="Executive KPIs"
      className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5"
    >
      {metrics.map((metric) => (
        <MetricCard key={metric.label} metric={metric} />
      ))}
    </section>
  );
}
