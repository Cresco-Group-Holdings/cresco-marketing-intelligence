"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CommandCentreHeader } from "@/components/marketing/command-centre-header";
import { MarketingDateRangeProvider } from "@/components/marketing/marketing-date-range-provider";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api/client";
import type { MarketingCommandCentreData } from "@/server/services/marketing-command-centre-service";
import { useLoadingTimeout } from "@/hooks/use-loading-timeout";
import { MetricCardGrid, type MetricCardData } from "@/components/command-centre/metric-card";
import { HealthScore } from "@/components/command-centre/health-score";
import { TodaysPrioritiesPanel } from "@/components/command-centre/priority-item";
import {
  FeaturedRecommendation,
  RecommendationsPanel,
} from "@/components/command-centre/recommendation-card";
import { ChannelPerformancePanel } from "@/components/command-centre/channel-performance-row";
import { PerformanceOverviewChart } from "@/components/command-centre/performance-overview-chart";
import { MarketingFunnelPanel } from "@/components/command-centre/marketing-funnel-panel";
import { RecentActivityPanel } from "@/components/command-centre/recent-activity-panel";
import { ModuleErrorBoundary, ModulePanel } from "@/components/command-centre/module-panel";
import { buildChannelPerformanceRows, buildOrganicChannelPerformanceRows } from "@/lib/command-centre/metrics";
import type {
  ChannelPerformanceMetric,
  ChannelPerformanceMode,
  OrganicChannelPerformanceMetric,
} from "@/lib/command-centre/types";
import { useCommandCentrePreviewData } from "@/components/marketing/command-centre-preview-context";

const PAID_CHANNEL_META = [
  { key: "GOOGLE_ADS", label: "Google Ads", href: "/advertising/google", connectHref: "/connectors/google-ads" },
  { key: "META", label: "Meta Ads", href: "/advertising/meta", connectHref: "/connectors/meta-ads" },
  { key: "TIKTOK", label: "TikTok Ads", href: "/advertising/tiktok", connectHref: "/connectors/tiktok-ads" },
  { key: "LINKEDIN", label: "LinkedIn Ads", href: "/advertising/linkedin", connectHref: "/connectors/linkedin-ads" },
] as const;

import type { MetricDisplayState } from "@/lib/command-centre/types";

function toMetricCardState(state: MetricDisplayState | undefined): MetricCardData["state"] {
  return state;
}

function mapExecutiveKpis(metrics: MarketingCommandCentreData["executiveKpis"]): MetricCardData[] {
  return metrics.map((metric) => ({
    label: metric.label,
    value: metric.value,
    change: metric.change,
    comparisonLabel: metric.comparisonLabel,
    sparkline: metric.sparkline,
    state: toMetricCardState(metric.state),
    stateMessage: metric.stateMessage,
    invertTrend: metric.label === "Total Spend",
    absoluteChange: metric.label === "Marketing Health",
  }));
}

