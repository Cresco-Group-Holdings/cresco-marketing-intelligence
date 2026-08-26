import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import type { ProviderCredentialType } from "@prisma/client";
import { credentialVault } from "@/server/services/credential-vault";
import { credentialRefreshService } from "@/server/services/credential-refresh-service";
import { credentialRotationService } from "@/server/services/credential-rotation-service";
import { connectionLifecycleService } from "@/server/services/connection-lifecycle-service";
import { connectionScopeResolver } from "@/server/services/connection-scope-resolver";
import { oauthAuthorizationService } from "@/server/services/oauth-authorization-service";
import { providerAccountDiscoveryService } from "@/server/services/provider-account-discovery-service";
import { providerConnectionService } from "@/server/services/provider-connection-service";
import { providerInitialSyncService } from "@/server/services/provider-initial-sync-service";
import { oauthAdapterRegistry } from "@/server/providers/oauth/oauth-adapter-registry";
import { providerAuditService } from "@/server/services/provider-audit-service";

const STATIC_CREDENTIAL_MAP: Record<string, ProviderCredentialType> = {
  api_key: "API_KEY",
  bearer_token: "BEARER_TOKEN",
  service_account: "SERVICE_ACCOUNT_KEY",
  client_secret: "CLIENT_SECRET",
  webhook_secret: "WEBHOOK_SIGNING_SECRET",
  basic_auth: "BASIC_AUTH",
};

