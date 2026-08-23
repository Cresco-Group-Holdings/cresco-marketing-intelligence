import Link from "next/link";
import type { ChannelPerformanceMetric, CommandCentreChannelRow } from "@/lib/command-centre/types";
import { cn } from "@/lib/utils";
import { TrendIndicator } from "@/components/command-centre/metric-card";

const STATUS_STYLES = {
  healthy: "bg-success/80",
  warning: "bg-warning/80",
  error: "bg-danger/80",
  disconnected: "bg-foreground-subtle/25",
} as const;

export function ChannelPerformanceRow({ row }: { row: CommandCentreChannelRow }) {
  const barWidth = Math.max(6, Math.min(100, row.relativePerformance));

  return (
    <div className="grid grid-cols-[minmax(7rem,1fr)_minmax(5rem,auto)_minmax(0,1.4fr)_auto] items-center gap-3 rounded-md border border-border/70 bg-surface px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{row.label}</p>
        <p className="truncate text-[10px] text-foreground-subtle">{row.provider}</p>
      </div>

      <div>
        <p className="text-sm font-semibold tabular-nums text-foreground">{row.metricValue}</p>
        <TrendIndicator change={row.change} className="mt-0.5" />
      </div>

      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-hover">
          <div
            className={cn("h-full rounded-full", STATUS_STYLES[row.status])}
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
            className="text-[11px] font-medium text-foreground-muted hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            View
          </Link>
        ) : (
          <Link
            href={row.connectHref ?? "/integrations"}
            className="text-[11px] font-medium text-foreground-muted hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
      <div className="rounded-lg border border-dashed border-border bg-surface-subtle px-4 py-5 text-center text-xs text-foreground-muted">
        {emptyMessage ??
          "Connect paid advertising accounts to compare channel performance across providers."}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Channel metric">
        {metrics.map((option) => (
          <button
            key={option.key}
            type="button"
            role="tab"
            aria-selected={metric === option.key}
            onClick={() => onMetricChange(option.key)}
            className={cn(
              "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              metric === option.key
                ? "bg-surface-selected text-foreground"
                : "text-foreground-muted hover:bg-surface-hover",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="space-y-1.5">
        {rows.map((row) => (
          <ChannelPerformanceRow key={row.key} row={row} />
        ))}
      </div>
    </div>
  );
}
