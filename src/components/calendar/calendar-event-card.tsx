"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  CALENDAR_CHANNEL_LABELS,
  CALENDAR_EVENT_STATUS_LABELS,
  type CalendarChannel,
  type CalendarEvent,
  type CalendarEventStatus,
  formatEventTime,
} from "@/components/calendar/types";

type CalendarEventCardProps = {
  event: CalendarEvent;
  compact?: boolean;
  draggable?: boolean;
  onSelect?: (event: CalendarEvent) => void;
  onDragStart?: (event: CalendarEvent) => void;
  onDragEnd?: () => void;
};

function statusVariant(status: string): "default" | "muted" | "warning" {
  if (status === "OVERDUE" || status === "FAILED") return "warning";
  if (status === "CANCELLED" || status === "DRAFT") return "muted";
  return "default";
}

function channelLabel(channel?: string | null): string | null {
  if (!channel) return null;
  return CALENDAR_CHANNEL_LABELS[channel as CalendarChannel] ?? channel.replace(/_/g, " ").toLowerCase();
}

export function CalendarEventCard({
  event,
  compact = false,
  draggable = false,
  onSelect,
  onDragStart,
  onDragEnd,
}: CalendarEventCardProps) {
  const channel = channelLabel(event.channel);
  const statusLabel =
    CALENDAR_EVENT_STATUS_LABELS[event.status as CalendarEventStatus] ??
    event.status.replace(/_/g, " ").toLowerCase();

  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={(dragEvent) => {
        dragEvent.dataTransfer.setData("text/calendar-event-id", event.id);
        dragEvent.dataTransfer.effectAllowed = "move";
        onDragStart?.(event);
      }}
      onDragEnd={() => onDragEnd?.()}
      onClick={() => onSelect?.(event)}
      className={cn(
        "w-full rounded-md border text-left transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        event.hasConflict ? "border-amber-400 bg-amber-50" : "border-border bg-surface-elevated",
        compact ? "px-2 py-1" : "px-3 py-2",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={cn("font-medium text-foreground", compact ? "text-xs" : "text-sm")}>{event.title}</p>
        {!compact && (event.hasConflict || event.status === "OVERDUE") ? (
          <Badge variant="warning" className="shrink-0">
            {event.hasConflict ? "Conflict" : statusLabel}
          </Badge>
        ) : null}
      </div>
      <p className={cn("text-foreground-muted", compact ? "text-[11px]" : "text-xs")}>
        {formatEventTime(event)}
        {channel ? ` · ${channel}` : ""}
      </p>
      {!compact && event.campaignName ? (
        <p className="mt-1 truncate text-xs text-foreground-subtle">{event.campaignName}</p>
      ) : null}
      {compact && event.status !== "SCHEDULED" ? (
        <Badge variant={statusVariant(event.status)} className="mt-1">
          {statusLabel}
        </Badge>
      ) : null}
    </button>
  );
}
