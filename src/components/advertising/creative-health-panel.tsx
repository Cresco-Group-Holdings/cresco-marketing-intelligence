"use client";

import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import type { PaidCreativePerformance } from "@/lib/paid-advertising/types";

const STATE_VARIANT: Record<
  PaidCreativePerformance["performanceState"],
  "success" | "warning" | "danger" | "muted"
> = {
  Strong: "success",
  Healthy: "success",
  "Needs attention": "warning",
  Underperforming: "danger",
  "Insufficient data": "muted",
};

export function CreativeHealthPanel({ creatives }: { creatives: PaidCreativePerformance[] }) {
  const fatigued = creatives.filter((creative) => creative.fatigueDetected);
  const winners = creatives.filter(
    (creative) =>
      creative.performanceState === "Strong" &&
      (creative.conversions ?? 0) >= 5 &&
      !creative.fatigueDetected,
  );

  return (
    <section aria-labelledby="creative-health-heading" className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 id="creative-health-heading" className="text-lg font-semibold text-foreground">
            Creative health
          </h2>
          <p className="text-sm text-foreground-muted">
            Winning creatives and fatigue signals from connected accounts.
          </p>
        </div>
        <ButtonLink href="/advertising/creatives" variant="outline" size="sm">
          View creatives
        </ButtonLink>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <CreativeList
          title="Top performers"
          creatives={winners.slice(0, 3)}
          emptyMessage="No creatives with sufficient data to identify winners."
        />
        <CreativeList
          title="Fatigue signals"
          creatives={fatigued.slice(0, 3)}
          emptyMessage="No creative fatigue detected in the selected period."
          showFatigue
        />
      </div>
    </section>
  );
}

function CreativeList({
  title,
  creatives,
  emptyMessage,
  showFatigue = false,
}: {
  title: string;
  creatives: PaidCreativePerformance[];
  emptyMessage: string;
  showFatigue?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-elevated p-4">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {creatives.length === 0 ? (
        <p className="mt-3 text-sm text-foreground-muted">{emptyMessage}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {creatives.map((creative) => (
            <li
              key={creative.id}
              className="rounded-lg border border-border bg-surface px-3 py-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{creative.name}</p>
                  <p className="text-xs text-foreground-subtle">
                    {creative.provider}
                    {creative.campaignName ? ` · ${creative.campaignName}` : ""}
                  </p>
                  {showFatigue && creative.fatigueReason ? (
                    <p className="mt-1 text-xs text-warning">{creative.fatigueReason}</p>
                  ) : null}
                </div>
                <Badge variant={STATE_VARIANT[creative.performanceState]}>
                  {showFatigue ? "Fatigue" : creative.performanceState}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
