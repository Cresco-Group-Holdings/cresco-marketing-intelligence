"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CALENDAR_CHANNELS,
  CALENDAR_CHANNEL_LABELS,
  CALENDAR_EVENT_TYPES,
  CALENDAR_EVENT_TYPE_LABELS,
  type CreateCalendarEventInput,
} from "@/components/calendar/types";

type CalendarCreateEventDialogProps = {
  open: boolean;
  organisationId: string;
  defaultProjectId?: string | null;
  defaultBrandId?: string | null;
  defaultTimezone?: string;
  saving?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (input: CreateCalendarEventInput) => void;
};

function toLocalInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function CalendarCreateEventDialog({
  open,
  organisationId,
  defaultProjectId,
  defaultBrandId,
  defaultTimezone = "UTC",
  saving,
  error,
  onClose,
  onSubmit,
}: CalendarCreateEventDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState<string>("MANUAL");
  const [channel, setChannel] = useState("");
  const [startsAt, setStartsAt] = useState(toLocalInputValue(new Date()));
  const [endsAt, setEndsAt] = useState("");
  const [timezone, setTimezone] = useState(defaultTimezone);
  const [allDay, setAllDay] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDescription("");
    setEventType("MANUAL");
    setChannel("");
    setStartsAt(toLocalInputValue(new Date()));
    setEndsAt("");
    setTimezone(defaultTimezone);
    setAllDay(false);
    setValidationError(null);
  }, [open, defaultTimezone]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(keyboardEvent: KeyboardEvent) {
      if (keyboardEvent.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  function handleSubmit() {
    if (!title.trim()) {
      setValidationError("Title is required.");
      return;
    }
    if (!startsAt) {
      setValidationError("Start time is required.");
      return;
    }

    const startIso = new Date(startsAt).toISOString();
    const endIso = endsAt ? new Date(endsAt).toISOString() : undefined;
    if (endIso && new Date(endIso).getTime() < new Date(startIso).getTime()) {
      setValidationError("End time must be after start time.");
      return;
    }

    setValidationError(null);
    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      eventType,
      channel: channel || undefined,
      projectId: defaultProjectId ?? undefined,
      brandId: defaultBrandId ?? undefined,
      startsAt: startIso,
      endsAt: endIso,
      timezone: timezone.trim() || defaultTimezone,
      allDay,
    });
  }

  const selectClassName =
    "block w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground shadow-sm focus-visible:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-background/60"
        aria-label="Close create event dialog"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendar-create-event-title"
        className="relative z-10 w-full max-w-lg rounded-xl border border-border bg-surface-elevated shadow-xl"
      >
        <div className="flex items-start justify-between border-b border-border-subtle px-6 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-foreground-subtle">New event</p>
            <h2 id="calendar-create-event-title" className="mt-1 text-lg font-semibold text-foreground">
              Create manual calendar event
            </h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <Input
            label="Title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Launch announcement"
          />
          <div className="space-y-2">
            <label htmlFor="calendar-event-description" className="block text-sm font-medium text-foreground-muted">
              Description
            </label>
            <textarea
              id="calendar-event-description"
              className="block min-h-[88px] w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-foreground-subtle focus-visible:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional notes for the team"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="calendar-event-type" className="block text-sm font-medium text-foreground-muted">
                Event type
              </label>
              <select
                id="calendar-event-type"
                className={selectClassName}
                value={eventType}
                onChange={(event) => setEventType(event.target.value)}
              >
                {CALENDAR_EVENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {CALENDAR_EVENT_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="calendar-event-channel" className="block text-sm font-medium text-foreground-muted">
                Channel
              </label>
              <select
                id="calendar-event-channel"
                className={selectClassName}
                value={channel}
                onChange={(event) => setChannel(event.target.value)}
              >
                <option value="">No channel</option>
                {CALENDAR_CHANNELS.map((item) => (
                  <option key={item} value={item}>
                    {CALENDAR_CHANNEL_LABELS[item]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Starts at"
              type="datetime-local"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
            />
            <Input
              label="Ends at"
              type="datetime-local"
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
            />
          </div>

          <Input
            label="Timezone"
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
            hint="Events display in this timezone (IANA identifier)."
          />

          <label className="flex items-center gap-2 text-sm text-foreground-muted">
            <input
              type="checkbox"
              checked={allDay}
              onChange={(event) => setAllDay(event.target.checked)}
              className="rounded border-border"
            />
            All-day event
          </label>

          {validationError ? <p className="text-sm text-red-600">{validationError}</p> : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {!defaultBrandId ? (
            <p className="text-xs text-foreground-subtle">
              Select a brand in the workspace header to associate this event with a brand context.
            </p>
          ) : null}
          <p className="text-xs text-foreground-subtle">Organisation: {organisationId}</p>
        </div>

        <div className="flex justify-end gap-2 border-t border-border-subtle px-6 py-4">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Creating…" : "Create event"}
          </Button>
        </div>
      </div>
    </div>
  );
}
