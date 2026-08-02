"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { resolveOnboardingRouteDecision } from "@/lib/onboarding/redirect-policy";

export function OnboardingRedirect() {
  const router = useRouter();
  const pathname = usePathname();
  const { onboardingStatus } = useWorkspace();

  useEffect(() => {
    const decision = resolveOnboardingRouteDecision({
      pathname,
      status: onboardingStatus,
    });

    if (decision === "redirect-onboarding") {
      router.replace("/onboarding");
      return;
    }

    if (decision === "redirect-dashboard") {
      router.replace("/dashboard");
    }
  }, [onboardingStatus, pathname, router]);

  return null;
}
