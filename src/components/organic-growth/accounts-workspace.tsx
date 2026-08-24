"use client";

import { PageHeader } from "@/components/layout/page-header";
import { AccountRow } from "@/components/organic-growth/account-row";
import { useOrganicGrowthEngine } from "@/components/organic-growth/use-organic-growth-engine";
import { WorkspaceErrorState } from "@/components/layout/workspace-empty-state";
import { ButtonLink } from "@/components/ui/button";
import { DashboardSkeleton } from "@/components/ui/skeleton";

export function AccountsWorkspace() {
  const { data, loading, error, reload } = useOrganicGrowthEngine();

  if (loading && !data) return <DashboardSkeleton />;
  if (error && !data) {
    return (
      <WorkspaceErrorState title="Accounts unavailable" description={error} onRetry={reload} />
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Accounts"
        description="Connected organic social accounts, sync health, and channel actions."
        actions={
          <>
            <ButtonLink href="/social/connections" variant="outline" size="sm" className="hidden sm:inline-flex">
              Manage connections
            </ButtonLink>
            <ButtonLink href="/integrations" variant="organic" size="sm">
              Connect accounts
            </ButtonLink>
          </>
        }
      />
      <section className="overflow-hidden rounded-xl border border-border bg-surface-elevated">
        {data.accounts.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm font-medium text-foreground">No social accounts connected</p>
            <p className="mt-1 text-sm text-foreground-muted">
              Connect LinkedIn or another organic channel to start measuring reach, engagement and
              follower growth.
            </p>
            <ButtonLink href="/integrations" variant="organic" size="sm" className="mt-4">
              Connect accounts
            </ButtonLink>
          </div>
        ) : (
          data.accounts.map((account) => <AccountRow key={account.id} account={account} />)
        )}
      </section>
      <section className="rounded-xl border border-border bg-surface-subtle p-4">
        <h2 className="text-sm font-semibold text-foreground">Provider roadmap</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {data.providers.map((provider) => (
            <li
              key={provider.provider}
              className="rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm"
            >
              <p className="font-medium text-foreground">{provider.label}</p>
              <p className="text-xs capitalize text-foreground-muted">
                {provider.availability.replace(/_/g, " ")}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
