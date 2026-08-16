import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type AIInsightType =
  | "opportunity"
  | "anomaly"
  | "audience-signal"
  | "content-opportunity"
  | "budget-recommendation"
  | "creative-fatigue"
  | "recommended-action";

export type AIInsight = {
  id: string;
  type: AIInsightType;
  title: string;
  explanation: string;
  impact?: string;
  ctaLabel: string;
  ctaHref?: string;
  category: "paid" | "organic" | "cross-channel";
};

const TYPE_LABELS: Record<AIInsightType, string> = {
  opportunity: "Opportunity detected",
  anomaly: "Performance anomaly",
  "audience-signal": "Audience signal",
  "content-opportunity": "Content opportunity",
  "budget-recommendation": "Budget recommendation",
  "creative-fatigue": "Creative fatigue",
  "recommended-action": "Recommended next action",
};

export function AIInsightCard({ insight }: { insight: AIInsight }) {
  return (
    <article className="rounded-xl border border-border bg-surface-elevated p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={insight.category === "paid" ? "paid" : insight.category === "organic" ? "organic" : "muted"}>
          {insight.category === "cross-channel" ? "Cross-channel" : insight.category === "paid" ? "Paid" : "Organic"}
        </Badge>
        <span className="text-xs font-medium uppercase tracking-wide text-foreground-subtle">
          {TYPE_LABELS[insight.type]}
        </span>
      </div>
      <h3 className="mt-3 text-sm font-semibold text-foreground">{insight.title}</h3>
      <p className="mt-2 text-sm text-foreground-muted">{insight.explanation}</p>
      {insight.impact ? (
        <p className={cn("mt-2 text-xs font-medium text-success")}>Estimated impact: {insight.impact}</p>
      ) : null}
      <div className="mt-4">
        {insight.ctaHref ? (
          <ButtonLink href={insight.ctaHref} variant="outline" size="sm">
            {insight.ctaLabel}
          </ButtonLink>
        ) : (
          <ButtonLink href="/analyst" variant="outline" size="sm">
            {insight.ctaLabel}
          </ButtonLink>
        )}
      </div>
    </article>
  );
}

export function AIIntelligenceFeed({
  insights,
  emptyMessage,
}: {
  insights: AIInsight[];
  emptyMessage?: string;
}) {
  if (insights.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface p-6 text-sm text-foreground-muted">
        {emptyMessage ?? "Connect marketing data sources to unlock Cresco AI recommendations."}
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {insights.map((insight) => (
        <AIInsightCard key={insight.id} insight={insight} />
      ))}
    </div>
  );
}
