import type { OrganicGrowthScore } from "@/lib/organic-growth/types";
import { cn } from "@/lib/utils";

export function GrowthScorePanel({
  score,
  className,
  compact = false,
}: {
  score: OrganicGrowthScore;
  className?: string;
  compact?: boolean;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-surface-elevated",
        className,
      )}
      aria-label="Organic Growth Score"
    >
      <div className={cn("border-b border-border px-4 py-3", compact && "py-2.5")}>
        <p className="text-[11px] font-medium uppercase tracking-wide text-foreground-subtle">
          Organic Growth Score
        </p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
          {score.total}
          <span className="text-base font-normal text-foreground-muted"> / {score.maxTotal}</span>
        </p>
      </div>
      <ul className="divide-y divide-border">
        {score.dimensions.map((dimension) => (
          <li key={dimension.key} className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-sm font-medium",
                    dimension.unavailable ? "text-foreground-muted" : "text-foreground",
                  )}
                >
                  {dimension.label}
                </p>
                <p className="mt-0.5 text-xs text-foreground-muted">{dimension.explanation}</p>
                {dimension.recommendedImprovement ? (
                  <p className="mt-1 text-xs text-organic-accent">
                    Improve: {dimension.recommendedImprovement}
                  </p>
                ) : null}
              </div>
              <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                {dimension.unavailable ? "—" : `${dimension.score}/${dimension.maxScore}`}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
