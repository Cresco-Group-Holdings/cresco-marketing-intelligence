"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarEventCard } from "@/components/calendar/calendar-event-card";
import type { CalendarEvent } from "@/components/calendar/types";

type CalendarUpcomingPanelProps = {
  events: CalendarEvent[];
  loading?: boolean;
  error?: string | null;
  onSelectEvent?: (event: CalendarEvent) => void;
};

export function CalendarUpcomingPanel({
  events,
  loading,
  error,
  onSelectEvent,
}: CalendarUpcomingPanelProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Upcoming</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? <p className="text-sm text-slate-600">Loading upcoming events…</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {!loading && !error && events.length === 0 ? (
          <p className="text-sm text-slate-600">No upcoming events in the next few days.</p>
        ) : null}
        {events.map((event) => (
          <CalendarEventCard
            key={event.id}
            event={event}
            compact
            onSelect={onSelectEvent}
          />
        ))}
      </CardContent>
    </Card>
  );
}
