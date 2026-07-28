import type { ConnectorType } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { connectorRegistry } from "@/lib/connectors/registry";
import type { ConnectorCatalogueItem } from "@/lib/connectors/types";
import type { TenantContext } from "@/lib/tenancy/context";
import { recordAuditEvent } from "@/server/services/audit-service";
import { brandService } from "@/server/services/workspace-service";
import { connectorCredentialService } from "@/server/services/connector-credential-service";
import { connectorOAuthService } from "@/server/services/connector-oauth-service";

type BrandScope = {
  organisationId: string;
  projectId: string;
  brandId: string;
};

async function resolveBrandScope(
  brandId: string,
  organisationId: string,
  context: TenantContext,
): Promise<BrandScope> {
  const brand = await brandService.getById(brandId, organisationId, context);
  return {
    organisationId,
    projectId: brand.projectId,
    brandId,
  };
}

function toPublicAccount(account: {
  id: string;
  connectorType: ConnectorType;
  status: import("@prisma/client").ConnectorStatus;
  displayName: string | null;
  externalAccountLabel: string | null;
  grantedScopes: string[];
  connectedAt: Date | null;
  lastSuccessfulSyncAt: Date | null;
  lastErrorAt: Date | null;
  lastErrorMessage: string | null;
}) {
  return {
    id: account.id,
    connectorType: account.connectorType,
    status: account.status,
    displayName: account.displayName,
    externalAccountLabel: account.externalAccountLabel,
    grantedScopes: account.grantedScopes,
    connectedAt: account.connectedAt?.toISOString() ?? null,
    lastSuccessfulSyncAt: account.lastSuccessfulSyncAt?.toISOString() ?? null,
    lastErrorAt: account.lastErrorAt?.toISOString() ?? null,
    lastErrorMessage: account.lastErrorMessage,
  };
}

async function getDefinitionRecord(connectorType: ConnectorType) {
  const definition = await prisma.connectorDefinition.findUnique({
    where: { key: connectorType },
  });
  if (!definition) {
    throw new AppError("NOT_FOUND", "Connector definition was not found.");
  }
  return definition;
}

