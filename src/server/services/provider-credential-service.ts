import { prisma } from "@/lib/database/prisma";
import {
  decryptSecret,
  encryptSecret,
  getCurrentEncryptionKeyVersion,
} from "@/lib/security/encryption";
import { fingerprintCredential } from "@/lib/providers/credential-redaction";
import type { ProviderCredentialType } from "@prisma/client";

export const providerCredentialService = {
  async storeCredential(input: {
    organisationId: string;
    connectionId: string;
    credentialType: ProviderCredentialType;
    plaintext: string;
    expiresAt?: Date;
  }) {
    const encryptedValue = encryptSecret(input.plaintext);
    const keyVersion = getCurrentEncryptionKeyVersion();
    const fingerprint = fingerprintCredential(input.plaintext);

    return prisma.providerCredential.upsert({
      where: {
        connectionId_credentialType: {
          connectionId: input.connectionId,
          credentialType: input.credentialType,
        },
      },
      create: {
        organisationId: input.organisationId,
        connectionId: input.connectionId,
        credentialType: input.credentialType,
        encryptedValue,
        keyVersion,
        fingerprint,
        expiresAt: input.expiresAt,
      },
      update: {
        encryptedValue,
        keyVersion,
        fingerprint,
        expiresAt: input.expiresAt,
        revokedAt: null,
      },
    });
  },

  async getCredentialPlaintext(connectionId: string, credentialType: ProviderCredentialType): Promise<string | null> {
    const credential = await prisma.providerCredential.findFirst({
      where: { connectionId, credentialType, revokedAt: null },
    });
    if (!credential) {
      return null;
    }
    return decryptSecret(credential.encryptedValue);
  },

  async revokeCredential(connectionId: string, credentialType: ProviderCredentialType): Promise<void> {
    await prisma.providerCredential.updateMany({
      where: { connectionId, credentialType, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  async revokeAllCredentials(connectionId: string): Promise<void> {
    await prisma.providerCredential.updateMany({
      where: { connectionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  toSafeCredential(credential: {
    id: string;
    credentialType: ProviderCredentialType;
    fingerprint: string | null;
    expiresAt: Date | null;
    revokedAt: Date | null;
    createdAt: Date;
  }) {
    return {
      id: credential.id,
      credentialType: credential.credentialType,
      fingerprint: credential.fingerprint,
      expiresAt: credential.expiresAt?.toISOString() ?? null,
      revokedAt: credential.revokedAt?.toISOString() ?? null,
      createdAt: credential.createdAt.toISOString(),
    };
  },
};
