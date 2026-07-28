import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import type { UserProfile } from "@prisma/client";

export type ProvisionedUser = {
  authUserId: string;
  email: string;
  userProfileId: string;
  profile: UserProfile;
  created: boolean;
};

export type ProviderMetadata = {
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
};

function buildCreateData(input: {
  authUserId: string;
  email: string;
  metadata: ProviderMetadata;
}): Prisma.UserProfileCreateInput {
  const emailLocalPart = input.email.split("@")[0];

  return {
    authUserId: input.authUserId,
    email: input.email,
    displayName: input.metadata.displayName?.trim() || emailLocalPart,
    firstName: input.metadata.firstName?.trim() || null,
    lastName: input.metadata.lastName?.trim() || null,
    avatarUrl: input.metadata.avatarUrl?.trim() || null,
  };
}

export async function ensureUserProfile(input: {
  authUserId: string;
  email: string;
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
}): Promise<ProvisionedUser> {
  const email = input.email.trim().toLowerCase();
  const metadata: ProviderMetadata = {
    displayName: input.displayName,
    firstName: input.firstName,
    lastName: input.lastName,
    avatarUrl: input.avatarUrl,
  };

  const existing = await prisma.userProfile.findUnique({
    where: { authUserId: input.authUserId },
  });

  if (!existing) {
    const profile = await prisma.userProfile.create({
      data: buildCreateData({
        authUserId: input.authUserId,
        email,
        metadata,
      }),
    });

    return {
      authUserId: input.authUserId,
      email,
      userProfileId: profile.id,
      profile,
      created: true,
    };
  }

  const profile = await prisma.userProfile.update({
    where: { authUserId: input.authUserId },
    data: {
      email,
    },
  });

  return {
    authUserId: input.authUserId,
    email,
    userProfileId: profile.id,
    profile,
    created: false,
  };
}

export function extractProviderMetadata(
  userMetadata: Record<string, unknown> | null | undefined,
): ProviderMetadata {
  if (!userMetadata) {
    return {};
  }

  const fullName =
    typeof userMetadata.full_name === "string"
      ? userMetadata.full_name
      : typeof userMetadata.name === "string"
        ? userMetadata.name
        : null;

  return {
    displayName: fullName,
    firstName:
      typeof userMetadata.first_name === "string"
        ? userMetadata.first_name
        : typeof userMetadata.given_name === "string"
          ? userMetadata.given_name
          : null,
    lastName:
      typeof userMetadata.last_name === "string"
        ? userMetadata.last_name
        : typeof userMetadata.family_name === "string"
          ? userMetadata.family_name
          : null,
    avatarUrl:
      typeof userMetadata.avatar_url === "string"
        ? userMetadata.avatar_url
        : typeof userMetadata.picture === "string"
          ? userMetadata.picture
          : null,
  };
}
