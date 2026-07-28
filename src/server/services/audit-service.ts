import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { logger } from "@/lib/logging";

export type AuditEventInput = {
  organisationId: string;
  projectId?: string;
  actorUserId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  requestId?: string;
  metadata?: Prisma.InputJsonValue;
};

export async function recordAuditEvent(
  event: AuditEventInput,
  tx: Prisma.TransactionClient = prisma,
) {
  const created = await tx.auditLog.create({
    data: {
      organisationId: event.organisationId,
      projectId: event.projectId,
      actorUserId: event.actorUserId,
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      requestId: event.requestId,
      metadata: event.metadata,
    },
  });

  logger.info("audit.event.recorded", {
    auditLogId: created.id,
    organisationId: created.organisationId,
    action: created.action,
    resourceType: created.resourceType,
  });

  return created;
}

export const auditService = {
  async list(organisationId: string, limit = 50) {
    return prisma.auditLog.findMany({
      where: { organisationId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  },
};
