import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { buildFactFingerprint } from "@/lib/analytics-core/deduplication";
import {
  addDecimal,
  divideDecimal,
  percentOf,
  sumDecimals,
  toDecimal,
} from "@/lib/analytics-core/decimal";
import { isWithinRange, normaliseDateRange } from "@/lib/analytics-core/date-boundaries";
import { resolveDataCoverageState } from "@/lib/analytics-core/data-state";
import { computeAnalyticsFreshness } from "@/lib/analytics-core/freshness";
import { computeDerivedMetric } from "@/lib/analytics-core/metric-engine";
import { ANALYTICS_METRIC_KEYS } from "@/lib/analytics-core/constants";
import { validateImportRow } from "@/lib/analytics-core/import-validation";

describe("analytics decimal calculations", () => {
  it("adds and divides without floating point drift", () => {
    const total = addDecimal("0.1", "0.2");
    expect(total.toString()).toBe("0.3");
    const ratio = divideDecimal("10", "4");
    expect(ratio?.toString()).toBe("2.5");
  });

  it("computes percentages safely", () => {
    const ctr = percentOf(25, 100);
    expect(ctr?.toString()).toBe("25");
  });

  it("sums decimal arrays", () => {
    const total = sumDecimals([new Prisma.Decimal(1.5), 2.5, "3"]);
    expect(total.toString()).toBe("7");
  });
});

describe("analytics deduplication", () => {
  it("produces stable fingerprints regardless of dimension key order", () => {
    const base = {
      organisationId: "org-1",
      metricKey: "clicks",
      occurredAt: "2026-08-01T00:00:00.000Z",
      granularity: "DAY",
      dimensions: { a: 1, b: 2 },
    };
    const first = buildFactFingerprint(base);
    const second = buildFactFingerprint({
      ...base,
      dimensions: { b: 2, a: 1 },
    });
    expect(first).toBe(second);
  });

  it("changes fingerprint when tenant scope changes", () => {
    const first = buildFactFingerprint({
      organisationId: "org-1",
      metricKey: "clicks",
      occurredAt: "2026-08-01T00:00:00.000Z",
      granularity: "DAY",
    });
    const second = buildFactFingerprint({
      organisationId: "org-2",
      metricKey: "clicks",
      occurredAt: "2026-08-01T00:00:00.000Z",
      granularity: "DAY",
    });
    expect(first).not.toBe(second);
  });
});

describe("analytics metric engine", () => {
  const totals = {
    [ANALYTICS_METRIC_KEYS.IMPRESSIONS]: 1000,
    [ANALYTICS_METRIC_KEYS.CLICKS]: 50,
    [ANALYTICS_METRIC_KEYS.SPEND]: 200,
    [ANALYTICS_METRIC_KEYS.CONVERSIONS]: 10,
    [ANALYTICS_METRIC_KEYS.REVENUE]: 500,
    [ANALYTICS_METRIC_KEYS.LEADS]: 20,
    [ANALYTICS_METRIC_KEYS.SESSIONS]: 400,
  };

  it("computes CTR from clicks and impressions", () => {
    const result = computeDerivedMetric(ANALYTICS_METRIC_KEYS.CTR, totals);
    expect(Number(result.value)).toBe(5);
  });

  it("computes CPC, CPM, CPL, CPA and ROAS", () => {
    expect(Number(computeDerivedMetric(ANALYTICS_METRIC_KEYS.CPC, totals).value)).toBe(4);
    expect(Number(computeDerivedMetric(ANALYTICS_METRIC_KEYS.CPM, totals).value)).toBe(200);
    expect(Number(computeDerivedMetric(ANALYTICS_METRIC_KEYS.CPL, totals).value)).toBe(10);
    expect(Number(computeDerivedMetric(ANALYTICS_METRIC_KEYS.CPA, totals).value)).toBe(20);
    expect(Number(computeDerivedMetric(ANALYTICS_METRIC_KEYS.ROAS, totals).value)).toBe(2.5);
  });

  it("computes conversion rate using sessions", () => {
    const result = computeDerivedMetric(ANALYTICS_METRIC_KEYS.CONVERSION_RATE, totals);
    expect(Number(result.value)).toBe(2.5);
  });

  it("returns null when denominator inputs are missing", () => {
    const result = computeDerivedMetric(ANALYTICS_METRIC_KEYS.CTR, {
      [ANALYTICS_METRIC_KEYS.CLICKS]: 10,
    });
    expect(result.value).toBeNull();
    expect(result.missingInputs).toContain(ANALYTICS_METRIC_KEYS.IMPRESSIONS);
  });
});

