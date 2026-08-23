import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import type { MarketingSignal } from "@/lib/marketing-intelligence/types";
import { cn } from "@/lib/utils";

export type RecommendationActionKind =
  | "review"
  | "take_action"
  | "create_experiment"
  | "approve"
  | "apply"
  | "dismiss";

const TYPE_LABELS: Record<MarketingSignal["type"], string> = {
  opportunity: "Opportunity",
  anomaly: "Finding",
  budget: "Recommendation",
  "creative-fatigue": "Risk",
  audience: "Recommendation",
  organic: "Opportunity",
  "cross-channel": "Insight",
};

const TYPE_ACCENT: Record<MarketingSignal["type"], string> = {
  opportunity: "border-l-organic-accent",
  anomaly: "border-l-warning",
  budget: "border-l-paid-accent",
  "creative-fatigue": "border-l-danger",
  audience: "border-l-paid-accent",
  organic: "border-l-organic-accent",
  "cross-channel": "border-l-ai-accent",
};

function confidenceLabel(confidence: number): "High" | "Medium" | "Low" {
  if (confidence >= 0.75) return "High";
  if (confidence >= 0.45) return "Medium";
  return "Low";
}

function resolveActionKind(signal: MarketingSignal): RecommendationActionKind {
  const label = signal.action?.label?.toLowerCase() ?? "";
  if (label.includes("experiment")) return "create_experiment";
  if (label.includes("approve")) return "approve";
  if (label.includes("apply")) return "apply";
  if (label.includes("dismiss")) return "dismiss";
  if (label.includes("action")) return "take_action";
  return "review";
}

export function ConfidenceBadge({ confidence }: { confidence: number }) {
  const label = confidenceLabel(confidence);
  return (
    <Badge variant={label === "High" ? "muted" : "muted"} className="text-[10px]">
      {label} confidence
    </Badge>
  );
}

export function InsightBadge({ type }: { type: MarketingSignal["type"] }) {
  return (
    <Badge variant="muted" className="text-[10px]">
      {TYPE_LABELS[type]}
    </Badge>
  );
}

export function RecommendationCard({
  signal,
  featured = false,
}: {
  signal: MarketingSignal;
  featured?: boolean;
}) {
  const actionKind = resolveActionKind(signal);

  return (
    <article
      className={cn(
        "rounded-lg border border-border bg-surface-elevated border-l-[3px] p-4",
        TYPE_ACCENT[signal.type],
        featured && "shadow-sm",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <InsightBadge type={signal.type} />
        {signal.estimatedImpact ? (
          <p className="text-xs font-medium text-foreground">{signal.estimatedImpact}</p>
        ) : null}
      </div>

      <h3 className={cn("mt-2 font-semibold text-foreground", featured ? "text-base" : "text-sm")}>
        {signal.title}
      </h3>
      <p className="mt-1 text-sm text-foreground-muted">{signal.explanation}</p>

      {signal.evidence.length > 0 ? (
        <dl className="mt-3 space-y-1 border-t border-border/60 pt-3">
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-foreground-subtle">
            Evidence
          </dt>
          {signal.evidence.slice(0, 3).map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-3 text-xs">
              <dd className="text-foreground-subtle">{item.label}</dd>
              <dd className="font-medium tabular-nums text-foreground">{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <ConfidenceBadge confidence={signal.confidence} />
        {signal.action?.href ? (
          <ButtonLink
            href={signal.action.href}
            variant={featured ? "primary" : "outline"}
            size="sm"
            data-action-kind={actionKind}
          >
            {signal.action.label}
          </ButtonLink>
        ) : (
          <ButtonLink href="/growth" variant="outline" size="sm" data-action-kind="review">
            {signal.action?.label ?? "Review"}
          </ButtonLink>
        )}
      </div>
    </article>
  );
}

export function FeaturedRecommendation({ signal }: { signal: MarketingSignal }) {
  return <RecommendationCard signal={signal} featured />;
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
      <div className="rounded-lg border border-dashed border-border bg-surface-subtle px-4 py-5 text-center">
        <p className="text-sm font-medium text-foreground">{emptyTitle}</p>
        <p className="mt-1 text-xs text-foreground-muted">{emptyDescription}</p>
        {emptyAction ? <div className="mt-3">{emptyAction}</div> : null}
      </div>
    );
  }

  const remainder = insights.slice(1);

  return (
    <div className="space-y-3">
      {remainder.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {remainder.map((insight) => (
            <RecommendationCard key={insight.id} signal={insight} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
