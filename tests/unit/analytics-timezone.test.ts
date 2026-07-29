import { describe, expect, it } from "vitest";
import {
  DEFAULT_ANALYTICS_TIMEZONE,
  assertSupportedTimeZone,
  endOfZonedDay,
  isSupportedTimeZone,
  resolveAnalyticsTimezone,
  startOfZonedDay,
  zonedDayCount,
  zonedDayKey,
  zonedPeriodKey,
  zonedRangeToUtc,
  zonedWallClockToUtc,
} from "@/lib/analytics/timezone";

const wall = (
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
) => ({ year, month, day, hour, minute, second });

describe("analytics timezone resolution", () => {
  it("prefers the request, then the brand, then the organisation, then UTC", () => {
    expect(
      resolveAnalyticsTimezone({
        requestedTimezone: "Asia/Tokyo",
        brandTimezone: "Europe/London",
        organisationTimezone: "America/New_York",
      }),
    ).toBe("Asia/Tokyo");
    expect(
      resolveAnalyticsTimezone({
        brandTimezone: "Europe/London",
        organisationTimezone: "America/New_York",
      }),
    ).toBe("Europe/London");
    expect(resolveAnalyticsTimezone({ organisationTimezone: "America/New_York" })).toBe(
      "America/New_York",
    );
    expect(resolveAnalyticsTimezone({})).toBe(DEFAULT_ANALYTICS_TIMEZONE);
  });

  it("ignores an unusable stored identifier but rejects an unusable requested one", () => {
    expect(resolveAnalyticsTimezone({ brandTimezone: "Mars/Olympus" })).toBe("UTC");
    expect(() => resolveAnalyticsTimezone({ requestedTimezone: "Mars/Olympus" })).toThrow(
      "Unsupported analytics timezone",
    );
    expect(isSupportedTimeZone("Europe/Berlin")).toBe(true);
    expect(isSupportedTimeZone("Not/AZone")).toBe(false);
    expect(assertSupportedTimeZone("UTC")).toBe("UTC");
  });
});

describe("business-local boundary conversion", () => {
  it("converts wall-clock time to UTC on both sides of a DST change", () => {
    // Europe/London is UTC+0 in winter and UTC+1 in summer.
    expect(zonedWallClockToUtc(wall(2026, 1, 15), "Europe/London").toISOString()).toBe(
      "2026-01-15T00:00:00.000Z",
    );
    expect(zonedWallClockToUtc(wall(2026, 7, 15), "Europe/London").toISOString()).toBe(
      "2026-07-14T23:00:00.000Z",
    );
  });

  it("derives day boundaries in the business timezone", () => {
    // 22:30 UTC is 23:30 local on 15 July, so the local day is still 15 July and it began at 23:00
    // UTC on 14 July.
    const instant = new Date("2026-07-15T22:30:00Z");
    expect(startOfZonedDay(instant, "Europe/London").toISOString()).toBe(
      "2026-07-14T23:00:00.000Z",
    );
    expect(zonedDayKey(instant, "Europe/London")).toBe("2026-07-15");
    expect(endOfZonedDay(new Date("2026-07-15T12:00:00Z"), "Europe/London").toISOString()).toBe(
      "2026-07-15T23:00:00.000Z",
    );
  });

  it("keeps a spring-forward day whole", () => {
    // 29 March 2026 is the UK spring-forward day and lasts only 23 hours.
    const start = startOfZonedDay(new Date("2026-03-29T06:00:00Z"), "Europe/London");
    const end = endOfZonedDay(new Date("2026-03-29T06:00:00Z"), "Europe/London");
    expect(start.toISOString()).toBe("2026-03-29T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-03-29T23:00:00.000Z");
    expect(end.getTime() - start.getTime()).toBe(23 * 3_600_000);
  });

  it("keeps an autumn-back day whole", () => {
    // 25 October 2026 is the UK fall-back day and lasts 25 hours.
    const start = startOfZonedDay(new Date("2026-10-25T10:00:00Z"), "Europe/London");
    const end = endOfZonedDay(new Date("2026-10-25T10:00:00Z"), "Europe/London");
    expect(end.getTime() - start.getTime()).toBe(25 * 3_600_000);
  });

  it("expands a requested range to whole local days", () => {
    const range = zonedRangeToUtc(
      new Date("2026-07-10T09:15:00Z"),
      new Date("2026-07-12T18:45:00Z"),
      "America/New_York",
    );
    expect(range.from.toISOString()).toBe("2026-07-10T04:00:00.000Z");
    expect(range.to.toISOString()).toBe("2026-07-13T03:59:59.999Z");
    expect(range.timeZone).toBe("America/New_York");
  });

  it("rejects an empty range", () => {
    expect(() =>
      zonedRangeToUtc(new Date("2026-07-10T00:00:00Z"), new Date("2026-07-09T00:00:00Z"), "UTC"),
    ).toThrow("at least one day");
  });
});

describe("business-local bucketing", () => {
  it("buckets by local day, ISO week and month", () => {
    const instant = new Date("2026-07-15T23:30:00Z");
    expect(zonedPeriodKey(instant, "UTC", "DAY")).toBe("2026-07-15");
    expect(zonedPeriodKey(instant, "Australia/Sydney", "DAY")).toBe("2026-07-16");
    expect(zonedPeriodKey(instant, "UTC", "MONTH")).toBe("2026-07");
    // 15 July 2026 is a Wednesday, so the ISO week starts on Monday 13 July.
    expect(zonedPeriodKey(new Date("2026-07-15T12:00:00Z"), "UTC", "WEEK")).toBe("2026-07-13");
  });

  it("counts whole local days across a DST transition", () => {
    const range = zonedRangeToUtc(
      new Date("2026-03-28T00:00:00Z"),
      new Date("2026-03-30T00:00:00Z"),
      "Europe/London",
    );
    expect(zonedDayCount(range.from, range.to, "Europe/London")).toBe(3);
  });
});
