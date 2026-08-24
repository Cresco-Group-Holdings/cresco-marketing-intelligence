"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { PublicationComposerV2 } from "@/components/organic-growth/publication-composer-v2";
import { useOrganicGrowthEngine } from "@/components/organic-growth/use-organic-growth-engine";
import { WorkspaceErrorState } from "@/components/layout/workspace-empty-state";
import { ButtonLink } from "@/components/ui/button";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  awaiting_approval: "Awaiting approval",
  approved: "Approved",
  scheduled: "Scheduled",
  publishing: "Publishing",
  published: "Published",
  failed: "Failed",
  cancelled: "Cancelled",
};

export function PublishingWorkspace() {
  const { data, loading, error, reload } = useOrganicGrowthEngine();
  const [brandId, setBrandId] = useState<string | null>(null);
  const [organisationId, setOrganisationId] = useState<string | null>(null);

  useEffect(() => {
    async function loadContext() {
      try {
        const response = await fetch("/api/workspace");
        if (!response.ok) return;
        const json = (await response.json()) as {
          workspace?: {
            preference?: {
              currentBrandId?: string | null;
              currentOrganisationId?: string | null;
            };
          };
        };
        setBrandId(json.workspace?.preference?.currentBrandId ?? null);
        setOrganisationId(json.workspace?.preference?.currentOrganisationId ?? null);
      } catch {
        // Workspace context unavailable in preview mode
      }
    }
    void loadContext();
  }, []);

  if (loading && !data) return <DashboardSkeleton />;
  if (error && !data) {
    return (
      <WorkspaceErrorState title="Publishing unavailable" description={error} onRetry={reload} />
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Publishing"
        description="Compose, validate, schedule and publish channel-native content variants."
        actions={
          <ButtonLink href="/calendar" variant="outline" size="sm">
            Open calendar
          </ButtonLink>
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <PublicationComposerV2
          brandId={brandId}
          organisationId={organisationId}
          accounts={data.accounts}
          onCreated={reload}
        />
        <section className="overflow-hidden rounded-xl border border-border bg-surface-elevated">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">Publishing queue</h2>
          </div>
          {data.publishingQueue.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-foreground-muted">
              No publications in queue. Create content and schedule a post to get started.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {data.publishingQueue.map((item) => (
                <li key={item.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                      <p className="text-xs text-foreground-muted">
                        {item.channel} · {item.accountName}
                      </p>
                      {item.validationMessage ? (
                        <p className="mt-1 text-xs text-danger">{item.validationMessage}</p>
                      ) : null}
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase",
                        item.status === "failed" && "bg-danger/10 text-danger",
                        item.status === "scheduled" && "bg-info/10 text-info",
                        item.status === "published" && "bg-success/10 text-success",
                        item.status !== "failed" &&
                          item.status !== "scheduled" &&
                          item.status !== "published" &&
                          "bg-surface-hover text-foreground-muted",
                      )}
                    >
                      {STATUS_LABELS[item.status] ?? item.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
