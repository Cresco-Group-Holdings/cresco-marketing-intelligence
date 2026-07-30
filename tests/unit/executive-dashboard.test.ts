import { describe, expect, it } from "vitest";
import { compareMetrics, availableMetric, unavailableMetric } from "@/lib/executive/metric-value";
import { computeDateRanges } from "@/lib/executive/comparisons";
import {
  calculateObjectiveProgress,
  resolveObjectiveActual,
} from "@/lib/executive/objective-kpis";
import {
  buildExecutiveCacheKey,
  clearExecutiveCache,
  getExecutiveCache,
  setExecutiveCache,
} from "@/lib/executive/cache";

describe("executive metric values", () => {
  it("shows unavailable instead of zero for missing data", () => {
    const metric = unavailableMetric("No data synced.");
    expect(metric.available).toBe(false);
    expect(metric.value).toBeNull();
  });

  it("calculates comparison with absolute and percent change", () => {
    const comparison = compareMetrics(
      availableMetric(120),
      availableMetric(100),
    );
    expect(comparison.changeAbsolute).toBe(20);
    expect(comparison.changePercent).toBe(20);
  });

  it("avoids percent change from zero denominator", () => {
    const comparison = compareMetrics(
      availableMetric(50),
      unavailableMetric("No previous data"),
    );
    expect(comparison.changePercent).toBeNull();
  });

  it("avoids percent change when previous value is zero", () => {
    const comparison = compareMetrics(
      availableMetric(50),
      availableMetric(0),
    );
    expect(comparison.changeAbsolute).toBe(50);
    expect(comparison.changePercent).toBeNull();
  });
});

describe("executive comparisons", () => {
  it("computes previous period range", () => {
    const from = new Date("2026-02-01T00:00:00Z");
    const to = new Date("2026-02-28T23:59:59Z");
    const ranges = computeDateRanges(from, to, "PREVIOUS_PERIOD");
    expect(ranges.comparisonTo.getTime()).toBeLessThan(from.getTime());
  });
});

describe("executive objectives", () => {
  it("maps objective types to KPIs", () => {
    const actual = resolveObjectiveActual("LEAD_GENERATION", {
      leads: availableMetric(42),
    });
    expect(actual.value).toBe(42);
  });

  it("calculates progress against target", () => {
    const progress = calculateObjectiveProgress(100, availableMetric(75));
    expect(progress.progressPercent).toBe(75);
    expect(progress.remaining).toBe(25);
    expect(progress.status).toBe("on_track");
  });

  it("returns unavailable progress without actual data", () => {
    const progress = calculateObjectiveProgress(100, unavailableMetric("No data"));
    expect(progress.progressPercent).toBeNull();
    expect(progress.status).toBe("unavailable");
  });
});

describe("executive cache", () => {
  it("uses tenant-scoped cache keys", () => {
    clearExecutiveCache();
    const key = buildExecutiveCacheKey(["org-1", "brand-1", "overview", "2026-01-01"]);
    setExecutiveCache(key, { value: 1 });
    expect(getExecutiveCache(key)).toEqual({ value: 1 });
    expect(getExecutiveCache(buildExecutiveCacheKey(["org-2", "brand-1", "overview", "2026-01-01"]))).toBeNull();
  });
});
