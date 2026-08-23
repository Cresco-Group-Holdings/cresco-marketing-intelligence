"use client";

import { DateRangeSelector } from "@/components/marketing/date-range-selector";
import { DataFreshness } from "@/components/command-centre/data-freshness";
import type { DataFreshnessState } from "@/lib/marketing-intelligence/types";

type CommandCentreHeaderProps = {
  dateLabel?: string;
  freshness?: {
    paid: string;
    organic: string;
    paidState?: DataFreshnessState;
    organicState?: DataFreshnessState;
  };
  coverage?: {
    paid: string;
    organic: string;
    note?: string;
  };
};

export function CommandCentreHeader({ dateLabel, freshness, coverage }: CommandCentreHeaderProps) {
  return (
    <header className="rounded-2xl border border-border bg-surface-elevated p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Marketing Command Centre
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-foreground-muted">
            Your daily operating cockpit for growth, performance and marketing decisions.
          </p>
          {coverage ? (
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-foreground-subtle">
              <span>{coverage.paid}</span>
              <span>{coverage.organic}</span>
              {coverage.note ? <span>{coverage.note}</span> : null}
            </div>
          ) : null}
          {freshness ? (
            <div className="mt-2 flex flex-wrap gap-4">
              <DataFreshness
                label="Paid"
                state={freshness.paidState ?? "unavailable"}
                detail={freshness.paid}
              />
              <DataFreshness
                label="Organic"
                state={freshness.organicState ?? "unavailable"}
                detail={freshness.organic}
              />
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DateRangeSelector />
          {dateLabel ? <span className="text-xs text-foreground-subtle">{dateLabel}</span> : null}
        </div>
      </div>
    </header>
  );
}
