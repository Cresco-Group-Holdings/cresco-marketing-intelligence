import {
  DEFAULT_AUTOMATION_TIMEZONE,
  DELAY_TYPES,
  type DelayType,
} from "./constants";
import {
  assertSupportedTimeZone,
  isSupportedTimeZone,
  wallClockInZone,
  zonedWallClockToUtc,
} from "@/lib/analytics/timezone";

export type DelayConfig = {
  delayType: DelayType;
  durationMinutes?: number;
  untilAt?: string;
  timezone?: string;
  businessDaysOnly?: boolean;
  daypartStart?: string;
  daypartEnd?: string;
  waitEventType?: string;
  maxWaitMinutes?: number;
};

const MS_PER_MINUTE = 60_000;

function resolveTimezone(timezone?: string): string {
  if (timezone && isSupportedTimeZone(timezone)) return timezone;
  return DEFAULT_AUTOMATION_TIMEZONE;
}

function parseTimeOfDay(timeOfDay: string): { hour: number; minute: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(timeOfDay.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour > 23 || minute > 59) {
    return null;
  }
  return { hour, minute };
}

function isBusinessDay(date: Date): boolean {
  const day = date.getUTCDay();
  return day !== 0 && day !== 6;
}

function addBusinessDays(from: Date, days: number): Date {
  let remaining = days;
  const result = new Date(from);
  while (remaining > 0) {
    result.setUTCDate(result.getUTCDate() + 1);
    if (isBusinessDay(result)) remaining -= 1;
  }
  return result;
}

function nextDaypartWindow(
  from: Date,
  timezone: string,
  daypartStart: string,
  daypartEnd: string,
): Date {
  const start = parseTimeOfDay(daypartStart);
  const end = parseTimeOfDay(daypartEnd);
  if (!start || !end) return from;

  const wall = wallClockInZone(from, timezone);
  const windowStart = zonedWallClockToUtc(
    { year: wall.year, month: wall.month, day: wall.day, hour: start.hour, minute: start.minute, second: 0 },
    timezone,
  );
  const windowEnd = zonedWallClockToUtc(
    { year: wall.year, month: wall.month, day: wall.day, hour: end.hour, minute: end.minute, second: 0 },
    timezone,
  );

  if (from < windowStart) return windowStart;
  if (from <= windowEnd) return from;
  const tomorrow = new Date(from.getTime() + 86_400_000);
  const tomorrowWall = wallClockInZone(tomorrow, timezone);
  return zonedWallClockToUtc(
    { year: tomorrowWall.year, month: tomorrowWall.month, day: tomorrowWall.day, hour: start.hour, minute: start.minute, second: 0 },
    timezone,
  );
}

export function isValidDelayType(value: string): value is DelayType {
  return (DELAY_TYPES as readonly string[]).includes(value);
}

export function validateDelayConfig(config: DelayConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!isValidDelayType(config.delayType)) {
    return { valid: false, errors: [`Invalid delay type: ${config.delayType}`] };
  }

  if (config.timezone && !isSupportedTimeZone(config.timezone)) {
    errors.push(`Unsupported timezone: ${config.timezone}`);
  }

  switch (config.delayType) {
    case "FIXED_DURATION":
      if (!config.durationMinutes || config.durationMinutes <= 0) {
        errors.push("FIXED_DURATION requires positive durationMinutes.");
      }
      break;
    case "UNTIL_DATETIME":
      if (!config.untilAt || Number.isNaN(Date.parse(config.untilAt))) {
        errors.push("UNTIL_DATETIME requires valid untilAt.");
      }
      break;
    case "UNTIL_BUSINESS_DAY":
      if (!config.durationMinutes || config.durationMinutes <= 0) {
        errors.push("UNTIL_BUSINESS_DAY requires positive durationMinutes.");
      }
      break;
    case "UNTIL_DAYPART":
      if (!config.daypartStart || !parseTimeOfDay(config.daypartStart)) {
        errors.push("UNTIL_DAYPART requires daypartStart in HH:mm format.");
      }
      if (!config.daypartEnd || !parseTimeOfDay(config.daypartEnd)) {
        errors.push("UNTIL_DAYPART requires daypartEnd in HH:mm format.");
      }
      break;
    case "WAIT_FOR_EVENT":
      if (!config.waitEventType) {
        errors.push("WAIT_FOR_EVENT requires waitEventType.");
      }
      break;
    case "WAIT_FOR_CONDITION":
      break;
    default:
      break;
  }

  return { valid: errors.length === 0, errors };
}

export function computeDelayResumeAt(config: DelayConfig, from = new Date()): Date {
  const timezone = resolveTimezone(config.timezone);
  assertSupportedTimeZone(timezone);

  let resumeAt: Date;

  switch (config.delayType) {
    case "FIXED_DURATION":
      resumeAt = new Date(from.getTime() + (config.durationMinutes ?? 0) * MS_PER_MINUTE);
      break;
    case "UNTIL_DATETIME":
      resumeAt = config.untilAt ? new Date(config.untilAt) : from;
      break;
    case "UNTIL_BUSINESS_DAY":
      resumeAt = addBusinessDays(from, Math.ceil((config.durationMinutes ?? 0) / (24 * 60)));
      break;
    case "UNTIL_DAYPART":
      resumeAt = nextDaypartWindow(from, timezone, config.daypartStart ?? "09:00", config.daypartEnd ?? "17:00");
      break;
    case "WAIT_FOR_EVENT":
    case "WAIT_FOR_CONDITION":
      resumeAt = new Date(from.getTime() + (config.maxWaitMinutes ?? 7 * 24 * 60) * MS_PER_MINUTE);
      break;
    default:
      resumeAt = from;
  }

  if (config.maxWaitMinutes) {
    const maxAt = new Date(from.getTime() + config.maxWaitMinutes * MS_PER_MINUTE);
    if (resumeAt > maxAt) resumeAt = maxAt;
  }

  return resumeAt;
}
