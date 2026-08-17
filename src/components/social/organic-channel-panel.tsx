"use client";

import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import type { OrganicChannelMetrics } from "@/lib/organic-social/types";
import { unavailableValue } from "@/lib/marketing-intelligence/format";

const CONNECTION_VARIANT: Record<
  OrganicChannelMetrics["connectionState"],
  "success" | "warning" | "danger" | "muted"
> = {
  Connected: "success",
  "Needs re-authentication": "danger",
  "Permission missing": "warning",
  "Sync delayed": "warning",
  Disconnected: "muted",
  Unavailable: "muted",
};

function formatNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString("en-GB");
}

export function OrganicChannelPanel({ channels }: { channels: OrganicChannelMetrics[] }) {
  return (
    <section
      aria-labelledby="organic-channels-heading"
      className="rounded-xl border border-border bg-surface-elevated p-4 sm:p-5"
    >
      <h2 id="organic-channels-heading" className="text-sm font-semibold text-foreground">
        Channel performance
      </h2>
      <p className="mt-1 text-xs text-foreground-muted">
        Organic metrics by platform for the selected period.
      </p>
      <div className="mt-4 space-y-3">
        {channels.map((channel) => (
          <article
            key={channel.provider}
            className="rounded-lg border border-border bg-surface px-4 py-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-medium text-foreground">{channel.channel}</h3>
              <Badge variant={CONNECTION_VARIANT[channel.connectionState]}>
                {channel.connected ? channel.freshnessLabel : channel.connectionState}
              </Badge>
            </div>
            {channel.connected ? (
              <>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                  <div>
                    <dt className="text-foreground-subtle">Reach</dt>
                    <dd className="mt-0.5 font-medium text-foreground">
                      {channel.reach != null ? formatNumber(channel.reach) : unavailableValue()}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-foreground-subtle">Engagement</dt>
                    <dd className="mt-0.5 font-medium text-foreground">
                      {channel.engagement != null
                        ? formatNumber(channel.engagement)
                        : unavailableValue()}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-foreground-subtle">Scheduled</dt>
                    <dd className="mt-0.5 font-medium text-foreground">
                      {channel.scheduledContent}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-foreground-subtle">Published</dt>
                    <dd className="mt-0.5 font-medium text-foreground">
                      {channel.publishedContent}
                    </dd>
                  </div>
                </dl>
                <div className="mt-3">
                  <ButtonLink href={channel.ctaHref} variant="organic" size="sm">
                    {channel.ctaLabel}
                  </ButtonLink>
                </div>
              </>
            ) : (
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-xs text-foreground-muted">
                  Connect {channel.channel} to publish and measure organic performance.
                </p>
                <ButtonLink href={channel.connectHref} variant="outline" size="sm">
                  Connect
                </ButtonLink>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