export const connectorService = {
  async getCatalogue(
    brandId: string,
    organisationId: string,
    context: TenantContext,
  ): Promise<ConnectorCatalogueItem[]> {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const accounts = await prisma.connectorAccount.findMany({
      where: {
        organisationId: scope.organisationId,
        brandId: scope.brandId,
      },
    });

    const accountByType = new Map(accounts.map((account) => [account.connectorType, account]));

    return connectorRegistry.list().map((entry) => {
      const account = accountByType.get(entry.key) ?? null;
      const canConnect = connectorRegistry.isConnectable(entry.key);
      return {
        ...entry,
        account: account ? toPublicAccount(account) : null,
        canConnect,
        connectDisabledReason: canConnect ? null : connectorRegistry.getConnectDisabledReason(entry.key),
      };
    });
  },

  async getConnectorDetail(
    brandId: string,
    organisationId: string,
    connectorType: ConnectorType,
    context: TenantContext,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const entry = connectorRegistry.get(connectorType);
    const account = await prisma.connectorAccount.findFirst({
      where: {
        organisationId: scope.organisationId,
        brandId: scope.brandId,
        connectorType,
      },
      include: {
        errors: {
          orderBy: { occurredAt: "desc" },
          take: 5,
        },
        syncs: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });

    return {
      ...entry,
      canConnect: connectorRegistry.isConnectable(connectorType),
      connectDisabledReason: connectorRegistry.getConnectDisabledReason(connectorType),
      account: account
        ? {
            ...toPublicAccount(account),
            recentErrors: account.errors.map((error) => ({
              id: error.id,
              category: error.category,
              message: error.message,
              retryable: error.retryable,
              occurredAt: error.occurredAt.toISOString(),
            })),
            recentSyncs: account.syncs.map((sync) => ({
              id: sync.id,
              syncType: sync.syncType,
              status: sync.status,
              recordsProcessed: sync.recordsProcessed,
              recordsFailed: sync.recordsFailed,
              startedAt: sync.startedAt?.toISOString() ?? null,
              completedAt: sync.completedAt?.toISOString() ?? null,
            })),
          }
        : null,
    };
  },

  async beginConnect(
    brandId: string,
    organisationId: string,
    connectorType: ConnectorType,
    context: TenantContext,
    requestId?: string,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const definition = await getDefinitionRecord(connectorType);

    if (!connectorRegistry.isConnectable(connectorType)) {
      throw new AppError(
        "VALIDATION_ERROR",
        connectorRegistry.getConnectDisabledReason(connectorType) ??
          "Connector is not available.",
      );
    }

    const account = await prisma.connectorAccount.upsert({
      where: {
        brandId_connectorType: {
          brandId: scope.brandId,
          connectorType,
        },
      },
      create: {
        organisationId: scope.organisationId,
        projectId: scope.projectId,
        brandId: scope.brandId,
        connectorDefinitionId: definition.id,
        connectorType,
        status: "CONNECTING",
        connectedByUserId: context.userProfileId,
      },
      update: {
        status: "CONNECTING",
        connectedByUserId: context.userProfileId,
        disconnectedAt: null,
      },
    });

    const oauth = await connectorOAuthService.beginConnection({
      organisationId: scope.organisationId,
      projectId: scope.projectId,
      brandId: scope.brandId,
      connectorType,
      usePkce: true,
    });

    await recordAuditEvent({
      organisationId: scope.organisationId,
      projectId: scope.projectId,
      actorUserId: context.userProfileId,
      action: "connector.connect.begin",
      resourceType: "ConnectorAccount",
      resourceId: account.id,
      requestId,
      metadata: { connectorType },
    });

    return {
      accountId: account.id,
      ...oauth,
    };
  },

  async completeConnect(
    brandId: string,
    organisationId: string,
    connectorType: ConnectorType,
    input: { state: string; code: string },
    context: TenantContext,
    requestId?: string,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const account = await prisma.connectorAccount.findFirst({
      where: {
        organisationId: scope.organisationId,
        brandId: scope.brandId,
        connectorType,
      },
    });
    if (!account) {
      throw new AppError("NOT_FOUND", "Connector account was not found.");
    }

    const result = await connectorOAuthService.handleCallback({
      state: input.state,
      code: input.code,
      connectorAccountId: account.id,
    });

    const updated = await prisma.connectorAccount.update({
      where: { id: account.id },
      data: {
        status: "CONNECTED",
        connectedAt: new Date(),
        grantedScopes: result.scopes,
        displayName: connectorRegistry.get(connectorType).name,
        externalAccountLabel: `Connected ${connectorType}`,
        lastErrorAt: null,
        lastErrorMessage: null,
      },
    });

    await recordAuditEvent({
      organisationId: scope.organisationId,
      projectId: scope.projectId,
      actorUserId: context.userProfileId,
      action: "connector.connect.complete",
      resourceType: "ConnectorAccount",
      resourceId: updated.id,
      requestId,
      metadata: { connectorType, scopes: result.scopes },
    });

    return toPublicAccount(updated);
  },

  async reconnect(
    brandId: string,
    organisationId: string,
    connectorType: ConnectorType,
    context: TenantContext,
    requestId?: string,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const account = await prisma.connectorAccount.findFirst({
      where: {
        organisationId: scope.organisationId,
        brandId: scope.brandId,
        connectorType,
      },
    });
    if (!account) {
      throw new AppError("NOT_FOUND", "Connector account was not found.");
    }

    await connectorOAuthService.refreshConnection(account.id, connectorType);

    const updated = await prisma.connectorAccount.update({
      where: { id: account.id },
      data: {
        status: "CONNECTED",
        lastErrorAt: null,
        lastErrorMessage: null,
      },
    });

    await recordAuditEvent({
      organisationId: scope.organisationId,
      projectId: scope.projectId,
      actorUserId: context.userProfileId,
      action: "connector.reconnect",
      resourceType: "ConnectorAccount",
      resourceId: account.id,
      requestId,
      metadata: { connectorType },
    });

    return toPublicAccount(updated);
  },

  async disconnect(
    brandId: string,
    organisationId: string,
    connectorType: ConnectorType,
    context: TenantContext,
    requestId?: string,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const account = await prisma.connectorAccount.findFirst({
      where: {
        organisationId: scope.organisationId,
        brandId: scope.brandId,
        connectorType,
      },
    });
    if (!account) {
      throw new AppError("NOT_FOUND", "Connector account was not found.");
    }

    await connectorOAuthService.revokeConnection(account.id, connectorType);
    await connectorCredentialService.deleteCredentials(account.id);

    const updated = await prisma.connectorAccount.update({
      where: { id: account.id },
      data: {
        status: "NOT_CONFIGURED",
        disconnectedAt: new Date(),
        grantedScopes: [],
        externalAccountId: null,
        externalAccountLabel: null,
        displayName: null,
      },
    });

    await recordAuditEvent({
      organisationId: scope.organisationId,
      projectId: scope.projectId,
      actorUserId: context.userProfileId,
      action: "connector.disconnect",
      resourceType: "ConnectorAccount",
      resourceId: account.id,
      requestId,
      metadata: { connectorType },
    });

    return toPublicAccount(updated);
  },

  async assertAccountAccess(
    connectorAccountId: string,
    organisationId: string,
    brandId: string,
  ) {
    const account = await prisma.connectorAccount.findFirst({
      where: {
        id: connectorAccountId,
        organisationId,
        brandId,
      },
    });
    if (!account) {
      throw new AppError("NOT_FOUND", "Connector account was not found.");
    }
    return account;
  },
};
