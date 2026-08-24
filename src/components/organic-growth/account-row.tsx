import type { OrganicAccountRow } from "@/lib/organic-growth/types";
import { DataFreshness } from "@/components/command-centre/data-freshness";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const HEALTH_LABELS: Record<OrganicAccountRow["connectionState"], string> = {
  healthy: "Healthy",
  syncing: "Syncing",
  stale: "Stale",
  error: "Error",
  reauth_required: "Reauthentication required",
  not_connected: "Not connected",
  coming_soon: "Coming soon",
};

const HEALTH_STYLES: Record<OrganicAccountRow["connectionState"], string> = {
  healthy: "text-success",
  syncing: "text-info",
  stale: "text-warning",
  error: "text-danger",
  reauth_required: "text-warning",
  not_connected: "text-foreground-muted",
  coming_soon: "text-foreground-subtle",
};

export function AccountRow({ account }: { account: OrganicAccountRow }) {
  return (
    <div className="flex flex-col gap-3 border-b border-border px-4 py-3.5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-foreground">{account.provider}</p>
          <span className={cn("text-xs font-medium", HEALTH_STYLES[account.connectionState])}>
            {HEALTH_LABELS[account.connectionState]}
          </span>
        </div>
        <p className="mt-0.5 truncate text-sm text-foreground-muted">
          {account.displayName}
          {account.handle ? ` · @${account.handle}` : ""}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-foreground-subtle">
          {account.followers != null ? (
            <span>{account.followers.toLocaleString("en-GB")} followers</span>
          ) : (
            <span>Followers not tracked</span>
          )}
          {account.followerGrowthRate != null ? (
            <span
              className={account.followerGrowthRate >= 0 ? "text-success" : "text-danger"}
            >
              {account.followerGrowthRate >= 0 ? "+" : ""}
              {account.followerGrowthRate.toFixed(1)}%
            </span>
          ) : null}
          {account.engagementRate != null ? (
            <span>{account.engagementRate.toFixed(2)}% engagement</span>
          ) : null}
          <DataFreshness label={account.freshnessLabel} state={account.freshness} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {account.connectionState === "coming_soon" ? (
          <span className="text-xs text-foreground-muted">Coming soon</span>
        ) : account.connectionState === "not_connected" ? (
          <ButtonLink href={account.actions.connectHref} variant="organic" size="sm">
            Connect account
          </ButtonLink>
        ) : account.connectionState === "reauth_required" ? (
          <ButtonLink href="/social/connections" variant="organic" size="sm">
            Reconnect
          </ButtonLink>
        ) : (
          <>
            <ButtonLink href={account.actions.performanceHref} variant="outline" size="sm">
              View performance
            </ButtonLink>
            <ButtonLink href={account.actions.createHref} variant="outline" size="sm">
              Create content
            </ButtonLink>
          </>
        )}
      </div>
    </div>
  );
}
