import Link from "next/link";
import type { ChannelPerformanceMetric, CommandCentreChannelRow } from "@/lib/command-centre/types";
import { cn } from "@/lib/utils";
import { TrendIndicator } from "@/components/command-centre/metric-card";

const STATUS_STYLES = {
  healthy: "bg-success",
  warning: "bg-warning",
  error: "bg-danger",
  disconnected: "bg-foreground-subtle/30",
} as const;

export function ChannelPerformanceRow({ row }: { row: CommandCentreChannelRow }) {
  const barWidth = Math.max(8, Math.min(100, row.relativePerformance));

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-surface px-4 py-3">
      <div className="min-w-[8rem]">
        <p className="text-sm font-medium text-foreground">{row.label}</p>
        <p className="text-xs text-foreground-subtle capitalize">{row.provider}</p>
      </div>

      <div className="min-w-[5rem]">
        <p className="text-lg font-semibold text-foreground">{row.metricValue}</p>
        <TrendIndicator change={row.change} comparisonLabel={row.comparisonLabel} className="mt-0.5" />
      </div>

      <div className="flex min-w-[8rem] flex-1 items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-hover">
          <div
            className={cn("h-full rounded-full transition-all", STATUS_STYLES[row.status])}
            style={{ width: `${barWidth}%` }}
            role="presentation"
          />
        </div>
        <span className="sr-only">{row.status}</span>
      </div>

      <div className="shrink-0">
        {row.connected ? (
          <Link
            href={row.href}
            className="text-xs font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            View
          </Link>
        ) : (
          <Link
            href={row.connectHref ?? "/integrations"}
            className="text-xs font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Connect
          </Link>
        )}
      </div>
    </div>
  );
}

export function ChannelPerformancePanel({
  rows,
  metric,
  onMetricChange,
  emptyMessage,
}: {
  rows: CommandCentreChannelRow[];
  metric: ChannelPerformanceMetric;
  onMetricChange: (metric: ChannelPerformanceMetric) => void;
  emptyMessage?: string;
}) {
  const metrics: Array<{ key: ChannelPerformanceMetric; label: string }> = [
    { key: "spend", label: "Spend" },
    { key: "roas", label: "ROAS" },
    { key: "conversions", label: "Conversions" },
    { key: "ctr", label: "CTR" },
  ];

  if (rows.every((row) => !row.connected)) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface-subtle p-6 text-center text-sm text-foreground-muted">
        {emptyMessage ??
          "Connect paid advertising accounts to compare channel performance across providers."}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Channel metric">
        {metrics.map((option) => (
          <button
            key={option.key}
            type="button"
            role="tab"
            aria-selected={metric === option.key}
            onClick={() => onMetricChange(option.key)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              metric === option.key
                ? "bg-surface-selected text-foreground"
                : "text-foreground-muted hover:bg-surface-hover",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {rows.map((row) => (
          <ChannelPerformanceRow key={row.key} row={row} />
        ))}
      </div>
    </div>
  );
}
