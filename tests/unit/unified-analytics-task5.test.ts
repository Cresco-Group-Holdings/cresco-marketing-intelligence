import { describe, expect, it } from "vitest";
import {
  appendUtmToUrl,
  buildContentUtm,
  parseUtmParams,
  resolveContentLineageKey,
} from "@/lib/analytics/utm";
import { computeAttributionConfidence } from "@/lib/unified-analytics/attribution-confidence";
import { deduplicateConversions } from "@/lib/unified-analytics/conversion-dedup";
import { buildCoverageDimensions } from "@/lib/unified-analytics/coverage";
import { buildOverviewKpiStrip, buildUnifiedKpis } from "@/lib/unified-analytics/kpis";
import { unavailableValue } from "@/lib/marketing-intelligence/format";

describe("UTM governance", () => {
  it("builds human-readable campaign labels without exposing internal IDs", () => {
    const utm = buildContentUtm({
      source: "Instagram",
      medium: "social",
      campaignLabel: "Q3 Product Launch",
      contentLabel: "Launch Reel",
      lineage: { contentVariantId: "uuid-should-not-appear" },
    });

    expect(utm.displayCampaign).toBe("Q3 Product Launch");
    expect(utm.utm_campaign).toBe("q3-product-launch");
    expect(utm.utm_content).toBe("launch-reel");
    expect(utm.utm_campaign).not.toContain("uuid");
  });

  it("parses direct traffic honestly", () => {
    const direct = parseUtmParams({ utm_medium: "direct" });
    expect(direct.isDirect).toBe(true);

    const empty = parseUtmParams({});
    expect(empty.isDirect).toBe(true);
    expect(empty.isUnknown).toBe(false);
  });

  it("appends UTM parameters to destination URLs", () => {
    const utm = buildContentUtm({
      source: "linkedin",
      medium: "social",
      campaignLabel: "Webinar Series",
    });
    const url = appendUtmToUrl("https://example.com/page", utm);
    expect(url).toContain("utm_source=linkedin");
    expect(url).toContain("utm_campaign=webinar-series");
  });

  it("resolves content lineage from utm_content", () => {
    const parsed = parseUtmParams({ utm_content: "launch-reel" });
    expect(resolveContentLineageKey(parsed)).toBe("launch-reel");
    expect(resolveContentLineageKey(parsed, "fallback-id")).toBe("launch-reel");
  });
});

describe("attribution confidence", () => {
  it("returns low confidence when coverage is limited", () => {
    const { coverage } = buildCoverageDimensions({
      paidConnected: true,
      paidSpendAvailable: true,
      organicConnected: true,
      organicAnalyticsAvailable: false,
      conversionsTracked: 20,
      conversionsObserved: 50,
      revenueObserved: null,
      revenueAttributed: null,
      journeysWithTouchpoints: 10,
      totalJourneys: 50,
    });

    const confidence = computeAttributionConfidence({
      totalJourneys: 50,
      journeysWithTouchpoints: 10,
      attributedConversions: 20,
      unattributedConversions: 30,
      revenueObserved: null,
      revenueAttributed: null,
      coverageDimensions: coverage,
    });

    expect(confidence.level).toBe("Low");
    expect(confidence.limitations.some((item) => item.includes("cannot be attributed"))).toBe(true);
  });

  it("returns high confidence when source and journey coverage are strong", () => {
    const { coverage } = buildCoverageDimensions({
      paidConnected: true,
      paidSpendAvailable: true,
      organicConnected: true,
      organicAnalyticsAvailable: true,
      webAnalyticsConnected: true,
      webAnalyticsAvailable: true,
      conversionsTracked: 90,
      conversionsObserved: 100,
      revenueObserved: 100000,
      revenueAttributed: 85000,
      journeysWithTouchpoints: 95,
      totalJourneys: 100,
    });

    const confidence = computeAttributionConfidence({
      totalJourneys: 100,
      journeysWithTouchpoints: 95,
      attributedConversions: 90,
      unattributedConversions: 10,
      revenueObserved: 100000,
      revenueAttributed: 85000,
      coverageDimensions: coverage,
    });

    expect(confidence.level).toBe("High");
    expect(confidence.sourceCoveragePercent).toBe(90);
  });
});

describe("conversion deduplication", () => {
  it("deduplicates by transaction_id across providers", () => {
    const result = deduplicateConversions([
      {
        id: "meta-1",
        provider: "META",
        conversionType: "purchase",
        occurredAt: "2026-02-01T10:00:00Z",
        value: 100,
        transactionId: "txn-abc",
      },
      {
        id: "ga4-1",
        provider: "GA4",
        conversionType: "purchase",
        occurredAt: "2026-02-01T10:01:00Z",
        value: 100,
        transactionId: "txn-abc",
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.sources).toHaveLength(2);
    expect(result[0]?.dedupeMethod).toBe("transaction_id");
    expect(result[0]?.confidence).toBe("high");
  });

  it("preserves separate observations when no shared identifier exists", () => {
    const result = deduplicateConversions([
      {
        id: "a",
        provider: "META",
        conversionType: "lead",
        occurredAt: "2026-02-01T10:00:00Z",
        value: null,
      },
      {
        id: "b",
        provider: "GA4",
        conversionType: "lead",
        occurredAt: "2026-02-01T11:00:00Z",
        value: null,
      },
    ]);

    expect(result).toHaveLength(2);
    expect(result.every((row) => row.dedupeMethod === "none")).toBe(true);
  });
});

describe("web analytics coverage dimension", () => {
  it("reports unavailable when GA4 is not connected", () => {
    const { coverage, warnings } = buildCoverageDimensions({
      paidConnected: true,
      paidSpendAvailable: true,
      organicConnected: false,
      organicAnalyticsAvailable: false,
      webAnalyticsConnected: false,
      webAnalyticsAvailable: false,
      conversionsTracked: 0,
      conversionsObserved: 0,
      revenueObserved: null,
      revenueAttributed: null,
      journeysWithTouchpoints: 0,
      totalJourneys: 0,
    });

    expect(coverage.find((item) => item.dimension === "Web Analytics Coverage")?.state).toBe(
      "Unavailable",
    );
    expect(warnings.some((warning) => warning.includes("Connect GA4"))).toBe(true);
  });
});

describe("overview KPI strip", () => {
  it("prioritizes launch KPIs and omits unavailable metrics", () => {
    const allKpis = buildUnifiedKpis({
      paidSpend: 10000,
      previousPaidSpend: 8000,
      attributedRevenue: null,
      previousAttributedRevenue: null,
      observedRevenue: null,
      conversions: 120,
      previousConversions: 100,
      paidConversions: 130,
      organicContributionRevenue: null,
      paidContributionRevenue: null,
      contentAssistedRevenue: null,
      organicReach: 50000,
      previousOrganicReach: 40000,
      webSessions: null,
      previousWebSessions: null,
      attributionModelLabel: "Last Touch",
      revenueCoveragePercent: null,
      paidSpendCoveragePercent: 100,
      showComparison: true,
      comparisonLabel: "vs previous period",
    });

    const strip = buildOverviewKpiStrip(allKpis);
    expect(strip.some((kpi) => kpi.label === "Attributed Revenue")).toBe(false);
    expect(strip.some((kpi) => kpi.label === "Total Marketing Spend")).toBe(true);
    expect(strip.some((kpi) => kpi.label === "Organic Reach")).toBe(true);
    expect(strip.every((kpi) => kpi.value !== unavailableValue())).toBe(true);
  });
});
