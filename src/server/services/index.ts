import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { logger } from "@/lib/logging";
import type { TenantContext } from "@/lib/tenancy/context";

export type AuditEventInput = {
  organisationId: string;
  actorUserId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Prisma.InputJsonValue;
};

export async function recordAuditEvent(event: AuditEventInput) {
  const created = await prisma.auditLog.create({
    data: {
      organisationId: event.organisationId,
      actorUserId: event.actorUserId,
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
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

export const organisationService = {
  async getAccessibleOrganisations(context: TenantContext) {
    return prisma.organisation.findMany({
      where: {
        archivedAt: null,
        memberships: {
          some: {
            userProfileId: context.userProfileId,
          },
        },
      },
      orderBy: { name: "asc" },
    });
  },
};
