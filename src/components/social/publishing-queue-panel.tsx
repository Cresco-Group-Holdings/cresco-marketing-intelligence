"use client";

import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import type { PublishingQueueItem } from "@/lib/organic-social/types";

const SECTION_VARIANT: Record<
  PublishingQueueItem["section"],
  "success" | "warning" | "danger" | "muted" | "default"
> = {
  Ready: "default",
  Scheduled: "muted",
  Publishing: "warning",
  Published: "success",
  Failed: "danger",
};

export function PublishingQueuePanel({ items }: { items: PublishingQueueItem[] }) {
  const sections: PublishingQueueItem["section"][] = [
    "Ready",
    "Scheduled",
    "Publishing",
    "Published",
    "Failed",
  ];

  return (
    <section
      aria-labelledby="publishing-queue-heading"
      className="rounded-xl border border-border bg-surface-elevated p-4 sm:p-5"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 id="publishing-queue-heading" className="text-sm font-semibold text-foreground">
            Publishing queue
          </h2>
          <p className="mt-1 text-xs text-foreground-muted">
            Ready, scheduled, and failed publications across organic channels.
          </p>
        </div>
        <ButtonLink href="/publishing" variant="outline" size="sm">
          Open publishing
        </ButtonLink>
      </div>
      <div className="mt-4 space-y-4">
        {sections.map((section) => {
          const sectionItems = items.filter((item) => item.section === section);
          if (sectionItems.length === 0) return null;
          return (
            <div key={section}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground-subtle">
                {section}
              </h3>
              <ul className="mt-2 space-y-2">
                {sectionItems.slice(0, 5).map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                      <p className="text-xs text-foreground-subtle">
                        {item.channel}
                        {item.scheduledAt
                          ? ` · ${new Date(item.scheduledAt).toLocaleString("en-GB")}`
                          : ""}
                      </p>
                      {item.failureReason ? (
                        <p className="mt-1 text-xs text-danger">{item.failureReason}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <Badge variant={SECTION_VARIANT[item.section]}>{item.section}</Badge>
                      {item.previewHref ? (
                        <ButtonLink href={item.previewHref} variant="ghost" size="sm">
                          {item.canRetry ? "Retry" : "Edit"}
                        </ButtonLink>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        {items.length === 0 ? (
          <p className="text-sm text-foreground-muted">No publications in the current queue.</p>
        ) : null}
      </div>
    </section>
  );
}
