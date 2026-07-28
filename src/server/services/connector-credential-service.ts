import { createHash } from "node:crypto";
import { prisma } from "@/lib/database/prisma";
import {
  decryptSecret,
  encryptSecret,
  getCurrentEncryptionKeyVersion,
  rotateEncryptedSecret,
} from "@/lib/security/encryption";
import type { OAuthTokenPair } from "@/lib/connectors/types";

export type StoredConnectorTokens = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
};

function digestValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export const connectorCredentialService = {
  async upsertTokens(connectorAccountId: string, tokens: OAuthTokenPair) {
    const encryptedAccessToken = encryptSecret(tokens.accessToken);
    const encryptedRefreshToken = tokens.refreshToken
      ? encryptSecret(tokens.refreshToken)
      : null;

    return prisma.connectorCredential.upsert({
      where: { connectorAccountId },
      create: {
        connectorAccountId,
        encryptionKeyVersion: getCurrentEncryptionKeyVersion(),
        encryptedAccessToken,
        encryptedRefreshToken,
        tokenExpiresAt: tokens.expiresAt,
      },
      update: {
        encryptionKeyVersion: getCurrentEncryptionKeyVersion(),
        encryptedAccessToken,
        encryptedRefreshToken,
        tokenExpiresAt: tokens.expiresAt,
      },
    });
  },

  async readTokens(connectorAccountId: string): Promise<StoredConnectorTokens | null> {
    const credential = await prisma.connectorCredential.findUnique({
      where: { connectorAccountId },
    });

    if (!credential?.encryptedAccessToken) {
      return null;
    }

    return {
      accessToken: decryptSecret(credential.encryptedAccessToken),
      refreshToken: credential.encryptedRefreshToken
        ? decryptSecret(credential.encryptedRefreshToken)
        : undefined,
      expiresAt: credential.tokenExpiresAt ?? undefined,
    };
  },

  async deleteCredentials(connectorAccountId: string): Promise<void> {
    await prisma.connectorCredential.deleteMany({
      where: { connectorAccountId },
    });
  },

  async rotateStoredCredentials(connectorAccountId: string): Promise<void> {
    const credential = await prisma.connectorCredential.findUnique({
      where: { connectorAccountId },
    });
    if (!credential) {
      return;
    }

    await prisma.connectorCredential.update({
      where: { connectorAccountId },
      data: {
        encryptionKeyVersion: getCurrentEncryptionKeyVersion(),
        encryptedAccessToken: credential.encryptedAccessToken
          ? rotateEncryptedSecret(credential.encryptedAccessToken)
          : null,
        encryptedRefreshToken: credential.encryptedRefreshToken
          ? rotateEncryptedSecret(credential.encryptedRefreshToken)
          : null,
      },
    });
  },

  digestWebhookSecret(secret: string): string {
    return digestValue(secret);
  },
};
