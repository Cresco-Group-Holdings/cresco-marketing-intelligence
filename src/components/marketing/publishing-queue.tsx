import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";

export type PublishingQueueStatus =
  | "Draft"
  | "Ready"
  | "Scheduled"
  | "Publishing"
  | "Published"
  | "Failed";

export type PublishingQueueItem = {
  id: string;
  platform: string;
  title: string;
  scheduledAt: string;
  status: PublishingQueueStatus;
  thumbnailLabel?: string;
};

const STATUS_VARIANT: Record<
  PublishingQueueStatus,
  "muted" | "warning" | "success" | "danger" | "paid" | "organic"
> = {
  Draft: "muted",
  Ready: "paid",
  Scheduled: "organic",
  Publishing: "warning",
  Published: "success",
  Failed: "danger",
};

export function PublishingQueue({
  items,
  emptyMessage,
}: {
  items: PublishingQueueItem[];
  emptyMessage?: string;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface-elevated p-6 text-sm text-foreground-muted">
        {emptyMessage ?? "No content scheduled yet."}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface-elevated">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-border bg-surface">
            <tr>
              <th className="px-4 py-3 font-medium text-foreground-subtle">Content</th>
              <th className="px-4 py-3 font-medium text-foreground-subtle">Platform</th>
              <th className="px-4 py-3 font-medium text-foreground-subtle">Scheduled</th>
              <th className="px-4 py-3 font-medium text-foreground-subtle">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-border last:border-b-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div
                      aria-hidden="true"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-hover text-xs font-semibold text-foreground-subtle"
                    >
                      {item.thumbnailLabel ?? item.platform.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="font-medium text-foreground">{item.title}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-foreground-muted">{item.platform}</td>
                <td className="px-4 py-3 text-foreground-muted">{item.scheduledAt}</td>
                <td className="px-4 py-3">
                  <Badge variant={STATUS_VARIANT[item.status]}>{item.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-border px-4 py-3">
        <ButtonLink href="/publishing" variant="ghost" size="sm">
          View publishing queue
        </ButtonLink>
      </div>
    </div>
  );
}

export function ContentCalendarPreview({
  days,
  emptyMessage,
}: {
  days: Array<{
    dateLabel: string;
    items: Array<{ id: string; platform: string; title: string }>;
  }>;
  emptyMessage?: string;
}) {
  if (days.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface-elevated p-6 text-sm text-foreground-muted">
        {emptyMessage ?? "No upcoming calendar events."}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface-elevated p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {days.map((day) => (
          <div key={day.dateLabel} className="rounded-lg border border-border bg-surface p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground-subtle">
              {day.dateLabel}
            </p>
            <ul className="mt-2 space-y-2">
              {day.items.map((item) => (
                <li key={item.id} className="rounded-md bg-surface-hover px-2 py-1.5">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-organic-accent">
                    {item.platform}
                  </p>
                  <p className="truncate text-xs text-foreground">{item.title}</p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <Link href="/calendar" className="text-sm font-medium text-paid-accent hover:underline">
          Open full Content Calendar
        </Link>
      </div>
    </div>
  );
}
