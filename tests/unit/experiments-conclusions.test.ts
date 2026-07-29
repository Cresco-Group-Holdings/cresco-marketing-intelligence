import { describe, expect, it } from "vitest";
import { concludeExperiment } from "@/lib/experiments/conclusions";
import { VALIDITY_WARNING_CODES } from "@/lib/experiments/constants";

describe("experiment conclusions", () => {
  it("does not declare a winner from trivial differences", () => {
    const result = concludeExperiment({
      primaryMetricKey: "engagement_rate",
      minimumSampleThreshold: 100,
      validityWarnings: [],
      variantResults: [
        {
          variantId: "a",
          label: "A",
          metricKey: "engagement_rate",
          rawValue: 100,
          normalisedValue: 0.05,
          sampleSize: 200,
          dataSufficient: true,
        },
        {
          variantId: "b",
          label: "B",
          metricKey: "engagement_rate",
          rawValue: 104,
          normalisedValue: 0.052,
          sampleSize: 200,
          dataSufficient: true,
        },
      ],
    });

    expect(result.outcome).toBe("INCONCLUSIVE");
    expect(result.winningVariantId).toBeNull();
  });

  it("declares a winner when difference exceeds threshold and data is sufficient", () => {
    const result = concludeExperiment({
      primaryMetricKey: "engagement_rate",
      minimumSampleThreshold: 50,
      validityWarnings: [],
      variantResults: [
        {
          variantId: "a",
          label: "A",
          metricKey: "engagement_rate",
          rawValue: 100,
          normalisedValue: 0.05,
          sampleSize: 120,
          dataSufficient: true,
        },
        {
          variantId: "b",
          label: "B",
          metricKey: "engagement_rate",
          rawValue: 150,
          normalisedValue: 0.075,
          sampleSize: 120,
          dataSufficient: true,
        },
      ],
    });

    expect(result.outcome).toBe("WINNER");
    expect(result.winningVariantId).toBe("b");
  });

  it("returns inconclusive when critical validity warnings exist", () => {
    const result = concludeExperiment({
      primaryMetricKey: "engagement_rate",
      minimumSampleThreshold: 50,
      validityWarnings: [
        {
          code: VALIDITY_WARNING_CODES.DIFFERENT_PLATFORMS,
          message: "Different platforms",
          severity: "CRITICAL",
        },
      ],
      variantResults: [
        {
          variantId: "a",
          label: "A",
          metricKey: "engagement_rate",
          rawValue: 100,
          sampleSize: 120,
          dataSufficient: true,
        },
        {
          variantId: "b",
          label: "B",
          metricKey: "engagement_rate",
          rawValue: 200,
          sampleSize: 120,
          dataSufficient: true,
        },
      ],
    });

    expect(result.outcome).toBe("INCONCLUSIVE");
  });
});
