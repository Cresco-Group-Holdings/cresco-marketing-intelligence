import { describe, expect, it } from "vitest";
import { buildHealthRecommendedImprovement } from "@/lib/marketing-intelligence/scoring/health-improvements";
import type { MarketingIntelligenceContext } from "@/lib/marketing-intelligence/types";

const baseContext: MarketingIntelligenceContext = {
  rangeLabel: "Last 30 days",
  comparisonLabel: "vs previous 30 days",
  paid: {
    connectedCount: 1,
    totalProviders: 4,
    spend: 1000,
    previousSpend: 900,
    conversions: 10,
    previousConversions: 8,
    revenue: 2500,
    previousRevenue: 2000,
    roas: 2.5,
    previousRoas: 2.2,
    cpa: 100,
    previousCpa: 110,
    byProvider: [],
    freshness: "fresh",
    lastSyncedAt: null,
  },
  organic: {
    connectedCount: 0,
    totalProviders: 5,
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
    daysWithoutScheduled: 7,
    strongestOrganicFormat: null,
  },
  connectivity: {
    paidConnected: 1,
    paidTotal: 4,
    organicConnected: 0,
    organicTotal: 5,
  },
};

describe("health recommended improvements", () => {
  it("suggests connecting channels when connectivity score is incomplete", () => {
    const improvement = buildHealthRecommendedImprovement("connectivity", 5, 15, baseContext);
    expect(improvement).toContain("Connect");
  });

  it("does not fabricate improvements for fully scored components", () => {
    const improvement = buildHealthRecommendedImprovement("connectivity", 15, 15, baseContext);
    expect(improvement).toBeUndefined();
  });
});
