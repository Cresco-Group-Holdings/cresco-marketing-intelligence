import type { CommandCentreFunnelStage } from "@/lib/command-centre/types";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";

export function MarketingFunnelPanel({
  stages,
  emptyTitle = "Funnel data unavailable",
  emptyDescription = "Connect paid advertising and analytics sources to unlock funnel visibility from impressions through revenue.",
}: {
  stages: CommandCentreFunnelStage[];
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const visibleStages = stages.filter((stage) => stage.count != null);

  if (visibleStages.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={
          <ButtonLink href="/integrations" variant="outline" size="sm">
            Review integrations
          </ButtonLink>
        }
      />
    );
  }

  return (
    <ol className="space-y-2">
      {visibleStages.map((stage, index) => (
        <li
          key={stage.stage}
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3"
        >
          <div>
            <p className="text-sm font-semibold text-foreground">{stage.stage}</p>
            {stage.rateLabel && stage.rateValue ? (
              <p className="text-xs text-foreground-subtle">
                {stage.rateLabel} {stage.rateValue}
              </p>
            ) : null}
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold text-foreground">
              {stage.count != null ? stage.count.toLocaleString("en-GB") : "—"}
            </p>
            {index > 0 && stage.rateValue && !stage.rateLabel ? (
              <p className="text-xs text-foreground-subtle">{stage.rateValue}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
