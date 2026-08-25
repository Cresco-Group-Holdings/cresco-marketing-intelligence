import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import type { NextContentRecommendation } from "@/lib/content-intelligence/types";

const STRENGTH_LABELS = {
  emerging: "Emerging",
  moderate: "Moderate",
  strong: "Strong",
} as const;

export function NextContentRecommendationPanel({
  recommendation,
}: {
  recommendation: NextContentRecommendation;
}) {
  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{recommendation.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-lg font-medium">{recommendation.topic}</p>
          <p className="text-sm text-foreground-muted">{recommendation.format}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-foreground-subtle">Why</p>
          <ul className="mt-1 list-inside list-disc space-y-1 text-sm text-foreground-muted">
            {recommendation.why.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-foreground-muted">
            Evidence strength: {STRENGTH_LABELS[recommendation.evidenceStrength]}
          </span>
          <ButtonLink href={recommendation.action.href} size="sm">
            {recommendation.action.label}
          </ButtonLink>
        </div>
      </CardContent>
    </Card>
  );
}
