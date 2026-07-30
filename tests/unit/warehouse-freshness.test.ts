import { describe, expect, it } from "vitest";
import { computeFreshnessState } from "@/lib/warehouse/freshness";

describe("warehouse freshness states", () => {
  const now = new Date("2026-07-30T12:00:00Z");

  it("returns UNKNOWN when no successful sync exists", () => {
    expect(computeFreshnessState({ now })).toEqual({ state: "UNKNOWN", lagMinutes: null });
  });

  it("returns FRESH when lag is within the stale threshold", () => {
    const lastSuccessfulSyncAt = new Date("2026-07-30T10:00:00Z");
    const result = computeFreshnessState({
      lastSuccessfulSyncAt,
      expectedIntervalMinutes: 120,
      now,
    });
    expect(result.state).toBe("FRESH");
    expect(result.lagMinutes).toBe(120);
  });

  it("returns STALE when lag exceeds the stale multiplier", () => {
    const lastSuccessfulSyncAt = new Date("2026-07-30T06:00:00Z");
    const result = computeFreshnessState({
      lastSuccessfulSyncAt,
      expectedIntervalMinutes: 120,
      now,
    });
    expect(result.state).toBe("STALE");
    expect(result.lagMinutes).toBe(360);
  });

  it("returns CRITICAL when lag exceeds the critical multiplier", () => {
    const lastSuccessfulSyncAt = new Date("2026-07-29T12:00:00Z");
    const result = computeFreshnessState({
      lastSuccessfulSyncAt,
      expectedIntervalMinutes: 120,
      now,
    });
    expect(result.state).toBe("CRITICAL");
    expect(result.lagMinutes).toBe(1440);
  });
});
