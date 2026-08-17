"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CommandCentreHeader } from "@/components/marketing/command-centre-header";
import { ExecutiveKpiStrip } from "@/components/marketing/marketing-metric-card";
import { MarketingSection } from "@/components/marketing/marketing-section";
import { PaidChannelCard, OrganicChannelCard } from "@/components/marketing/channel-card";
import { PaidPerformanceChart } from "@/components/marketing/paid-performance-chart";
import { PublishingQueue, ContentCalendarPreview } from "@/components/marketing/publishing-queue";
import { AIIntelligenceFeed } from "@/components/marketing/ai-insight-card";
import { MarketingDateRangeProvider } from "@/components/marketing/marketing-date-range-provider";
import { ButtonLink } from "@/components/ui/button";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api/client";
import type { MarketingCommandCentreData } from "@/server/services/marketing-command-centre-service";

function SummaryMetrics({ metrics }: { metrics: Array<{ label: string; value: string }> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {metrics.map((metric) => (
        <div key={metric.label} className="rounded-lg border border-border bg-surface-elevated px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-foreground-subtle">{metric.label}</p>
          <p className="mt-1 text-lg font-semibold text-foreground">{metric.value}</p>
        </div>
      ))}
    </div>
  );
}

function HealthBreakdown({
  health,
}: {
  health: NonNullable<MarketingCommandCentreData["health"]>;
}) {
  return (
    <div className="mt-4 rounded-xl border border-border bg-surface-elevated p-4">
      <p className="text-sm font-semibold text-foreground">Marketing Health breakdown</p>
      <dl className="mt-3 space-y-2">
        {health.components.map((component) => (
          <div key={component.key} className="flex items-start justify-between gap-4 text-sm">
            <div>
              <dt className="font-medium text-foreground">{component.label}</dt>
              <dd className="text-xs text-foreground-muted">{component.detail}</dd>
            </div>
            <dd className="shrink-0 font-semibold text-foreground">
              {component.score} / {component.maxScore}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function CommandCentreDashboardContent() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<MarketingCommandCentreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
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
  }, [searchParams]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

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

  if (!data) {
    return null;
  }

  return (
    <div className="space-y-6">
      <CommandCentreHeader
        dateLabel={data.dateRange.label}
        freshness={data.freshness}
        coverage={data.coverage}
      />

      <ExecutiveKpiStrip metrics={data.executiveKpis} />

      {data.health ? <HealthBreakdown health={data.health} /> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <MarketingSection
            title="Paid Advertising"
            subtitle="Drive performance and measurable growth."
            accent="paid"
            actions={
              <>
                <ButtonLink href="/advertising/plans/new" variant="paid" size="sm">
                  Launch Campaign
                </ButtonLink>
                <ButtonLink href="/advertising/budgets" variant="outline" size="sm">
                  Adjust Budget
                </ButtonLink>
                <ButtonLink href="/advertising/audiences/new" variant="outline" size="sm">
                  Create Audience
                </ButtonLink>
                <ButtonLink href="/advertising" variant="outline" size="sm">
                  View Campaigns
                </ButtonLink>
              </>
            }
          >
            {data.paidSummary ? (
              <SummaryMetrics
                metrics={[
                  { label: "Spend", value: data.paidSummary.spend },
                  { label: "ROAS", value: data.paidSummary.roas },
                  { label: "Conversions", value: data.paidSummary.conversions },
                  { label: "CPA", value: data.paidSummary.cpa },
                  { label: "Active campaigns", value: data.paidSummary.activeCampaigns },
                ]}
              />
            ) : null}

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {data.paidChannels.map((channel) => (
                <PaidChannelCard
                  key={channel.key}
                  title={channel.label}
                  metrics={channel.metrics}
                  connectionState={channel.connectionState}
                  emptyMessage={channel.emptyMessage}
                  ctaLabel={channel.ctaLabel}
                  ctaHref={channel.href}
                  connectHref={channel.connectHref}
                  connectLabel={`Connect ${channel.label}`}
                  statusLabel={channel.statusLabel}
                />
              ))}
            </div>

            <div className="mt-6">
              <PaidPerformanceChart
                data={data.paidChart}
                currency={data.currency}
                loading={loading}
                emptyMessage={
                  data.hasPaidConnections
                    ? "Paid performance trends will appear after sync completes."
                    : "Connect paid advertising accounts to view performance trends."
                }
              />
            </div>
          </MarketingSection>
        </div>

        <div className="space-y-6">
          <MarketingSection
            title="Organic Social & Reels"
            subtitle="Build community. Share value. Grow organically."
            accent="organic"
            actions={
              <>
                <ButtonLink href="/publishing" variant="organic" size="sm">
                  Upload Reels
                </ButtonLink>
                <ButtonLink href="/publishing" variant="outline" size="sm">
                  Create Post
                </ButtonLink>
                <ButtonLink href="/calendar" variant="outline" size="sm">
                  Open Calendar
                </ButtonLink>
                <ButtonLink href="/content/studio" variant="outline" size="sm">
                  Content Studio
                </ButtonLink>
              </>
            }
          >
            {data.organicSummary ? (
              <SummaryMetrics
                metrics={[
                  { label: "Reach", value: data.organicSummary.reach },
                  { label: "Engagement", value: data.organicSummary.engagement },
                  { label: "Profile visits", value: data.organicSummary.profileVisits },
                  { label: "Shares", value: data.organicSummary.shares },
                  { label: "Posts published", value: data.organicSummary.postsPublished },
                ]}
              />
            ) : null}

            <div className="mt-6 grid gap-4">
              {data.organicChannels.map((channel) => (
                <OrganicChannelCard
                  key={channel.provider}
                  title={channel.title}
                  metrics={channel.metrics}
                  connectionState={channel.connectionState}
                  emptyMessage={channel.emptyMessage}
                  ctaLabel={channel.ctaLabel}
                  ctaHref={channel.ctaHref}
                  connectHref={channel.connectHref}
                  connectLabel={channel.connectLabel}
                />
              ))}
            </div>
          </MarketingSection>

          <MarketingSection title="Publishing Queue" accent="organic">
            <PublishingQueue
              items={data.publishingQueue}
              emptyMessage={
                data.hasOrganicConnections
                  ? "No content scheduled yet."
                  : "Connect your social channels to start publishing content."
              }
            />
          </MarketingSection>

          <MarketingSection title="Content Calendar" accent="organic">
            <ContentCalendarPreview
              days={data.calendarPreview}
              emptyMessage="No upcoming calendar events."
            />
          </MarketingSection>
        </div>
      </div>

      <MarketingSection
        title="Cresco AI Intelligence"
        subtitle="Deterministic recommendations with evidence from your connected marketing data."
        accent="neutral"
        actions={
          <>
            <ButtonLink href="/growth" variant="outline" size="sm">
              View all intelligence
            </ButtonLink>
            <ButtonLink href="/analyst" variant="outline" size="sm">
              Ask Cresco AI
            </ButtonLink>
          </>
        }
      >
        <AIIntelligenceFeed
          insights={data.insights}
          emptyMessage="Connect marketing data sources to unlock Cresco AI recommendations."
        />
      </MarketingSection>
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