export const integrationsConnectionService = {
  async reconnect(context: TenantContext, connectionId: string, returnPath?: string) {
    const connection = await prisma.providerConnection.findFirst({
      where: { id: connectionId, organisationId: context.organisationId },
    });
    if (!connection) throw new AppError("NOT_FOUND", "Provider connection not found.");
    if (connection.status === "REVOKED" || connection.status === "ARCHIVED") {
      throw new AppError("VALIDATION_ERROR", "Cannot reconnect a revoked or archived connection.");
    }

    if (!["PENDING_AUTHORIZATION", "REAUTH_REQUIRED", "EXPIRED", "ACTION_REQUIRED"].includes(connection.status)) {
      if (connection.status === "DRAFT" || connection.status === "PENDING") {
        await connectionLifecycleService.transition(context, connectionId, "PENDING_AUTHORIZATION");
      } else {
        await connectionLifecycleService.transition(context, connectionId, "REAUTH_REQUIRED", {
          reason: "reconnect",
        });
        await connectionLifecycleService.transition(context, connectionId, "PENDING_AUTHORIZATION");
      }
    }

    return oauthAuthorizationService.startConnect(context, {
      providerKey: connection.providerKey,
      connectionId,
      returnPath,
    });
  },

  async refresh(context: TenantContext, connectionId: string) {
    return credentialRefreshService.refreshConnection(context, connectionId);
  },

  async revoke(context: TenantContext, connectionId: string) {
    return this.disconnect(context, connectionId, { remoteRevoke: true });
  },

  async disconnect(
    context: TenantContext,
    connectionId: string,
    options?: { remoteRevoke?: boolean },
  ) {
    const connection = await prisma.providerConnection.findFirst({
      where: { id: connectionId, organisationId: context.organisationId },
    });
    if (!connection) throw new AppError("NOT_FOUND", "Provider connection not found.");

    const accessToken = await credentialVault.readForExecution(connectionId, "OAUTH_ACCESS_TOKEN", {
      organisationId: context.organisationId,
      actorUserId: context.userId,
      providerKey: connection.providerKey,
    });

    if (options?.remoteRevoke !== false && accessToken) {
      try {
        await oauthAdapterRegistry.revokeToken({
          providerKey: connection.providerKey,
          accessToken,
        });
      } catch {
        // Local disconnect must proceed even if remote revoke fails.
      }
    }

    await credentialVault.revokeAll(connectionId, {
      organisationId: context.organisationId,
      actorUserId: context.userId,
      providerKey: connection.providerKey,
    });

    await connectionLifecycleService.transition(context, connectionId, "REVOKED");

    await prisma.providerConnection.update({
      where: { id: connectionId },
      data: {
        disconnectedAt: new Date(),
        revokedAt: new Date(),
      },
    });

    await providerAuditService.recordEvent({
      organisationId: context.organisationId,
      providerKey: connection.providerKey,
      action: options?.remoteRevoke === false ? "CONNECTION_STATUS_CHANGED" : "CREDENTIAL_REVOKED",
      connectionId,
      actorUserId: context.userId,
      result: "success",
      metadata: options?.remoteRevoke === false ? { category: "connection_disconnected" } : undefined,
    });

    return { disconnected: true, remoteRevokeAttempted: options?.remoteRevoke !== false };
  },

  async verify(context: TenantContext, connectionId: string) {
    const connection = await prisma.providerConnection.findFirst({
      where: { id: connectionId, organisationId: context.organisationId },
    });
    if (!connection) throw new AppError("NOT_FOUND", "Provider connection not found.");
    if (connection.status === "REVOKED" || connection.status === "ARCHIVED") {
      throw new AppError("VALIDATION_ERROR", "Cannot verify a revoked or archived connection.");
    }

    const accessToken = await credentialVault.readForExecution(connectionId, "OAUTH_ACCESS_TOKEN", {
      organisationId: context.organisationId,
      actorUserId: context.userId,
      providerKey: connection.providerKey,
    });

    const apiKey = await credentialVault.readForExecution(connectionId, "API_KEY", {
      organisationId: context.organisationId,
      actorUserId: context.userId,
      providerKey: connection.providerKey,
    });

    let healthy = Boolean(accessToken || apiKey);
    if (accessToken) {
      const validation = await oauthAdapterRegistry.validateConnection({
        providerKey: connection.providerKey,
        accessToken,
      });
      healthy = validation.healthy;
    }

    const status = healthy ? "CONNECTED" : "DEGRADED";

    await prisma.providerConnection.update({
      where: { id: connectionId },
      data: {
        lastHealthCheckAt: new Date(),
        ...(healthy ? { lastSuccessfulAt: new Date() } : {}),
      },
    });

    if (connection.status !== status && connection.status !== "ACTION_REQUIRED") {
      await connectionLifecycleService.transition(context, connectionId, status);
    }

    await providerAuditService.recordEvent({
      organisationId: context.organisationId,
      providerKey: connection.providerKey,
      action: "CONNECTION_TESTED",
      connectionId,
      actorUserId: context.userId,
      result: healthy ? "success" : "failure",
    });

    return { healthy, status };
  },

  async getScopes(context: TenantContext, connectionId: string) {
    await providerConnectionService.getConnection(context, connectionId);
    const record = await connectionScopeResolver.getScopeRecord(context.organisationId, connectionId);
    if (!record) {
      return {
        requestedScopes: [],
        grantedScopes: [],
        missingScopes: [],
        optionalScopes: [],
        capabilityMap: null,
      };
    }
    return {
      requestedScopes: record.requestedScopes,
      grantedScopes: record.grantedScopes,
      missingScopes: record.missingScopes,
      optionalScopes: record.optionalScopes,
      capabilityMap: record.capabilityMap,
    };
  },

  async listAccounts(context: TenantContext, connectionId: string) {
    await providerConnectionService.getConnection(context, connectionId);
    const accounts = await providerAccountDiscoveryService.listAccounts(
      context.organisationId,
      connectionId,
    );
    return accounts.map((account) => ({
      id: account.id,
      externalAccountId: account.externalAccountId,
      accountType: account.accountType,
      displayName: account.displayName,
      status: account.status,
      selectedAt: account.selectedAt?.toISOString() ?? null,
      metadata: account.metadata,
    }));
  },

  async selectAccounts(
    context: TenantContext,
    connectionId: string,
    externalAccountIds: string[],
  ) {
    const connection = await providerConnectionService.getConnection(context, connectionId);
    const accounts = await providerAccountDiscoveryService.selectAccounts({
      organisationId: context.organisationId,
      connectionId,
      externalAccountIds,
      actorUserId: context.userId,
    });

    if (externalAccountIds.length > 0) {
      await providerAuditService.recordEvent({
        organisationId: context.organisationId,
        providerKey: connection.providerKey,
        action: "CONNECTION_STATUS_CHANGED",
        connectionId,
        actorUserId: context.userId,
        result: "success",
        metadata: { category: "account_selected", selectedCount: externalAccountIds.length },
      });

      await providerInitialSyncService.triggerAfterAccountSelection(
        context,
        connectionId,
        connection.providerKey,
      );
    }

    return accounts.map((account) => ({
      id: account.id,
      externalAccountId: account.externalAccountId,
      accountType: account.accountType,
      displayName: account.displayName,
      status: account.status,
      selectedAt: account.selectedAt?.toISOString() ?? null,
    }));
  },

  async storeStaticCredential(
    context: TenantContext,
    input: {
      providerKey: string;
      credentialKind: keyof typeof STATIC_CREDENTIAL_MAP;
      secret: string;
      displayName?: string;
      expiresAt?: Date;
      connectionId?: string;
    },
  ) {
    const credentialType = STATIC_CREDENTIAL_MAP[input.credentialKind];
    if (!credentialType) {
      throw new AppError("VALIDATION_ERROR", "Unsupported credential kind.");
    }

    let connectionId = input.connectionId;
    if (!connectionId) {
      const connection = await providerConnectionService.createDraftConnection(context, {
        providerKey: input.providerKey,
        displayName: input.displayName,
      });
      connectionId = connection.id;
    } else {
      await providerConnectionService.getConnection(context, connectionId);
    }

    await credentialVault.store({
      organisationId: context.organisationId,
      connectionId,
      credentialType,
      plaintext: input.secret,
      expiresAt: input.expiresAt,
      actorUserId: context.userId,
      providerKey: input.providerKey,
    });

    const row = await prisma.providerConnection.findFirst({
      where: { id: connectionId },
      select: { status: true },
    });
    if (row?.status === "DRAFT" || row?.status === "PENDING") {
      await connectionLifecycleService.transition(context, connectionId, "PENDING_AUTHORIZATION");
    }
    await connectionLifecycleService.transition(context, connectionId, "CONNECTED");

    const fingerprint = (await prisma.providerCredential.findFirst({
      where: { connectionId, credentialType },
      select: { fingerprint: true },
    }))?.fingerprint;

    return {
      connectionId,
      credentialType,
      fingerprint,
    };
  },

  async rotateCredentials(context: TenantContext, connectionId: string) {
    return credentialRotationService.rotateConnectionCredentials(context, connectionId);
  },

  async archive(context: TenantContext, connectionId: string) {
    return connectionLifecycleService.archive(context, connectionId);
  },

  async restore(context: TenantContext, connectionId: string) {
    return connectionLifecycleService.restore(context, connectionId);
  },
};
