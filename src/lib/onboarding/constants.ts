import { OnboardingStepKey } from "@prisma/client";

export const ONBOARDING_STEPS: OnboardingStepKey[] = [
  OnboardingStepKey.ACCOUNT_PROFILE,
  OnboardingStepKey.ORGANISATION,
  OnboardingStepKey.PROJECT,
  OnboardingStepKey.BRAND,
  OnboardingStepKey.BRAND_PROFILE,
  OnboardingStepKey.MARKETING_OBJECTIVES,
  OnboardingStepKey.CHANNEL_PREFERENCES,
  OnboardingStepKey.REVIEW,
];

export const ONBOARDING_STEP_LABELS: Record<OnboardingStepKey, string> = {
  ACCOUNT_PROFILE: "Account profile",
  ORGANISATION: "Organisation details",
  PROJECT: "First project",
  BRAND: "First brand",
  BRAND_PROFILE: "Brand profile",
  MARKETING_OBJECTIVES: "Marketing objectives",
  CHANNEL_PREFERENCES: "Channel preferences",
  REVIEW: "Review and completion",
};

export function getNextOnboardingStep(
  current: OnboardingStepKey,
): OnboardingStepKey | null {
  const index = ONBOARDING_STEPS.indexOf(current);
  if (index < 0 || index >= ONBOARDING_STEPS.length - 1) {
    return null;
  }

  return ONBOARDING_STEPS[index + 1]!;
}

export function getPreviousOnboardingStep(
  current: OnboardingStepKey,
): OnboardingStepKey | null {
  const index = ONBOARDING_STEPS.indexOf(current);
  if (index <= 0) {
    return null;
  }

  return ONBOARDING_STEPS[index - 1]!;
}

export function getOnboardingStepNumber(step: OnboardingStepKey): number {
  return ONBOARDING_STEPS.indexOf(step) + 1;
}

export function isOnboardingStepComplete(
  completedSteps: OnboardingStepKey[],
  step: OnboardingStepKey,
): boolean {
  return completedSteps.includes(step);
}

export const CRESCO_INTERNAL_TEMPLATE_KEY = "cresco-internal";
