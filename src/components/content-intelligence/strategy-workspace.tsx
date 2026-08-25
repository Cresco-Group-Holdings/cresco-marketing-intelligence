"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { WorkspaceErrorState } from "@/components/layout/workspace-empty-state";
import { ContentOpportunityCard } from "@/components/content-intelligence/content-opportunity-card";
import { useContentIntelligence } from "@/components/content-intelligence/use-content-intelligence";
import { resolveObjectiveLabel } from "@/lib/content-intelligence/objectives";
import { resolveFunnelStageLabel } from "@/lib/content-intelligence/funnel-stages";

export function StrategyWorkspace() {
  const { data, loading, error, reload } = useContentIntelligence();

  if (loading && !data) return <DashboardSkeleton />;
  if (error && !data) {
    return <WorkspaceErrorState title="Couldn't load strategy" description={error} onRetry={reload} />;
  }
  if (!data) return null;

  const { strategy, opportunities, themes } = data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content Strategy"
        description="Structured plan connecting brand, audience, and channel mix."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Strategy overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <p className="text-xs text-foreground-subtle">Primary objective</p>
                <p>{resolveObjectiveLabel(strategy.primaryObjective)}</p>
              </div>
              <div>
                <p className="text-xs text-foreground-subtle">Funnel stage</p>
                <p>{resolveFunnelStageLabel(strategy.funnelStage)}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-foreground-subtle">Target audiences</p>
              <p>{strategy.targetAudienceLabels.join(", ") || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-foreground-subtle">Offers</p>
              <p>{strategy.offerLabels.join(", ") || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-foreground-subtle">Content pillars</p>
              <p>{strategy.contentPillars.map((p) => p.replace(/_/g, " ")).join(", ") || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-foreground-subtle">Channel mix</p>
              <p>
                Primary: {strategy.primaryChannels.join(", ") || "—"}
                {strategy.secondaryChannels.length > 0
                  ? ` · Secondary: ${strategy.secondaryChannels.join(", ")}`
                  : ""}
              </p>
            </div>
            {strategy.publishingCadence ? (
              <div>
                <p className="text-xs text-foreground-subtle">Publishing cadence</p>
                <p>{strategy.publishingCadence}</p>
              </div>
            ) : null}
            {strategy.narrative ? (
              <p className="text-foreground-muted">{strategy.narrative}</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Content pillars</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {themes.map((theme) => (
                <li key={theme.key} className="rounded-lg border border-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{theme.label}</p>
                      {theme.description ? (
                        <p className="text-xs text-foreground-muted">{theme.description}</p>
                      ) : null}
                    </div>
                    {theme.performanceSummary ? (
                      <span className="text-xs capitalize text-foreground-subtle">
                        {theme.performanceSummary.classification.replace(/_/g, " ")}
                      </span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium">Content opportunities</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {opportunities.slice(0, 4).map((opp) => (
            <ContentOpportunityCard key={opp.id} opportunity={opp} />
          ))}
        </div>
      </div>
    </div>
  );
}
