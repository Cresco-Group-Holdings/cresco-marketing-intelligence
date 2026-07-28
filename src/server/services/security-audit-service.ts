import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { logger } from "@/lib/logging";

export type SecurityAuditEventInput = {
  actorUserId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  requestId?: string;
  ipAddress?: string;
  metadata?: Prisma.InputJsonValue;
};

export async function recordSecurityAuditEvent(
  event: SecurityAuditEventInput,
  tx: Prisma.TransactionClient = prisma,
) {
  const created = await tx.securityAuditLog.create({
    data: {
      actorUserId: event.actorUserId,
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      requestId: event.requestId,
      ipAddress: event.ipAddress,
      metadata: event.metadata,
    },
  });

  logger.info("security.audit.recorded", {
    securityAuditLogId: created.id,
    action: created.action,
    resourceType: created.resourceType,
  });

  return created;
}

export const securityAuditService = {
  record: recordSecurityAuditEvent,
};
