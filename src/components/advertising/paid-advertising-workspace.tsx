"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PaidEmptyState, WorkspaceErrorState } from "@/components/layout/workspace-empty-state";
import { ExecutiveKpiStrip } from "@/components/marketing/marketing-metric-card";
import { PaidPerformanceChart } from "@/components/marketing/paid-performance-chart";
import { AIIntelligenceFeed } from "@/components/marketing/ai-insight-card";
import { MarketingDateRangeProvider } from "@/components/marketing/marketing-date-range-provider";
import { DateRangeSelector } from "@/components/marketing/date-range-selector";
import { Button, ButtonLink } from "@/components/ui/button";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { PaidChannelPerformancePanel } from "@/components/advertising/paid-channel-performance";
import { BudgetAllocationPanel } from "@/components/advertising/budget-allocation-panel";
import { CampaignHighlights } from "@/components/advertising/campaign-highlights";
import { CreativeHealthPanel } from "@/components/advertising/creative-health-panel";
import { apiFetch } from "@/lib/api/client";
import type { PaidAdvertisingWorkspaceData } from "@/lib/paid-advertising/types";

function PaidAdvertisingHeader({
  data,
  onRefresh,
  loading,
}: {
  data: PaidAdvertisingWorkspaceData;
  onRefresh: () => void;
  loading: boolean;
}) {
  const hasConnections = data.coverage !== "0 of 4 paid channels connected";

  return (
    <PageHeader
      title="Paid Advertising"
      description="Performance, budget and optimisation across every paid channel."
      actions={
        <>
          <DateRangeSelector />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            aria-label="Refresh data"
          >
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden="true" />
          </Button>
          {hasConnections ? (
            <ButtonLink href="/advertising/campaigns" variant="paid" size="sm">
              View Campaigns
            </ButtonLink>
          ) : (
            <ButtonLink href="/connectors" variant="paid" size="sm">
              Connect Ad Account
            </ButtonLink>
          )}
        </>
      }
    />
  );
}

function WorkspaceMeta({ data }: { data: PaidAdvertisingWorkspaceData }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-foreground-subtle">
      <span>{data.coverage}</span>
      <span aria-hidden="true">·</span>
      <span>{data.freshness.label}</span>
      <span aria-hidden="true">·</span>
      <span>{data.dateRange.comparisonLabel || "No comparison"}</span>
    </div>
  );
}

function PaidAdvertisingWorkspaceContent() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<PaidAdvertisingWorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = searchParams.toString();
      const response = await apiFetch<{ workspace: PaidAdvertisingWorkspaceData }>(
        `/api/advertising/workspace${query ? `?${query}` : ""}`,
      );
      setData(response.workspace);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load paid advertising workspace.");
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  if (loading && !data) {
    return <DashboardSkeleton />;
  }

  if (error && !data) {
    return (
      <WorkspaceErrorState
        title="We couldn't load this workspace"
        description={error}
        onRetry={loadWorkspace}
      />
    );
  }

  if (!data) {
    return null;
  }

  const hasConnections = !data.coverage.startsWith("0 of");

  if (!data.hasBrandContext) {
    return (
      <div className="space-y-6">
        <PaidAdvertisingHeader data={data} onRefresh={loadWorkspace} loading={loading} />
        <PaidEmptyState />
      </div>
    );
  }

  if (!hasConnections) {
    return (
      <div className="space-y-6">
        <PaidAdvertisingHeader data={data} onRefresh={loadWorkspace} loading={loading} />
        <WorkspaceMeta data={data} />
        <PaidEmptyState />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PaidAdvertisingHeader data={data} onRefresh={loadWorkspace} loading={loading} />
      <WorkspaceMeta data={data} />
      <ExecutiveKpiStrip
        metrics={data.executiveKpis}
        accent="paid"
        mobilePriorityLabels={["ROAS", "Spend", "CPA", "Conversions"]}
      />
      <PaidPerformanceChart
        data={data.chart}
        currency={data.currency}
        loading={loading}
        emptyMessage={
          data.hasBrandContext
            ? "No paid performance data for the selected period."
            : "Select a brand to view paid advertising performance."
        }
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <PaidChannelPerformancePanel channels={data.channels} currency={data.currency} />
        <BudgetAllocationPanel allocation={data.budgetAllocation} currency={data.currency} />
      </div>
      <CampaignHighlights campaigns={data.campaigns} currency={data.currency} />
      <CreativeHealthPanel creatives={data.creatives} />
      <section aria-labelledby="paid-intelligence-heading">
        <h2 id="paid-intelligence-heading" className="text-lg font-semibold text-foreground">
          Cresco recommendations
        </h2>
        <p className="mt-1 text-sm text-foreground-muted">
          Evidence-based signals to guide budget, creative and campaign decisions.
        </p>
        <div className="mt-4">
          <AIIntelligenceFeed
            insights={data.insights}
            emptyMessage="No paid advertising recommendations for the selected period."
          />
        </div>
      </section>
    </div>
  );
}

export function PaidAdvertisingWorkspace() {
  return (
    <MarketingDateRangeProvider>
      <PaidAdvertisingWorkspaceContent />
    </MarketingDateRangeProvider>
  );
}
