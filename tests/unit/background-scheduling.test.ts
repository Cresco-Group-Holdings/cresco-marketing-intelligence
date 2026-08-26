import { describe, expect, it } from "vitest";
import {
  cronMatches,
  localDateTimeToUtc,
  nextRecurrenceOccurrence,
  shouldExecuteMissedJob,
} from "@/lib/background/scheduling";

describe("background scheduling", () => {
  it("converts Europe/London local time to UTC including DST spring forward", () => {
    const beforeDst = localDateTimeToUtc({
      year: 2026,
      month: 3,
      day: 28,
      hour: 9,
      minute: 0,
      timezone: "Europe/London",
    });
    const afterDst = localDateTimeToUtc({
      year: 2026,
      month: 3,
      day: 30,
      hour: 9,
      minute: 0,
      timezone: "Europe/London",
    });
    expect(beforeDst.toISOString()).toBe("2026-03-28T09:00:00.000Z");
    expect(afterDst.toISOString()).toBe("2026-03-30T08:00:00.000Z");
  });

  it("finds next weekly recurrence occurrence", () => {
    const after = new Date("2026-08-10T12:00:00.000Z");
    const next = nextRecurrenceOccurrence(
      {
        weekdays: [1],
        localTime: "09:00",
        timezone: "Europe/London",
      },
      after,
    );
    expect(next?.utc.getUTCDay()).toBe(1);
    expect(next?.localTime).toBe("09:00");
  });

  it("matches simple daily cron expressions in timezone", () => {
    const date = new Date("2026-08-18T08:00:00.000Z");
    expect(cronMatches("0 9 * * *", date, "Europe/London")).toBe(true);
    expect(cronMatches("0 10 * * *", date, "Europe/London")).toBe(false);
  });

  it("applies missed execution grace policy for publishing", () => {
    const scheduledAt = new Date("2026-08-18T09:00:00.000Z");
    const withinGrace = new Date("2026-08-18T09:10:00.000Z");
    const outsideGrace = new Date("2026-08-18T10:00:00.000Z");
    expect(
      shouldExecuteMissedJob({
        policy: "execute_if_within_grace",
        scheduledAt,
        now: withinGrace,
        graceWindowMs: 15 * 60_000,
      }),
    ).toBe(true);
    expect(
      shouldExecuteMissedJob({
        policy: "execute_if_within_grace",
        scheduledAt,
        now: outsideGrace,
        graceWindowMs: 15 * 60_000,
      }),
    ).toBe(false);
  });
});
