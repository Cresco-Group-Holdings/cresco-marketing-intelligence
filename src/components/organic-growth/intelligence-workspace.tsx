"use client";

import { PageHeader } from "@/components/layout/page-header";
import { RecommendationsPanel, FeaturedRecommendation } from "@/components/command-centre/recommendation-card";
import { OpportunityCard } from "@/components/organic-growth/opportunity-card";
import { useOrganicGrowthEngine } from "@/components/organic-growth/use-organic-growth-engine";
import { WorkspaceErrorState } from "@/components/layout/workspace-empty-state";
import { ButtonLink } from "@/components/ui/button";
import { DashboardSkeleton } from "@/components/ui/skeleton";

export function IntelligenceWorkspace() {
  const { data, loading, error, reload } = useOrganicGrowthEngine();

  if (loading && !data) return <DashboardSkeleton />;
  if (error && !data) {
    return (
      <WorkspaceErrorState title="Intelligence unavailable" description={error} onRetry={reload} />
    );
  }
  if (!data) return null;

  const featured = data.insights[0];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Organic Intelligence"
        description="Evidence-backed opportunities, risks, and recommendations for organic growth."
        actions={
          <ButtonLink href="/growth" variant="outline" size="sm">
            Cresco Intelligence
          </ButtonLink>
        }
      />
      {featured ? <FeaturedRecommendation signal={featured} /> : null}
      <RecommendationsPanel
        insights={data.insights}
        emptyTitle="No organic insights yet"
        emptyDescription="Connect social accounts and publish content to unlock Cresco recommendations."
        emptyAction={
          <ButtonLink href="/organic-social/accounts" variant="organic" size="sm">
            Connect accounts
          </ButtonLink>
        }
      />
      {data.opportunities.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Growth opportunities</h2>
          {data.opportunities.map((opportunity) => (
            <OpportunityCard key={opportunity.id} opportunity={opportunity} />
          ))}
        </section>
      ) : null}
    </div>
  );
}
