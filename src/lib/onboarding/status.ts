import { prisma } from "@/lib/database/prisma";

export type OnboardingCompletionStatus = "complete" | "incomplete";

export type ClientOnboardingStatus = "loading" | "complete" | "incomplete" | "error";

export type OnboardingStatusSnapshot = {
  status: OnboardingCompletionStatus;
  completedAt: Date | null;
};

/**
 * Database source of truth for onboarding completion.
 * Prefers WorkspacePreference.onboardingCompletedAt, falls back to OnboardingProgress.completedAt.
 */
export async function resolveOnboardingStatus(
  userProfileId: string,
): Promise<OnboardingStatusSnapshot> {
  const [preference, progress] = await Promise.all([
    prisma.workspacePreference.findUnique({
      where: { userId: userProfileId },
      select: { onboardingCompletedAt: true },
    }),
    prisma.onboardingProgress.findUnique({
      where: { userId: userProfileId },
      select: { completedAt: true },
    }),
  ]);

  const completedAt = preference?.onboardingCompletedAt ?? progress?.completedAt ?? null;

  return {
    status: completedAt ? "complete" : "incomplete",
    completedAt,
  };
}

export function isOnboardingCompleteSnapshot(snapshot: OnboardingStatusSnapshot): boolean {
  return snapshot.status === "complete";
}

export function serializeOnboardingStatus(snapshot: OnboardingStatusSnapshot) {
  return {
    status: snapshot.status,
    completedAt: snapshot.completedAt?.toISOString() ?? null,
  };
}

export function resolveClientOnboardingStatus(input: {
  loading: boolean;
  error: string | null;
  onboardingCompletedAt: string | null;
  serverStatus?: OnboardingCompletionStatus | null;
}): ClientOnboardingStatus {
  if (input.loading) {
    return "loading";
  }

  if (input.error) {
    return "error";
  }

  if (input.serverStatus === "complete" || input.onboardingCompletedAt) {
    return "complete";
  }

  if (input.serverStatus === "incomplete") {
    return "incomplete";
  }

  return "incomplete";
}
