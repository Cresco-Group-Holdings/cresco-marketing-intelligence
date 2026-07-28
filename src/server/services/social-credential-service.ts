import { prisma } from "@/lib/database/prisma";
import {
  decryptSecret,
  encryptSecret,
  getCurrentEncryptionKeyVersion,
  rotateEncryptedSecret,
} from "@/lib/security/encryption";
import type { SocialOAuthTokenPair } from "@/lib/social/types";

export type StoredSocialTokens = {
  accessToken: string;
  refreshToken?: string;
};

export const socialCredentialService = {
  async upsertTokens(socialConnectionId: string, tokens: SocialOAuthTokenPair) {
    const encryptedAccessToken = encryptSecret(tokens.accessToken);
    const encryptedRefreshToken = tokens.refreshToken
      ? encryptSecret(tokens.refreshToken)
      : null;

    return prisma.socialConnectionCredential.upsert({
      where: { socialConnectionId },
      create: {
        socialConnectionId,
        encryptionKeyVersion: getCurrentEncryptionKeyVersion(),
        encryptedAccessToken,
        encryptedRefreshToken,
      },
      update: {
        encryptionKeyVersion: getCurrentEncryptionKeyVersion(),
        encryptedAccessToken,
        encryptedRefreshToken,
      },
    });
  },

  async readTokens(socialConnectionId: string): Promise<StoredSocialTokens | null> {
    const credential = await prisma.socialConnectionCredential.findUnique({
      where: { socialConnectionId },
    });

    if (!credential?.encryptedAccessToken) {
      return null;
    }

    return {
      accessToken: decryptSecret(credential.encryptedAccessToken),
      refreshToken: credential.encryptedRefreshToken
        ? decryptSecret(credential.encryptedRefreshToken)
        : undefined,
    };
  },

  async deleteCredentials(socialConnectionId: string): Promise<void> {
    await prisma.socialConnectionCredential.deleteMany({
      where: { socialConnectionId },
    });
  },

  async rotateStoredCredentials(input: {
    socialConnectionId: string;
    organisationId: string;
    projectId: string;
    brandId: string;
    reason: "SCHEDULED" | "KEY_ROTATION" | "MANUAL" | "COMPROMISE_RESPONSE";
    rotatedByUserId?: string;
  }): Promise<void> {
    const credential = await prisma.socialConnectionCredential.findUnique({
      where: { socialConnectionId: input.socialConnectionId },
    });
    if (!credential) {
      return;
    }

    const fromKeyVersion = credential.encryptionKeyVersion;
    const toKeyVersion = getCurrentEncryptionKeyVersion();

    await prisma.$transaction([
      prisma.socialConnectionCredential.update({
        where: { socialConnectionId: input.socialConnectionId },
        data: {
          encryptionKeyVersion: toKeyVersion,
          encryptedAccessToken: credential.encryptedAccessToken
            ? rotateEncryptedSecret(credential.encryptedAccessToken)
            : null,
          encryptedRefreshToken: credential.encryptedRefreshToken
            ? rotateEncryptedSecret(credential.encryptedRefreshToken)
            : null,
        },
      }),
      prisma.credentialRotationEvent.create({
        data: {
          organisationId: input.organisationId,
          projectId: input.projectId,
          brandId: input.brandId,
          socialConnectionId: input.socialConnectionId,
          fromKeyVersion,
          toKeyVersion,
          reason: input.reason,
          rotatedByUserId: input.rotatedByUserId,
        },
      }),
    ]);
  },
};
