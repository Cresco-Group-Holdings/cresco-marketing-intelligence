"use client";

import { PageHeader } from "@/components/layout/page-header";
import { buildCommunityOpportunityArchitecture } from "@/lib/organic-growth/community";
import { useOrganicGrowthEngine } from "@/components/organic-growth/use-organic-growth-engine";
import { WorkspaceErrorState } from "@/components/layout/workspace-empty-state";
import { ButtonLink } from "@/components/ui/button";
import { DashboardSkeleton } from "@/components/ui/skeleton";

export function CommunityWorkspace() {
  const { data, loading, error, reload } = useOrganicGrowthEngine();
  const architecture = buildCommunityOpportunityArchitecture();

  if (loading && !data) return <DashboardSkeleton />;
  if (error && !data) {
    return <WorkspaceErrorState title="Community unavailable" description={error} onRetry={reload} />;
  }
  if (!data) return null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Community Intelligence"
        description="Discover relevant public conversations worth joining — all responses require human approval."
      />
      <section className="rounded-xl border border-border bg-surface-elevated p-4">
        <p className="text-sm text-foreground-muted">
          Community actions require human review. Cresco does not post replies automatically.
        </p>
        <p className="mt-2 text-xs text-foreground-subtle">
          Supported sources (when connected): {architecture.supportedSources.join(", ")}
        </p>
      </section>
      {data.communityOpportunities.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface-subtle px-4 py-8 text-center">
          <p className="text-sm font-medium text-foreground">No conversation sources connected</p>
          <p className="mt-1 text-sm text-foreground-muted">
            Connect X, LinkedIn or Reddit to surface high-relevance community opportunities. All
            suggested responses remain draft until you approve them.
          </p>
          <ButtonLink href="/integrations" variant="outline" size="sm" className="mt-4">
            Connect sources
          </ButtonLink>
        </div>
      ) : (
        <ul className="space-y-3">
          {data.communityOpportunities.map((item) => (
            <li key={item.id} className="rounded-xl border border-border bg-surface-elevated p-4">
              <p className="text-sm font-medium text-foreground">{item.topic}</p>
              <p className="mt-1 text-xs text-foreground-muted">
                {item.source} · Relevance: {item.relevance}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
