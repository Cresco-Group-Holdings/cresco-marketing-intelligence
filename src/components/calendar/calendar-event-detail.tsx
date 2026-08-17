"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CALENDAR_CHANNEL_LABELS,
  CALENDAR_EVENT_STATUS_LABELS,
  CALENDAR_EVENT_TYPE_LABELS,
  formatEventTime,
  formatInTimezone,
  type CalendarChannel,
  type CalendarEvent,
  type CalendarEventStatus,
  type CalendarEventType,
} from "@/components/calendar/types";

type CalendarEventDetailProps = {
  event: CalendarEvent | null;
  open: boolean;
  loading?: boolean;
  error?: string | null;
  actionError?: string | null;
  saving?: boolean;
  onClose: () => void;
  onCancel?: (event: CalendarEvent) => void;
  onRefresh?: (event: CalendarEvent) => void;
};

export function CalendarEventDetail({
  event,
  open,
  loading,
  error,
  actionError,
  saving,
  onClose,
  onCancel,
  onRefresh,
}: CalendarEventDetailProps) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(keyboardEvent: KeyboardEvent) {
      if (keyboardEvent.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const statusLabel = event
    ? (CALENDAR_EVENT_STATUS_LABELS[event.status as CalendarEventStatus] ??
      event.status.replace(/_/g, " ").toLowerCase())
    : "";
  const typeLabel = event
    ? (CALENDAR_EVENT_TYPE_LABELS[event.eventType as CalendarEventType] ??
      event.eventType.replace(/_/g, " ").toLowerCase())
    : "";
  const channelLabel = event?.channel
    ? (CALENDAR_CHANNEL_LABELS[event.channel as CalendarChannel] ??
      event.channel.replace(/_/g, " ").toLowerCase())
    : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-background/60"
        aria-label="Close event details"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendar-event-detail-title"
        className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-border bg-surface-elevated shadow-xl"
      >
        <div className="flex items-start justify-between border-b border-border-subtle px-6 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-foreground-subtle">Event details</p>
            <h2 id="calendar-event-detail-title" className="mt-1 text-lg font-semibold text-foreground">
              {event?.title ?? "Loading event…"}
            </h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {loading ? <p className="text-sm text-foreground-muted">Loading event details…</p> : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {actionError ? <p className="text-sm text-red-600">{actionError}</p> : null}

          {event ? (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge variant={event.status === "OVERDUE" ? "warning" : "muted"}>{statusLabel}</Badge>
                <Badge variant="muted">{typeLabel}</Badge>
                {event.hasConflict ? <Badge variant="warning">Conflict</Badge> : null}
              </div>

              {event.description ? (
                <div>
                  <h3 className="text-sm font-medium text-foreground-muted">Description</h3>
                  <p className="mt-1 text-sm text-foreground-muted">{event.description}</p>
                </div>
              ) : null}

              <div className="space-y-3 text-sm">
                <div>
                  <h3 className="font-medium text-foreground-muted">Schedule</h3>
                  <p className="mt-1 text-foreground-muted">{formatEventTime(event)}</p>
                  {event.endsAt ? (
                    <p className="text-foreground-subtle">
                      Ends{" "}
                      {formatInTimezone(event.endsAt, event.timezone, {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  ) : null}
                  <p className="text-foreground-subtle">Timezone: {event.timezone}</p>
                </div>

                {channelLabel ? (
                  <div>
                    <h3 className="font-medium text-foreground-muted">Channel</h3>
                    <p className="mt-1 text-foreground-muted">{channelLabel}</p>
                  </div>
                ) : null}

                {event.brandName ? (
                  <div>
                    <h3 className="font-medium text-foreground-muted">Brand</h3>
                    <p className="mt-1 text-foreground-muted">{event.brandName}</p>
                  </div>
                ) : null}

                {event.campaignName ? (
                  <div>
                    <h3 className="font-medium text-foreground-muted">Campaign</h3>
                    <p className="mt-1 text-foreground-muted">{event.campaignName}</p>
                  </div>
                ) : null}

                {event.contentTitle ? (
                  <div>
                    <h3 className="font-medium text-foreground-muted">Content</h3>
                    <p className="mt-1 text-foreground-muted">{event.contentTitle}</p>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </div>

        {event ? (
          <div className="flex flex-wrap gap-2 border-t border-border-subtle px-6 py-4">
            {onRefresh ? (
              <Button variant="outline" size="sm" onClick={() => onRefresh(event)}>
                Refresh
              </Button>
            ) : null}
            {onCancel && event.status !== "CANCELLED" ? (
              <Button
                variant="secondary"
                size="sm"
                disabled={saving}
                onClick={() => onCancel(event)}
              >
                {saving ? "Cancelling…" : "Cancel event"}
              </Button>
            ) : null}
            <Button variant="primary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
