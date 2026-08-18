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
import { ChartBarGroup } from "@/components/marketing/chart-bar";
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
      <div className="mt-6 min-h-[12rem]">
        <ChartBarGroup
          points={points.map((point) => ({
            label: point.label,
            value: point.value,
            formattedValue:
              metric === "engagementRate"
                ? `${point.value.toFixed(1)}%`
                : point.value.toLocaleString(),
          }))}
          accentClassName="bg-organic-accent/80 hover:bg-organic-accent"
          ariaLabel={`${labels[metric]} chart`}
        />
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
