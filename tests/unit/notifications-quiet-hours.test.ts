import { describe, expect, it } from "vitest";
import { isWithinQuietHours } from "@/lib/notifications/quiet-hours";

describe("quiet hours", () => {
  it("returns false when quiet hours are not configured", () => {
    expect(
      isWithinQuietHours({
        now: new Date("2026-07-29T23:00:00.000Z"),
        timezone: "UTC",
      }),
    ).toBe(false);
  });

  it("detects quiet hours within the same day window", () => {
    expect(
      isWithinQuietHours({
        now: new Date("2026-07-29T23:30:00.000Z"),
        timezone: "UTC",
        quietHoursStart: "22:00",
        quietHoursEnd: "07:00",
      }),
    ).toBe(true);

    expect(
      isWithinQuietHours({
        now: new Date("2026-07-29T12:00:00.000Z"),
        timezone: "UTC",
        quietHoursStart: "22:00",
        quietHoursEnd: "07:00",
      }),
    ).toBe(false);
  });

  it("handles overnight quiet hours", () => {
    expect(
      isWithinQuietHours({
        now: new Date("2026-07-29T02:00:00.000Z"),
        timezone: "UTC",
        quietHoursStart: "22:00",
        quietHoursEnd: "07:00",
      }),
    ).toBe(true);
  });
});
