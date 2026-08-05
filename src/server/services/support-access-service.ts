import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { securityAuditService } from "@/server/services/security-audit-service";

const DEFAULT_SESSION_MINUTES = 60;

export const supportAccessService = {
  async startSession(input: {
    adminUserId: string;
    targetUserId: string;
    targetOrgId?: string;
    reason: string;
    durationMinutes?: number;
    requestId?: string;
  }) {
    if (!input.reason.trim() || input.reason.trim().length < 10) {
      throw new AppError("VALIDATION_ERROR", "A detailed reason (min 10 chars) is required for support access.");
    }

    if (input.adminUserId === input.targetUserId) {
      throw new AppError("VALIDATION_ERROR", "Cannot impersonate yourself.");
    }

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + (input.durationMinutes ?? DEFAULT_SESSION_MINUTES));

    await this.expireStaleSessions();

    const session = await prisma.supportAccessSession.create({
      data: {
        adminUserId: input.adminUserId,
        targetUserId: input.targetUserId,
        targetOrgId: input.targetOrgId,
        reason: input.reason.trim(),
        expiresAt,
      },
      include: {
        targetUser: { select: { id: true, email: true, displayName: true } },
        targetOrg: { select: { id: true, name: true, slug: true } },
      },
    });

    await securityAuditService.record({
      actorUserId: input.adminUserId,
      action: "SUPPORT_ACCESS_STARTED",
      resourceType: "support_access_session",
      resourceId: session.id,
      requestId: input.requestId,
      metadata: {
        targetUserId: input.targetUserId,
        targetOrgId: input.targetOrgId,
        reason: input.reason,
        expiresAt: expiresAt.toISOString(),
      },
    });

    return session;
  },

  async revokeSession(sessionId: string, revokedById: string, requestId?: string) {
    const session = await prisma.supportAccessSession.update({
      where: { id: sessionId },
      data: {
        status: "REVOKED",
        revokedAt: new Date(),
        revokedById,
      },
    });

    await securityAuditService.record({
      actorUserId: revokedById,
      action: "SUPPORT_ACCESS_REVOKED",
      resourceType: "support_access_session",
      resourceId: sessionId,
      requestId,
    });

    return session;
  },

  async expireStaleSessions() {
    const result = await prisma.supportAccessSession.updateMany({
      where: {
        status: "ACTIVE",
        expiresAt: { lt: new Date() },
      },
      data: { status: "EXPIRED" },
    });
    return result.count;
  },

  async listActiveSessions() {
    await this.expireStaleSessions();
    return prisma.supportAccessSession.findMany({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      include: {
        adminUser: { select: { id: true, email: true, displayName: true } },
        targetUser: { select: { id: true, email: true, displayName: true } },
        targetOrg: { select: { id: true, name: true } },
      },
    });
  },

  async getActiveSessionForAdmin(adminUserId: string) {
    await this.expireStaleSessions();
    return prisma.supportAccessSession.findFirst({
      where: { adminUserId, status: "ACTIVE", expiresAt: { gt: new Date() } },
      include: {
        targetUser: { select: { id: true, email: true, displayName: true } },
        targetOrg: { select: { id: true, name: true } },
      },
    });
  },
};
