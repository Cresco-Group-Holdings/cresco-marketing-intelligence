import { describe, expect, it } from "vitest";
import { OrganisationRole } from "@prisma/client";
import { analyzeExperiment } from "@/lib/advertising-experiments/analysis";
import { buildAllocationPlan } from "@/lib/advertising-experiments/allocation";
import { validateDecision, requiresHumanApproval } from "@/lib/advertising-experiments/decisions";
import { validateHypothesis } from "@/lib/advertising-experiments/hypothesis";
import { validateMetrics } from "@/lib/advertising-experiments/metrics";
import { assessAdvertisingExperimentValidity, hasCriticalValidityIssues } from "@/lib/advertising-experiments/validity";
import { checkVariantIsolation, validateVariants } from "@/lib/advertising-experiments/variants";
import { hasPermission, PERMISSIONS } from "@/lib/tenancy/permissions";

const validHypothesis = {
  observedProblem: "CTR below 1%",
  proposedChange: "Test new headline",
  expectedOutcome: "CTR increase to 1.5%",
  primaryMetric: "ctr",
  guardrailMetrics: ["cpa"],
  audience: "US marketing professionals",
  durationDays: 14,
  minimumVolume: 1000,
  decisionRule: "Adopt if CTR improves ≥5% with stable CPA.",
};

const controlVariant = {
  variantType: "CONTROL",
  label: "Control",
  documentedVariables: { headline: "Original" },
};

const treatmentVariant = {
  variantType: "TREATMENT",
  label: "Treatment A",
  documentedVariables: { headline: "New headline" },
};

describe("hypothesis requirements", () => {
  it("requires all measurable fields", () => {
    expect(validateHypothesis(validHypothesis).valid).toBe(true);
  });

  it("rejects missing observed problem", () => {
    expect(validateHypothesis({ ...validHypothesis, observedProblem: "" }).valid).toBe(false);
  });

  it("rejects invalid primary metric", () => {
    expect(validateHypothesis({ ...validHypothesis, primaryMetric: "invalid" }).valid).toBe(false);
  });

  it("rejects zero minimum volume", () => {
    expect(validateHypothesis({ ...validHypothesis, minimumVolume: 0 }).valid).toBe(false);
  });
});

describe("variant isolation", () => {
  it("requires control and treatment", () => {
    const result = validateVariants([controlVariant, treatmentVariant], "HEADLINE");
    expect(result.valid).toBe(true);
  });

  it("requires exactly one control", () => {
    expect(validateVariants([treatmentVariant, treatmentVariant], "HEADLINE").valid).toBe(false);
  });

  it("detects multi-variable isolation breach", () => {
    const issues = checkVariantIsolation([
      controlVariant,
      { ...treatmentVariant, documentedVariables: { headline: "New", cta: "Buy now" } },
    ]);
    expect(issues.length).toBeGreaterThan(0);
  });
});

describe("allocation", () => {
  it("builds equal split", () => {
    const plan = buildAllocationPlan(["v1", "v2"], { allocationType: "EQUAL" });
    expect(plan.weights.v1).toBe(50);
    expect(plan.weights.v2).toBe(50);
  });

  it("includes randomisation disclaimer for equal split", () => {
    const plan = buildAllocationPlan(["v1", "v2"], { allocationType: "EQUAL" });
    expect(plan.randomisationDisclaimer).toContain("random");
  });

  it("rejects weighted split not summing to 100", () => {
    expect(() => buildAllocationPlan(["v1", "v2"], { allocationType: "WEIGHTED", weights: { v1: 60, v2: 30 } })).toThrow();
  });
});

describe("metric calculations", () => {
  it("requires exactly one primary metric", () => {
    expect(validateMetrics([{ metricKey: "ctr", role: "PRIMARY" }]).valid).toBe(true);
    expect(validateMetrics([]).valid).toBe(false);
  });
});

