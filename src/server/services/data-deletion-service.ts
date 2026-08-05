import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { securityAuditService } from "@/server/services/security-audit-service";

export const dataDeletionService = {
  async createRequest(input: {
    organisationId: string;
    requestedById: string;
    subjectEmail?: string;
    reason?: string;
    requestId?: string;
  }) {
    const request = await prisma.dataDeletionRequest.create({
      data: {
        organisationId: input.organisationId,
        requestedById: input.requestedById,
        subjectEmail: input.subjectEmail,
        reason: input.reason,
      },
    });

    await securityAuditService.record({
      actorUserId: input.requestedById,
      action: "DATA_DELETION_REQUESTED",
      resourceType: "data_deletion_request",
      resourceId: request.id,
      requestId: input.requestId,
      metadata: { organisationId: input.organisationId, subjectEmail: input.subjectEmail },
    });

    return request;
  },

  async listRequests(options?: { organisationId?: string; status?: string }) {
    return prisma.dataDeletionRequest.findMany({
      where: {
        ...(options?.organisationId ? { organisationId: options.organisationId } : {}),
        ...(options?.status ? { status: options.status as "PENDING" } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        requestedBy: { select: { id: true, email: true, displayName: true } },
        organisation: { select: { id: true, name: true, slug: true } },
      },
    });
  },

  async updateStatus(
    requestId: string,
    status: "IN_PROGRESS" | "COMPLETED" | "REJECTED",
    actorUserId: string,
    requestIdHeader?: string,
  ) {
    const existing = await prisma.dataDeletionRequest.findUnique({ where: { id: requestId } });
    if (!existing) throw new AppError("NOT_FOUND", "Deletion request not found.");

    const updated = await prisma.dataDeletionRequest.update({
      where: { id: requestId },
      data: {
        status,
        completedAt: status === "COMPLETED" || status === "REJECTED" ? new Date() : undefined,
      },
    });

    await securityAuditService.record({
      actorUserId,
      action: `DATA_DELETION_${status}`,
      resourceType: "data_deletion_request",
      resourceId: requestId,
      requestId: requestIdHeader,
      metadata: { organisationId: existing.organisationId },
    });

    return updated;
  },
};