function CommandCentreDashboardContent() {
  const searchParams = useSearchParams();
  const previewData = useCommandCentrePreviewData();
  const [data, setData] = useState<MarketingCommandCentreData | null>(previewData ?? null);
  const [loading, setLoading] = useState(!previewData);
  const [error, setError] = useState<string | null>(null);
  const [channelMetric, setChannelMetric] = useState<ChannelPerformanceMetric>("spend");
  const [organicChannelMetric, setOrganicChannelMetric] =
    useState<OrganicChannelPerformanceMetric>("reach");
  const [channelMode, setChannelMode] = useState<ChannelPerformanceMode>("paid");
  const { timedOut, reset: resetTimeout } = useLoadingTimeout(loading && !data);

  const loadDashboard = useCallback(async () => {
    if (previewData) {
      setData(previewData);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    resetTimeout();
    try {
      const query = searchParams.toString();
      const response = await apiFetch<{ dashboard: MarketingCommandCentreData }>(
        `/api/dashboard/command-centre${query ? `?${query}` : ""}`,
      );
      setData(response.dashboard);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  }, [previewData, searchParams, resetTimeout]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const paidChannelRows = useMemo(() => {
    if (!data) return [];
    const channels = PAID_CHANNEL_META.map((channel) => {
      const paidChannel = data.paidChannels.find((item) => item.label === channel.label);
      return {
        key: channel.key,
        label: channel.label,
        href: channel.href,
        connectHref: channel.connectHref,
        connected: paidChannel?.connectionState === "connected",
        hasError: paidChannel?.connectionState === "error",
      };
    });
    return buildChannelPerformanceRows(
      data.channelProviders,
      channels,
      channelMetric,
      data.currency,
      data.dateRange.comparisonLabel,
      data.previousChannelProviders,
    );
  }, [data, channelMetric]);

  const organicChannelRows = useMemo(() => {
    if (!data?.organicChannelPerformance) return [];
    return buildOrganicChannelPerformanceRows(
      data.organicChannelPerformance,
      data.previousOrganicChannelPerformance,
      organicChannelMetric,
      data.dateRange.comparisonLabel,
    );
  }, [data, organicChannelMetric]);

  const channelRows = channelMode === "paid" ? paidChannelRows : organicChannelRows;

  if (loading && !data && !timedOut) {
    return <DashboardSkeleton />;
  }

  if ((error && !data) || (timedOut && !data)) {
    return (
      <ErrorState
        title="Command Centre unavailable"
        description={error ?? "Loading took longer than expected."}
        onRetry={() => void loadDashboard()}
      />
    );
  }

  if (!data) {
    return null;
  }

  const executiveKpis = mapExecutiveKpis(data.executiveKpis);
  const featuredInsight = data.insights[0] ?? null;

  return (
    <div className="space-y-5">
      <CommandCentreHeader
        dateLabel={data.dateRange.label}
        freshness={data.freshness}
        coverage={data.coverage}
      />

      <MetricCardGrid metrics={executiveKpis} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ModuleErrorBoundary moduleName="Today's Priorities">
            <ModulePanel
              tier="executive"
              title="Today's Priorities"
              subtitle="Items requiring your attention, sorted by urgency."
            >
              <TodaysPrioritiesPanel priorities={data.priorities} />
            </ModulePanel>
          </ModuleErrorBoundary>
        </div>

        <ModuleErrorBoundary moduleName="Marketing Health">
          <HealthScore
            health={data.health}
            change={data.healthChange}
            comparisonLabel={data.dateRange.comparisonLabel}
            unavailable={!data.hasBrandContext}
          />
        </ModuleErrorBoundary>
      </div>

      {featuredInsight ? (
        <ModuleErrorBoundary moduleName="Top recommendation">
          <ModulePanel tier="actionable" title="Top Recommendation" subtitle="Highest-value opportunity from Cresco Intelligence.">
            <FeaturedRecommendation signal={featuredInsight} />
          </ModulePanel>
        </ModuleErrorBoundary>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <ModuleErrorBoundary moduleName="Channel performance" onRetry={() => void loadDashboard()}>
          <ModulePanel
            tier="analytical"
            title="Channel Performance"
            subtitle={
              channelMode === "paid"
                ? "Cross-channel paid media comparison."
                : "Organic social reach and engagement by channel."
            }
            actions={
              <ButtonLink href={channelMode === "paid" ? "/analytics" : "/organic-social/growth"} variant="outline" size="sm">
                View analytics
              </ButtonLink>
            }
          >
            <ChannelPerformancePanel
              rows={channelRows}
              mode={channelMode}
              onModeChange={(mode) => {
                setChannelMode(mode);
                if (mode === "organic") {
                  setOrganicChannelMetric("reach");
                } else {
                  setChannelMetric("spend");
                }
              }}
              metric={channelMode === "paid" ? channelMetric : organicChannelMetric}
              onMetricChange={(nextMetric) => {
                if (channelMode === "paid") {
                  setChannelMetric(nextMetric as ChannelPerformanceMetric);
                } else {
                  setOrganicChannelMetric(nextMetric as OrganicChannelPerformanceMetric);
                }
              }}
              emptyMessage={
                channelMode === "paid"
                  ? "Connect paid advertising accounts to compare performance across Google Ads, Meta, LinkedIn, and TikTok."
                  : "Connect organic social accounts to compare reach and engagement across LinkedIn, Instagram, X, and other channels."
              }
            />
          </ModulePanel>
        </ModuleErrorBoundary>

        <ModuleErrorBoundary moduleName="Marketing funnel" onRetry={() => void loadDashboard()}>
          <ModulePanel
            tier="analytical"
            title="Marketing Funnel"
            subtitle="Impressions through revenue for the selected period."
          >
            <MarketingFunnelPanel stages={data.funnel} />
          </ModulePanel>
        </ModuleErrorBoundary>
      </div>

      <ModuleErrorBoundary moduleName="Performance overview" onRetry={() => void loadDashboard()}>
        <ModulePanel
          tier="analytical"
          title="Performance Overview"
          subtitle="Revenue, conversions, and spend trends."
        >
          <PerformanceOverviewChart
            data={data.performanceOverview}
            currency={data.currency}
            loading={loading}
            emptyMessage="Connect revenue and advertising sources to view performance trends for this period."
          />
        </ModulePanel>
      </ModuleErrorBoundary>

      {data.insights.length > 1 ? (
        <ModuleErrorBoundary moduleName="Cresco AI Recommendations">
          <ModulePanel
            tier="actionable"
            title="More Recommendations"
            subtitle="Additional evidence-based insights from your connected marketing data."
            actions={
              <ButtonLink href="/growth" variant="outline" size="sm">
                View all
              </ButtonLink>
            }
          >
            <RecommendationsPanel
              insights={data.insights}
              emptyDescription="Connect marketing data sources to unlock Cresco AI recommendations."
              emptyAction={
                <ButtonLink href="/integrations" variant="outline" size="sm">
                  Review integrations
                </ButtonLink>
              }
            />
          </ModulePanel>
        </ModuleErrorBoundary>
      ) : null}

      <ModuleErrorBoundary moduleName="Recent activity" onRetry={() => void loadDashboard()}>
        <ModulePanel
          tier="history"
          title="Recent Activity"
          subtitle="Informational history — not an action queue."
          actions={
            <ButtonLink href="/operations" variant="outline" size="sm">
              View all
            </ButtonLink>
          }
        >
          <RecentActivityPanel activities={data.recentActivity} />
        </ModulePanel>
      </ModuleErrorBoundary>

      {!data.hasBrandContext ? (
        <EmptyState
          title="Select a brand to unlock your Command Centre"
          description="Choose an organisation, project, and brand to view marketing performance, priorities, and recommendations for your workspace."
          action={
            <ButtonLink href="/settings" variant="outline" size="sm">
              Configure workspace
            </ButtonLink>
          }
        />
      ) : null}
    </div>
  );
}

export function CommandCentreDashboard() {
  return (
    <MarketingDateRangeProvider>
      <CommandCentreDashboardContent />
    </MarketingDateRangeProvider>
  );
}
