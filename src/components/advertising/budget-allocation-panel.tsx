"use client";

import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { BudgetAllocationItem } from "@/lib/paid-advertising/types";

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

const PACING_VARIANT: Record<
  BudgetAllocationItem["pacing"],
  "success" | "warning" | "danger" | "muted"
> = {
  "On track": "success",
  Underspending: "warning",
  Overspending: "danger",
  "Projected overspend": "warning",
  Unavailable: "muted",
};

export function BudgetAllocationPanel({
  allocation,
  currency,
}: {
  allocation: BudgetAllocationItem[];
  currency: string;
}) {
  if (allocation.length === 0) {
    return (
      <section
        aria-labelledby="budget-allocation-heading"
        className="rounded-xl border border-dashed border-border bg-surface-elevated p-6 text-sm text-foreground-muted"
      >
        <h2 id="budget-allocation-heading" className="font-semibold text-foreground">
          Budget allocation
        </h2>
        <p className="mt-2">Connect paid channels to see spend allocation by provider.</p>
      </section>
    );
  }

  const maxShare = Math.max(...allocation.map((item) => item.spendShare), 0.01);

  return (
    <section
      aria-labelledby="budget-allocation-heading"
      className="rounded-xl border border-border bg-surface-elevated p-4 sm:p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="budget-allocation-heading" className="text-sm font-semibold text-foreground">
            Budget allocation
          </h2>
          <p className="mt-1 text-xs text-foreground-muted">
            Share of spend and performance by channel.
          </p>
        </div>
        <ButtonLink href="/advertising/budgets" variant="outline" size="sm">
          Review allocation
        </ButtonLink>
      </div>
      <div className="mt-4 space-y-4">
        {allocation.map((item) => (
          <article key={item.provider}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-foreground">{item.provider}</span>
              <div className="flex items-center gap-2">
                <Badge variant={PACING_VARIANT[item.pacing]}>{item.pacing}</Badge>
                <span className="text-foreground-muted">
                  {formatCurrency(item.spend, currency)}
                </span>
              </div>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface">
              <div
                className="h-full rounded-full bg-paid-accent/80"
                style={{ width: `${(item.spendShare / maxShare) * 100}%` }}
                role="presentation"
              />
            </div>
            <div className="mt-1 flex justify-between text-xs text-foreground-subtle">
              <span>{(item.spendShare * 100).toFixed(0)}% of total spend</span>
              <span>
                ROAS {item.roas != null ? `${item.roas.toFixed(1)}x` : "—"}
                {item.projectedSpend != null
                  ? ` · Projected ${formatCurrency(item.projectedSpend, currency)}`
                  : null}
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
