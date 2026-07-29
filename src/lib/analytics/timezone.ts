import { AppError } from "@/lib/errors";

export const DEFAULT_ANALYTICS_TIMEZONE = "UTC";

export type AnalyticsGranularity = "DAY" | "WEEK" | "MONTH";

const partFormatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string) {
  let cached = partFormatters.get(timeZone);
  if (!cached) {
    cached = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partFormatters.set(timeZone, cached);
  }
  return cached;
}

export function isSupportedTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function assertSupportedTimeZone(timeZone: string): string {
  if (!isSupportedTimeZone(timeZone)) {
    throw new AppError("VALIDATION_ERROR", `Unsupported analytics timezone: ${timeZone}`);
  }
  return timeZone;
}

/**
 * Resolution order required by the analytics contract: an explicit brand setting wins, then the
 * organisation default, then UTC. Unsupported identifiers are ignored rather than throwing so a
 * bad stored value can never take reporting offline.
 */
export function resolveAnalyticsTimezone(input: {
  brandTimezone?: string | null;
  organisationTimezone?: string | null;
  requestedTimezone?: string | null;
}): string {
  if (input.requestedTimezone) return assertSupportedTimeZone(input.requestedTimezone);
  for (const candidate of [input.brandTimezone, input.organisationTimezone]) {
    if (candidate && isSupportedTimeZone(candidate)) return candidate;
  }
  return DEFAULT_ANALYTICS_TIMEZONE;
}

type WallClock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export function wallClockInZone(instant: Date, timeZone: string): WallClock {
  const parts = formatter(timeZone).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  const hour = read("hour");
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    // Intl renders midnight as 24 in some ICU builds under hour12: false.
    hour: hour === 24 ? 0 : hour,
    minute: read("minute"),
    second: read("second"),
  };
}

function offsetMinutes(instant: Date, timeZone: string): number {
  const wall = wallClockInZone(instant, timeZone);
  const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
  return (asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60_000;
}

/**
 * Converts a business-local wall-clock time to the matching UTC instant. The offset is sampled
 * twice because the first sample uses a UTC guess that can sit on the wrong side of a daylight
 * saving transition.
 */
export function zonedWallClockToUtc(wall: WallClock, timeZone: string): Date {
  assertSupportedTimeZone(timeZone);
  const guess = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
  const firstOffset = offsetMinutes(new Date(guess), timeZone);
  const firstPass = new Date(guess - firstOffset * 60_000);
  const secondOffset = offsetMinutes(firstPass, timeZone);
  return secondOffset === firstOffset ? firstPass : new Date(guess - secondOffset * 60_000);
}

/** Start of the business-local calendar day containing `instant`, expressed in UTC. */
export function startOfZonedDay(instant: Date, timeZone: string): Date {
  const wall = wallClockInZone(instant, timeZone);
  return zonedWallClockToUtc({ ...wall, hour: 0, minute: 0, second: 0 }, timeZone);
}

/** Exclusive end of the business-local calendar day containing `instant`, expressed in UTC. */
export function endOfZonedDay(instant: Date, timeZone: string): Date {
  const start = startOfZonedDay(instant, timeZone);
  const nextGuess = new Date(start.getTime() + 36 * 3_600_000);
  return startOfZonedDay(nextGuess, timeZone);
}

/**
 * Expands a requested range to whole business-local days so a report never shows a partial day at
 * either edge, and so DST-shortened or DST-lengthened days stay whole.
 */
export function zonedRangeToUtc(from: Date, to: Date, timeZone: string) {
  const start = startOfZonedDay(from, timeZone);
  const end = endOfZonedDay(to, timeZone);
  if (end <= start) {
    throw new AppError("VALIDATION_ERROR", "The analytics date range must cover at least one day.");
  }
  return { from: start, to: new Date(end.getTime() - 1), timeZone };
}

const pad = (value: number) => String(value).padStart(2, "0");

export function zonedDayKey(instant: Date, timeZone: string): string {
  const wall = wallClockInZone(instant, timeZone);
  return `${wall.year}-${pad(wall.month)}-${pad(wall.day)}`;
}

/** ISO weekday index (1 = Monday) for the business-local day containing `instant`. */
function zonedWeekday(instant: Date, timeZone: string): number {
  const wall = wallClockInZone(instant, timeZone);
  const day = new Date(Date.UTC(wall.year, wall.month - 1, wall.day)).getUTCDay();
  return day === 0 ? 7 : day;
}

export function zonedPeriodKey(
  instant: Date,
  timeZone: string,
  granularity: AnalyticsGranularity,
): string {
  const wall = wallClockInZone(instant, timeZone);
  if (granularity === "MONTH") return `${wall.year}-${pad(wall.month)}`;
  if (granularity === "DAY") return zonedDayKey(instant, timeZone);
  const dayStart = startOfZonedDay(instant, timeZone);
  const mondayOffset = zonedWeekday(instant, timeZone) - 1;
  const mondayGuess = new Date(dayStart.getTime() - mondayOffset * 86_400_000 + 12 * 3_600_000);
  return zonedDayKey(mondayGuess, timeZone);
}

/** Whole business-local days covered by a UTC range, used as a derived-metric denominator. */
export function zonedDayCount(from: Date, to: Date, timeZone: string): number {
  let cursor = startOfZonedDay(from, timeZone);
  let days = 0;
  while (cursor <= to && days < 1_000) {
    days += 1;
    cursor = endOfZonedDay(new Date(cursor.getTime() + 3_600_000), timeZone);
  }
  return Math.max(days, 1);
}
