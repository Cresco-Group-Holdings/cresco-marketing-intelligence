"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { MarketingHealthBreakdown } from "@/lib/marketing-intelligence/types";
import { cn } from "@/lib/utils";

type HealthScoreProps = {
  health: MarketingHealthBreakdown | null;
  change?: number | null;
  comparisonLabel?: string;
  unavailable?: boolean;
};

export function HealthScore({
  health,
  change,
  comparisonLabel,
  unavailable = false,
}: HealthScoreProps) {
  const [expanded, setExpanded] = useState(false);

  if (unavailable || !health) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface-subtle p-4">
        <p className="text-sm font-semibold text-foreground">Marketing Health</p>
        <p className="mt-2 text-sm text-foreground-muted">
          Connect marketing data sources to calculate your health score.
        </p>
      </div>
    );
  }

  const scoreColor =
    health.total >= 75 ? "text-success" : health.total >= 50 ? "text-foreground" : "text-warning";

  return (
    <div className="rounded-xl border border-border bg-surface-elevated p-4">
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        className="flex w-full items-start justify-between gap-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-expanded={expanded}
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground-subtle">
            Marketing Health
          </p>
          <p className={cn("mt-1 text-3xl font-semibold tracking-tight", scoreColor)}>
            {health.total}
            <span className="text-lg text-foreground-muted"> / 100</span>
          </p>
          {change != null ? (
            <p className="mt-2 text-xs text-foreground-muted">
              {change > 0 ? "+" : ""}
              {change} vs previous period
            </p>
          ) : comparisonLabel ? (
            <p className="mt-2 text-xs text-foreground-subtle">{comparisonLabel}</p>
          ) : null}
        </div>
        <span className="mt-1 text-foreground-muted">
          {expanded ? (
            <ChevronUp className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          )}
        </span>
      </button>

      {expanded ? (
        <dl className="mt-4 space-y-3 border-t border-border pt-4">
          {health.components.map((component) => (
            <div key={component.key} className="space-y-1">
              <div className="flex items-center justify-between gap-4 text-sm">
                <dt className="font-medium text-foreground">{component.label}</dt>
                <dd className="shrink-0 font-semibold text-foreground">
                  {component.score} / {component.maxScore}
                </dd>
              </div>
              <dd className="text-xs text-foreground-muted">{component.detail}</dd>
              <div
                className="h-1.5 overflow-hidden rounded-full bg-surface-hover"
                role="progressbar"
                aria-valuenow={component.score}
                aria-valuemin={0}
                aria-valuemax={component.maxScore}
              >
                <div
                  className="h-full rounded-full bg-paid-accent/70"
                  style={{ width: `${(component.score / component.maxScore) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
