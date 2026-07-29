import { describe, expect, it } from "vitest";
import { assessExperimentValidity } from "@/lib/experiments/validity";
import { VALIDITY_WARNING_CODES } from "@/lib/experiments/constants";

describe("experiment validity warnings", () => {
  it("warns when variants publish on different platforms", () => {
    const warnings = assessExperimentValidity({
      targetProvider: "INSTAGRAM",
      minimumSampleThreshold: 100,
      variants: [
        { label: "A", provider: "INSTAGRAM", hasPaidPromotion: false },
        { label: "B", provider: "TIKTOK", hasPaidPromotion: false },
      ],
    });
    expect(warnings.some((warning) => warning.code === VALIDITY_WARNING_CODES.DIFFERENT_PLATFORMS)).toBe(
      true,
    );
  });

  it("warns when paid promotion affects only one variant", () => {
    const warnings = assessExperimentValidity({
      targetProvider: "INSTAGRAM",
      minimumSampleThreshold: 100,
      variants: [
        { label: "A", provider: "INSTAGRAM", hasPaidPromotion: true },
        { label: "B", provider: "INSTAGRAM", hasPaidPromotion: false },
      ],
    });
    expect(warnings.some((warning) => warning.code === VALIDITY_WARNING_CODES.PAID_PROMOTION_BIAS)).toBe(
      true,
    );
  });

  it("warns on insufficient sample size", () => {
    const warnings = assessExperimentValidity({
      targetProvider: "INSTAGRAM",
      minimumSampleThreshold: 100,
      variants: [
        { label: "A", provider: "INSTAGRAM", hasPaidPromotion: false },
        { label: "B", provider: "INSTAGRAM", hasPaidPromotion: false },
      ],
      sampleSizes: { a: 20, b: 150 },
    });
    expect(warnings.some((warning) => warning.code === VALIDITY_WARNING_CODES.INSUFFICIENT_SAMPLE)).toBe(
      true,
    );
  });
});
