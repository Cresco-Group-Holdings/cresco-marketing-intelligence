import type { CommandCentreFunnelStage } from "@/lib/command-centre/types";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function formatCount(stage: CommandCentreFunnelStage): string {
  if (stage.availability === "unavailable" || stage.availability === "not_tracked") {
    return "—";
  }
  if (stage.availability === "zero" || stage.count === 0) {
    return "0";
  }
  return stage.count != null ? stage.count.toLocaleString("en-GB") : "—";
}

function availabilityNote(stage: CommandCentreFunnelStage): string | null {
  if (stage.availability === "not_tracked") return "Not tracked";
  if (stage.availability === "unavailable") return "Unavailable";
  if (stage.availability === "zero") return "No activity in period";
  return null;
}

export function MarketingFunnelPanel({
  stages,
  emptyTitle = "Funnel data unavailable",
  emptyDescription = "Connect paid advertising and analytics sources to unlock funnel visibility from impressions through revenue.",
}: {
  stages: CommandCentreFunnelStage[];
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const visibleStages = stages.filter(
    (stage) =>
      stage.availability !== "unavailable" &&
      stage.availability !== "not_tracked" &&
      stage.count != null,
  );

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
    <ol className="space-y-1.5">
      {visibleStages.map((stage) => {
        const note = availabilityNote(stage);
        return (
          <li
            key={stage.stage}
            className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-surface px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{stage.stage}</p>
              {stage.rateLabel && stage.rateValue ? (
                <p className="text-[11px] text-foreground-subtle">
                  {stage.rateLabel} {stage.rateValue}
                </p>
              ) : null}
              {note ? <p className="text-[10px] text-foreground-subtle">{note}</p> : null}
            </div>
            <p
              className={cn(
                "shrink-0 text-base font-semibold tabular-nums text-foreground",
                stage.availability === "zero" && "text-foreground-muted",
              )}
            >
              {formatCount(stage)}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
