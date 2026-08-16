"use client";

import { Bell, Bot, Calendar, Search } from "lucide-react";
import { AppearanceMenu } from "@/components/theme/appearance-menu";
import { Button, ButtonLink } from "@/components/ui/button";
import { APP_NAME } from "@/lib/constants";

type CommandCentreHeaderProps = {
  dateLabel?: string;
};

export function CommandCentreHeader({ dateLabel }: CommandCentreHeaderProps) {
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
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-[12rem] flex-1 sm:flex-none">
            <span className="sr-only">Global search</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-subtle"
              aria-hidden="true"
            />
            <input
              type="search"
              placeholder="Search campaigns, content, channels…"
              className="h-10 w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-foreground-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>

          <ButtonLink href="/analyst" variant="outline" size="sm">
            <Bot className="h-4 w-4" aria-hidden="true" />
            Ask Cresco AI
          </ButtonLink>

          <Button variant="outline" size="sm" type="button" aria-label="Date range selector">
            <Calendar className="h-4 w-4" aria-hidden="true" />
            {dateLabel ?? "Last 30 days"}
          </Button>

          <ButtonLink href="/notifications" variant="ghost" size="sm" aria-label="Notifications">
            <Bell className="h-4 w-4" aria-hidden="true" />
          </ButtonLink>

          <AppearanceMenu />
        </div>
      </div>
    </header>
  );
}