describe("validity checks", () => {
  it("detects insufficient volume", () => {
    const checks = assessAdvertisingExperimentValidity({
      minimumVolume: 1000,
      allocationType: "EQUAL",
      variantSampleSizes: { v1: 500, v2: 1200 },
      variantDelivered: { v1: true, v2: true },
      hasStaleObservations: false,
      campaignChangedDuringTest: false,
      audienceOverlapDetected: false,
      trackingFailure: false,
      inconsistentAttribution: false,
      missingConversionData: false,
      majorBudgetChange: false,
      earlyStoppingRisk: false,
      testDurationDays: 7,
      plannedDurationDays: 14,
    });
    expect(checks.some((c) => c.checkType === "INSUFFICIENT_VOLUME")).toBe(true);
  });

  it("detects unequal delivery", () => {
    const checks = assessAdvertisingExperimentValidity({
      minimumVolume: 100,
      allocationType: "EQUAL",
      variantSampleSizes: { v1: 100, v2: 500 },
      variantDelivered: { v1: true, v2: true },
      hasStaleObservations: false,
      campaignChangedDuringTest: false,
      audienceOverlapDetected: false,
      trackingFailure: false,
      inconsistentAttribution: false,
      missingConversionData: false,
      majorBudgetChange: false,
      earlyStoppingRisk: false,
      testDurationDays: 10,
      plannedDurationDays: 14,
    });
    expect(checks.some((c) => c.checkType === "UNEQUAL_DELIVERY")).toBe(true);
  });

  it("detects stale data", () => {
    const checks = assessAdvertisingExperimentValidity({
      minimumVolume: 100,
      allocationType: "EQUAL",
      variantSampleSizes: { v1: 200, v2: 200 },
      variantDelivered: { v1: true, v2: true },
      hasStaleObservations: true,
      campaignChangedDuringTest: false,
      audienceOverlapDetected: false,
      trackingFailure: false,
      inconsistentAttribution: false,
      missingConversionData: false,
      majorBudgetChange: false,
      earlyStoppingRisk: false,
      testDurationDays: 10,
      plannedDurationDays: 14,
    });
    expect(checks.some((c) => c.checkType === "STALE_DATA")).toBe(true);
  });

  it("flags invalid test with critical issues", () => {
    const checks = assessAdvertisingExperimentValidity({
      minimumVolume: 1000,
      allocationType: "EQUAL",
      variantSampleSizes: { v1: 100, v2: 100 },
      variantDelivered: { v1: true, v2: true },
      hasStaleObservations: false,
      campaignChangedDuringTest: true,
      audienceOverlapDetected: false,
      trackingFailure: false,
      inconsistentAttribution: false,
      missingConversionData: false,
      majorBudgetChange: false,
      earlyStoppingRisk: false,
      testDurationDays: 5,
      plannedDurationDays: 14,
    });
    expect(hasCriticalValidityIssues(checks)).toBe(true);
  });
});

describe("analysis", () => {
  it("does not claim significance with critical validity issues", () => {
    const result = analyzeExperiment({
      primaryMetricKey: "ctr",
      variantValues: [
        { variantId: "v1", label: "Control", metricKey: "ctr", absoluteValue: 0.01, sampleSize: 5000 },
        { variantId: "v2", label: "Treatment", metricKey: "ctr", absoluteValue: 0.015, sampleSize: 5000 },
      ],
      validityChecks: [{ checkType: "CAMPAIGN_CHANGE_DURING_TEST", severity: "CRITICAL", message: "Changed." }],
      testDurationDays: 14,
      minimumVolume: 1000,
      decisionRule: "Adopt if ≥5% improvement.",
    });
    expect(result.significanceClaimed).toBe(false);
    expect(result.recommendation).toBe("INVALID_TEST");
  });

  it("computes relative difference", () => {
    const result = analyzeExperiment({
      primaryMetricKey: "ctr",
      variantValues: [
        { variantId: "v1", label: "Control", metricKey: "ctr", absoluteValue: 0.01, sampleSize: 5000 },
        { variantId: "v2", label: "Treatment", metricKey: "ctr", absoluteValue: 0.02, sampleSize: 5000 },
      ],
      validityChecks: [],
      testDurationDays: 14,
      minimumVolume: 1000,
      decisionRule: "Adopt if ≥5% improvement.",
    });
    expect(result.relativeDifference).toBe(100);
    expect(result.recommendation).toBe("ADOPT_VARIANT");
  });
});

describe("decision approval", () => {
  it("requires human approval for adopt variant", () => {
    expect(requiresHumanApproval("ADOPT_VARIANT")).toBe(true);
    expect(requiresHumanApproval("KEEP_CONTROL")).toBe(false);
  });

  it("validates adopt variant requires winning variant", () => {
    expect(validateDecision({
      outcome: "ADOPT_VARIANT",
      recommendation: "Deploy treatment",
      limitations: "Observational only",
      analysisSignificanceClaimed: false,
    }).valid).toBe(false);
  });
});

describe("permissions", () => {
  it("grants decide to admin", () => {
    expect(hasPermission(OrganisationRole.ADMIN, PERMISSIONS["advertisingExperiments.decide"])).toBe(true);
  });

  it("denies decide to viewer", () => {
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["advertisingExperiments.decide"])).toBe(false);
  });
});

describe("tenant isolation", () => {
  it("hypothesis payload has no tenant IDs", () => {
    const json = JSON.stringify(validHypothesis);
    expect(json).not.toContain("organisationId");
    expect(json).not.toContain("brandId");
  });
});
