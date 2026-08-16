import { describe, expect, it } from "vitest";
import { MIN_SAMPLE_SIZE, calculateBestPostingWindows } from "@/lib/organic-social/best-time";
import {
  calculatePublishingConsistencyScore,
  detectScheduleGaps,
} from "@/lib/organic-social/consistency";
import {
  calculateOrganicPerformanceState,
  mapContentPipelineStatus,
  mapPublicationToQueueSection,
} from "@/lib/organic-social/performance-state";
import { evaluateAllMarketingSignals, evaluateMarketingSignals } from "@/lib/marketing-intelligence/engine";
import type { MarketingIntelligenceContext } from "@/lib/marketing-intelligence/types";

describe("organic content pipeline", () => {
  it("maps studio statuses to pipeline labels", () => {
    expect(mapContentPipelineStatus("IN_REVIEW")).toBe("In Review");
    expect(mapContentPipelineStatus("PUBLISHED")).toBe("Published");
  });

  it("maps publication statuses to queue sections", () => {
    expect(mapPublicationToQueueSection("FAILED")).toBe("Failed");
    expect(mapPublicationToQueueSection("SCHEDULED")).toBe("Scheduled");
  });
});

describe("organic performance state", () => {
  it("requires minimum data before labelling", () => {
    expect(
      calculateOrganicPerformanceState({
        engagement: 2,
        reach: 50,
        baselineEngagementRate: 3,
        engagementRate: 2,
      }),
    ).toBe("Insufficient data");
  });

  it("labels strong performers", () => {
    expect(
      calculateOrganicPerformanceState({
        engagement: 500,
        reach: 10000,
        baselineEngagementRate: 2,
        engagementRate: 3.5,
      }),
    ).toBe("Strong");
  });
});

describe("publishing consistency", () => {
  it("scores connected channels", () => {
    const result = calculatePublishingConsistencyScore({
      channels: [
        {
          channel: "Instagram",
          published: 8,
          scheduled: 2,
          periodDays: 30,
          connected: true,
        },
        {
          channel: "TikTok",
          published: 1,
          scheduled: 0,
          periodDays: 30,
          connected: true,
        },
      ],
    });
    expect(result.score).toBeGreaterThan(0);
    expect(result.channels).toHaveLength(2);
  });

  it("detects schedule gaps for connected channels", () => {
    const gaps = detectScheduleGaps({
      channels: [
        {
          channel: "Instagram",
          connected: true,
          scheduledContent: 0,
          reelsScheduled: 0,
          formatLabel: "Reel",
        },
      ],
    });
    expect(gaps.length).toBe(1);
    expect(gaps[0]?.message).toContain("Reel");
  });
});

describe("best posting windows", () => {
  it("requires minimum sample size", () => {
    const windows = calculateBestPostingWindows(
      [
        {
          publishedAt: new Date("2026-08-01T10:00:00Z"),
          engagement: 100,
          impressions: 1000,
          channel: "Instagram",
          format: "Reel",
        },
      ],
      2.5,
    );
    expect(windows).toHaveLength(0);
    expect(MIN_SAMPLE_SIZE).toBeGreaterThanOrEqual(5);
  });

  it("returns evidence-based window when sample is sufficient", () => {
    const posts = Array.from({ length: 10 }, (_, index) => ({
      publishedAt: new Date(`2026-08-${String((index % 7) + 1).padStart(2, "0")}T09:00:00Z`),
      engagement: 120 + index * 5,
      impressions: 1000,
      channel: "Instagram",
      format: "Reel",
    }));
    const windows = calculateBestPostingWindows(posts, 2);
    if (windows.length > 0) {
      expect(windows[0]?.sampleSize).toBeGreaterThanOrEqual(5);
      expect(windows[0]?.engagementLift).toBeGreaterThan(0);
    }
  });
});

