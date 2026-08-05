import { prisma } from "@/lib/database/prisma";
import type { TenantContext } from "@/lib/tenancy/context";
import { credentialVault } from "@/server/services/credential-vault";
import { providerAuditService } from "@/server/services/provider-audit-service";

export const credentialRotationService = {
  async rotateConnectionCredentials(context: TenantContext, connectionId: string) {
    const connection = await prisma.providerConnection.findFirst({
      where: { id: connectionId, organisationId: context.organisationId },
    });
    if (!connection) {
      throw new Error("Provider connection not found.");
    }

    const credentials = await prisma.providerCredential.findMany({
      where: { connectionId, organisationId: context.organisationId, revokedAt: null },
    });

    const rotated = [];
    for (const credential of credentials) {
      const updated = await credentialVault.rotateCredential(
        connectionId,
        credential.credentialType,
        context.organisationId,
      );
      if (updated) rotated.push(credential.credentialType);
    }

    await providerAuditService.recordEvent({
      organisationId: context.organisationId,
      providerKey: connection.providerKey,
      action: "CREDENTIAL_ROTATED",
      connectionId,
      actorUserId: context.userId,
      result: "success",
      metadata: { rotated },
    });

    return { rotated };
  },
};
