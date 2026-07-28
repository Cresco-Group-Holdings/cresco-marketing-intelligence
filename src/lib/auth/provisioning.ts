import { prisma } from "@/lib/database/prisma";
import type { UserProfile } from "@prisma/client";

export type ProvisionedUser = {
  authUserId: string;
  email: string;
  userProfileId: string;
  profile: UserProfile;
};

export async function ensureUserProfile(input: {
  authUserId: string;
  email: string;
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}): Promise<ProvisionedUser> {
  const email = input.email.trim().toLowerCase();

  const profile = await prisma.userProfile.upsert({
    where: { authUserId: input.authUserId },
    update: {
      email,
      displayName: input.displayName ?? undefined,
      firstName: input.firstName ?? undefined,
      lastName: input.lastName ?? undefined,
    },
    create: {
      authUserId: input.authUserId,
      email,
      displayName: input.displayName ?? email.split("@")[0],
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
    },
  });

  return {
    authUserId: input.authUserId,
    email,
    userProfileId: profile.id,
    profile,
  };
}
