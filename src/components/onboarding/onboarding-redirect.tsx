"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useWorkspace } from "@/components/workspace/workspace-provider";

export function OnboardingRedirect() {
  const router = useRouter();
  const pathname = usePathname();
  const { organisations, preference, loading } = useWorkspace();

  useEffect(() => {
    if (loading || pathname.startsWith("/onboarding")) {
      return;
    }

    const needsOnboarding =
      !preference.onboardingCompletedAt &&
      (organisations.length === 0 || !preference.currentOrganisationId);

    if (needsOnboarding) {
      router.replace("/onboarding");
    }
  }, [loading, organisations.length, pathname, preference, router]);

  return null;
}
