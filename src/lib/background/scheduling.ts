/**
 * Canonical scheduling utilities for background jobs and publications.
 *
 * Policy:
 * - User-entered local time + IANA timezone are preserved on domain records.
 * - Execution uses UTC instants derived at schedule time (including DST boundaries).
 * - Recurring schedules use weekday bitmask + local time + timezone.
 */

export type RecurrenceRule = {
  weekdays: number[];
  localTime: string;
  timezone: string;
  endDate?: string;
  maxOccurrences?: number;
};

export type ScheduledInstant = {
  utc: Date;
  localTime: string;
  timezone: string;
};

const TIME_RE = /^(\d{1,2}):(\d{2})$/;

export function parseLocalTime(value: string): { hour: number; minute: number } {
  const match = TIME_RE.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid local time: ${value}`);
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error(`Invalid local time: ${value}`);
  }
  return { hour, minute };
}

/** Convert a wall-clock instant in `timezone` to UTC `Date`. */
export function localDateTimeToUtc(input: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  timezone: string;
}): Date {
  const probe = new Date(Date.UTC(input.year, input.month - 1, input.day, input.hour, input.minute, 0, 0));
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: input.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(probe).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]),
  );
  const displayed = new Date(
    `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00.000Z`,
  );
  const offsetMs = displayed.getTime() - probe.getTime();
  return new Date(probe.getTime() - offsetMs);
}

export function scheduleLocalDateTime(input: {
  localDate: string;
  localTime: string;
  timezone: string;
}): ScheduledInstant {
  const [year, month, day] = input.localDate.split("-").map(Number);
  const { hour, minute } = parseLocalTime(input.localTime);
  const utc = localDateTimeToUtc({ year, month, day, hour, minute, timezone: input.timezone });
  return { utc, localTime: input.localTime, timezone: input.timezone };
}

export function weekdayInTimezone(date: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, weekday: "short" });
  const label = formatter.format(date);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[label] ?? 0;
}

/** Next occurrence on or after `after` for a recurring local-time rule. */
export function nextRecurrenceOccurrence(
  rule: RecurrenceRule,
  after: Date,
  maxDaysToScan = 370,
): ScheduledInstant | null {
  const { hour, minute } = parseLocalTime(rule.localTime);
  const cursor = new Date(after.getTime());
  cursor.setUTCHours(0, 0, 0, 0);

  for (let i = 0; i < maxDaysToScan; i += 1) {
    const weekday = weekdayInTimezone(cursor, rule.timezone);
    if (rule.weekdays.includes(weekday)) {
      const y = cursor.getUTCFullYear();
      const m = cursor.getUTCMonth() + 1;
      const d = cursor.getUTCDate();
      const utc = localDateTimeToUtc({
        year: y,
        month: m,
        day: d,
        hour,
        minute,
        timezone: rule.timezone,
      });
      if (utc.getTime() > after.getTime()) {
        if (rule.endDate && utc.toISOString() > rule.endDate) {
          return null;
        }
        return { utc, localTime: rule.localTime, timezone: rule.timezone };
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return null;
}

export type MissedExecutionPolicy = "execute_if_within_grace" | "execute_on_recovery" | "skip_if_stale";

export const MISSED_EXECUTION_POLICIES: Record<string, MissedExecutionPolicy> = {
  PUBLISHING: "execute_if_within_grace",
  PROVIDER_SYNC: "execute_on_recovery",
  ANALYTICS_SYNC: "execute_on_recovery",
  WEEKLY_REPORT: "execute_on_recovery",
  AUTOMATION: "execute_on_recovery",
};

export function shouldExecuteMissedJob(input: {
  policy: MissedExecutionPolicy;
  scheduledAt: Date;
  now: Date;
  graceWindowMs?: number;
  maxStaleMs?: number;
}): boolean {
  const lateMs = input.now.getTime() - input.scheduledAt.getTime();
  if (lateMs <= 0) return true;

  switch (input.policy) {
    case "execute_if_within_grace":
      return lateMs <= (input.graceWindowMs ?? 15 * 60_000);
    case "execute_on_recovery":
      return lateMs <= (input.maxStaleMs ?? 7 * 24 * 60 * 60_000);
    case "skip_if_stale":
      return false;
    default:
      return false;
  }
}

/** Minimal 5-field cron matcher for launch schedules (minute hour dom month dow). */
export function cronMatches(cron: string, date: Date, timezone: string): boolean {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const [minute, hour, dom, month, dow] = parts;

  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    minute: "numeric",
    hour: "numeric",
    day: "numeric",
    month: "numeric",
    weekday: "short",
    hour12: false,
  });
  const p = Object.fromEntries(
    formatter.formatToParts(date).filter((x) => x.type !== "literal").map((x) => [x.type, x.value]),
  );
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const fields = {
    minute: Number(p.minute),
    hour: Number(p.hour),
    dom: Number(p.day),
    month: Number(p.month),
    dow: weekdayMap[p.weekday ?? "Sun"] ?? 0,
  };

  const matchField = (expr: string, value: number) => {
    if (expr === "*") return true;
    if (expr.includes(",")) return expr.split(",").some((v) => matchField(v, value));
    if (expr.includes("/")) {
      const [base, step] = expr.split("/");
      const stepNum = Number(step);
      if (!Number.isFinite(stepNum) || stepNum <= 0) return false;
      if (base === "*") return value % stepNum === 0;
      return false;
    }
    return Number(expr) === value;
  };

  return (
    matchField(minute, fields.minute) &&
    matchField(hour, fields.hour) &&
    matchField(dom, fields.dom) &&
    matchField(month, fields.month) &&
    (dow === "*" || matchField(dow, fields.dow))
  );
}

export function idempotencyKeyForScheduledRun(workflowId: string, windowStart: Date): string {
  return `automation:${workflowId}:schedule:${windowStart.toISOString().slice(0, 16)}`;
}
