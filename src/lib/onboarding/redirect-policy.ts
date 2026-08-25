import { isOnboardingRoute, isActivationRoute } from "@/lib/auth/routes";
import type { ClientOnboardingStatus } from "@/lib/onboarding/status";

export type OnboardingRouteDecision = "allow" | "redirect-onboarding" | "redirect-dashboard";

export function resolveOnboardingRouteDecision(input: {
  pathname: string;
  status: ClientOnboardingStatus;
}): OnboardingRouteDecision {
  if (input.status === "loading" || input.status === "error") {
    return "allow";
  }

  const onOnboarding = isOnboardingRoute(input.pathname);
  const onActivation = isActivationRoute(input.pathname);

  if (input.status === "incomplete" && !onOnboarding && !onActivation) {
    return "redirect-onboarding";
  }

  if (input.status === "complete" && onOnboarding) {
    return "redirect-dashboard";
  }

  return "allow";
}
