"use client";

import { PageHeader } from "@/components/layout/page-header";
import { WinningContentPanel } from "@/components/organic-growth/winning-content-panel";
import { useOrganicGrowthEngine } from "@/components/organic-growth/use-organic-growth-engine";
import { WorkspaceErrorState } from "@/components/layout/workspace-empty-state";
import { ButtonLink } from "@/components/ui/button";
import { DashboardSkeleton } from "@/components/ui/skeleton";

export function ContentPerformanceWorkspace() {
  const { data, loading, error, reload } = useOrganicGrowthEngine();

  if (loading && !data) return <DashboardSkeleton />;
  if (error && !data) {
    return (
      <WorkspaceErrorState
        title="Content performance unavailable"
        description={error}
        onRetry={reload}
      />
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Content performance"
        description="Top and bottom performers, formats, themes, and repurposing lineage."
        actions={
          <ButtonLink href="/content/studio/new" variant="organic" size="sm">
            Create content
          </ButtonLink>
        }
      />
      <section className="overflow-hidden rounded-xl border border-border bg-surface-elevated">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">All content</h2>
        </div>
        {data.contentPerformance.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm font-medium text-foreground">No content performance yet</p>
            <p className="mt-1 text-sm text-foreground-muted">
              Publish or sync at least one social post to start building your organic performance
              baseline.
            </p>
            <ButtonLink href="/organic-social/publishing" variant="outline" size="sm" className="mt-4">
              Review publishing
            </ButtonLink>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {data.contentPerformance.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                  <p className="text-xs text-foreground-muted">
                    {item.channel}
                    {item.format ? ` · ${item.format}` : ""} · {item.status}
                  </p>
                </div>
                <div className="text-right text-xs tabular-nums text-foreground-muted">
                  {item.engagements != null ? `${item.engagements} eng.` : "—"}
                  {item.isWinning ? (
                    <span className="ml-2 rounded-full bg-organic-accent/10 px-2 py-0.5 text-organic-accent">
                      Winning
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <WinningContentPanel items={data.winningContent} />
    </div>
  );
}
