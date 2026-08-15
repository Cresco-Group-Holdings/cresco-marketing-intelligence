import { prisma } from "@/lib/database/prisma";
import type { ProviderCredentialType } from "@prisma/client";
import {
  decryptSecret,
  encryptSecret,
  getCurrentEncryptionKeyVersion,
  rotateEncryptedSecret,
} from "@/lib/security/encryption";
import { fingerprintCredential } from "@/lib/providers/credential-redaction";
import { providerAuditService } from "@/server/services/provider-audit-service";

export type VaultStoreInput = {
  organisationId: string;
  connectionId: string;
  credentialType: ProviderCredentialType;
  plaintext: string;
  expiresAt?: Date;
  actorUserId?: string;
  providerKey?: string;
};

export const credentialVault = {
  async store(input: VaultStoreInput) {
    const encryptedValue = encryptSecret(input.plaintext);
    const keyVersion = getCurrentEncryptionKeyVersion();
    const fingerprint = fingerprintCredential(input.plaintext);

    const credential = await prisma.providerCredential.upsert({
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
        revokedByUserId: null,
        rotatedAt: new Date(),
        rotationVersion: { increment: 1 },
      },
    });

    await providerAuditService.recordEvent({
      organisationId: input.organisationId,
      providerKey: input.providerKey ?? "unknown",
      action: "CREDENTIAL_STORED",
      connectionId: input.connectionId,
      actorUserId: input.actorUserId,
      result: "success",
      metadata: { credentialType: input.credentialType, fingerprint },
    });

    return credential;
  },

  async storeEphemeral(reference: string, plaintext: string, organisationId: string) {
    return encryptSecret(JSON.stringify({ reference, value: plaintext, organisationId }));
  },

  async readEphemeral(encrypted: string): Promise<string> {
    const parsed = JSON.parse(decryptSecret(encrypted)) as { value: string };
    return parsed.value;
  },

  async readForExecution(
    connectionId: string,
    credentialType: ProviderCredentialType,
    context: { organisationId: string; actorUserId?: string; providerKey?: string },
  ): Promise<string | null> {
    const credential = await prisma.providerCredential.findFirst({
      where: {
        connectionId,
        credentialType,
        revokedAt: null,
        organisationId: context.organisationId,
      },
    });
    if (!credential) return null;
    if (credential.expiresAt && credential.expiresAt < new Date()) {
      return null;
    }

    await providerAuditService.recordEvent({
      organisationId: context.organisationId,
      providerKey: context.providerKey ?? "unknown",
      action: "CREDENTIAL_ACCESSED",
      connectionId,
      actorUserId: context.actorUserId,
      result: "success",
      metadata: { credentialType },
    });

    return decryptSecret(credential.encryptedValue);
  },

  async revoke(
    connectionId: string,
    credentialType: ProviderCredentialType,
    context: { organisationId: string; actorUserId?: string; providerKey?: string },
  ) {
    await prisma.providerCredential.updateMany({
      where: { connectionId, credentialType, revokedAt: null, organisationId: context.organisationId },
      data: { revokedAt: new Date(), revokedByUserId: context.actorUserId },
    });

    await providerAuditService.recordEvent({
      organisationId: context.organisationId,
      providerKey: context.providerKey ?? "unknown",
      action: "CREDENTIAL_REVOKED",
      connectionId,
      actorUserId: context.actorUserId,
      result: "success",
      metadata: { credentialType },
    });
  },

  async revokeAll(
    connectionId: string,
    context: { organisationId: string; actorUserId?: string; providerKey?: string },
  ) {
    await prisma.providerCredential.updateMany({
      where: { connectionId, revokedAt: null, organisationId: context.organisationId },
      data: { revokedAt: new Date(), revokedByUserId: context.actorUserId },
    });
  },

  toSafeCredential(credential: {
    id: string;
    credentialType: ProviderCredentialType;
    fingerprint: string | null;
    expiresAt: Date | null;
    revokedAt: Date | null;
    rotatedAt: Date | null;
    rotationVersion: number;
    createdAt: Date;
  }) {
    return {
      id: credential.id,
      credentialType: credential.credentialType,
      fingerprint: credential.fingerprint,
      expiresAt: credential.expiresAt?.toISOString() ?? null,
      revokedAt: credential.revokedAt?.toISOString() ?? null,
      rotatedAt: credential.rotatedAt?.toISOString() ?? null,
      rotationVersion: credential.rotationVersion,
      createdAt: credential.createdAt.toISOString(),
    };
  },

  async rotateCredential(connectionId: string, credentialType: ProviderCredentialType, organisationId: string) {
    const credential = await prisma.providerCredential.findFirst({
      where: { connectionId, credentialType, organisationId, revokedAt: null },
    });
    if (!credential) return null;

    const rotatedValue = rotateEncryptedSecret(credential.encryptedValue);
    return prisma.providerCredential.update({
      where: { id: credential.id },
      data: {
        encryptedValue: rotatedValue,
        keyVersion: getCurrentEncryptionKeyVersion(),
        rotatedAt: new Date(),
        rotationVersion: { increment: 1 },
      },
    });
  },
};
