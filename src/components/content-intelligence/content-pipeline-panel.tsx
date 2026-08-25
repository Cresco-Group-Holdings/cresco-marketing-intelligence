import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ContentIntelligenceWorkspace } from "@/lib/content-intelligence/types";

export function ContentPipelinePanel({
  items,
}: {
  items: ContentIntelligenceWorkspace["pipeline"];
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">Content pipeline</CardTitle>
        <Link href="/content/studio/workflow" className="text-xs text-primary hover:underline">
          View workflow
        </Link>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-foreground-muted">No content in pipeline yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {items.slice(0, 6).map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <Link href={item.href} className="truncate font-medium hover:underline">
                    {item.title}
                  </Link>
                  <p className="text-xs text-foreground-muted">
                    {[item.status, item.channel, item.contentPillar?.replace(/_/g, " ")]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-foreground-subtle">{item.status}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
