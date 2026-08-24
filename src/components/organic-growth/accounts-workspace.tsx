"use client";

import { PageHeader } from "@/components/layout/page-header";
import { AccountRow } from "@/components/organic-growth/account-row";
import { useOrganicGrowthEngine } from "@/components/organic-growth/use-organic-growth-engine";
import { groupProvidersByAvailability } from "@/lib/organic-growth/providers";
import { WorkspaceErrorState } from "@/components/layout/workspace-empty-state";
import { ButtonLink } from "@/components/ui/button";
import { DashboardSkeleton } from "@/components/ui/skeleton";

function ProviderGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  if (!children) return null;
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface-elevated">
      <div className="border-b border-border px-4 py-2.5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export function AccountsWorkspace() {
  const { data, loading, error, reload } = useOrganicGrowthEngine();

  if (loading && !data) return <DashboardSkeleton />;
  if (error && !data) {
    return (
      <WorkspaceErrorState title="Accounts unavailable" description={error} onRetry={reload} />
    );
  }
  if (!data) return null;

  const grouped = groupProvidersByAvailability(data.providers);
  const connectedAccounts = data.accounts.filter((account) =>
    ["healthy", "syncing", "stale", "error", "reauth_required"].includes(account.connectionState),
  );

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
            <ButtonLink href="/social/connections" variant="organic" size="sm">
              Connect accounts
            </ButtonLink>
          </>
        }
      />

      <ProviderGroup title="Connected">
        {connectedAccounts.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm font-medium text-foreground">No social accounts connected</p>
            <p className="mt-1 text-sm text-foreground-muted">
              Connect LinkedIn or another supported organic channel to start measuring reach, engagement
              and follower growth.
            </p>
            <ButtonLink href="/social/connections" variant="organic" size="sm" className="mt-4">
              Connect accounts
            </ButtonLink>
          </div>
        ) : (
          connectedAccounts.map((account) => <AccountRow key={account.id} account={account} />)
        )}
      </ProviderGroup>

      {grouped.availableToConnect.length > 0 ? (
        <ProviderGroup title="Available to connect">
          <ul className="divide-y divide-border">
            {grouped.availableToConnect.map((provider) => (
              <li
                key={String(provider.provider)}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium text-foreground">{provider.label}</p>
                  <p className="text-xs text-foreground-muted">Ready to connect via Social Connections</p>
                </div>
                <ButtonLink href={provider.connectHref} variant="outline" size="sm">
                  Connect
                </ButtonLink>
              </li>
            ))}
          </ul>
        </ProviderGroup>
      ) : null}

      {grouped.comingSoon.length > 0 ? (
        <ProviderGroup title="Coming soon">
          <ul className="divide-y divide-border">
            {grouped.comingSoon.map((provider) => (
              <li key={String(provider.provider)} className="px-4 py-3 text-sm text-foreground-muted">
                <p className="font-medium text-foreground">{provider.label}</p>
                <p className="text-xs">On the provider roadmap — not yet available to connect.</p>
              </li>
            ))}
          </ul>
        </ProviderGroup>
      ) : null}

      {grouped.planned.length > 0 ? (
        <ProviderGroup title="Planned">
          <ul className="divide-y divide-border">
            {grouped.planned.map((provider) => (
              <li key={String(provider.provider)} className="px-4 py-3 text-sm text-foreground-muted">
                <p className="font-medium text-foreground">{provider.label}</p>
                <p className="text-xs">Planned for a future release.</p>
              </li>
            ))}
          </ul>
        </ProviderGroup>
      ) : null}
    </div>
  );
}
