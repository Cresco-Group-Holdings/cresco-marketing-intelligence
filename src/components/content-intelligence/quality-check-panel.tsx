import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ContentQualityResult } from "@/lib/content-intelligence/types";

export function QualityCheckPanel({ result }: { result: ContentQualityResult }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Content quality check</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="font-medium">{result.summary}</p>
        {result.issues.length > 0 ? (
          <ul className="space-y-2">
            {result.issues.map((issue) => (
              <li key={issue.id} className="rounded-md border border-border px-3 py-2 text-xs">
                <p>{issue.message}</p>
                {issue.action ? (
                  <p className="mt-1 text-primary">{issue.action}</p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        <p className="text-[11px] text-foreground-subtle">
          Content compliance check — not a substitute for legal review.
        </p>
      </CardContent>
    </Card>
  );
}
