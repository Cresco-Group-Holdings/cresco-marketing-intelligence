import type { CoverageDimension } from "@/lib/unified-analytics/types";

export function buildCoverageDimensions(input: {
  paidConnected: boolean;
  paidSpendAvailable: boolean;
  organicConnected: boolean;
  organicAnalyticsAvailable: boolean;
  webAnalyticsConnected?: boolean;
  webAnalyticsAvailable?: boolean;
  conversionsTracked: number;
  conversionsObserved: number;
  revenueObserved: number | null;
  revenueAttributed: number | null;
  journeysWithTouchpoints: number;
  totalJourneys: number;
}): { coverage: CoverageDimension[]; warnings: string[] } {
  const warnings: string[] = [];

  const paidSpendCoverage: CoverageDimension = {
    dimension: "Paid Spend Coverage",
    state: !input.paidConnected
      ? "Unavailable"
      : input.paidSpendAvailable
        ? "Strong"
        : "Partial",
    label: !input.paidConnected
      ? "No paid channels connected"
      : input.paidSpendAvailable
        ? "Paid spend data available for selected period"
        : "Paid spend partially available",
    coveragePercent: input.paidConnected ? (input.paidSpendAvailable ? 100 : 60) : null,
  };

  const organicCoverage: CoverageDimension = {
    dimension: "Organic Analytics Coverage",
    state: !input.organicConnected
      ? "Unavailable"
      : input.organicAnalyticsAvailable
        ? "Strong"
        : "Limited",
    label: !input.organicConnected
      ? "No organic channels connected"
      : input.organicAnalyticsAvailable
        ? "Organic analytics reporting"
        : "Organic analytics incomplete",
    coveragePercent: input.organicConnected ? (input.organicAnalyticsAvailable ? 100 : 40) : null,
  };

  const conversionCoveragePercent =
    input.conversionsObserved > 0
      ? Math.min(100, (input.conversionsTracked / input.conversionsObserved) * 100)
      : input.conversionsTracked > 0
        ? 100
        : null;

  const conversionCoverage: CoverageDimension = {
    dimension: "Conversion Tracking Coverage",
    state:
      conversionCoveragePercent == null
        ? "Unavailable"
        : conversionCoveragePercent >= 80
          ? "Strong"
          : conversionCoveragePercent >= 50
            ? "Partial"
            : "Limited",
    label:
      conversionCoveragePercent != null
        ? `Attribution based on ${conversionCoveragePercent.toFixed(0)}% of tracked conversions`
        : "No conversion tracking data",
    coveragePercent: conversionCoveragePercent,
  };

  const revenueCoveragePercent =
    input.revenueObserved != null &&
    input.revenueObserved > 0 &&
    input.revenueAttributed != null
      ? Math.min(100, (input.revenueAttributed / input.revenueObserved) * 100)
      : null;

  const revenueCoverage: CoverageDimension = {
    dimension: "Revenue Coverage",
    state:
      input.revenueObserved == null
        ? "Unavailable"
        : revenueCoveragePercent != null && revenueCoveragePercent >= 70
          ? "Strong"
          : revenueCoveragePercent != null
            ? "Partial"
            : "Limited",
    label:
      input.revenueObserved == null
        ? "Revenue data not connected"
        : revenueCoveragePercent != null
          ? `${revenueCoveragePercent.toFixed(0)}% of observed revenue attributed`
          : "Revenue attribution limited",
    coveragePercent: revenueCoveragePercent,
  };

  const attributionCoveragePercent =
    input.totalJourneys > 0
      ? Math.min(100, (input.journeysWithTouchpoints / input.totalJourneys) * 100)
      : null;

  const attributionCoverage: CoverageDimension = {
    dimension: "Attribution Coverage",
    state:
      attributionCoveragePercent == null
        ? "Unavailable"
        : attributionCoveragePercent >= 75
          ? "Strong"
          : attributionCoveragePercent >= 50
            ? "Partial"
            : "Limited",
    label:
      attributionCoveragePercent != null
        ? `${attributionCoveragePercent.toFixed(0)}% of journeys have eligible touchpoints`
        : "No journey data for attribution",
    coveragePercent: attributionCoveragePercent,
  };

  const webAnalyticsCoverage: CoverageDimension = {
    dimension: "Web Analytics Coverage",
    state:
      input.webAnalyticsConnected === false
        ? "Unavailable"
        : input.webAnalyticsAvailable
          ? "Strong"
          : input.webAnalyticsConnected
            ? "Partial"
            : "Unavailable",
    label:
      input.webAnalyticsConnected === false
        ? "No web analytics connected"
        : input.webAnalyticsAvailable
          ? "GA4 sessions and conversion data available"
          : "GA4 connected but no data in selected period",
    coveragePercent:
      input.webAnalyticsConnected && input.webAnalyticsAvailable
        ? 100
        : input.webAnalyticsConnected
          ? 40
          : null,
  };

  if (organicCoverage.state === "Limited") {
    warnings.push("Organic analytics missing for one or more connected channels.");
  }
  if (webAnalyticsCoverage.state === "Unavailable") {
    warnings.push("Connect GA4 to measure sessions, landing pages and conversion journeys.");
  }
  if (revenueCoverage.state === "Unavailable") {
    warnings.push("Revenue data not connected.");
  }
  if (attributionCoverage.state === "Limited" || attributionCoverage.state === "Partial") {
    warnings.push(
      `Attribution is based on ${attributionCoveragePercent?.toFixed(0) ?? "0"}% of tracked conversion journeys.`,
    );
  }

  return {
    coverage: [
      paidSpendCoverage,
      organicCoverage,
      webAnalyticsCoverage,
      conversionCoverage,
      revenueCoverage,
      attributionCoverage,
    ],
    warnings,
  };
}
