"use client";

import { OnboardingStepKey } from "@prisma/client";
import { ONBOARDING_STEP_LABELS, ONBOARDING_STEPS } from "@/lib/onboarding/constants";

type OnboardingStepProgressProps = {
  currentStep: OnboardingStepKey;
  completedSteps: OnboardingStepKey[];
};

export function OnboardingStepProgress({
  currentStep,
  completedSteps,
}: OnboardingStepProgressProps) {
  return (
    <nav aria-label="Onboarding progress" className="space-y-3">
      <ol className="grid gap-2 sm:grid-cols-2">
        {ONBOARDING_STEPS.map((step, index) => {
          const isComplete = completedSteps.includes(step);
          const isCurrent = step === currentStep;

          return (
            <li
              key={step}
              className={`rounded-lg border px-3 py-2 text-sm ${
                isCurrent
                  ? "border-primary bg-primary text-primary-foreground"
                  : isComplete
                    ? "border-green-200 bg-green-50 text-green-900"
                    : "border-border bg-surface-elevated text-foreground-muted"
              }`}
            >
              <span className="font-medium">
                {index + 1}. {ONBOARDING_STEP_LABELS[step]}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
