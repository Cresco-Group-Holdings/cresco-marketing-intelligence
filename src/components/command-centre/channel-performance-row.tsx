import Link from "next/link";
import type {
  ChannelPerformanceMetric,
  ChannelPerformanceMode,
  CommandCentreChannelRow,
  OrganicChannelPerformanceMetric,
} from "@/lib/command-centre/types";
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
    <div className="grid grid-cols-[minmax(6rem,1fr)_minmax(4.5rem,auto)_minmax(0,1.2fr)_auto] items-center gap-2 rounded-md border border-border/70 bg-surface px-3 py-2 sm:gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{row.label}</p>
        <p className="truncate text-[10px] text-foreground-subtle">{row.provider}</p>
      </div>

      <div>
        <p className="text-sm font-semibold tabular-nums text-foreground">{row.metricValue}</p>
        <TrendIndicator change={row.change} className="mt-0.5" />
      </div>

      <div className="hidden items-center gap-2 sm:flex">
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
            {row.actionLabel ?? "View"}
          </Link>
        ) : (
          <Link
            href={row.connectHref ?? "/organic-social/accounts"}
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
  mode,
  onModeChange,
  metric,
  onMetricChange,
  emptyMessage,
}: {
  rows: CommandCentreChannelRow[];
  mode: ChannelPerformanceMode;
  onModeChange: (mode: ChannelPerformanceMode) => void;
  metric: ChannelPerformanceMetric | OrganicChannelPerformanceMetric;
  onMetricChange: (metric: ChannelPerformanceMetric | OrganicChannelPerformanceMetric) => void;
  emptyMessage?: string;
}) {
  const paidMetrics: Array<{ key: ChannelPerformanceMetric; label: string }> = [
    { key: "spend", label: "Spend" },
    { key: "roas", label: "ROAS" },
    { key: "conversions", label: "Conversions" },
    { key: "ctr", label: "CTR" },
  ];

  const organicMetrics: Array<{ key: OrganicChannelPerformanceMetric; label: string }> = [
    { key: "reach", label: "Reach" },
    { key: "engagement", label: "Engagement" },
    { key: "engagementRate", label: "Eng. rate" },
    { key: "followersGained", label: "Followers" },
  ];

  const metrics = mode === "paid" ? paidMetrics : organicMetrics;

  if (rows.every((row) => !row.connected)) {
    return (
      <div className="space-y-3">
        <ChannelModeToggle mode={mode} onModeChange={onModeChange} />
        <div className="rounded-lg border border-dashed border-border bg-surface-subtle px-4 py-5 text-center text-xs text-foreground-muted">
          {emptyMessage ??
            (mode === "paid"
              ? "Connect paid advertising accounts to compare channel performance across providers."
              : "Connect organic social accounts to compare reach and engagement across channels.")}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ChannelModeToggle mode={mode} onModeChange={onModeChange} />
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

function ChannelModeToggle({
  mode,
  onModeChange,
}: {
  mode: ChannelPerformanceMode;
  onModeChange: (mode: ChannelPerformanceMode) => void;
}) {
  return (
    <div
      className="inline-flex rounded-md border border-border bg-surface-subtle p-0.5"
      role="tablist"
      aria-label="Channel performance mode"
    >
      {(
        [
          { key: "paid", label: "Paid" },
          { key: "organic", label: "Organic" },
        ] as const
      ).map((option) => (
        <button
          key={option.key}
          type="button"
          role="tab"
          aria-selected={mode === option.key}
          onClick={() => onModeChange(option.key)}
          className={cn(
            "rounded px-2.5 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            mode === option.key
              ? "bg-surface-elevated text-foreground shadow-sm"
              : "text-foreground-muted hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
