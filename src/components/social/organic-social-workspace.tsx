"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RefreshCw, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ExecutiveKpiStrip } from "@/components/marketing/marketing-metric-card";
import { AIIntelligenceFeed } from "@/components/marketing/ai-insight-card";
import { MarketingDateRangeProvider } from "@/components/marketing/marketing-date-range-provider";
import { DateRangeSelector } from "@/components/marketing/date-range-selector";
import { OrganicChannelPanel } from "@/components/social/organic-channel-panel";
import { FormatPerformancePanel } from "@/components/social/format-performance-panel";
import { PublishingQueuePanel } from "@/components/social/publishing-queue-panel";
import { Button, ButtonLink } from "@/components/ui/button";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api/client";
import type { OrganicSocialWorkspaceData } from "@/lib/organic-social/types";

function ConsistencyPanel({
  consistency,
  scheduleGaps,
}: {
  consistency: OrganicSocialWorkspaceData["consistency"];
  scheduleGaps: OrganicSocialWorkspaceData["scheduleGaps"];
}) {
  return (
    <section className="rounded-xl border border-border bg-surface-elevated p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-foreground">Publishing consistency</h2>
      <p className="mt-2 text-3xl font-semibold text-foreground">{consistency.score} / 100</p>
      <ul className="mt-4 space-y-2">
        {consistency.channels.map((channel) => (
          <li
            key={channel.channel}
            className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          >
            <span className="text-foreground">{channel.channel}</span>
            <span className="text-foreground-muted">{channel.label}</span>
          </li>
        ))}
      </ul>
      {scheduleGaps.length > 0 ? (
        <ul className="mt-4 space-y-2 text-xs text-warning">
          {scheduleGaps.map((gap) => (
            <li key={gap.channel}>{gap.message}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function PublishRecommendation({
  recommendation,
}: {
  recommendation: OrganicSocialWorkspaceData["publishRecommendation"];
}) {
  if (!recommendation) return null;
  return (
    <section className="rounded-xl border border-organic-accent/20 bg-surface-elevated p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 h-5 w-5 text-organic-accent" aria-hidden="true" />
        <div>
          <h2 className="text-sm font-semibold text-foreground">What to publish next</h2>
          <p className="mt-2 text-sm text-foreground-muted">
            <span className="font-medium text-foreground">{recommendation.format}</span> on{" "}
            {recommendation.channel}
          </p>
          <p className="mt-1 text-sm text-foreground-muted">{recommendation.reason}</p>
          <ButtonLink
            href="/content/studio/new"
            variant="organic"
            size="sm"
            className="mt-3"
          >
            Create content
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

function OrganicSocialWorkspaceContent() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<OrganicSocialWorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = searchParams.toString();
      const response = await apiFetch<{ workspace: OrganicSocialWorkspaceData }>(
        `/api/social/workspace${query ? `?${query}` : ""}`,
      );
      setData(response.workspace);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load organic social workspace.");
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
      <div className="rounded-xl border border-danger/30 bg-danger-muted p-6 text-sm text-danger">
        {error}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organic Social"
        description="Create, publish and grow across every organic social channel."
        actions={
          <>
            <DateRangeSelector />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadWorkspace}
              disabled={loading}
              aria-label="Refresh data"
            >
              <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden="true" />
            </Button>
            <ButtonLink href={data.primaryCta.href} variant="organic" size="sm">
              {data.primaryCta.label}
            </ButtonLink>
            <ButtonLink href="/content/studio/new?repurpose=1" variant="outline" size="sm">
              Repurpose with Cresco AI
            </ButtonLink>
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-3 text-xs text-foreground-subtle">
        <span>{data.coverage}</span>
        <span aria-hidden="true">·</span>
        <span>{data.freshness.label}</span>
        {data.partialCoverageNote ? (
          <>
            <span aria-hidden="true">·</span>
            <span>{data.partialCoverageNote}</span>
          </>
        ) : null}
      </div>
      <ExecutiveKpiStrip metrics={data.executiveKpis} accent="organic" />
      <PublishRecommendation recommendation={data.publishRecommendation} />
      <div className="grid gap-6 xl:grid-cols-2">
        <OrganicChannelPanel channels={data.channels} />
        <FormatPerformancePanel formats={data.formatPerformance} />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <PublishingQueuePanel items={data.publishingQueue} />
        <ConsistencyPanel
          consistency={data.consistency}
          scheduleGaps={data.scheduleGaps}
        />
      </div>
      <section aria-labelledby="organic-intelligence-heading">
        <h2 id="organic-intelligence-heading" className="text-lg font-semibold text-foreground">
          Cresco recommendations
        </h2>
        <p className="mt-1 text-sm text-foreground-muted">
          Evidence-based organic and cross-channel signals.
        </p>
        <div className="mt-4">
          <AIIntelligenceFeed
            insights={data.insights}
            emptyMessage="No organic recommendations for the selected period."
          />
        </div>
      </section>
    </div>
  );
}

export function OrganicSocialWorkspace() {
  return (
    <MarketingDateRangeProvider>
      <OrganicSocialWorkspaceContent />
    </MarketingDateRangeProvider>
  );
}
