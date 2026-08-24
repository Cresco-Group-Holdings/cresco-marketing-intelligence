import type { MetricDisplayState } from "@/lib/command-centre/types";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

type TrendIndicatorProps = {
  change?: number | null;
  comparisonLabel?: string;
  invertColors?: boolean;
  absoluteChange?: boolean;
  className?: string;
};

export function TrendIndicator({
  change,
  comparisonLabel,
  invertColors = false,
  absoluteChange = false,
  className,
}: TrendIndicatorProps) {
  if (change == null) {
    return comparisonLabel ? (
      <span className={cn("text-[11px] text-foreground-subtle", className)}>{comparisonLabel}</span>
    ) : null;
  }

  const isPositive = change > 0;
  const isNegative = change < 0;
  const isGood = invertColors ? isNegative : isPositive;
  const isBad = invertColors ? isPositive : isNegative;
  const changeLabel = absoluteChange
    ? `${change > 0 ? "+" : ""}${change}`
    : `${change > 0 ? "+" : ""}${change.toFixed(1)}%`;

  return (
    <div className={cn("flex items-center gap-1.5 text-[11px]", className)}>
      <span
        className={cn(
          "inline-flex items-center gap-0.5 font-medium",
          isGood && "text-success",
          isBad && "text-danger",
          !isGood && !isBad && "text-foreground-subtle",
        )}
      >
        {isPositive ? <ArrowUpRight className="h-3 w-3" aria-hidden="true" /> : null}
        {isNegative ? <ArrowDownRight className="h-3 w-3" aria-hidden="true" /> : null}
        {!isPositive && !isNegative ? <Minus className="h-3 w-3" aria-hidden="true" /> : null}
        {changeLabel}
      </span>
      {comparisonLabel ? (
        <span className="text-foreground-subtle">{comparisonLabel}</span>
      ) : null}
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) {
    return null;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const width = 48;
  const height = 18;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[18px] w-12 shrink-0 opacity-60" aria-hidden="true">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
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
  state?: MetricDisplayState;
  stateMessage?: string;
  invertTrend?: boolean;
  absoluteChange?: boolean;
};

function MetricCell({ metric, className }: { metric: MetricCardData; className?: string }) {
  const isLoading = metric.state === "loading";
  const isEmpty = metric.state === "empty";
  const isUnavailable = metric.state === "unavailable";
  const isStale = metric.state === "stale";
  const showTrend = !isLoading && !isUnavailable;

  return (
    <div className={cn("min-w-0 px-4 py-3.5 first:pl-4 last:pr-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[11px] font-medium uppercase tracking-wide text-foreground-subtle">
          {metric.label}
        </p>
        {metric.sparkline && metric.sparkline.length > 1 ? (
          <Sparkline values={metric.sparkline} />
        ) : null}
      </div>

      {isLoading ? (
        <div className="mt-2 h-7 w-20 animate-pulse rounded bg-surface-hover" />
      ) : (
        <p
          className={cn(
            "mt-1 truncate text-xl font-semibold tabular-nums tracking-tight sm:text-2xl",
            isEmpty || isUnavailable ? "text-foreground-muted" : "text-foreground",
          )}
        >
          {metric.value}
        </p>
      )}

      {metric.stateMessage ? (
        <p className="mt-0.5 line-clamp-2 text-[11px] text-foreground-muted">{metric.stateMessage}</p>
      ) : isUnavailable ? (
        <p className="mt-0.5 line-clamp-2 text-[11px] text-foreground-muted">Metric unavailable</p>
      ) : null}

      {showTrend ? (
        <TrendIndicator
          change={metric.change}
          comparisonLabel={metric.comparisonLabel}
          invertColors={metric.invertTrend}
          absoluteChange={metric.absoluteChange}
          className="mt-1.5"
        />
      ) : null}
      {isStale ? (
        <p className="mt-1 text-[10px] font-medium text-warning">Stale data</p>
      ) : null}
    </div>
  );
}

export function MetricCardGrid({ metrics }: { metrics: MetricCardData[] }) {
  return (
    <section
      aria-label="Executive KPIs"
      className="overflow-hidden rounded-xl border border-border bg-surface-elevated shadow-sm"
    >
      <div className="grid grid-cols-2 divide-x divide-y divide-border lg:grid-cols-5 lg:divide-y-0">
        {metrics.map((metric, index) => (
          <MetricCell
            key={metric.label}
            metric={metric}
            className={cn(index === metrics.length - 1 && metrics.length % 2 === 1 && "col-span-2 lg:col-span-1")}
          />
        ))}
      </div>
    </section>
  );
}
