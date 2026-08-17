"use client";

import { Badge } from "@/components/ui/badge";
import type { PaidChannelPerformance } from "@/lib/paid-advertising/types";
import { unavailableValue } from "@/lib/marketing-intelligence/format";

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function freshnessBadgeVariant(
  state: PaidChannelPerformance["freshness"],
): "success" | "warning" | "danger" | "muted" {
  if (state === "fresh") return "success";
  if (state === "delayed") return "warning";
  if (state === "stale") return "danger";
  return "muted";
}

export function PaidChannelPerformancePanel({
  channels,
  currency,
}: {
  channels: PaidChannelPerformance[];
  currency: string;
}) {
  return (
    <section
      aria-labelledby="channel-performance-heading"
      className="rounded-xl border border-border bg-surface-elevated p-4 sm:p-5"
    >
      <h2 id="channel-performance-heading" className="text-sm font-semibold text-foreground">
        Channel performance
      </h2>
      <p className="mt-1 text-xs text-foreground-muted">
        Paid metrics by provider for the selected period.
      </p>
      <div className="mt-4 space-y-3">
        {channels.map((channel) => (
          <article
            key={channel.providerKey}
            className="rounded-lg border border-border bg-surface px-4 py-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-medium text-foreground">{channel.provider}</h3>
              <Badge variant={channel.connected ? freshnessBadgeVariant(channel.freshness) : "muted"}>
                {channel.connected ? channel.freshnessLabel : "Disconnected"}
              </Badge>
            </div>
            {channel.connected ? (
              <dl className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                <div>
                  <dt className="text-foreground-subtle">Spend</dt>
                  <dd className="mt-0.5 font-medium text-foreground">
                    {channel.spend != null ? formatCurrency(channel.spend, currency) : unavailableValue()}
                  </dd>
                </div>
                <div>
                  <dt className="text-foreground-subtle">ROAS</dt>
                  <dd className="mt-0.5 font-medium text-foreground">
                    {channel.roas != null ? `${channel.roas.toFixed(2)}x` : unavailableValue()}
                  </dd>
                </div>
                <div>
                  <dt className="text-foreground-subtle">Conversions</dt>
                  <dd className="mt-0.5 font-medium text-foreground">
                    {channel.conversions != null
                      ? channel.conversions.toLocaleString()
                      : unavailableValue()}
                  </dd>
                </div>
                <div>
                  <dt className="text-foreground-subtle">Active campaigns</dt>
                  <dd className="mt-0.5 font-medium text-foreground">{channel.activeCampaigns}</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-2 text-xs text-foreground-muted">
                Connect this channel to view performance metrics.
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
