"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RefreshCw } from "lucide-react";
import {
  AttributionPanel,
  ChannelsPanel,
  ContentPanel,
  ConversionsPanel,
  CoveragePanel,
  FunnelPanel,
  RevenuePanel,
  UnifiedKpiStrip,
} from "@/components/analytics/unified-analytics-panels";
import { PageHeader } from "@/components/layout/page-header";
import { AIIntelligenceFeed } from "@/components/marketing/ai-insight-card";
import { AnalyticsEmptyState, WorkspaceErrorState } from "@/components/layout/workspace-empty-state";
import { MarketingDateRangeProvider } from "@/components/marketing/marketing-date-range-provider";
import { DateRangeSelector } from "@/components/marketing/date-range-selector";
import { Button } from "@/components/ui/button";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api/client";
import type { UnifiedAnalyticsWorkspaceData } from "@/lib/unified-analytics/types";
import { useUnifiedAnalyticsPreviewData } from "@/components/analytics/unified-analytics-preview-context";

export type UnifiedAnalyticsTab =
  | "overview"
  | "channels"
  | "content"
  | "attribution"
  | "funnels"
  | "conversions"
  | "revenue";

function ModelSelector({
  options,
  selected,
  onChange,
}: {
  options: UnifiedAnalyticsWorkspaceData["modelOptions"];
  selected: string;
  onChange: (model: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-foreground-muted">
      <span className="sr-only">Attribution model</span>
      <span aria-hidden="true">Model</span>
      <select
        value={selected}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-foreground w-full sm:w-auto"
      >
        {options.map((option) => (
          <option key={option.type} value={option.type}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function UnifiedAnalyticsWorkspaceContent({ tab }: { tab: UnifiedAnalyticsTab }) {
  const previewData = useUnifiedAnalyticsPreviewData();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [data, setData] = useState<UnifiedAnalyticsWorkspaceData | null>(previewData);
  const [loading, setLoading] = useState(!previewData);
  const [error, setError] = useState<string | null>(null);

  const loadWorkspace = useCallback(async () => {
    if (previewData) {
      setData(previewData);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const query = searchParams.toString();
      const response = await apiFetch<{ workspace: UnifiedAnalyticsWorkspaceData }>(
        `/api/analytics/workspace${query ? `?${query}` : ""}`,
      );
      setData(response.workspace);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load unified analytics workspace.");
    } finally {
      setLoading(false);
    }
  }, [previewData, searchParams]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const handleModelChange = (model: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("model", model);
    router.replace(`?${params.toString()}`);
  };

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

  if (!data) return null;

  const hasMeasurementData =
    data.coverage.some((item) => item.state === "Strong" || item.state === "Partial") ||
    data.executiveKpis.some((kpi) => kpi.value !== "—" && kpi.value !== "Unavailable");

  if (!hasMeasurementData) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Unified Analytics"
          description="Understand performance, attribution and revenue across your entire marketing system."
          actions={<DateRangeSelector />}
        />
        <AnalyticsEmptyState />
      </div>
    );
  }

  const showModelSelector = tab === "overview" || tab === "attribution" || tab === "revenue";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Unified Analytics"
        description="Understand performance, attribution and revenue across your entire marketing system."
        actions={
          <>
            <DateRangeSelector />
            {showModelSelector ? (
              <ModelSelector
                options={data.modelOptions}
                selected={data.attributionModel}
                onChange={handleModelChange}
              />
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadWorkspace}
              disabled={loading}
              aria-label="Refresh data"
            >
              <RefreshCw
                className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"}
                aria-hidden="true"
              />
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3 text-xs text-foreground-subtle">
        <span>{data.freshness.label}</span>
        <span aria-hidden="true">·</span>
        <span>{data.dateRange.label}</span>
        <span aria-hidden="true">·</span>
        <span>{data.dateRange.comparisonLabel || "No comparison"}</span>
        <span aria-hidden="true">·</span>
        <span>Lookback {data.lookbackWindowDays}d</span>
        <span aria-hidden="true">·</span>
        <span>
          Attribution confidence: {data.attributionConfidence.level}
          {data.attributionConfidence.sourceCoveragePercent != null
            ? ` (${data.attributionConfidence.sourceCoveragePercent}% source coverage)`
            : ""}
        </span>
      </div>

      {(tab === "overview" || tab === "revenue") && (
        <UnifiedKpiStrip kpis={data.executiveKpis} />
      )}

      {tab === "overview" && (
        <>
          <div className="grid gap-6 xl:grid-cols-2">
            <CoveragePanel coverage={data.coverage} warnings={data.coverageWarnings} />
            <FunnelPanel funnel={data.funnel} />
          </div>
          <section aria-labelledby="analytics-intelligence-heading">
            <h2 id="analytics-intelligence-heading" className="text-lg font-semibold text-foreground">
              Cresco measurement intelligence
            </h2>
            <p className="mt-1 text-sm text-foreground-muted">
              Attribution, content, funnel and data-quality signals with explicit limitations.
            </p>
            <div className="mt-4">
              <AIIntelligenceFeed
                insights={data.insights}
                emptyMessage="No measurement signals for the selected period."
              />
            </div>
          </section>
        </>
      )}

      {tab === "channels" && (
        <ChannelsPanel channels={data.channels} modelLabel={data.attributionModelLabel} />
      )}

      {tab === "content" && <ContentPanel content={data.content} />}

      {tab === "attribution" && (
        <AttributionPanel
          modelOptions={data.modelOptions}
          selectedModel={data.attributionModel}
          modelComparison={data.modelComparison}
          organicAssist={data.organicAssist}
          journeyFlows={data.journeyFlows}
          lookbackWindowDays={data.lookbackWindowDays}
          disclaimer={data.disclaimer}
          attributionConfidence={data.attributionConfidence}
          unattributed={data.unattributed}
        />
      )}

      {tab === "funnels" && <FunnelPanel funnel={data.funnel} />}

      {tab === "conversions" && <ConversionsPanel conversions={data.conversions} />}

      {tab === "revenue" && (
        <RevenuePanel revenue={data.revenue} unattributed={data.unattributed} />
      )}
    </div>
  );
}

export function UnifiedAnalyticsWorkspace({ tab }: { tab: UnifiedAnalyticsTab }) {
  return (
    <MarketingDateRangeProvider>
      <UnifiedAnalyticsWorkspaceContent tab={tab} />
    </MarketingDateRangeProvider>
  );
}