describe("analytics date boundaries", () => {
  it("rejects inverted ranges", () => {
    expect(() =>
      normaliseDateRange({
        from: "2026-08-10T00:00:00.000Z",
        to: "2026-08-01T00:00:00.000Z",
      }),
    ).toThrow();
  });

  it("checks inclusive membership", () => {
    const range = normaliseDateRange({
      from: "2026-08-01T00:00:00.000Z",
      to: "2026-08-31T23:59:59.999Z",
    });
    expect(isWithinRange(new Date("2026-08-15T12:00:00.000Z"), range)).toBe(true);
    expect(isWithinRange(new Date("2026-09-01T00:00:00.000Z"), range)).toBe(false);
  });
});

describe("analytics data state", () => {
  it("returns NO_DATA when no facts exist", () => {
    const state = resolveDataCoverageState({ hasFacts: false, presentMetricKeys: [] });
    expect(state.state).toBe("NO_DATA");
  });

  it("returns PARTIAL when base metrics are missing", () => {
    const state = resolveDataCoverageState({
      hasFacts: true,
      presentMetricKeys: ["clicks", "impressions"],
    });
    expect(state.state).toBe("PARTIAL");
    expect(state.missingMetricKeys.length).toBeGreaterThan(0);
  });
});

describe("analytics freshness", () => {
  it("marks data as FRESH within expected interval", () => {
    const now = new Date("2026-08-05T12:00:00.000Z");
    const result = computeAnalyticsFreshness({
      lastDataAt: new Date("2026-08-05T10:00:00.000Z"),
      expectedIntervalMinutes: 180,
      now,
    });
    expect(result.state).toBe("FRESH");
    expect(result.lagMinutes).toBe(120);
  });

  it("returns UNKNOWN without last data timestamp", () => {
    expect(computeAnalyticsFreshness({ lastDataAt: null }).state).toBe("UNKNOWN");
  });
});

describe("analytics import validation", () => {
  it("rejects derived metric imports", () => {
    const result = validateImportRow(
      {
        metricKey: ANALYTICS_METRIC_KEYS.CTR,
        value: 5,
        occurredAt: "2026-08-01T00:00:00.000Z",
        granularity: "DAY",
      },
      0,
    );
    expect(result.valid).toBe(false);
  });

  it("requires currency for spend metrics", () => {
    const result = validateImportRow(
      {
        metricKey: ANALYTICS_METRIC_KEYS.SPEND,
        value: 100,
        occurredAt: "2026-08-01T00:00:00.000Z",
        granularity: "DAY",
      },
      0,
    );
    expect(result.valid).toBe(false);
  });

  it("accepts valid base metric rows", () => {
    const result = validateImportRow(
      {
        metricKey: ANALYTICS_METRIC_KEYS.CLICKS,
        value: 42,
        occurredAt: "2026-08-01T00:00:00.000Z",
        granularity: "DAY",
      },
      0,
    );
    expect(result.valid).toBe(true);
  });
});

describe("analytics campaign attribution fingerprint", () => {
  it("isolates facts by campaign", () => {
    const shared = {
      organisationId: "org-1",
      metricKey: "conversions",
      occurredAt: "2026-08-01T00:00:00.000Z",
      granularity: "DAY",
    };
    const campaignA = buildFactFingerprint({ ...shared, campaignId: "camp-a" });
    const campaignB = buildFactFingerprint({ ...shared, campaignId: "camp-b" });
    expect(campaignA).not.toBe(campaignB);
  });
});

describe("analytics currency separation", () => {
  it("includes currency in fingerprint", () => {
    const base = {
      organisationId: "org-1",
      metricKey: "spend",
      occurredAt: "2026-08-01T00:00:00.000Z",
      granularity: "DAY",
    };
    const usd = buildFactFingerprint({ ...base, currency: "USD" });
    const gbp = buildFactFingerprint({ ...base, currency: "GBP" });
    expect(usd).not.toBe(gbp);
  });
});
