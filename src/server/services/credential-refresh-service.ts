import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { credentialVault } from "@/server/services/credential-vault";
import { oauthAdapterRegistry } from "@/server/providers/oauth/oauth-adapter-registry";
import { connectionLifecycleService } from "@/server/services/connection-lifecycle-service";
import { providerAuditService } from "@/server/services/provider-audit-service";

export const credentialRefreshService = {
  async refreshConnection(context: TenantContext, connectionId: string) {
    const connection = await prisma.providerConnection.findFirst({
      where: { id: connectionId, organisationId: context.organisationId },
    });
    if (!connection) throw new AppError("NOT_FOUND", "Provider connection not found.");
    if (connection.status === "REVOKED" || connection.status === "ARCHIVED") {
      throw new AppError("VALIDATION_ERROR", "Cannot refresh a revoked or archived connection.");
    }

    const refreshToken = await credentialVault.readForExecution(connectionId, "OAUTH_REFRESH_TOKEN", {
      organisationId: context.organisationId,
      actorUserId: context.userId,
      providerKey: connection.providerKey,
    });

    if (!refreshToken) {
      await connectionLifecycleService.markActionRequired(
        context,
        connectionId,
        "Refresh token is missing or expired.",
      );
      throw new AppError("VALIDATION_ERROR", "Refresh token unavailable.");
    }

    const tokens = await oauthAdapterRegistry.refreshAccessToken({
      providerKey: connection.providerKey,
      refreshToken,
    });

    await credentialVault.store({
      organisationId: context.organisationId,
      connectionId,
      credentialType: "OAUTH_ACCESS_TOKEN",
      plaintext: tokens.accessToken,
      expiresAt: tokens.expiresAt,
      actorUserId: context.userId,
      providerKey: connection.providerKey,
    });

    if (tokens.refreshToken) {
      await credentialVault.store({
        organisationId: context.organisationId,
        connectionId,
        credentialType: "OAUTH_REFRESH_TOKEN",
        plaintext: tokens.refreshToken,
        actorUserId: context.userId,
        providerKey: connection.providerKey,
      });
    }

    await prisma.providerConnection.update({
      where: { id: connectionId },
      data: {
        tokenExpiresAt: tokens.expiresAt,
        lastSuccessfulAt: new Date(),
        status: connection.status === "EXPIRED" ? "RECONNECTED" : "CONNECTED",
      },
    });

    await providerAuditService.recordEvent({
      organisationId: context.organisationId,
      providerKey: connection.providerKey,
      action: "CREDENTIAL_REFRESHED",
      connectionId,
      actorUserId: context.userId,
      result: "success",
    });

    return { refreshed: true, expiresAt: tokens.expiresAt?.toISOString() ?? null };
  },
};
