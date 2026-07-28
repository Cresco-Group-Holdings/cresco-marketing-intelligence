import { redirect } from "next/navigation";
import { requireAuthenticatedUser } from "@/lib/tenancy/guards";
import {
  hasSuspendedMembershipOnly,
  resolvePostAuthRedirectPath,
} from "@/lib/auth/post-auth";
import { isOnboardingRoute } from "@/lib/auth/routes";

type DashboardAuthGateProps = {
  pathname: string;
  children: React.ReactNode;
};

export async function DashboardAuthGate({ pathname, children }: DashboardAuthGateProps) {
  const user = await requireAuthenticatedUser();

  if (await hasSuspendedMembershipOnly(user.userProfileId)) {
    redirect("/auth/error?code=membership_suspended");
  }

  const postAuthPath = await resolvePostAuthRedirectPath(user.userProfileId);

  if (postAuthPath === "/onboarding" && !isOnboardingRoute(pathname)) {
    redirect("/onboarding");
  }

  return children;
}
