import type { ProviderConnectionStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { providerAuditService } from "@/server/services/provider-audit-service";

const ALLOWED_TRANSITIONS: Record<ProviderConnectionStatus, ProviderConnectionStatus[]> = {
  DRAFT: ["PENDING", "PENDING_AUTHORIZATION", "ARCHIVED"],
  PENDING: ["PENDING_AUTHORIZATION", "ARCHIVED"],
  PENDING_AUTHORIZATION: ["CONNECTED", "ACTION_REQUIRED", "ERROR", "ARCHIVED"],
  CONNECTED: ["DEGRADED", "ACTION_REQUIRED", "EXPIRED", "REAUTH_REQUIRED", "REVOKED", "ARCHIVED"],
  DEGRADED: ["CONNECTED", "ACTION_REQUIRED", "REAUTH_REQUIRED", "REVOKED", "ARCHIVED"],
  ACTION_REQUIRED: ["PENDING_AUTHORIZATION", "REAUTH_REQUIRED", "RECONNECTED", "REVOKED", "ARCHIVED"],
  REAUTH_REQUIRED: ["PENDING_AUTHORIZATION", "RECONNECTED", "REVOKED", "ARCHIVED"],
  EXPIRED: ["PENDING_AUTHORIZATION", "RECONNECTED", "REVOKED", "ARCHIVED"],
  RECONNECTED: ["CONNECTED", "DEGRADED", "ACTION_REQUIRED", "ARCHIVED"],
  RATE_LIMITED: ["CONNECTED", "DEGRADED", "ARCHIVED"],
  SUSPENDED: ["CONNECTED", "REVOKED", "ARCHIVED"],
  DISABLED: ["ARCHIVED"],
  REVOKED: ["ARCHIVED"],
  ARCHIVED: [],
  ERROR: ["PENDING_AUTHORIZATION", "ARCHIVED", "REVOKED"],
};

export const connectionLifecycleService = {
  assertTransition(from: ProviderConnectionStatus, to: ProviderConnectionStatus) {
    const allowed = ALLOWED_TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
      throw new AppError("VALIDATION_ERROR", `Invalid connection transition from ${from} to ${to}.`);
    }
  },

  async transition(
    context: TenantContext,
    connectionId: string,
    status: ProviderConnectionStatus,
    metadata?: Record<string, unknown>,
  ) {
    const connection = await prisma.providerConnection.findFirst({
      where: { id: connectionId, organisationId: context.organisationId },
    });
    if (!connection) throw new AppError("NOT_FOUND", "Provider connection not found.");

    this.assertTransition(connection.status, status);

    const updated = await prisma.providerConnection.update({
      where: { id: connectionId },
      data: {
        status,
        ...(status === "CONNECTED" || status === "RECONNECTED"
          ? { connectedAt: new Date(), lastSuccessfulAt: new Date() }
          : {}),
        ...(status === "REVOKED" ? { revokedAt: new Date(), disconnectedAt: new Date() } : {}),
        ...(status === "ARCHIVED" ? { disconnectedAt: new Date() } : {}),
        ...(metadata
          ? {
              metadata: {
                ...((connection.metadata as Record<string, unknown> | null) ?? {}),
                ...metadata,
              } as Prisma.InputJsonObject,
            }
          : {}),
      },
    });

    await providerAuditService.recordEvent({
      organisationId: context.organisationId,
      providerKey: connection.providerKey,
      action: "CONNECTION_STATUS_CHANGED",
      connectionId,
      actorUserId: context.userId,
      result: "success",
      metadata: { from: connection.status, to: status },
    });

    return updated;
  },

  async markDegraded(context: TenantContext, connectionId: string, reason: string) {
    return this.transition(context, connectionId, "DEGRADED", { reason });
  },

  async markActionRequired(context: TenantContext, connectionId: string, reason: string) {
    return this.transition(context, connectionId, "ACTION_REQUIRED", { reason });
  },

  async markExpired(context: TenantContext, connectionId: string) {
    return this.transition(context, connectionId, "EXPIRED");
  },

  async archive(context: TenantContext, connectionId: string) {
    return this.transition(context, connectionId, "ARCHIVED");
  },

  async restore(context: TenantContext, connectionId: string) {
    const connection = await prisma.providerConnection.findFirst({
      where: { id: connectionId, organisationId: context.organisationId },
    });
    if (!connection) throw new AppError("NOT_FOUND", "Provider connection not found.");
    if (connection.status !== "ARCHIVED") {
      throw new AppError("VALIDATION_ERROR", "Only archived connections can be restored.");
    }
    return prisma.providerConnection.update({
      where: { id: connectionId },
      data: { status: "DRAFT", disconnectedAt: null },
    });
  },
};
