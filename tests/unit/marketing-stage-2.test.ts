import { describe, expect, it } from "vitest";
import {
  parseMarketingDateRangeSearchParams,
  resolveMarketingDateRange,
} from "@/lib/marketing/date-range";
import { calculateMarketingHealth } from "@/lib/marketing-intelligence/scoring/health-score";
import { evaluateMarketingSignals } from "@/lib/marketing-intelligence/engine";
import type { MarketingIntelligenceContext } from "@/lib/marketing-intelligence/types";

describe("marketing date range", () => {
  it("resolves 30 day preset", () => {
    const now = new Date("2026-08-16T12:00:00.000Z");
    const range = resolveMarketingDateRange({ preset: "30d", now });
    expect(range.label).toBe("Last 30 days");
    expect(range.comparisonLabel).toBe("vs previous period");
  });

  it("parses URL search params", () => {
    const params = new URLSearchParams("range=7d&comparison=previous_month");
    const range = parseMarketingDateRangeSearchParams(
      params,
      new Date("2026-08-16T12:00:00.000Z"),
    );
    expect(range.preset).toBe("7d");
    expect(range.comparison).toBe("previous_month");
  });
});

function buildContext(
  overrides: Partial<MarketingIntelligenceContext> = {},
): MarketingIntelligenceContext {
  return {
    rangeLabel: "Last 30 days",
    comparisonLabel: "vs previous period",
    paid: {
      connectedCount: 2,
      totalProviders: 4,
      spend: 10000,
      previousSpend: 8000,
      conversions: 200,
      previousConversions: 180,
      revenue: 32000,
      previousRevenue: 25000,
      roas: 3.2,
      previousRoas: 3.1,
      cpa: 50,
      previousCpa: 44,
      byProvider: [
        {
          provider: "TikTok Ads",
          spend: 1400,
          conversions: 80,
          revenue: 6720,
          clicks: 1000,
          impressions: 50000,
        },
        {
          provider: "Meta Ads",
          spend: 8600,
          conversions: 120,
          revenue: 25280,
          clicks: 4000,
          impressions: 200000,
        },
      ],
      freshness: "fresh",
      lastSyncedAt: new Date(),
    },
    organic: {
      connectedCount: 2,
      totalProviders: 5,
      reach: 120000,
      previousReach: 100000,
      engagement: 5400,
      previousEngagement: 4200,
      engagementRate: 3.4,
      published: 8,
      scheduled: 0,
      channels: [],
      freshness: "fresh",
      lastSyncedAt: new Date(),
    },
    publishing: {
      publishedInRange: 8,
      scheduledUpcoming: 0,
      daysWithoutScheduled: 5,
      strongestOrganicFormat: "Instagram Reels",
    },
    connectivity: {
      paidConnected: 2,
      paidTotal: 4,
      organicConnected: 2,
      organicTotal: 5,
    },
    ...overrides,
  };
}

describe("marketing health score", () => {
  it("returns deterministic capped score with breakdown", () => {
    const health = calculateMarketingHealth(buildContext());
    expect(health.total).toBeGreaterThan(0);
    expect(health.total).toBeLessThanOrEqual(100);
    expect(health.components).toHaveLength(5);
    expect(health.components.reduce((sum, item) => sum + item.score, 0)).toBe(health.total);
  });

  it("handles missing paid data", () => {
    const health = calculateMarketingHealth(
      buildContext({
        paid: {
          ...buildContext().paid,
          connectedCount: 0,
          spend: 0,
          conversions: 0,
          roas: null,
        },
      }),
    );
    expect(health.components.find((item) => item.key === "paid")?.score).toBe(0);
  });
});

describe("marketing intelligence engine", () => {
  it("fires budget opportunity when channel ROAS materially outperforms", () => {
    const signals = evaluateMarketingSignals(buildContext());
    expect(signals.some((signal) => signal.type === "budget")).toBe(true);
  });

  it("fires CPA anomaly when CPA rises materially", () => {
    const signals = evaluateMarketingSignals(
      buildContext({
        paid: {
          ...buildContext().paid,
          cpa: 80,
          previousCpa: 50,
        },
      }),
    );
    expect(signals.some((signal) => signal.id === "cpa-anomaly")).toBe(true);
  });

  it("suppresses insignificant variance", () => {
    const signals = evaluateMarketingSignals(
      buildContext({
        paid: {
          ...buildContext().paid,
          cpa: 51,
          previousCpa: 50,
          byProvider: [
            {
              provider: "Meta Ads",
              spend: 5000,
              conversions: 100,
              revenue: 15000,
              clicks: 1000,
              impressions: 50000,
            },
          ],
        },
      }),
    );
    expect(signals.some((signal) => signal.id === "cpa-anomaly")).toBe(false);
  });

  it("includes evidence on every signal", () => {
    const signals = evaluateMarketingSignals(buildContext());
    for (const signal of signals) {
      expect(signal.evidence.length).toBeGreaterThan(0);
      expect(signal.explanation.length).toBeGreaterThan(20);
    }
  });
});
