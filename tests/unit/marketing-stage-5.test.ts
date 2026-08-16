import { describe, expect, it } from "vitest";
import { calculateAttributionCredits } from "@/lib/attribution/models";
import type { AttributionTouchpointInput } from "@/lib/attribution/types";
import { computeAttributionFromJourneys } from "@/lib/unified-analytics/attribution";
import { calculateAssistedMetrics, calculateOrganicAssist } from "@/lib/unified-analytics/assist";
import { buildCoverageDimensions } from "@/lib/unified-analytics/coverage";
import { buildUnifiedKpis } from "@/lib/unified-analytics/kpis";
import { evaluateAllMarketingSignals } from "@/lib/marketing-intelligence/engine";
import type { MarketingIntelligenceContext } from "@/lib/marketing-intelligence/types";

const conversionAt = new Date("2026-02-01T12:00:00Z");

function touchpoint(
  id: string,
  channel: string,
  daysBeforeConversion: number,
  contentKey?: string,
): AttributionTouchpointInput {
  return {
    id,
    occurredAt: new Date(conversionAt.getTime() - daysBeforeConversion * 86_400_000),
    channel,
    contentKey,
    position: daysBeforeConversion,
    isExcluded: false,
  };
}

describe("unified attribution from journeys", () => {
  const journeys = [
    {
      journeyStart: "2026-01-20T00:00:00Z",
      journeyEnd: "2026-02-01T12:00:00Z",
      revenueValue: 1000,
      status: "CONVERTED",
      touchpoints: [
        {
          id: "tp-1",
          occurredAt: "2026-01-25T00:00:00Z",
          channel: "Instagram Organic",
          position: 1,
          isExcluded: false,
        },
        {
          id: "tp-2",
          occurredAt: "2026-01-31T00:00:00Z",
          channel: "Meta Ads",
          position: 2,
          isExcluded: false,
        },
      ],
    },
    {
      journeyStart: "2026-01-22T00:00:00Z",
      journeyEnd: "2026-02-01T10:00:00Z",
      revenueValue: 500,
      status: "CONVERTED",
      touchpoints: [
        {
          id: "tp-3",
          occurredAt: "2026-01-30T00:00:00Z",
          channel: "Google Ads",
          position: 1,
          isExcluded: false,
        },
      ],
    },
  ];

  it("computes last-touch attributed revenue", () => {
    const result = computeAttributionFromJourneys(journeys, "LAST_TOUCH", 30);
    expect(result.attributedConversions).toBe(2);
    expect(result.attributedRevenue).toBe(1500);
    expect(result.channelBreakdown.find((row) => row.channel === "Meta Ads")?.creditValue).toBe(1000);
    expect(result.channelBreakdown.find((row) => row.channel === "Google Ads")?.creditValue).toBe(500);
  });

  it("computes first-touch attributed revenue", () => {
    const result = computeAttributionFromJourneys(journeys, "FIRST_TOUCH", 30);
    expect(result.channelBreakdown.find((row) => row.channel === "Instagram Organic")?.creditValue).toBe(
      1000,
    );
  });

  it("does not double count a single journey across models", () => {
    const models = ["FIRST_TOUCH", "LAST_TOUCH", "LINEAR", "POSITION_BASED", "TIME_DECAY"] as const;
    for (const model of models) {
      const result = computeAttributionFromJourneys(journeys, model, 30);
      expect(result.attributedRevenue).toBe(1500);
    }
  });

  it("marks journeys without touchpoints as unattributed", () => {
    const result = computeAttributionFromJourneys(
      [
        {
          journeyStart: "2026-02-01T00:00:00Z",
          journeyEnd: "2026-02-01T12:00:00Z",
          revenueValue: 200,
          status: "UNATTRIBUTED",
          touchpoints: [],
        },
      ],
      "LAST_TOUCH",
      30,
    );
    expect(result.unattributedConversions).toBe(1);
    expect(result.attributedConversions).toBe(0);
  });
});

describe("organic assist", () => {
  it("detects prior organic touch before paid-attributed conversion", () => {
    const result = calculateOrganicAssist([
      {
        conversionAt,
        creditedChannel: "Meta Ads",
        creditedSourceType: "paid",
        touchpoints: [
          touchpoint("1", "Instagram Organic", 5),
          touchpoint("2", "Meta Ads", 1),
        ],
      },
      {
        conversionAt,
        creditedChannel: "Google Ads",
        creditedSourceType: "paid",
        touchpoints: [touchpoint("3", "Google Ads", 1)],
      },
    ]);

    expect(result.totalPaidAttributedConversions).toBe(2);
    expect(result.paidConversionsWithPriorOrganic).toBe(1);
    expect(result.rate).toBe(50);
    expect(result.description).toContain("prior organic interaction");
  });

  it("does not count organic touch after conversion as assist", () => {
    const result = calculateOrganicAssist([
      {
        conversionAt,
        creditedChannel: "Meta Ads",
        creditedSourceType: "paid",
        touchpoints: [
          touchpoint("1", "Meta Ads", 1),
          {
            ...touchpoint("2", "Instagram Organic", 0),
            occurredAt: new Date(conversionAt.getTime() + 3_600_000),
          },
        ],
      },
    ]);

    expect(result.paidConversionsWithPriorOrganic).toBe(0);
  });
});

