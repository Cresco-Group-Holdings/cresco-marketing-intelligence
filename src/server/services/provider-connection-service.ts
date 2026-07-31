import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import {
  getProviderDefinition,
  validateProviderConfiguration,
} from "@/lib/providers/registry";
import { assertProviderConnectorsEnabled } from "@/lib/providers/feature-flags";
import { providerAuditService } from "@/server/services/provider-audit-service";
import type { ProviderConnectionStatus, ProviderEnvironment } from "@prisma/client";
import type { ProviderConfiguration, SafeProviderConnection } from "@/lib/providers/types";

function toSafeConnection(connection: {
  id: string;
  providerKey: string;
  displayName: string | null;
  category: SafeProviderConnection["category"];
  authType: SafeProviderConnection["authType"];
  environment: ProviderEnvironment;
  status: ProviderConnectionStatus;
  externalLabel: string | null;
  lastHealthCheckAt: Date | null;
  lastSuccessfulAt: Date | null;
  tokenExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): SafeProviderConnection {
  return {
    id: connection.id,
    providerKey: connection.providerKey,
    displayName: connection.displayName,
    category: connection.category,
    authType: connection.authType,
    environment: connection.environment,
    status: connection.status,
    externalLabel: connection.externalLabel,
    lastHealthCheckAt: connection.lastHealthCheckAt?.toISOString() ?? null,
    lastSuccessfulAt: connection.lastSuccessfulAt?.toISOString() ?? null,
    tokenExpiresAt: connection.tokenExpiresAt?.toISOString() ?? null,
    reauthorizationRequired: connection.status === "REAUTH_REQUIRED",
    createdAt: connection.createdAt.toISOString(),
    updatedAt: connection.updatedAt.toISOString(),
  };
}

export const providerConnectionService = {
  async listConnections(context: TenantContext, filters?: { brandId?: string; projectId?: string }) {
    const connections = await prisma.providerConnection.findMany({
      where: {
        organisationId: context.organisationId,
        ...(filters?.brandId ? { brandId: filters.brandId } : {}),
        ...(filters?.projectId ? { projectId: filters.projectId } : {}),
      },
      orderBy: { updatedAt: "desc" },
    });
    return connections.map(toSafeConnection);
  },

  async getConnection(context: TenantContext, connectionId: string) {
    const connection = await prisma.providerConnection.findFirst({
      where: { id: connectionId, organisationId: context.organisationId },
    });
    if (!connection) {
      throw new AppError("NOT_FOUND", "Provider connection not found.");
    }
    return toSafeConnection(connection);
  },

  async createDraftConnection(
    context: TenantContext,
    input: {
      providerKey: string;
      displayName?: string;
      brandId?: string;
      projectId?: string;
      environment?: ProviderEnvironment;
      configuration?: ProviderConfiguration;
    },
  ) {
    assertProviderConnectorsEnabled();

    const definition = getProviderDefinition(input.providerKey);
    if (!definition) {
      throw new AppError("VALIDATION_ERROR", "Unknown provider.");
    }

    if (input.configuration) {
      const validation = validateProviderConfiguration(input.providerKey, input.configuration);
      if (!validation.valid) {
        throw new AppError("VALIDATION_ERROR", validation.errors.join("; "));
      }
    }

    const connection = await prisma.providerConnection.create({
      data: {
        organisationId: context.organisationId,
        projectId: input.projectId,
        brandId: input.brandId,
        providerKey: input.providerKey,
        displayName: input.displayName ?? definition.displayName,
        category: definition.category,
        authType: definition.authType,
        environment: input.environment ?? "PRODUCTION",
        status: "DRAFT",
        configuration: input.configuration as object | undefined,
        createdByUserId: context.userId,
      },
    });

    await providerAuditService.recordEvent({
      organisationId: context.organisationId,
      providerKey: input.providerKey,
      action: "CONNECTION_CREATED",
      connectionId: connection.id,
      actorUserId: context.userId,
      result: "success",
    });

    return toSafeConnection(connection);
  },

  async updateConnectionStatus(
    context: TenantContext,
    connectionId: string,
    status: ProviderConnectionStatus,
    error?: { code?: string; message?: string },
  ) {
    const connection = await prisma.providerConnection.update({
      where: { id: connectionId, organisationId: context.organisationId },
      data: {
        status,
        lastErrorAt: error ? new Date() : undefined,
        lastErrorCode: error?.code,
        lastErrorMessage: error?.message,
        connectedAt: status === "CONNECTED" ? new Date() : undefined,
        disconnectedAt: status === "REVOKED" || status === "DISABLED" ? new Date() : undefined,
      },
    });
    return toSafeConnection(connection);
  },

  async disconnectConnection(context: TenantContext, connectionId: string) {
    const connection = await prisma.providerConnection.findFirst({
      where: { id: connectionId, organisationId: context.organisationId },
    });
    if (!connection) {
      throw new AppError("NOT_FOUND", "Provider connection not found.");
    }

    await prisma.providerConnection.update({
      where: { id: connectionId },
      data: { status: "REVOKED", revokedAt: new Date(), disconnectedAt: new Date() },
    });

    await providerAuditService.recordEvent({
      organisationId: context.organisationId,
      providerKey: connection.providerKey,
      action: "CREDENTIAL_REVOKED",
      connectionId,
      actorUserId: context.userId,
      result: "success",
    });
  },
};
