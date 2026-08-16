"use client";

import { Bot } from "lucide-react";
import { AppearanceMenu } from "@/components/theme/appearance-menu";
import { DateRangeSelector } from "@/components/marketing/date-range-selector";
import { ButtonLink } from "@/components/ui/button";
import { APP_NAME } from "@/lib/constants";

type CommandCentreHeaderProps = {
  dateLabel?: string;
  freshness?: {
    paid: string;
    organic: string;
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
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground-subtle">
            {APP_NAME}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Marketing Command Centre
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-foreground-muted">
            Command center for paid media and organic social performance.
          </p>
          {coverage ? (
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-foreground-subtle">
              <span>{coverage.paid}</span>
              <span>{coverage.organic}</span>
              {coverage.note ? <span>{coverage.note}</span> : null}
            </div>
          ) : null}
          {freshness ? (
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-foreground-subtle">
              <span>Paid: {freshness.paid}</span>
              <span>Organic: {freshness.organic}</span>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ButtonLink href="/analyst" variant="outline" size="sm">
            <Bot className="h-4 w-4" aria-hidden="true" />
            Ask Cresco AI
          </ButtonLink>

          <DateRangeSelector />

          <span className="text-xs text-foreground-subtle">{dateLabel}</span>

          <AppearanceMenu />
        </div>
      </div>
    </header>
  );
}
