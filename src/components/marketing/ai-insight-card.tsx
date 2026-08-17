import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { MarketingSignal } from "@/lib/marketing-intelligence/types";
import { cn } from "@/lib/utils";

const TYPE_LABELS: Record<MarketingSignal["type"], string> = {
  opportunity: "Opportunity detected",
  anomaly: "Performance anomaly",
  budget: "Budget recommendation",
  "creative-fatigue": "Creative fatigue",
  audience: "Audience signal",
  organic: "Content opportunity",
  "cross-channel": "Cross-channel signal",
};

export function AIInsightCard({ signal }: { signal: MarketingSignal }) {
  return (
    <article className="rounded-xl border border-border bg-surface-elevated p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant={
            signal.category === "paid"
              ? "paid"
              : signal.category === "organic"
                ? "organic"
                : "muted"
          }
        >
          {signal.category === "cross-channel"
            ? "Cross-channel"
            : signal.category === "paid"
              ? "Paid"
              : "Organic"}
        </Badge>
        <span className="text-xs font-medium uppercase tracking-wide text-foreground-subtle">
          {TYPE_LABELS[signal.type]}
        </span>
        <Badge variant={signal.severity === "high" ? "danger" : signal.severity === "medium" ? "warning" : "muted"}>
          {signal.severity}
        </Badge>
      </div>
      <h3 className="mt-3 text-sm font-semibold text-foreground">{signal.title}</h3>
      <p className="mt-2 text-sm text-foreground-muted">{signal.explanation}</p>
      {signal.evidence.length > 0 ? (
        <dl className="mt-3 space-y-1 rounded-lg bg-surface px-3 py-2">
          {signal.evidence.map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-3 text-xs">
              <dt className="text-foreground-subtle">{item.label}</dt>
              <dd className="font-medium text-foreground">{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {signal.estimatedImpact ? (
        <p className={cn("mt-2 text-xs font-medium text-success")}>
          Estimated impact: {signal.estimatedImpact}
        </p>
      ) : null}
      <div className="mt-4">
        {signal.action?.href ? (
          <ButtonLink href={signal.action.href} variant="outline" size="sm">
            {signal.action.label}
          </ButtonLink>
        ) : (
          <ButtonLink href="/growth" variant="outline" size="sm">
            {signal.action?.label ?? "Explore"}
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
  insights: MarketingSignal[];
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
        <AIInsightCard key={insight.id} signal={insight} />
      ))}
    </div>
  );
}
