import type { NotificationCategory, OperationalAlertType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import {
  classifyRetryError,
  nextRetryDate,
  shouldMoveToDeadLetter,
} from "@/lib/notifications/retry-governance";
import { sanitiseEmailBody } from "@/lib/notifications/email-security";
import type { OperationalAlertFilters } from "@/lib/validation/notifications";
import { assertOrganisationScope, type TenantContext } from "@/lib/tenancy/context";

export type CreateOperationalAlertInput = {
  organisationId: string;
  projectId?: string;
  brandId?: string;
  alertType: OperationalAlertType;
  category: NotificationCategory;
  resourceType: string;
  resourceId: string;
  provider?: string;
  title: string;
  safeErrorMessage: string;
  recommendedAction?: string;
  attemptCount?: number;
  maxAttempts?: number;
  idempotencyKey: string;
  metadata?: Prisma.InputJsonValue;
};

export const operationalAlertService = {
  async upsert(input: CreateOperationalAlertInput) {
    const classification = classifyRetryError("PROVIDER_ERROR", input.safeErrorMessage);
    const attemptCount = input.attemptCount ?? 0;
    const maxAttempts = input.maxAttempts ?? 3;
    const deadLetter = shouldMoveToDeadLetter(attemptCount, maxAttempts) || classification.terminal;

    return prisma.operationalAlert.upsert({
      where: {
        organisationId_idempotencyKey: {
          organisationId: input.organisationId,
          idempotencyKey: input.idempotencyKey,
        },
      },
      create: {
        organisationId: input.organisationId,
        projectId: input.projectId,
        brandId: input.brandId,
        alertType: input.alertType,
        category: input.category,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        provider: input.provider,
        title: input.title,
        safeErrorMessage: sanitiseEmailBody(input.safeErrorMessage),
        recommendedAction: input.recommendedAction,
        attemptCount,
        maxAttempts,
        lastAttemptAt: new Date(),
        nextRetryAt: deadLetter ? null : nextRetryDate(attemptCount),
        status: deadLetter ? "DEAD_LETTER" : "OPEN",
        idempotencyKey: input.idempotencyKey,
        metadata: input.metadata,
      },
      update: {
        attemptCount,
        lastAttemptAt: new Date(),
        nextRetryAt: deadLetter ? null : nextRetryDate(attemptCount),
        status: deadLetter ? "DEAD_LETTER" : "OPEN",
        safeErrorMessage: sanitiseEmailBody(input.safeErrorMessage),
        metadata: input.metadata,
      },
    });
  },

  async list(organisationId: string, filters: OperationalAlertFilters, context: TenantContext) {
    assertOrganisationScope(organisationId, context);
    const limit = filters.limit ?? 25;
    const items = await prisma.operationalAlert.findMany({
      where: {
        organisationId,
        ...(filters.status ? { status: filters.status as never } : { status: { not: "RESOLVED" } }),
        ...(filters.alertType ? { alertType: filters.alertType } : {}),
        ...(filters.brandId ? { brandId: filters.brandId } : {}),
        ...(filters.provider ? { provider: filters.provider } : {}),
      },
      include: {
        recoveryActions: { orderBy: { createdAt: "desc" }, take: 5 },
        brand: { select: { id: true, name: true } },
      },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      take: limit + 1,
      ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    });
    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    return { items: page, nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null };
  },

  async summary(organisationId: string, context: TenantContext) {
    assertOrganisationScope(organisationId, context);
    const [open, deadLetter, publishing, connectors, rendering] = await Promise.all([
      prisma.operationalAlert.count({ where: { organisationId, status: "OPEN" } }),
      prisma.operationalAlert.count({ where: { organisationId, status: "DEAD_LETTER" } }),
      prisma.operationalAlert.count({
        where: {
          organisationId,
          alertType: { in: ["PUBLISHING_FAILURE", "PUBLISHING_PARTIAL"] },
          status: { in: ["OPEN", "RETRYING", "DEAD_LETTER"] },
        },
      }),
      prisma.operationalAlert.count({
        where: {
          organisationId,
          alertType: { in: ["CONNECTOR_SYNC_FAILURE", "ANALYTICS_SYNC_FAILURE", "TOKEN_REAUTH_REQUIRED"] },
          status: { in: ["OPEN", "RETRYING", "DEAD_LETTER"] },
        },
      }),
      prisma.operationalAlert.count({
        where: { organisationId, alertType: "RENDER_FAILURE", status: { in: ["OPEN", "DEAD_LETTER"] } },
      }),
    ]);
    return { open, deadLetter, publishing, connectors, rendering };
  },

  async resolve(organisationId: string, alertId: string, userId: string, context: TenantContext) {
    assertOrganisationScope(organisationId, context);
    const alert = await prisma.operationalAlert.findFirst({
      where: { id: alertId, organisationId },
    });
    if (!alert) throw new AppError("NOT_FOUND", "Operational alert was not found.");
    return prisma.operationalAlert.update({
      where: { id: alertId },
      data: { status: "RESOLVED", resolvedAt: new Date(), resolvedByUserId: userId },
    });
  },
};
