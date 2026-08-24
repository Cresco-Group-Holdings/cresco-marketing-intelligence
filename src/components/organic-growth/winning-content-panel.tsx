import type { WinningContentItem } from "@/lib/organic-growth/types";
import { ModulePanel } from "@/components/command-centre/module-panel";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STRENGTH_LABELS = {
  emerging: "Emerging evidence",
  moderate: "Moderate evidence",
  strong: "Strong evidence",
} as const;

const STRENGTH_STYLES = {
  emerging: "bg-surface-hover text-foreground-muted",
  moderate: "bg-warning/10 text-warning",
  strong: "bg-success/10 text-success",
} as const;

export function WinningContentPanel({
  items,
  className,
}: {
  items: WinningContentItem[];
  className?: string;
}) {
  return (
    <ModulePanel
      title="Winning content"
      subtitle="Posts performing above your account baseline"
      className={className}
      tier="actionable"
    >
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface-subtle px-4 py-5 text-center">
          <p className="text-sm font-medium text-foreground">No winning content identified yet</p>
          <p className="mt-1 text-xs text-foreground-muted">
            Publish or sync at least three posts to establish a performance baseline.
          </p>
          <ButtonLink href="/organic-social/publishing" variant="outline" size="sm" className="mt-3">
            Review publishing
          </ButtonLink>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <li key={item.id} className="px-4 py-3.5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                  <p className="mt-0.5 text-xs text-foreground-muted">
                    {item.channel}
                    {item.format ? ` · ${item.format}` : ""}
                  </p>
                  <p className="mt-2 text-xs text-foreground-muted">{item.baselineDescription}</p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {item.engagementLift?.toFixed(1)}× engagement
                    {item.profileVisitLift != null && item.profileVisitLift >= 1.3
                      ? ` · ${item.profileVisitLift.toFixed(1)}× profile visits`
                      : ""}
                    {item.clickLift != null && item.clickLift >= 1.3
                      ? ` · ${item.clickLift.toFixed(1)}× clicks`
                      : ""}
                  </p>
                  <p className="mt-1 text-xs text-foreground-subtle">
                    Based on {item.sampleSize} comparable posts · {item.disclaimer}
                  </p>
                  <span
                    className={cn(
                      "mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase",
                      STRENGTH_STYLES[item.evidenceStrength],
                    )}
                  >
                    {STRENGTH_LABELS[item.evidenceStrength]}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.actions.slice(0, 2).map((action) => (
                    <ButtonLink key={action.label} href={action.href} variant="outline" size="sm">
                      {action.label}
                    </ButtonLink>
                  ))}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </ModulePanel>
  );
}
