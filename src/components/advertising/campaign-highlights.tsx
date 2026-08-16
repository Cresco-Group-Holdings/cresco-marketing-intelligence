"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import type { PaidCampaignPerformance } from "@/lib/paid-advertising/types";

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

const STATE_VARIANT: Record<
  PaidCampaignPerformance["performanceState"],
  "success" | "warning" | "danger" | "muted"
> = {
  Strong: "success",
  Healthy: "success",
  "Needs attention": "warning",
  Underperforming: "danger",
  "Insufficient data": "muted",
};

export function CampaignHighlights({
  campaigns,
  currency,
}: {
  campaigns: PaidCampaignPerformance[];
  currency: string;
}) {
  const withData = campaigns.filter(
    (campaign) => (campaign.spend ?? 0) > 0 || (campaign.conversions ?? 0) > 0,
  );

  const topPerformers = [...withData]
    .filter((campaign) => campaign.roas != null)
    .sort((a, b) => (b.roas ?? 0) - (a.roas ?? 0))
    .slice(0, 3);

  const underperformers = [...withData]
    .filter(
      (campaign) =>
        campaign.performanceState === "Underperforming" ||
        campaign.performanceState === "Needs attention",
    )
    .slice(0, 3);

  if (withData.length === 0) {
    return (
      <section className="rounded-xl border border-dashed border-border bg-surface-elevated p-6 text-sm text-foreground-muted">
        <h2 className="font-semibold text-foreground">Campaign performance</h2>
        <p className="mt-2">No campaign performance data for the selected period.</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="campaign-highlights-heading" className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 id="campaign-highlights-heading" className="text-lg font-semibold text-foreground">
            Campaign performance
          </h2>
          <p className="text-sm text-foreground-muted">Top and underperforming campaigns.</p>
        </div>
        <ButtonLink href="/advertising/campaigns" variant="outline" size="sm">
          View all campaigns
        </ButtonLink>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <CampaignList title="Top performers" campaigns={topPerformers} currency={currency} />
        <CampaignList title="Needs attention" campaigns={underperformers} currency={currency} />
      </div>
    </section>
  );
}

function CampaignList({
  title,
  campaigns,
  currency,
}: {
  title: string;
  campaigns: PaidCampaignPerformance[];
  currency: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-elevated p-4">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {campaigns.length === 0 ? (
        <p className="mt-3 text-sm text-foreground-muted">No campaigns in this category.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {campaigns.map((campaign) => (
            <li
              key={campaign.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2"
            >
              <div className="min-w-0">
                <Link
                  href={`/advertising/google/campaigns/${campaign.id}`}
                  className="truncate text-sm font-medium text-foreground hover:text-paid-accent"
                >
                  {campaign.name}
                </Link>
                <p className="text-xs text-foreground-subtle">
                  {campaign.provider} · {campaign.status}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Badge variant={STATE_VARIANT[campaign.performanceState]}>
                  {campaign.performanceState}
                </Badge>
                <span className="text-xs text-foreground-muted">
                  {campaign.roas != null
                    ? `${campaign.roas.toFixed(2)}x ROAS`
                    : campaign.spend != null
                      ? formatCurrency(campaign.spend, currency)
                      : "—"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
