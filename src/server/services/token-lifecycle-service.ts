import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { credentialVault } from "@/server/services/credential-vault";
import { oauthAdapterRegistry } from "@/server/providers/oauth/oauth-adapter-registry";
import { connectionLifecycleService } from "@/server/services/connection-lifecycle-service";
import { providerAuditService } from "@/server/services/provider-audit-service";

const REFRESH_BUFFER_MS = 5 * 60 * 1000;
const REFRESH_LEASE_MS = 30 * 1000;

export type TokenAccessStatus =
  | "ACTIVE"
  | "EXPIRING"
  | "EXPIRED"
  | "REFRESH_FAILED"
  | "REAUTH_REQUIRED"
  | "REVOKED"
  | "DISCONNECTED"
  | "CONFIGURATION_ERROR";

export type ValidAccessTokenResult = {
  accessToken: string;
  status: TokenAccessStatus;
  expiresAt?: Date;
};

function connectionLockKey(connectionId: string): bigint {
  let hash = 0;
  for (let i = 0; i < connectionId.length; i += 1) {
    hash = (hash * 31 + connectionId.charCodeAt(i)) | 0;
  }
  return BigInt(Math.abs(hash));
}

export const tokenLifecycleService = {
  async getValidAccessToken(
    context: { organisationId: string; actorUserId?: string },
    connectionId: string,
  ): Promise<ValidAccessTokenResult> {
    const connection = await prisma.providerConnection.findFirst({
      where: { id: connectionId, organisationId: context.organisationId },
    });
    if (!connection) {
      throw new AppError("NOT_FOUND", "Provider connection not found.");
    }
    if (connection.status === "REVOKED" || connection.status === "ARCHIVED") {
      return { accessToken: "", status: "REVOKED" };
    }

    const accessToken = await credentialVault.readForExecution(connectionId, "OAUTH_ACCESS_TOKEN", {
      organisationId: context.organisationId,
      actorUserId: context.actorUserId,
      providerKey: connection.providerKey,
    });

    const expiresAt = connection.tokenExpiresAt ?? undefined;
    const now = Date.now();

    if (accessToken && expiresAt && expiresAt.getTime() > now + REFRESH_BUFFER_MS) {
      return { accessToken, status: "ACTIVE", expiresAt };
    }

    if (accessToken && (!expiresAt || expiresAt.getTime() > now)) {
      return { accessToken, status: expiresAt ? "EXPIRING" : "ACTIVE", expiresAt };
    }

    const refreshed = await this.refreshConnectionTokens(context, connectionId);
    return refreshed;
  },

  async refreshConnectionTokens(
    context: { organisationId: string; actorUserId?: string },
    connectionId: string,
  ): Promise<ValidAccessTokenResult> {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${connectionLockKey(connectionId)})`;

      const connection = await tx.providerConnection.findFirst({
        where: { id: connectionId, organisationId: context.organisationId },
      });
      if (!connection) {
        throw new AppError("NOT_FOUND", "Provider connection not found.");
      }

      const metadata = (connection.metadata ?? {}) as Record<string, unknown>;
      const leaseUntil = metadata.refreshLeaseExpiresAt
        ? new Date(String(metadata.refreshLeaseExpiresAt)).getTime()
        : 0;
      if (leaseUntil > Date.now()) {
        const cached = await credentialVault.readForExecution(connectionId, "OAUTH_ACCESS_TOKEN", {
          organisationId: context.organisationId,
          actorUserId: context.actorUserId,
          providerKey: connection.providerKey,
        });
        if (cached) {
          return {
            accessToken: cached,
            status: "ACTIVE",
            expiresAt: connection.tokenExpiresAt ?? undefined,
          };
        }
      }

      await tx.providerConnection.update({
        where: { id: connectionId },
        data: {
          metadata: {
            ...metadata,
            refreshLeaseExpiresAt: new Date(Date.now() + REFRESH_LEASE_MS).toISOString(),
          },
        },
      });

      const refreshToken = await credentialVault.readForExecution(
        connectionId,
        "OAUTH_REFRESH_TOKEN",
        {
          organisationId: context.organisationId,
          actorUserId: context.actorUserId,
          providerKey: connection.providerKey,
        },
      );

      if (!refreshToken) {
        await tx.providerConnection.update({
          where: { id: connectionId },
          data: {
            status: "REAUTH_REQUIRED",
            lastErrorAt: new Date(),
            lastErrorCode: "REAUTH_REQUIRED",
            lastErrorMessage: "Refresh token is missing or expired.",
          },
        });
        return { accessToken: "", status: "REAUTH_REQUIRED" };
      }

      try {
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
          actorUserId: context.actorUserId,
          providerKey: connection.providerKey,
        });

        if (tokens.refreshToken) {
          await credentialVault.store({
            organisationId: context.organisationId,
            connectionId,
            credentialType: "OAUTH_REFRESH_TOKEN",
            plaintext: tokens.refreshToken,
            actorUserId: context.actorUserId,
            providerKey: connection.providerKey,
          });
        }

        await tx.providerConnection.update({
          where: { id: connectionId },
          data: {
            tokenExpiresAt: tokens.expiresAt,
            lastSuccessfulAt: new Date(),
            lastHealthCheckAt: new Date(),
            lastErrorAt: null,
            lastErrorCode: null,
            lastErrorMessage: null,
            metadata: {
              ...metadata,
              refreshLeaseExpiresAt: null,
            },
            status: connection.status === "EXPIRED" ? "RECONNECTED" : connection.status,
          },
        });

        await providerAuditService.recordEvent({
          organisationId: context.organisationId,
          providerKey: connection.providerKey,
          action: "CREDENTIAL_REFRESHED",
          connectionId,
          actorUserId: context.actorUserId,
          result: "success",
        });

        return {
          accessToken: tokens.accessToken,
          status: "ACTIVE",
          expiresAt: tokens.expiresAt,
        };
      } catch (error) {
        await tx.providerConnection.update({
          where: { id: connectionId },
          data: {
            lastErrorAt: new Date(),
            lastErrorCode: "REFRESH_FAILED",
            lastErrorMessage: error instanceof Error ? error.message : "Token refresh failed.",
            metadata: {
              ...metadata,
              refreshLeaseExpiresAt: null,
            },
          },
        });

        await providerAuditService.recordEvent({
          organisationId: context.organisationId,
          providerKey: connection.providerKey,
          action: "CREDENTIAL_REFRESHED",
          connectionId,
          actorUserId: context.actorUserId,
          result: "failure",
          metadata: { category: "token_refresh_failure" },
        });

        return { accessToken: "", status: "REFRESH_FAILED" };
      }
    });
  },

  async refreshExpiringConnections(input?: {
    organisationId?: string;
    withinMs?: number;
    limit?: number;
  }) {
    const withinMs = input?.withinMs ?? REFRESH_BUFFER_MS;
    const limit = input?.limit ?? 50;
    const threshold = new Date(Date.now() + withinMs);

    const connections = await prisma.providerConnection.findMany({
      where: {
        ...(input?.organisationId ? { organisationId: input.organisationId } : {}),
        status: { in: ["CONNECTED", "RECONNECTED", "DEGRADED", "EXPIRED"] },
        tokenExpiresAt: { lte: threshold },
      },
      take: limit,
      orderBy: { tokenExpiresAt: "asc" },
    });

    const results: Array<{ connectionId: string; status: TokenAccessStatus }> = [];

    for (const connection of connections) {
      const result = await this.refreshConnectionTokens(
        { organisationId: connection.organisationId },
        connection.id,
      );
      results.push({ connectionId: connection.id, status: result.status });
    }

    return { processed: results.length, results };
  },
};
