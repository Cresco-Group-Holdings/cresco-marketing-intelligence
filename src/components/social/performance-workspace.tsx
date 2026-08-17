"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { MarketingDateRangeProvider } from "@/components/marketing/marketing-date-range-provider";
import { DateRangeSelector } from "@/components/marketing/date-range-selector";
import { FormatPerformancePanel } from "@/components/social/format-performance-panel";
import { OrganicChannelPanel } from "@/components/social/organic-channel-panel";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api/client";
import type { OrganicSocialWorkspaceData } from "@/lib/organic-social/types";
import { cn } from "@/lib/utils";

function OrganicTrendChart({
  data,
  currency,
}: {
  data: OrganicSocialWorkspaceData["chart"];
  currency?: string;
}) {
  const [metric, setMetric] = useState<keyof OrganicSocialWorkspaceData["chart"]>("reach");
  const points = data[metric] ?? [];
  const maxValue = Math.max(...points.map((point) => point.value), 1);

  if (points.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface-elevated p-6 text-sm text-foreground-muted">
        No organic trend data for the selected period.
      </div>
    );
  }

  const labels: Record<keyof OrganicSocialWorkspaceData["chart"], string> = {
    reach: "Reach",
    views: "Views",
    engagement: "Engagement",
    engagementRate: "Engagement Rate",
  };

  return (
    <div className="rounded-xl border border-border bg-surface-elevated p-4 sm:p-5">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(labels) as Array<keyof OrganicSocialWorkspaceData["chart"]>).map((option) => (
          <button
            key={option}
            type="button"
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm",
              metric === option
                ? "border-organic-accent bg-organic-accent/10 text-foreground"
                : "border-border text-foreground-muted hover:bg-surface-hover",
            )}
            onClick={() => setMetric(option)}
          >
            {labels[option]}
          </button>
        ))}
      </div>
      <div className="mt-6 flex h-48 items-end gap-2" role="img" aria-label={`${labels[metric]} chart`}>
        {points.map((point) => {
          const height = Math.max((point.value / maxValue) * 100, 4);
          return (
            <div key={point.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div className="flex h-40 w-full items-end">
                <div
                  className="w-full rounded-t-md bg-organic-accent/80"
                  style={{ height: `${height}%` }}
                  title={`${point.label}: ${point.value.toLocaleString()}`}
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

function PerformanceWorkspaceContent() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<OrganicSocialWorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = searchParams.toString();
      const response = await apiFetch<{ workspace: OrganicSocialWorkspaceData }>(
        `/api/social/workspace${query ? `?${query}` : ""}`,
      );
      setData(response.workspace);
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organic Performance"
        description="Reach, engagement, and format analytics across connected channels."
        actions={<DateRangeSelector />}
      />
      {data ? (
        <>
          <OrganicTrendChart data={data.chart} />
          <div className="grid gap-6 xl:grid-cols-2">
            <FormatPerformancePanel formats={data.formatPerformance} />
            <OrganicChannelPanel channels={data.channels} />
          </div>
        </>
      ) : (
        <p className="text-sm text-foreground-muted">Unable to load performance data.</p>
      )}
    </div>
  );
}

export function PerformanceWorkspace() {
  return (
    <MarketingDateRangeProvider>
      <PerformanceWorkspaceContent />
    </MarketingDateRangeProvider>
  );
}
