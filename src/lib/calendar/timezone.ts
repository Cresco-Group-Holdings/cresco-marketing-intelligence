import type { CalendarEventType } from "@prisma/client";
import {
  assertSupportedTimeZone,
  endOfZonedDay,
  startOfZonedDay,
  wallClockInZone,
  zonedWallClockToUtc,
} from "@/lib/analytics/timezone";

export function resolveCalendarTimezone(
  requested?: string | null,
  brandTimezone?: string | null,
  organisationTimezone?: string | null,
): string {
  if (requested) return assertSupportedTimeZone(requested);
  for (const candidate of [brandTimezone, organisationTimezone]) {
    if (candidate) {
      try {
        return assertSupportedTimeZone(candidate);
      } catch {
        // ignore invalid stored values
      }
    }
  }
  return "UTC";
}

export function allDayStartsAt(instant: Date, timeZone: string): Date {
  return startOfZonedDay(instant, timeZone);
}

export function allDayEndsAt(instant: Date, timeZone: string): Date {
  const exclusiveEnd = endOfZonedDay(instant, timeZone);
  return new Date(exclusiveEnd.getTime() - 1);
}

export function buildAllDayRange(date: Date, timeZone: string): { startsAt: Date; endsAt: Date } {
  const tz = assertSupportedTimeZone(timeZone);
  return {
    startsAt: allDayStartsAt(date, tz),
    endsAt: allDayEndsAt(date, tz),
  };
}

export function formatCalendarEventForDisplay(input: {
  title: string;
  startsAt: Date;
  endsAt?: Date | null;
  allDay: boolean;
  timezone: string;
  type: CalendarEventType;
}): string {
  const tz = assertSupportedTimeZone(input.timezone);
  if (input.allDay) {
    const wall = wallClockInZone(input.startsAt, tz);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${input.title} — ${wall.year}-${pad(wall.month)}-${pad(wall.day)} (all day)`;
  }
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    dateStyle: "medium",
    timeStyle: "short",
  });
  const startLabel = formatter.format(input.startsAt);
  if (!input.endsAt) return `${input.title} — ${startLabel}`;
  return `${input.title} — ${startLabel} – ${formatter.format(input.endsAt)}`;
}

export function calendarRangeBoundaries(
  from: Date,
  to: Date,
  timeZone: string,
  view: "day" | "week" | "month" | "agenda" = "month",
): { from: Date; to: Date; timezone: string } {
  const tz = assertSupportedTimeZone(timeZone);
  const rangeStart = startOfZonedDay(from, tz);
  let rangeEndExclusive = endOfZonedDay(to, tz);

  if (view === "week") {
    const wall = wallClockInZone(from, tz);
    const day = new Date(Date.UTC(wall.year, wall.month - 1, wall.day)).getUTCDay();
    const mondayOffset = day === 0 ? 6 : day - 1;
    const mondayStart = zonedWallClockToUtc(
      { ...wall, day: wall.day - mondayOffset, hour: 0, minute: 0, second: 0 },
      tz,
    );
    rangeEndExclusive = new Date(mondayStart.getTime() + 7 * 86_400_000);
  }

  if (rangeEndExclusive <= rangeStart) {
    rangeEndExclusive = new Date(rangeStart.getTime() + 86_400_000);
  }

  return {
    from: rangeStart,
    to: new Date(rangeEndExclusive.getTime() - 1),
    timezone: tz,
  };
}
