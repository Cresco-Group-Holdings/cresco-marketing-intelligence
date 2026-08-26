"use client";

import { RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { MetricCardGrid } from "@/components/command-centre/metric-card";
import { ModuleErrorBoundary } from "@/components/command-centre/module-panel";
import { TodaysPrioritiesPanel } from "@/components/command-centre/priority-item";
import { Button, ButtonLink } from "@/components/ui/button";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { WorkspaceErrorState } from "@/components/layout/workspace-empty-state";
import { BrandContextReadinessPanel } from "@/components/content-intelligence/brand-context-readiness";
import { ContentOpportunityCard } from "@/components/content-intelligence/content-opportunity-card";
import { NextContentRecommendationPanel } from "@/components/content-intelligence/next-content-recommendation";
import { ContentPipelinePanel } from "@/components/content-intelligence/content-pipeline-panel";
import { useContentIntelligence } from "@/components/content-intelligence/use-content-intelligence";

export function ContentStudioOverview() {
  const { data, loading, error, timedOut, reload } = useContentIntelligence();

  if (loading && !data) return <DashboardSkeleton />;

  if ((error || timedOut) && !data) {
    return (
      <WorkspaceErrorState
        title={timedOut ? "Loading is taking longer than expected" : "We couldn't load Content Studio"}
        description={error ?? "Check your connection and try again."}
        onRetry={reload}
      />
    );
  }

  if (!data?.hasBrandContext) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Content Studio"
          description="Intelligence-led content production from brand knowledge to publishing."
        />
        <WorkspaceErrorState
          title="Select a brand to continue"
          description="Content Intelligence requires an active brand workspace."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Content Studio"
        description="Intelligence-led content production from brand knowledge to publishing."
        actions={
          <>
            <ButtonLink href="/content/studio/create" size="sm">
              Create content
            </ButtonLink>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={reload}
              disabled={loading}
              aria-label="Refresh"
            >
              <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            </Button>
          </>
        }
      />

      <MetricCardGrid metrics={data.kpis} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <ModuleErrorBoundary moduleName="Content priorities">
            <TodaysPrioritiesPanel
              emptyTitle="No content priorities"
              emptyDescription="Your content pipeline looks clear. New opportunities will appear as performance data and campaigns evolve."
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

          {data.nextRecommendation ? (
            <NextContentRecommendationPanel recommendation={data.nextRecommendation} />
          ) : null}

          <ContentPipelinePanel items={data.pipeline} />
        </div>

        <div className="space-y-4">
          <BrandContextReadinessPanel readiness={data.brandReadiness} />
          {data.opportunities[0] ? (
            <ContentOpportunityCard opportunity={data.opportunities[0]} featured />
          ) : null}
        </div>
      </div>
    </div>
  );
}
