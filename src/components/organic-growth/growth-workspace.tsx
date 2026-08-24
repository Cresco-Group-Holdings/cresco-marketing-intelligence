"use client";

import { PageHeader } from "@/components/layout/page-header";
import { GrowthScorePanel } from "@/components/organic-growth/growth-score-panel";
import { OpportunityCard } from "@/components/organic-growth/opportunity-card";
import { WinningContentPanel } from "@/components/organic-growth/winning-content-panel";
import { useOrganicGrowthEngine } from "@/components/organic-growth/use-organic-growth-engine";
import { WorkspaceErrorState } from "@/components/layout/workspace-empty-state";
import { DashboardSkeleton } from "@/components/ui/skeleton";

export function GrowthWorkspace() {
  const { data, loading, error, reload } = useOrganicGrowthEngine();

  if (loading && !data) return <DashboardSkeleton />;
  if (error && !data) {
    return <WorkspaceErrorState title="Growth unavailable" description={error} onRetry={reload} />;
  }
  if (!data) return null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Organic Growth Intelligence"
        description="Follower momentum, channel contribution, opportunities, and experiments."
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <GrowthScorePanel score={data.growthScore} className="lg:col-span-1" />
        <section className="lg:col-span-2 rounded-xl border border-border bg-surface-elevated p-4">
          <h2 className="text-sm font-semibold text-foreground">Growth opportunities</h2>
          {data.opportunities.length === 0 ? (
            <p className="mt-2 text-sm text-foreground-muted">
              Connect accounts and publish content to unlock growth opportunities.
            </p>
          ) : (
            <div className="mt-3 grid gap-3">
              {data.opportunities.slice(0, 4).map((opportunity) => (
                <OpportunityCard key={opportunity.id} opportunity={opportunity} />
              ))}
            </div>
          )}
        </section>
      </div>
      {data.bestTimeWindows.length > 0 ? (
        <section className="rounded-xl border border-border bg-surface-elevated p-4">
          <h2 className="text-sm font-semibold text-foreground">Best time to post</h2>
          <ul className="mt-3 space-y-2">
            {data.bestTimeWindows.map((window) => (
              <li key={`${window.channel}-${window.dayOfWeek}`} className="text-sm text-foreground-muted">
                <span className="font-medium text-foreground">{window.channel}</span> — {window.dayOfWeek}{" "}
                {window.hourRange}: {window.engagementLift.toFixed(1)}× baseline ({window.confidence}{" "}
                confidence, n={window.sampleSize})
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <WinningContentPanel items={data.winningContent} />
    </div>
  );
}
