"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarEventCard } from "@/components/calendar/calendar-event-card";
import {
  addDays,
  endOfMonth,
  groupEventsByDate,
  parseDateKey,
  startOfMonth,
  startOfWeek,
  toDateKey,
  type CalendarEvent,
} from "@/components/calendar/types";
import { cn } from "@/lib/utils";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type CalendarMonthGridProps = {
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

export function CalendarMonthGrid({
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
}: CalendarMonthGridProps) {
  const grouped = useMemo(() => groupEventsByDate(events), [events]);

  const weeks = useMemo(() => {
    const monthStart = startOfMonth(anchorDate);
    const monthEnd = endOfMonth(anchorDate);
    const gridStart = startOfWeek(monthStart);
    const gridEnd = startOfWeek(monthEnd);
    const totalDays = Math.round((gridEnd.getTime() - gridStart.getTime()) / (24 * 60 * 60 * 1000)) + 7;
    const days: Date[] = [];
    for (let index = 0; index < totalDays; index += 1) {
      days.push(addDays(gridStart, index));
    }
    const rows: Date[][] = [];
    for (let index = 0; index < days.length; index += 7) {
      rows.push(days.slice(index, index + 7));
    }
    return rows;
  }, [anchorDate]);

  const monthLabel = anchorDate.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  return (
    <Card>
      <CardContent className="space-y-4 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">{monthLabel}</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onPrevious} aria-label="Previous month">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={onToday}>
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={onNext} aria-label="Next month">
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
          <div className="min-w-[720px]">
            <div className="grid grid-cols-7 border-b border-border pb-2">
              {WEEKDAY_LABELS.map((label) => (
                <div key={label} className="px-2 text-center text-xs font-medium uppercase text-foreground-subtle">
                  {label}
                </div>
              ))}
            </div>

            <div className="divide-y divide-border">
              {weeks.map((week) => (
                <div key={toDateKey(week[0])} className="grid grid-cols-7">
                  {week.map((day) => {
                    const dateKey = toDateKey(day);
                    const dayEvents = grouped.get(dateKey) ?? [];
                    const inCurrentMonth = day.getMonth() === anchorDate.getMonth();
                    const isToday = dateKey === toDateKey(new Date());
                    const isDropTarget = dropTargetDate === dateKey;

                    return (
                      <div
                        key={dateKey}
                        className={cn(
                          "min-h-[120px] border-r border-border-subtle p-2 last:border-r-0",
                          !inCurrentMonth && "bg-surface-subtle/80",
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
                        <div className="mb-2 flex items-center justify-between">
                          <span
                            className={cn(
                              "inline-flex h-7 w-7 items-center justify-center rounded-full text-sm",
                              isToday && "bg-primary font-semibold text-primary-foreground",
                              !isToday && inCurrentMonth && "text-foreground",
                              !inCurrentMonth && "text-foreground-subtle",
                            )}
                          >
                            {day.getDate()}
                          </span>
                          {dayEvents.length > 0 ? (
                            <span className="text-[11px] text-foreground-subtle">{dayEvents.length}</span>
                          ) : null}
                        </div>
                        <div className="space-y-1">
                          {dayEvents.slice(0, 3).map((event) => (
                            <CalendarEventCard
                              key={event.id}
                              event={event}
                              compact
                              draggable={event.status !== "CANCELLED"}
                              onSelect={onSelectEvent}
                              onDragStart={onDragStart}
                              onDragEnd={onDragEnd}
                            />
                          ))}
                          {dayEvents.length > 3 ? (
                            <button
                              type="button"
                              className="text-xs text-foreground-subtle hover:text-foreground"
                              onClick={() => onSelectEvent(dayEvents[3])}
                            >
                              +{dayEvents.length - 3} more
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
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

export { parseDateKey };
