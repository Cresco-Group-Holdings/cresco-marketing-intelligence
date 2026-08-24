"use client";

import { RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { MetricCardGrid } from "@/components/command-centre/metric-card";
import { ModuleErrorBoundary } from "@/components/command-centre/module-panel";
import { TodaysPrioritiesPanel } from "@/components/command-centre/priority-item";
import { FeaturedRecommendation } from "@/components/command-centre/recommendation-card";
import { ChannelPerformanceRow } from "@/components/command-centre/channel-performance-row";
import { DataFreshness } from "@/components/command-centre/data-freshness";
import { MarketingDateRangeProvider } from "@/components/marketing/marketing-date-range-provider";
import { DateRangeSelector } from "@/components/marketing/date-range-selector";
import { OrganicEmptyState, WorkspaceErrorState } from "@/components/layout/workspace-empty-state";
import { GrowthScorePanel } from "@/components/organic-growth/growth-score-panel";
import { WinningContentPanel } from "@/components/organic-growth/winning-content-panel";
import { useOrganicGrowthEngine } from "@/components/organic-growth/use-organic-growth-engine";
import { Button, ButtonLink } from "@/components/ui/button";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import type { MarketingSignal } from "@/lib/marketing-intelligence/types";

function toFeaturedSignal(
  data: NonNullable<ReturnType<typeof useOrganicGrowthEngine>["data"]>,
): MarketingSignal | null {
  if (data.topOpportunity) {
    return {
      id: data.topOpportunity.id,
      type: "organic",
      severity: "medium",
      title: data.topOpportunity.title,
      explanation: data.topOpportunity.finding,
      evidence: data.topOpportunity.evidence,
      estimatedImpact: data.topOpportunity.potentialImpact,
      action: data.topOpportunity.action,
      category: "organic",
      generatedAt: new Date().toISOString(),
      confidence: 0.75,
    };
  }
  return data.insights[0] ?? null;
}

export function OrganicOverviewDashboard() {
  const { data, loading, error, timedOut, reload } = useOrganicGrowthEngine();

  if (loading && !data) {
    return <DashboardSkeleton />;
  }

  if ((error || timedOut) && !data) {
    return (
      <WorkspaceErrorState
        title={timedOut ? "Loading is taking longer than expected" : "We couldn't load this workspace"}
        description={error ?? "Check your connection and try again."}
        onRetry={reload}
      />
    );
  }

  if (!data) return null;

  const hasConnections = !data.coverage.startsWith("0 ");

  if (!data.hasBrandContext || !hasConnections) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Organic Social"
          description="Grow your audience, distribute content and discover organic opportunities."
          actions={
            <>
              <DateRangeSelector />
              <ButtonLink href="/organic-social/accounts" variant="organic" size="sm">
                Connect accounts
              </ButtonLink>
            </>
          }
        />
        <OrganicEmptyState />
      </div>
    );
  }

  const featured = toFeaturedSignal(data);
  const kpiMetrics = data.executiveKpis.map((kpi) => ({
    label: kpi.label,
    value: kpi.value,
    change: kpi.change,
    comparisonLabel: kpi.comparisonLabel,
    state: kpi.state,
    stateMessage: kpi.stateMessage,
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Organic Social"
        description="Grow your audience, distribute content and discover organic opportunities."
        actions={
          <>
            <DateRangeSelector />
            <ButtonLink href="/organic-social/accounts" variant="outline" size="sm" className="hidden sm:inline-flex">
              Accounts
            </ButtonLink>
            <ButtonLink href="/content/studio/new" variant="organic" size="sm">
              Create content
            </ButtonLink>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={reload}
              disabled={loading}
              aria-label="Refresh data"
              className="hidden sm:inline-flex"
            >
              <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden="true" />
            </Button>
          </>
        }
      />

      <DataFreshness label={data.freshness.label} state={data.freshness.state} detail={data.coverage} />

      <MetricCardGrid metrics={kpiMetrics} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ModuleErrorBoundary moduleName="Organic priorities">
            <TodaysPrioritiesPanel
              priorities={data.priorities.map((p) => ({
                id: p.id,
                type: "content" as const,
                title: p.title,
                urgency: p.urgency,
                context: p.context,
                action: p.action,
              }))}
            />
          </ModuleErrorBoundary>
        </div>
        <ModuleErrorBoundary moduleName="Organic Growth Score">
          <GrowthScorePanel score={data.growthScore} />
        </ModuleErrorBoundary>
      </div>

      {featured ? (
        <ModuleErrorBoundary moduleName="Top recommendation">
          <FeaturedRecommendation signal={featured} />
        </ModuleErrorBoundary>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <ModuleErrorBoundary moduleName="Channel performance">
          <section className="overflow-hidden rounded-xl border border-border bg-surface-elevated">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">Channel performance</h2>
            </div>
            <div className="divide-y divide-border">
              {data.channelMetrics.map((channel) => (
                <div key={channel.provider} className="px-4 py-2">
                  <ChannelPerformanceRow
                    row={{
                      key: channel.provider,
                      label: channel.label,
                      provider: channel.provider,
                      connected: channel.connected,
                      metricValue:
                        channel.reach != null ? channel.reach.toLocaleString("en-GB") : "—",
                      change: null,
                      status: channel.connected ? "healthy" : "disconnected",
                      relativePerformance: channel.engagementRate ?? 0,
                      href: "/organic-social/growth",
                      connectHref: "/organic-social/accounts",
                    }}
                  />
                </div>
              ))}
            </div>
          </section>
        </ModuleErrorBoundary>

        <ModuleErrorBoundary moduleName="Publishing consistency">
          <section className="rounded-xl border border-border bg-surface-elevated p-4">
            <h2 className="text-sm font-semibold text-foreground">Publishing consistency</h2>
            {data.consistencyGaps.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {data.consistencyGaps.map((gap) => (
                  <li key={gap.channel} className="text-sm text-warning">
                    {gap.message}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-foreground-muted">
                Publishing cadence looks healthy for the selected period.
              </p>
            )}
          </section>
        </ModuleErrorBoundary>
      </div>

      <WinningContentPanel items={data.winningContent} />
    </div>
  );
}

export function OrganicOverviewDashboardPage() {
  return (
    <MarketingDateRangeProvider>
      <OrganicOverviewDashboard />
    </MarketingDateRangeProvider>
  );
}
