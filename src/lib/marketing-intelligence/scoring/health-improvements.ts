import type { MarketingIntelligenceContext } from "@/lib/marketing-intelligence/types";

export function buildHealthRecommendedImprovement(
  key: string,
  score: number,
  maxScore: number,
  context: MarketingIntelligenceContext,
): string | undefined {
  if (score >= maxScore) {
    return undefined;
  }

  switch (key) {
    case "connectivity": {
      const missingPaid = context.connectivity.paidTotal - context.connectivity.paidConnected;
      const missingOrganic = context.connectivity.organicTotal - context.connectivity.organicConnected;
      if (missingPaid > 0 && missingOrganic > 0) {
        return `Connect ${missingPaid} paid and ${missingOrganic} organic channel(s) to improve marketing coverage.`;
      }
      if (missingPaid > 0) {
        return `Connect ${missingPaid} remaining paid advertising channel(s).`;
      }
      if (missingOrganic > 0) {
        return `Connect ${missingOrganic} remaining organic social channel(s).`;
      }
      return undefined;
    }
    case "dataQuality":
      if (context.paid.freshness === "stale" || context.organic.freshness === "stale") {
        return "Check integration sync status and re-authenticate any stale connections.";
      }
      if (context.paid.freshness === "unavailable" || context.organic.freshness === "unavailable") {
        return "Connect paid and organic data sources to improve data quality scoring.";
      }
      return undefined;
    case "paid":
      if (context.paid.connectedCount === 0) {
        return "Connect a paid advertising account to unlock spend and ROAS tracking.";
      }
      if (context.paid.roas != null && context.paid.roas < 1) {
        return "Review underperforming campaigns and reallocate budget to higher ROAS segments.";
      }
      return undefined;
    case "organic":
      if (context.organic.connectedCount === 0) {
        return "Connect organic social channels to track reach and engagement.";
      }
      if ((context.organic.scheduled ?? 0) === 0) {
        return "Schedule upcoming content to maintain organic publishing consistency.";
      }
      return undefined;
    case "publishing":
      if (context.publishing.scheduledUpcoming === 0) {
        return "Add scheduled posts to the content calendar for the next 7 days.";
      }
      if (context.publishing.publishedInRange < 2) {
        return "Increase publishing cadence to strengthen organic momentum.";
      }
      return undefined;
    default:
      return undefined;
  }
}
