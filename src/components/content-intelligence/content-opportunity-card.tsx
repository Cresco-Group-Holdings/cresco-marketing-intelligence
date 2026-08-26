import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import type { ContentOpportunity } from "@/lib/content-intelligence/types";
import { cn } from "@/lib/utils";

const STRENGTH_LABELS = {
  emerging: "Emerging evidence",
  moderate: "Moderate evidence",
  strong: "Strong evidence",
} as const;

export function ContentOpportunityCard({
  opportunity,
  featured = false,
}: {
  opportunity: ContentOpportunity;
  featured?: boolean;
}) {
  return (
    <Card className={cn(featured && "border-primary/30 bg-primary/5")}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-medium">{opportunity.title}</CardTitle>
          <span className="shrink-0 rounded-full bg-surface-hover px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-foreground-muted">
            {STRENGTH_LABELS[opportunity.evidenceStrength]}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="font-medium text-foreground">{opportunity.finding}</p>
        <dl className="grid gap-1">
          {opportunity.evidence.map((item) => (
            <div key={item.label} className="flex justify-between gap-2 text-xs">
              <dt className="text-foreground-muted">{item.label}</dt>
              <dd className="font-medium tabular-nums">{item.value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-foreground-muted">{opportunity.whyItMatters}</p>
        <ButtonLink href={opportunity.action.href} size="sm">
          {opportunity.action.label}
        </ButtonLink>
      </CardContent>
    </Card>
  );
}
