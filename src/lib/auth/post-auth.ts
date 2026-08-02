import { MembershipStatus } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { resolveOnboardingStatus } from "@/lib/onboarding/status";
import { resolveSafeRedirectPath } from "@/lib/security/redirects";

const AUTH_ROUTE_PATHS = new Set([
  "/login",
  "/signup",
  "/forgot-password",
  "/verify-email",
  "/reset-password",
]);

export async function hasActiveOrganisationMembership(userProfileId: string): Promise<boolean> {
  const count = await prisma.organisationMembership.count({
    where: {
      userId: userProfileId,
      status: MembershipStatus.ACTIVE,
      organisation: {
        archivedAt: null,
        status: { not: "ARCHIVED" },
      },
    },
  });

  return count > 0;
}

export async function hasSuspendedMembershipOnly(userProfileId: string): Promise<boolean> {
  const activeCount = await prisma.organisationMembership.count({
    where: {
      userId: userProfileId,
      status: MembershipStatus.ACTIVE,
    },
  });

  if (activeCount > 0) {
    return false;
  }

  const suspendedCount = await prisma.organisationMembership.count({
    where: {
      userId: userProfileId,
      status: MembershipStatus.SUSPENDED,
    },
  });

  return suspendedCount > 0;
}

export async function resolvePostAuthRedirectPath(userProfileId: string): Promise<string> {
  if (await hasSuspendedMembershipOnly(userProfileId)) {
    return "/auth/error?code=membership_suspended";
  }

  const onboarding = await resolveOnboardingStatus(userProfileId);
  if (onboarding.status === "complete") {
    return "/dashboard";
  }

  return "/onboarding";
}

export function resolveAuthenticatedRedirect(
  requestedPath: string | null | undefined,
  postAuthPath: string,
): string {
  if (isSafeAuthenticatedRedirect(requestedPath)) {
    return requestedPath!;
  }

  return postAuthPath;
}

export function isSafeAuthenticatedRedirect(path: string | null | undefined): boolean {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.includes("://")) {
    return false;
  }

  if (AUTH_ROUTE_PATHS.has(path)) {
    return false;
  }

  if (path.startsWith("/auth/")) {
    return false;
  }

  return true;
}

export function resolveCallbackRedirect(
  requestedPath: string | null | undefined,
  userProfileId: string,
  postAuthPathPromise: Promise<string>,
): Promise<string> {
  return postAuthPathPromise.then((postAuthPath) => {
    if (isSafeAuthenticatedRedirect(requestedPath)) {
      return resolveSafeRedirectPath(requestedPath, postAuthPath);
    }

    return postAuthPath;
  });
}