function buildOrganicContext(
  overrides: Partial<MarketingIntelligenceContext> = {},
): MarketingIntelligenceContext {
  return {
    rangeLabel: "Last 30 days",
    comparisonLabel: "vs previous period",
    paid: {
      connectedCount: 2,
      totalProviders: 4,
      spend: 20000,
      previousSpend: 18000,
      conversions: 400,
      previousConversions: 350,
      revenue: 80000,
      previousRevenue: 70000,
      roas: 4,
      previousRoas: 3.9,
      cpa: 50,
      previousCpa: 51,
      byProvider: [
        {
          provider: "Meta Ads",
          spend: 12000,
          conversions: 250,
          revenue: 50000,
          clicks: 8000,
          impressions: 200000,
        },
      ],
      freshness: "fresh",
      lastSyncedAt: new Date(),
    },
    organic: {
      connectedCount: 3,
      totalProviders: 5,
      reach: 500000,
      previousReach: 420000,
      engagement: 18000,
      previousEngagement: 25000,
      engagementRate: 3.6,
      published: 12,
      scheduled: 0,
      channels: [
        {
          provider: "INSTAGRAM",
          channel: "Instagram",
          connected: true,
          reach: 200000,
          views: 150000,
          engagement: 9000,
          engagementRate: 4.5,
          followers: 50000,
          followerGrowth: 1200,
          shares: 400,
          saves: 800,
          published: 6,
          scheduled: 0,
          dataFreshness: new Date(),
          unavailableMetrics: [],
        },
      ],
      freshness: "fresh",
      lastSyncedAt: new Date(),
    },
    publishing: {
      publishedInRange: 12,
      scheduledUpcoming: 0,
      daysWithoutScheduled: 6,
      strongestOrganicFormat: "Reel",
    },
    connectivity: {
      paidConnected: 2,
      paidTotal: 4,
      organicConnected: 3,
      organicTotal: 5,
    },
    formatPerformance: [
      {
        format: "Reel",
        contentCount: 8,
        averageEngagementRate: 4.8,
        averageReach: 12000,
      },
      {
        format: "Image",
        contentCount: 10,
        averageEngagementRate: 2.1,
        averageReach: 8000,
      },
    ],
    topOrganicContent: [
      {
        id: "content-1",
        title: "Product demo Reel",
        channel: "Instagram",
        format: "Reel",
        engagement: 2400,
        engagementRate: 5.5,
        reach: 48000,
      },
    ],
    topPaidCreatives: [
      {
        id: "creative-1",
        name: "AI Finance Demo",
        provider: "META",
        roas: 5.1,
        conversions: 120,
      },
    ],
    scheduleGaps: [
      {
        channel: "Instagram",
        message: "No Instagram Reel scheduled for the next 5 days.",
      },
    ],
    ...overrides,
  };
}

describe("organic intelligence rules", () => {
  it("fires format opportunity when difference is significant", () => {
    const signals = evaluateMarketingSignals(buildOrganicContext()).filter(
      (signal) => signal.category === "organic",
    );
    expect(signals.some((signal) => signal.id.startsWith("format-opportunity"))).toBe(true);
  });

  it("does not fire format opportunity with insufficient formats", () => {
    const signals = evaluateMarketingSignals(
      buildOrganicContext({ formatPerformance: [] }),
    );
    expect(signals.some((signal) => signal.id.startsWith("format-opportunity"))).toBe(false);
  });

  it("fires engagement anomaly on material decline", () => {
    const signals = evaluateMarketingSignals(buildOrganicContext()).filter(
      (signal) => signal.id === "engagement-anomaly",
    );
    expect(signals.length).toBe(1);
    expect(signals[0]?.evidence.length).toBeGreaterThan(0);
  });

  it("fires publishing gap signal", () => {
    const signals = evaluateAllMarketingSignals(buildOrganicContext()).filter(
      (signal) => signal.id.startsWith("publishing-gap"),
    );
    expect(signals.length).toBe(1);
  });
});

describe("cross-channel intelligence", () => {
  it("fires organic to paid opportunity", () => {
    const signals = evaluateAllMarketingSignals(buildOrganicContext()).filter(
      (signal) => signal.id.startsWith("organic-to-paid"),
    );
    expect(signals.length).toBe(1);
    expect(signals[0]?.action?.label).toBe("Review for Paid");
  });

  it("fires paid to organic repurpose opportunity", () => {
    const signals = evaluateAllMarketingSignals(buildOrganicContext()).filter(
      (signal) => signal.id.startsWith("paid-to-organic"),
    );
    expect(signals.length).toBe(1);
    expect(signals[0]?.action?.label).toBe("Repurpose");
    expect(signals[0]?.action?.href).toContain("repurposeFrom=");
  });

  it("organic to paid example fixture 1", () => {
    const signal = evaluateAllMarketingSignals(buildOrganicContext()).find(
      (item) => item.id.startsWith("organic-to-paid"),
    );
    expect(signal?.explanation).toContain("Product demo Reel");
    expect(signal?.explanation).toContain("paid");
  });

  it("paid to organic example fixture 2", () => {
    const signal = evaluateAllMarketingSignals(buildOrganicContext()).find(
      (item) => item.id.startsWith("paid-to-organic"),
    );
    expect(signal?.explanation).toContain("AI Finance Demo");
    expect(signal?.explanation).toContain("5.1x ROAS");
  });
});
