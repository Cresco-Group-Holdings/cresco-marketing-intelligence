import { describe, expect, it } from "vitest";
import { MarketingObjectiveType, OnboardingStepKey } from "@prisma/client";
import {
  getNextOnboardingStep,
  getOnboardingStepNumber,
  getPreviousOnboardingStep,
  ONBOARDING_STEPS,
} from "@/lib/onboarding/constants";
import { CRESCO_INTERNAL_TEMPLATE } from "@/lib/onboarding/cresco-template";
import { marketingObjectivesStepSchema } from "@/lib/validation/onboarding";

describe("onboarding step registry", () => {
  it("defines eight ordered steps", () => {
    expect(ONBOARDING_STEPS).toHaveLength(8);
    expect(ONBOARDING_STEPS[0]).toBe(OnboardingStepKey.ACCOUNT_PROFILE);
    expect(ONBOARDING_STEPS[7]).toBe(OnboardingStepKey.REVIEW);
  });

  it("resolves next and previous steps", () => {
    expect(getNextOnboardingStep(OnboardingStepKey.ACCOUNT_PROFILE)).toBe(
      OnboardingStepKey.ORGANISATION,
    );
    expect(getPreviousOnboardingStep(OnboardingStepKey.PROJECT)).toBe(
      OnboardingStepKey.ORGANISATION,
    );
    expect(getOnboardingStepNumber(OnboardingStepKey.BRAND_PROFILE)).toBe(5);
  });
});

describe("marketing objectives validation", () => {
  it("requires at least one objective with required fields", () => {
    const parsed = marketingObjectivesStepSchema.safeParse({
      objectives: [
        {
          objectiveType: MarketingObjectiveType.LEAD_GENERATION,
          description: "Generate qualified leads for the brand.",
          priority: 1,
          targetValue: 250,
          targetPeriod: "90d",
        },
      ],
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects empty objective lists", () => {
    const parsed = marketingObjectivesStepSchema.safeParse({ objectives: [] });
    expect(parsed.success).toBe(false);
  });
});

describe("cresco internal template", () => {
  it("includes both Cresco projects without being the default flow", () => {
    expect(CRESCO_INTERNAL_TEMPLATE.organisation.slug).toBe("cresco-group");
    expect(CRESCO_INTERNAL_TEMPLATE.projects).toHaveLength(2);
    expect(CRESCO_INTERNAL_TEMPLATE.projects.map((project) => project.slug)).toEqual([
      "cresco-grants-intelligence",
      "capital-cresco-terminal",
    ]);
  });
});
