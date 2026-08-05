"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarEventCard } from "@/components/calendar/calendar-event-card";
import { addDays, groupEventsByDate, parseDateKey, toDateKey, type CalendarEvent } from "@/components/calendar/types";

type CalendarListViewProps = {
  anchorDate: Date;
  events: CalendarEvent[];
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onSelectEvent: (event: CalendarEvent) => void;
};

export function CalendarListView({
  anchorDate,
  events,
  onPrevious,
  onNext,
  onToday,
  onSelectEvent,
}: CalendarListViewProps) {
  const grouped = useMemo(() => groupEventsByDate(events), [events]);
  const rangeStart = anchorDate;
  const rangeEnd = addDays(rangeStart, 29);
  const rangeLabel = `${rangeStart.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })} – ${rangeEnd.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`;

  const dateKeys = useMemo(() => {
    const keys: string[] = [];
    for (let index = 0; index < 30; index += 1) {
      keys.push(toDateKey(addDays(rangeStart, index)));
    }
    return keys;
  }, [rangeStart]);

  const hasEvents = events.length > 0;

  return (
    <Card>
      <CardContent className="space-y-4 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">{rangeLabel}</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onPrevious} aria-label="Previous range">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={onToday}>
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={onNext} aria-label="Next range">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {!hasEvents ? (
          <p className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-600">
            No events in this 30-day range. Adjust filters or create a manual event.
          </p>
        ) : (
          <div className="space-y-4">
            {dateKeys.map((dateKey) => {
              const dayEvents = grouped.get(dateKey);
              if (!dayEvents || dayEvents.length === 0) return null;
              const day = parseDateKey(dateKey);
              return (
                <Card key={dateKey}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      {day.toLocaleDateString("en-GB", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {dayEvents.map((event) => (
                      <CalendarEventCard key={event.id} event={event} onSelect={onSelectEvent} />
                    ))}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
