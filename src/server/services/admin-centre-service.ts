import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { runReadinessChecks } from "@/lib/observability/health-checks";
import { isStripeBillingConfigured } from "@/server/providers/billing/stripe-billing-provider";
import { securityAuditService } from "@/server/services/security-audit-service";

export const adminCentreService = {
  async getSystemHealth() {
    const readiness = await runReadinessChecks();

    const [
      deadLetterAlerts,
      failedBillingEvents,
      failedWebhooks,
      activeOrgs,
      activeUsers,
    ] = await Promise.all([
      prisma.operationalAlert.count({ where: { status: "DEAD_LETTER" } }),
      prisma.billingEvent.count({ where: { status: "FAILED" } }),
      prisma.billingEvent.count({ where: { status: "DUPLICATE" } }),
      prisma.organisation.count({ where: { archivedAt: null } }),
      prisma.userProfile.count(),
    ]);

    return {
      readiness,
      metrics: {
        deadLetterAlerts,
        failedBillingEvents,
        duplicateBillingWebhooks: failedWebhooks,
        activeOrganisations: activeOrgs,
        activeUsers,
        stripeBillingConfigured: isStripeBillingConfigured(),
      },
    };
  },

  async listWorkspaces(options?: { search?: string; limit?: number }) {
    const limit = options?.limit ?? 50;
    return prisma.organisation.findMany({
      where: options?.search
        ? {
            OR: [
              { name: { contains: options.search, mode: "insensitive" } },
              { slug: { contains: options.search, mode: "insensitive" } },
            ],
          }
        : undefined,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        billingAccount: {
          include: {
            subscription: { include: { planVersion: { include: { plan: true } } } },
          },
        },
        _count: { select: { memberships: true, providerConnections: true } },
      },
    });
  },

  async listSecurityEvents(options?: { limit?: number; action?: string }) {
    return prisma.securityAuditLog.findMany({
      where: options?.action ? { action: options.action } : undefined,
      take: options?.limit ?? 100,
      orderBy: { createdAt: "desc" },
      include: {
        actor: { select: { id: true, email: true, displayName: true } },
      },
    });
  },

  async listFailedJobs() {
    const [alerts, billingEvents] = await Promise.all([
      prisma.operationalAlert.findMany({
        where: { status: { in: ["DEAD_LETTER", "OPEN"] } },
        orderBy: { updatedAt: "desc" },
        take: 50,
        include: { brand: { select: { id: true, name: true } } },
      }),
      prisma.billingEvent.findMany({
        where: { status: { in: ["FAILED", "PENDING"] } },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

    return { operationalAlerts: alerts, billingEvents };
  },

  async listAuditLogs(options?: { organisationId?: string; limit?: number }) {
    return prisma.auditLog.findMany({
      where: options?.organisationId ? { organisationId: options.organisationId } : undefined,
      take: options?.limit ?? 100,
      orderBy: { createdAt: "desc" },
    });
  },

  async recordAdminAction(input: {
    actorUserId: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    requestId?: string;
    metadata?: Record<string, unknown>;
  }) {
    return securityAuditService.record({
      actorUserId: input.actorUserId,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      requestId: input.requestId,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    });
  },
};
