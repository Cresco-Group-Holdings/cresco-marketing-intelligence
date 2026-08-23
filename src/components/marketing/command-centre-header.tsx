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
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          Marketing Command Centre
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-foreground-muted">
          Your daily operating cockpit for growth, performance and marketing decisions.
        </p>
        {coverage ? (
          <p className="mt-2 text-[11px] text-foreground-subtle">
            {coverage.paid} · {coverage.organic}
            {coverage.note ? ` · ${coverage.note}` : ""}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
        <div className="flex flex-wrap items-center gap-2">
          <DateRangeSelector />
          {dateLabel ? <span className="text-[11px] text-foreground-subtle">{dateLabel}</span> : null}
        </div>
        {freshness ? (
          <div className="flex flex-wrap gap-3">
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
    </header>
  );
}
