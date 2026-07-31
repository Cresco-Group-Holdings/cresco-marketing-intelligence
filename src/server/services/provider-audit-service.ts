import { prisma } from "@/lib/database/prisma";
import { redactSecrets } from "@/lib/providers/credential-redaction";
import type { ProviderAuditAction } from "@prisma/client";

export const providerAuditService = {
  async recordEvent(input: {
    organisationId: string;
    providerKey: string;
    action: ProviderAuditAction;
    connectionId?: string;
    actorUserId?: string;
    requestId?: string;
    result: "success" | "failure";
    errorCode?: string;
    metadata?: Record<string, unknown>;
  }) {
    return prisma.providerAuditEvent.create({
      data: {
        organisationId: input.organisationId,
        connectionId: input.connectionId,
        providerKey: input.providerKey,
        action: input.action,
        actorUserId: input.actorUserId,
        requestId: input.requestId,
        result: input.result,
        errorCode: input.errorCode,
        metadata: input.metadata ? (redactSecrets(input.metadata) as object) : undefined,
      },
    });
  },

  async listEvents(input: {
    organisationId: string;
    connectionId?: string;
    limit?: number;
  }) {
    const events = await prisma.providerAuditEvent.findMany({
      where: {
        organisationId: input.organisationId,
        ...(input.connectionId ? { connectionId: input.connectionId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: input.limit ?? 50,
    });

    return events.map((event) => ({
      id: event.id,
      providerKey: event.providerKey,
      action: event.action,
      connectionId: event.connectionId,
      actorUserId: event.actorUserId,
      requestId: event.requestId,
      result: event.result,
      errorCode: event.errorCode,
      metadata: event.metadata,
      createdAt: event.createdAt.toISOString(),
    }));
  },
};
