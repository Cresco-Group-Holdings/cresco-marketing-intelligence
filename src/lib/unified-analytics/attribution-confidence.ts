import type { CoverageDimension } from "@/lib/unified-analytics/types";

export type AttributionConfidenceLevel = "Low" | "Medium" | "High";

export type AttributionConfidence = {
  level: AttributionConfidenceLevel;
  label: string;
  /** Percentage of conversions with known marketing source (0–100). */
  sourceCoveragePercent: number | null;
  /** Percentage of journeys with eligible touchpoints (0–100). */
  journeyCoveragePercent: number | null;
  limitations: string[];
};

export function computeAttributionConfidence(input: {
  totalJourneys: number;
  journeysWithTouchpoints: number;
  attributedConversions: number;
  unattributedConversions: number;
  revenueObserved: number | null;
  revenueAttributed: number | null;
  coverageDimensions: CoverageDimension[];
}): AttributionConfidence {
  const totalConversions = input.attributedConversions + input.unattributedConversions;
  const sourceCoveragePercent =
    totalConversions > 0
      ? Math.round((input.attributedConversions / totalConversions) * 100)
      : null;

  const journeyCoveragePercent =
    input.totalJourneys > 0
      ? Math.round((input.journeysWithTouchpoints / input.totalJourneys) * 100)
      : null;

  const limitations: string[] = [];

  if (sourceCoveragePercent != null && sourceCoveragePercent < 100) {
    limitations.push(
      `${100 - sourceCoveragePercent}% of conversions cannot be attributed with current tracking.`,
    );
  }
  if (journeyCoveragePercent != null && journeyCoveragePercent < 75) {
    limitations.push(
      `${100 - journeyCoveragePercent}% of conversion journeys lack eligible marketing touchpoints.`,
    );
  }
  if (input.revenueObserved == null) {
    limitations.push("No observed revenue source connected — revenue attribution is conversion-based only.");
  } else if (
    input.revenueAttributed != null &&
    input.revenueObserved > 0 &&
    input.revenueAttributed < input.revenueObserved * 0.5
  ) {
    limitations.push("Less than half of observed revenue is attributed to marketing touchpoints.");
  }

  const revenueDim = input.coverageDimensions.find((d) => d.dimension === "Revenue Coverage");
  if (revenueDim?.state === "Unavailable") {
    limitations.push("Revenue coverage unavailable.");
  }

  let level: AttributionConfidenceLevel = "Low";
  if (
    sourceCoveragePercent != null &&
    sourceCoveragePercent >= 75 &&
    journeyCoveragePercent != null &&
    journeyCoveragePercent >= 75
  ) {
    level = "High";
  } else if (
    sourceCoveragePercent != null &&
    sourceCoveragePercent >= 50 &&
    journeyCoveragePercent != null &&
    journeyCoveragePercent >= 50
  ) {
    level = "Medium";
  }

  const label =
    level === "High"
      ? "Strong coverage — attribution is based on most tracked conversions."
      : level === "Medium"
        ? "Partial coverage — interpret channel credit with caution."
        : "Limited coverage — many conversions lack marketing source linkage.";

  return {
    level,
    label,
    sourceCoveragePercent,
    journeyCoveragePercent,
    limitations,
  };
}
