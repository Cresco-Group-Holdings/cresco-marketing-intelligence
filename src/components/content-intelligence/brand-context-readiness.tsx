import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import type { BrandContextReadiness } from "@/lib/content-intelligence/types";

export function BrandContextReadinessPanel({ readiness }: { readiness: BrandContextReadiness }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          {readiness.complete ? "Brand context ready" : "Brand context incomplete"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-foreground-muted">{readiness.impactMessage}</p>
        {!readiness.complete && readiness.missing.length > 0 ? (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-foreground-subtle">Missing</p>
            <ul className="mt-1 space-y-1">
              {readiness.missing.map((item) => (
                <li key={`${item.category}-${item.label}`} className="text-foreground-muted">
                  {item.category}: {item.label}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={readiness.completeBrandHref} variant="outline" size="sm">
            {readiness.complete ? "Review brand knowledge" : "Complete brand profile"}
          </ButtonLink>
          {!readiness.complete ? (
            <ButtonLink href="/content/studio/create" variant="ghost" size="sm">
              Continue with available context
            </ButtonLink>
          ) : null}
        </div>
        <p className="text-[11px] text-foreground-subtle">
          Readiness score: {readiness.overallScore}%
        </p>
      </CardContent>
    </Card>
  );
}