describe("content assist metrics", () => {
  it("separates assisted and attributed revenue", () => {
    const metrics = calculateAssistedMetrics([
      {
        revenueValue: 1000,
        conversionAt,
        creditedContentKey: "content-b",
        touchpoints: [
          touchpoint("1", "Instagram Organic", 4, "content-a"),
          touchpoint("2", "Meta Ads", 1, "content-b"),
        ],
      },
    ]);

    expect(metrics.get("content-a")?.assistedRevenue).toBe(1000);
    expect(metrics.get("content-a")?.attributedRevenue).toBe(0);
    expect(metrics.get("content-b")?.assistedRevenue).toBe(1000);
    expect(metrics.get("content-b")?.attributedRevenue).toBe(1000);
  });

  it("does not duplicate assisted revenue when aggregating content totals naively", () => {
    const metrics = calculateAssistedMetrics([
      {
        revenueValue: 500,
        conversionAt,
        creditedContentKey: "content-a",
        touchpoints: [touchpoint("1", "Instagram Organic", 2, "content-a")],
      },
      {
        revenueValue: 700,
        conversionAt,
        creditedContentKey: "content-b",
        touchpoints: [touchpoint("2", "TikTok Organic", 2, "content-b")],
      },
    ]);

    const assistedTotal = [...metrics.values()].reduce((sum, row) => sum + row.assistedRevenue, 0);
    expect(assistedTotal).toBe(1200);
  });
});

describe("unified KPIs", () => {
  it("labels paid spend honestly and calculates blended ROAS", () => {
    const kpis = buildUnifiedKpis({
      paidSpend: 10000,
      previousPaidSpend: 8000,
      attributedRevenue: 38000,
      previousAttributedRevenue: 30000,
      observedRevenue: 45000,
      conversions: 120,
      previousConversions: 100,
      paidConversions: 130,
      organicContributionRevenue: 12000,
      paidContributionRevenue: 26000,
      contentAssistedRevenue: 41000,
      attributionModelLabel: "Last Touch",
      revenueCoveragePercent: 81,
      paidSpendCoveragePercent: 100,
      showComparison: true,
      comparisonLabel: "vs previous period",
    });

    const spend = kpis.find((kpi) => kpi.label === "Total Marketing Spend");
    const roas = kpis.find((kpi) => kpi.label === "Blended ROAS");
    const cpa = kpis.find((kpi) => kpi.label === "CPA");

    expect(spend?.footnote).toBe("Paid spend only");
    expect(spend?.metadata.kind).toBe("Observed");
    expect(roas?.value).toBe("3.80x");
    expect(cpa?.label).toBe("CPA");
    expect(cpa?.metadata.limitations?.[0]).toContain("Not equivalent to CAC");
  });
});

describe("coverage dimensions", () => {
  it("reports limited revenue coverage", () => {
    const { coverage, warnings } = buildCoverageDimensions({
      paidConnected: true,
      paidSpendAvailable: true,
      organicConnected: true,
      organicAnalyticsAvailable: false,
      conversionsTracked: 40,
      conversionsObserved: 50,
      revenueObserved: 100000,
      revenueAttributed: 61000,
      journeysWithTouchpoints: 30,
      totalJourneys: 50,
    });

    expect(coverage.find((item) => item.dimension === "Revenue Coverage")?.state).toBe("Partial");
    expect(warnings.some((warning) => warning.includes("Attribution is based on"))).toBe(true);
  });
});

describe("funnel calculations", () => {
  it("defines click-to-visit drop-off", () => {
    const clicks = 38420;
    const visits = 12740;
    const dropOff = ((clicks - visits) / clicks) * 100;
    expect(dropOff).toBeCloseTo(66.84, 1);
  });
});

