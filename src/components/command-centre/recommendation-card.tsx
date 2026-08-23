import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import type { MarketingSignal } from "@/lib/marketing-intelligence/types";
import { cn } from "@/lib/utils";

const TYPE_LABELS: Record<MarketingSignal["type"], string> = {
  opportunity: "Opportunity",
  anomaly: "Finding",
  budget: "Recommendation",
  "creative-fatigue": "Risk",
  audience: "Recommendation",
  organic: "Opportunity",
  "cross-channel": "Insight",
};

function confidenceLabel(confidence: number): "High" | "Medium" | "Low" {
  if (confidence >= 0.75) return "High";
  if (confidence >= 0.45) return "Medium";
  return "Low";
}

export function ConfidenceBadge({ confidence }: { confidence: number }) {
  const label = confidenceLabel(confidence);
  return (
    <Badge
      variant={label === "High" ? "default" : label === "Medium" ? "muted" : "warning"}
      className="text-[10px]"
    >
      {label} confidence
    </Badge>
  );
}

export function InsightBadge({ type }: { type: MarketingSignal["type"] }) {
  const variant =
    type === "creative-fatigue" || type === "anomaly"
      ? "warning"
      : type === "opportunity" || type === "organic" || type === "cross-channel"
        ? "organic"
        : "paid";

  return (
    <Badge variant={variant} className="text-[10px]">
      {TYPE_LABELS[type]}
    </Badge>
  );
}

export function RecommendationCard({ signal }: { signal: MarketingSignal }) {
  return (
    <article className="rounded-xl border border-border bg-surface-elevated p-4 transition-colors hover:border-border-strong">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ai-accent">
          Cresco Intelligence
        </span>
        <InsightBadge type={signal.type} />
        <ConfidenceBadge confidence={signal.confidence} />
      </div>

      <h3 className="mt-3 text-sm font-semibold text-foreground">{signal.title}</h3>
      <p className="mt-2 text-sm text-foreground-muted">{signal.explanation}</p>

      {signal.evidence.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground-subtle">
            Evidence
          </p>
          <dl className="mt-2 space-y-1 rounded-lg bg-surface-subtle px-3 py-2">
            {signal.evidence.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-3 text-xs">
                <dt className="text-foreground-subtle">{item.label}</dt>
                <dd className="font-medium text-foreground">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      {signal.estimatedImpact ? (
        <p className={cn("mt-2 text-xs font-medium text-positive")}>
          Potential impact: {signal.estimatedImpact}
        </p>
      ) : null}

      <div className="mt-4">
        {signal.action?.href ? (
          <ButtonLink href={signal.action.href} variant="outline" size="sm">
            {signal.action.label}
          </ButtonLink>
        ) : (
          <ButtonLink href="/growth" variant="outline" size="sm">
            {signal.action?.label ?? "Review"}
          </ButtonLink>
        )}
      </div>
    </article>
  );
}

export function RecommendationsPanel({
  insights,
  emptyTitle = "No recommendations yet",
  emptyDescription = "Connect marketing data sources to unlock Cresco AI recommendations.",
  emptyAction,
}: {
  insights: MarketingSignal[];
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
}) {
  if (insights.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface-subtle p-6 text-center">
        <p className="text-sm font-semibold text-foreground">{emptyTitle}</p>
        <p className="mt-2 text-sm text-foreground-muted">{emptyDescription}</p>
        {emptyAction ? <div className="mt-4">{emptyAction}</div> : null}
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {insights.map((insight) => (
        <RecommendationCard key={insight.id} signal={insight} />
      ))}
    </div>
  );
}
