import { redirect } from "next/navigation";
import { requireAuthenticatedUser } from "@/lib/tenancy/guards";
import { hasSuspendedMembershipOnly } from "@/lib/auth/post-auth";
import { resolveOnboardingRouteDecision } from "@/lib/onboarding/redirect-policy";
import { resolveOnboardingStatus } from "@/lib/onboarding/status";

type DashboardAuthGateProps = {
  pathname: string;
  children: React.ReactNode;
};

export async function DashboardAuthGate({ pathname, children }: DashboardAuthGateProps) {
  const user = await requireAuthenticatedUser();

  if (await hasSuspendedMembershipOnly(user.userProfileId)) {
    redirect("/auth/error?code=membership_suspended");
  }

  const onboarding = await resolveOnboardingStatus(user.userProfileId);
  const decision = resolveOnboardingRouteDecision({
    pathname,
    status: onboarding.status,
  });

  if (decision === "redirect-onboarding") {
    redirect("/onboarding");
  }

  if (decision === "redirect-dashboard") {
    redirect("/dashboard");
  }

  return children;
}
