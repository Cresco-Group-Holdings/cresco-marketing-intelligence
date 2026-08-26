import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ContentLearning } from "@/lib/content-intelligence/types";

const STRENGTH_LABELS = {
  emerging: "Emerging",
  moderate: "Moderate",
  strong: "Strong",
} as const;

export function ContentLearningPanel({ learnings }: { learnings: ContentLearning[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Learnings</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-4">
          {learnings.map((learning) => (
            <li key={learning.id} className="border-b border-border pb-4 last:border-0 last:pb-0">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium">{learning.pattern}</p>
                <span className="text-xs text-foreground-subtle">
                  {STRENGTH_LABELS[learning.evidenceStrength]}
                </span>
              </div>
              <p className="mt-1 text-sm text-foreground-muted">{learning.observation}</p>
              <p className="mt-1 text-[11px] text-foreground-subtle">{learning.disclaimer}</p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