describe("stage 5 intelligence rules", () => {
  const baseContext: MarketingIntelligenceContext = {
    rangeLabel: "Last 30 days",
    comparisonLabel: "vs previous period",
    paid: {
      connectedCount: 2,
      totalProviders: 4,
      spend: 10000,
      previousSpend: 9000,
      conversions: 120,
      previousConversions: 100,
      revenue: 38000,
      previousRevenue: 30000,
      roas: 3.8,
      previousRoas: 3.2,
      cpa: 83,
      previousCpa: 90,
      byProvider: [
        {
          provider: "META",
          spend: 5000,
          conversions: 80,
          revenue: 20000,
          clicks: 1000,
          impressions: 50000,
        },
      ],
      freshness: "fresh",
      lastSyncedAt: new Date(),
    },
    organic: {
      connectedCount: 2,
      totalProviders: 5,
      reach: 100000,
      previousReach: 90000,
      engagement: 5000,
      previousEngagement: 4500,
      engagementRate: 3.2,
      published: 12,
      scheduled: 4,
      channels: [],
      freshness: "fresh",
      lastSyncedAt: new Date(),
    },
    publishing: {
      publishedInRange: 12,
      scheduledUpcoming: 4,
      daysWithoutScheduled: null,
      strongestOrganicFormat: "Reel",
    },
    connectivity: {
      paidConnected: 2,
      paidTotal: 4,
      organicConnected: 2,
      organicTotal: 5,
    },
    analytics: {
      attributionModel: "Last Touch",
      attributedRevenue: 38000,
      observedRevenue: 50000,
      attributionCoveragePercent: 61,
      revenueCoveragePercent: 61,
      organicAssistRate: 23,
      contentAssistedRevenue: 41200,
      contentAttributedRevenue: 8400,
      channelContributionShift: {
        channel: "Google Ads",
        fromPercent: 32,
        toPercent: 46,
      },
      providerDiscrepancies: [
        { provider: "META", providerConversions: 120, trackedConversions: 88 },
      ],
      funnelClickVisitDropOff: 66.8,
    },
  };

  it("surfaces attribution coverage issue", () => {
    const signals = evaluateAllMarketingSignals(baseContext);
    expect(signals.some((signal) => signal.id === "attribution-coverage-issue")).toBe(true);
  });

  it("surfaces organic assist signal with non-causal language", () => {
    const signals = evaluateAllMarketingSignals(baseContext);
    const assist = signals.find((signal) => signal.id === "organic-assist");
    expect(assist?.explanation).toContain("prior organic interaction");
    expect(assist?.explanation).not.toContain("caused");
  });

  it("surfaces content revenue opportunity distinguishing assist from attribution", () => {
    const signals = evaluateAllMarketingSignals(baseContext);
    const content = signals.find((signal) => signal.id === "content-revenue-opportunity");
    expect(content?.explanation).toContain("assisted revenue");
    expect(content?.explanation).toContain("attributed revenue");
  });

  it("surfaces provider tracking discrepancy as possibilities", () => {
    const signals = evaluateAllMarketingSignals(baseContext);
    const discrepancy = signals.find((signal) => signal.id === "tracking-discrepancy-META");
    expect(discrepancy?.explanation).toContain("Possible causes");
  });

  it("surfaces funnel drop signal", () => {
    const signals = evaluateAllMarketingSignals(baseContext);
    expect(signals.some((signal) => signal.id === "funnel-click-visit-drop")).toBe(true);
  });
});

describe("deduplication guardrails", () => {
  it("counts each journey revenue once in attribution aggregation", () => {
    const journeys = [
      {
        journeyStart: "2026-01-01T00:00:00Z",
        journeyEnd: "2026-02-01T00:00:00Z",
        revenueValue: 1000,
        status: "CONVERTED",
        touchpoints: [
          {
            id: "dup-1",
            occurredAt: "2026-01-20T00:00:00Z",
            channel: "Meta Ads",
            position: 1,
            isExcluded: false,
          },
          {
            id: "dup-2",
            occurredAt: "2026-01-25T00:00:00Z",
            channel: "Google Ads",
            position: 2,
            isExcluded: false,
          },
        ],
      },
    ];

    const result = calculateAttributionCredits({
      modelType: "LINEAR",
      touchpoints: journeys[0]!.touchpoints.map((tp) => ({
        id: tp.id,
        occurredAt: new Date(tp.occurredAt),
        channel: tp.channel,
        position: tp.position,
        isExcluded: tp.isExcluded,
      })),
      revenueValue: 1000,
      directTrafficPolicy: "RETAIN",
      conversionAt: new Date("2026-02-01T00:00:00Z"),
    });

    const attributed = computeAttributionFromJourneys(journeys, "LINEAR", 30);
    const creditSum = result.credits.reduce((sum, credit) => sum + (credit.creditValue ?? 0), 0);
    expect(creditSum).toBe(1000);
    expect(attributed.attributedRevenue).toBe(1000);
  });
});
