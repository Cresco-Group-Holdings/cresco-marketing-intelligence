"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarEventCard } from "@/components/calendar/calendar-event-card";
import {
  addDays,
  groupEventsByDate,
  startOfWeek,
  toDateKey,
  type CalendarEvent,
} from "@/components/calendar/types";
import { cn } from "@/lib/utils";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type CalendarWeekGridProps = {
  anchorDate: Date;
  events: CalendarEvent[];
  draggingEventId?: string | null;
  dropTargetDate?: string | null;
  rescheduling?: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onSelectEvent: (event: CalendarEvent) => void;
  onDragStart: (event: CalendarEvent) => void;
  onDragEnd: () => void;
  onDropOnDate: (dateKey: string) => void;
  onDragOverDate: (dateKey: string | null) => void;
};

export function CalendarWeekGrid({
  anchorDate,
  events,
  draggingEventId,
  dropTargetDate,
  rescheduling,
  onPrevious,
  onNext,
  onToday,
  onSelectEvent,
  onDragStart,
  onDragEnd,
  onDropOnDate,
  onDragOverDate,
}: CalendarWeekGridProps) {
  const weekStart = startOfWeek(anchorDate);
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );
  const grouped = useMemo(() => groupEventsByDate(events), [events]);

  const weekLabel = `${days[0].toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  })} – ${days[6].toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`;

  return (
    <Card>
      <CardContent className="space-y-4 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">Week of {weekLabel}</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onPrevious} aria-label="Previous week">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={onToday}>
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={onNext} aria-label="Next week">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {rescheduling ? (
          <p className="text-sm text-foreground-muted">Rescheduling event…</p>
        ) : (
          <p className="text-xs text-foreground-subtle">Drag events between days to reschedule.</p>
        )}

        <div className="overflow-x-auto">
          <div className="min-w-[840px]">
            <div className="grid grid-cols-7 border-b border-border pb-2">
              {days.map((day, index) => {
                const dateKey = toDateKey(day);
                const isToday = dateKey === toDateKey(new Date());
                return (
                  <div key={dateKey} className="px-2 text-center">
                    <p className="text-xs font-medium uppercase text-foreground-subtle">{WEEKDAY_LABELS[index]}</p>
                    <p
                      className={cn(
                        "mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full text-sm",
                        isToday && "bg-foreground font-semibold text-white",
                      )}
                    >
                      {day.getDate()}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-7">
              {days.map((day) => {
                const dateKey = toDateKey(day);
                const dayEvents = grouped.get(dateKey) ?? [];
                const isDropTarget = dropTargetDate === dateKey;

                return (
                  <div
                    key={dateKey}
                    className={cn(
                      "min-h-[320px] border-r border-border-subtle p-2 last:border-r-0",
                      isDropTarget && "bg-sky-50 ring-2 ring-inset ring-sky-300",
                    )}
                    onDragOver={(dragEvent) => {
                      dragEvent.preventDefault();
                      dragEvent.dataTransfer.dropEffect = "move";
                      onDragOverDate(dateKey);
                    }}
                    onDragLeave={() => onDragOverDate(null)}
                    onDrop={(dragEvent) => {
                      dragEvent.preventDefault();
                      onDropOnDate(dateKey);
                    }}
                  >
                    <div className="space-y-2">
                      {dayEvents.length === 0 ? (
                        <p className="text-xs text-foreground-subtle">No events</p>
                      ) : (
                        dayEvents.map((event) => (
                          <CalendarEventCard
                            key={event.id}
                            event={event}
                            draggable={event.status !== "CANCELLED"}
                            onSelect={onSelectEvent}
                            onDragStart={onDragStart}
                            onDragEnd={onDragEnd}
                          />
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {draggingEventId ? (
          <p className="text-xs text-foreground-subtle">Drop on a day to move the selected event.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
