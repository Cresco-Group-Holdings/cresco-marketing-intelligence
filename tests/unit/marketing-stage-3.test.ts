import { describe, expect, it } from "vitest";
import {
  parseMarketingDateRangeSearchParams,
  resolveMarketingDateRange,
  validateCustomDateRange,
} from "@/lib/marketing/date-range";
import {
  buildBudgetAllocation,
  calculateBudgetPacing,
  calculateSpendShare,
  projectPeriodSpend,
} from "@/lib/paid-advertising/budget";
import {
  calculateCampaignPerformanceState,
  detectCreativeFatigue,
  mapCampaignStatus,
} from "@/lib/paid-advertising/performance-state";
import { evaluateMarketingSignals } from "@/lib/marketing-intelligence/engine";
import type { MarketingIntelligenceContext } from "@/lib/marketing-intelligence/types";

describe("marketing date range stage 3", () => {
  const now = new Date("2026-08-16T12:00:00.000Z");

  it("supports none comparison", () => {
    const range = resolveMarketingDateRange({ preset: "30d", comparison: "none", now });
    expect(range.comparisonLabel).toBe("");
  });

  it("validates custom range order", () => {
    const from = new Date("2026-08-16");
    const to = new Date("2026-08-10");
    expect(validateCustomDateRange(from, to, now)).toContain("before");
  });

  it("parses custom range from URL", () => {
    const params = new URLSearchParams(
      "range=custom&from=2026-08-01T00:00:00.000Z&to=2026-08-15T00:00:00.000Z&comparison=none",
    );
    const range = parseMarketingDateRangeSearchParams(params, now);
    expect(range.preset).toBe("custom");
    expect(range.comparison).toBe("none");
  });
});

describe("paid advertising budget", () => {
  it("calculates spend share", () => {
    expect(calculateSpendShare(250, 1000)).toBe(0.25);
    expect(calculateSpendShare(0, 0)).toBeNull();
  });

  it("detects underspending pacing", () => {
    const now = new Date("2026-08-16T12:00:00.000Z");
    const pacing = calculateBudgetPacing({
      spend: 100,
      budget: 10000,
      periodStart: new Date("2026-08-01"),
      periodEnd: new Date("2026-08-31"),
      now,
    });
    expect(pacing).toBe("Underspending");
  });

  it("projects period spend from run rate", () => {
    const projected = projectPeriodSpend({
      spend: 1000,
      periodStart: new Date("2026-08-01"),
      periodEnd: new Date("2026-08-31"),
      now: new Date("2026-08-11"),
    });
    expect(projected).toBeGreaterThan(1000);
  });

  it("builds budget allocation sorted by spend", () => {
    const allocation = buildBudgetAllocation(
      [
        {
          provider: "Meta Ads",
          spend: 500,
          roas: 2,
          budget: null,
          periodStart: new Date("2026-08-01"),
          periodEnd: new Date("2026-08-31"),
        },
        {
          provider: "TikTok Ads",
          spend: 1500,
          roas: 5,
          budget: null,
          periodStart: new Date("2026-08-01"),
          periodEnd: new Date("2026-08-31"),
        },
      ],
      2000,
    );
    expect(allocation[0]?.provider).toBe("TikTok Ads");
    expect(allocation[0]?.spendShare).toBe(0.75);
  });
});

describe("campaign performance state", () => {
  it("maps provider statuses", () => {
    expect(mapCampaignStatus("ACTIVE")).toBe("Active");
    expect(mapCampaignStatus("PAUSED")).toBe("Paused");
  });

  it("returns insufficient data for low volume", () => {
    expect(
      calculateCampaignPerformanceState({
        roas: 5,
        cpa: 10,
        conversions: 1,
        spend: 10,
        portfolioRoas: 3,
        portfolioCpa: 20,
      }),
    ).toBe("Insufficient data");
  });

  it("labels strong performers", () => {
    expect(
      calculateCampaignPerformanceState({
        roas: 5,
        cpa: 10,
        conversions: 50,
        spend: 500,
        portfolioRoas: 3,
        portfolioCpa: 20,
      }),
    ).toBe("Strong");
  });
});

describe("creative fatigue", () => {
  it("detects fatigue from ctr decline and frequency", () => {
    const result = detectCreativeFatigue({
      ctr: 0.8,
      previousCtr: 1.2,
      frequency: 4.5,
      cpa: null,
      previousCpa: null,
    });
    expect(result.detected).toBe(true);
    expect(result.reason).toContain("frequency");
  });

  it("does not detect fatigue without evidence", () => {
    const result = detectCreativeFatigue({
      ctr: 1.0,
      previousCtr: 1.1,
      frequency: 2,
      cpa: 10,
      previousCpa: 9,
    });
    expect(result.detected).toBe(false);
  });
});

describe("paid intelligence prioritisation", () => {
  function buildPaidContext(): MarketingIntelligenceContext {
    return {
      rangeLabel: "Last 30 days",
      comparisonLabel: "vs previous period",
      paid: {
        connectedCount: 2,
        totalProviders: 4,
        spend: 52000,
        previousSpend: 48000,
        conversions: 1200,
        previousConversions: 1100,
        revenue: 176800,
        previousRevenue: 158400,
        roas: 3.4,
        previousRoas: 3.3,
        cpa: 43.3,
        previousCpa: 55,
        byProvider: [
          {
            provider: "TikTok Ads",
            spend: 7800,
            conversions: 420,
            revenue: 40560,
            clicks: 12000,
            impressions: 800000,
          },
          {
            provider: "Meta Ads",
            spend: 24600,
            conversions: 380,
            revenue: 68880,
            clicks: 45000,
            impressions: 1200000,
          },
          {
            provider: "Google Ads",
            spend: 19600,
            conversions: 400,
            revenue: 67360,
            clicks: 38000,
            impressions: 900000,
          },
        ],
        freshness: "fresh",
        lastSyncedAt: new Date(),
      },
      organic: {
        connectedCount: 0,
        totalProviders: 0,
        reach: null,
        previousReach: null,
        engagement: null,
        previousEngagement: null,
        engagementRate: null,
        published: 0,
        scheduled: 0,
        channels: [],
        freshness: "unavailable",
        lastSyncedAt: null,
      },
      publishing: {
        publishedInRange: 0,
        scheduledUpcoming: 0,
        daysWithoutScheduled: 0,
        strongestOrganicFormat: null,
      },
      connectivity: {
        paidConnected: 2,
        paidTotal: 4,
        organicConnected: 0,
        organicTotal: 0,
      },
    };
  }

  it("generates budget opportunity signal for high ROAS channel", () => {
    const signals = evaluateMarketingSignals(buildPaidContext()).filter(
      (signal) => signal.category === "paid",
    );
    expect(signals.some((signal) => signal.type === "budget")).toBe(true);
  });

  it("limits signals to actionable paid recommendations", () => {
    const signals = evaluateMarketingSignals(buildPaidContext())
      .filter((signal) => signal.category === "paid")
      .slice(0, 5);
    expect(signals.length).toBeLessThanOrEqual(5);
    for (const signal of signals) {
      expect(signal.evidence.length).toBeGreaterThan(0);
      expect(signal.explanation.length).toBeGreaterThan(0);
    }
  });
});
