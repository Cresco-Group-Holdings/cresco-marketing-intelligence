import { prisma } from "@/lib/database/prisma";
import { listProviderCapabilities } from "@/lib/providers/capability-registry";
import {
  isOrganicSocialUnifiedKey,
  resolveUnifiedProviderOrganicStatus,
} from "@/lib/providers/organic-social-catalogue";
import { getProviderOAuthConfigDetail } from "@/lib/providers/oauth/provider-config";
import { isProductionOAuthProvider } from "@/lib/providers/oauth/production-providers";
import { getProviderDefinition, listProviderDefinitions } from "@/lib/providers/registry";
import { providerConnectionService } from "@/server/services/provider-connection-service";
import { providerGateway } from "@/server/services/provider-gateway-service";
import { providerSyncEngineService } from "@/server/services/provider-sync-engine-service";
import { providerCredentialService } from "@/server/services/provider-credential-service";
import type { TenantContext } from "@/lib/tenancy/context";
import { AppError } from "@/lib/errors";
import type { ProviderCredentialType } from "@prisma/client";

/** Facade mapping ProviderConnection to Stage 11 IntegrationConnection API shape. */
export const integrationConnectionService = {
  listProviders() {
    return listProviderDefinitions().map((def) => {
      const organicStatus = isOrganicSocialUnifiedKey(def.key)
        ? resolveUnifiedProviderOrganicStatus(def.key)
        : null;
      const oauthConfig = isProductionOAuthProvider(def.key)
        ? getProviderOAuthConfigDetail(def.key)
        : null;
      const isAvailable = organicStatus
        ? organicStatus.status === "AVAILABLE" || organicStatus.status === "BETA"
        : def.enabled || oauthConfig?.status === "READY";
      return {
        key: def.key,
        displayName: def.displayName,
        category: def.category,
        authTypes: [def.authType],
        status: organicStatus
          ? organicStatus.status
          : isAvailable
            ? "AVAILABLE"
            : oauthConfig?.status === "MISCONFIGURED"
              ? "MISCONFIGURED"
              : def.apiVersionStatus === "DEPRECATED"
                ? "DEPRECATED"
                : "DISABLED",
        statusLabel: organicStatus?.statusLabel,
        defaultApiVersion: def.apiVersion,
        documentationUrl: def.documentationUrl,
        supportsWebhooks: def.webhookSupport,
        supportsPolling: def.pullSupport,
        supportsPush: def.pushSupport,
        capabilities: listProviderCapabilities(def.key),
        metadata: {
          requiresApproval: def.requiresApproval,
          oauthConfigStatus: oauthConfig?.status ?? null,
          missingEnv: oauthConfig?.missingEnv ?? [],
          organicSocial: organicStatus?.organicSocial ?? false,
          connectRoute: organicStatus?.connectRoute ?? null,
        },
      };
    });
  },

  getProvider(providerKey: string) {
    const def = getProviderDefinition(providerKey);
    if (!def) throw new AppError("NOT_FOUND", "Provider not found.");
    return {
      ...def,
      capabilities: listProviderCapabilities(providerKey),
    };
  },

  listConnections(context: TenantContext, filters?: { brandId?: string }) {
    return providerConnectionService.listConnections(context, filters);
  },

  getConnection(context: TenantContext, connectionId: string) {
    return providerConnectionService.getConnection(context, connectionId);
  },

  async createConnection(
    context: TenantContext,
    input: {
      providerKey: string;
      name?: string;
      brandId?: string;
      projectId?: string;
      authType?: string;
      apiKey?: string;
    },
  ) {
    const connection = await providerConnectionService.createDraftConnection(context, {
      providerKey: input.providerKey,
      displayName: input.name,
      brandId: input.brandId,
      projectId: input.projectId,
    });

    if (input.apiKey) {
      await providerCredentialService.storeCredential({
        organisationId: context.organisationId,
        connectionId: connection.id,
        credentialType: "API_KEY" as ProviderCredentialType,
        plaintext: input.apiKey,
      });
      await providerConnectionService.updateConnectionStatus(context, connection.id, "CONNECTED");
    }

    return connection;
  },

  verifyConnection(connectionId: string, organisationId: string, context: TenantContext) {
    return providerGateway.verifyConnection(connectionId, organisationId, context);
  },

  revokeConnection(context: TenantContext, connectionId: string) {
    return providerConnectionService.disconnectConnection(context, connectionId);
  },

  async listAccounts(connectionId: string, organisationId: string, context: TenantContext) {
    await providerConnectionService.getConnection(context, connectionId);
    const accounts = await prisma.providerAccount.findMany({
      where: { connectionId, organisationId },
      orderBy: { displayName: "asc" },
    });
    if (accounts.length > 0) return accounts;

    const connection = await prisma.providerConnection.findFirst({
      where: { id: connectionId, organisationId },
    });
    if (!connection) throw new AppError("NOT_FOUND", "Connection not found.");

    const result = await providerGateway.execute(
      {
        organisationId,
        connectionId,
        capability: "AD_ACCOUNTS_READ",
        operation: "listAccounts",
        input: {},
      },
      context,
    );

    if (!result.success) return [];

    const data = result.data as { accounts?: Array<Record<string, unknown>> };
    const created: Awaited<ReturnType<typeof prisma.providerAccount.create>>[] = [];
    for (const account of data.accounts ?? []) {
      const row = await prisma.providerAccount.create({
        data: {
          organisationId,
          connectionId,
          externalId: String(account.externalId),
          displayName: String(account.displayName),
          accountType: account.accountType ? String(account.accountType) : undefined,
          currency: account.currency ? String(account.currency) : undefined,
          timezone: account.timezone ? String(account.timezone) : undefined,
          status: account.status ? String(account.status) : undefined,
          selected: created.length === 0,
        },
      });
      created.push(row);
    }
    return created;
  },

  async selectAccount(connectionId: string, organisationId: string, accountId: string, context: TenantContext) {
    await providerConnectionService.getConnection(context, connectionId);
    await prisma.providerAccount.updateMany({
      where: { connectionId, organisationId },
      data: { selected: false },
    });
    return prisma.providerAccount.update({
      where: { id: accountId },
      data: { selected: true },
    });
  },

  startSync(
    connectionId: string,
    organisationId: string,
    input: { capability: string; resourceType: string; idempotencyKey?: string },
    context: TenantContext,
  ) {
    return providerSyncEngineService.startSync(connectionId, organisationId, input, context);
  },

  listSyncJobs(connectionId: string, organisationId: string) {
    return providerSyncEngineService.listSyncJobs(connectionId, organisationId);
  },

  getSyncJob(syncRunId: string, organisationId: string) {
    return prisma.providerSyncRun.findFirst({
      where: { id: syncRunId, organisationId },
      include: { records: { take: 100, orderBy: { processedAt: "desc" } } },
    });
  },

  cancelSyncJob(syncRunId: string, organisationId: string) {
    return providerSyncEngineService.cancelSyncJob(syncRunId, organisationId);
  },

  async getHealth(connectionId: string, organisationId: string, context: TenantContext) {
    return providerGateway.verifyConnection(connectionId, organisationId, context);
  },
};
