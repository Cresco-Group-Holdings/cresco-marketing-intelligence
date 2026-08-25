import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BrandAlignmentResult } from "@/lib/content-intelligence/types";

const STATE_STYLES = {
  strong: "text-success",
  moderate: "text-foreground",
  weak: "text-warning",
  missing: "text-foreground-muted",
  not_evaluated: "text-foreground-subtle",
} as const;

export function BrandAlignmentPanel({ result }: { result: BrandAlignmentResult }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Brand alignment</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-2xl font-semibold tabular-nums">{result.scoreLabel}</p>
        <ul className="space-y-2">
          {result.dimensions.map((dim) => (
            <li key={dim.key} className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{dim.label}</p>
                <p className="text-xs text-foreground-muted">{dim.explanation}</p>
              </div>
              <span className={`shrink-0 text-xs capitalize ${STATE_STYLES[dim.state]}`}>
                {dim.state.replace(/_/g, " ")}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-foreground-subtle">{result.disclaimer}</p>
      </CardContent>
    </Card>
  );
}
