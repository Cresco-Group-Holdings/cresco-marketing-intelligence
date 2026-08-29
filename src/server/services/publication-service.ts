import type { PublicationOperationType, PublicationStatus } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { adaptContentForProvider } from "@/lib/publishing/content-adaptation";
import { evaluatePublicationGovernance } from "@/lib/publishing/publication-governance";
import { getPublishingConfig } from "@/lib/publishing/config";
import { isOutboundOperation } from "@/lib/publishing/outbound-operations";
import type { TenantContext } from "@/lib/tenancy/context";
import { hasPermission, PERMISSIONS } from "@/lib/tenancy/permissions";
import { recordAuditEvent } from "@/server/services/audit-service";
import { complianceAgentService } from "@/server/services/compliance-agent-service";
import { brandService } from "@/server/services/workspace-service";
import { isCommercialUsageExempt } from "@/lib/billing/commercial-exempt";
import { ENTITLEMENT_KEYS, USAGE_METER_KEYS } from "@/lib/billing/entitlements";
import { entitlementService } from "@/server/services/entitlement-service";
import { usageMeteringService } from "@/server/services/usage-metering-service";

export type CreatePublicationInput = {
  contentItemId: string;
  contentVariantId?: string;
  connectionId: string;
  externalAccountId: string;
  destinationType: string;
  destinationId: string;
  operationType: PublicationOperationType;
  scheduledFor?: string;
  timezone?: string;
  idempotencyKey: string;
  campaignId?: string;
  dryRun?: boolean;
  providerPayload?: Record<string, unknown>;
  humanApprovalRequired?: boolean;
  publicationApproved?: boolean;
};

function toSafePublication(publication: {
  id: string;
  organisationId: string;
  brandId: string;
  contentItemId: string;
  connectionId: string;
  providerKey: string;
  externalAccountId: string;
  destinationType: string;
  destinationId: string;
  operationType: PublicationOperationType;
  status: PublicationStatus;
  scheduledFor: Date | null;
  timezone: string;
  idempotencyKey: string;
  externalPublicationId: string | null;
  approvedAt: Date | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  providerPermalink: string | null;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  cancelledAt: Date | null;
}) {
  return {
    id: publication.id,
    organisationId: publication.organisationId,
    brandId: publication.brandId,
    contentItemId: publication.contentItemId,
    connectionId: publication.connectionId,
    providerKey: publication.providerKey,
    externalAccountId: publication.externalAccountId,
    destinationType: publication.destinationType,
    destinationId: publication.destinationId,
    operationType: publication.operationType,
    status: publication.status,
    scheduledFor: publication.scheduledFor?.toISOString() ?? null,
    timezone: publication.timezone,
    idempotencyKey: publication.idempotencyKey,
    externalPublicationId: publication.externalPublicationId,
    approvedAt: publication.approvedAt?.toISOString() ?? null,
    lastErrorCode: publication.lastErrorCode,
    lastErrorMessage: publication.lastErrorMessage,
    providerPermalink: publication.providerPermalink,
    createdAt: publication.createdAt.toISOString(),
    updatedAt: publication.updatedAt.toISOString(),
    publishedAt: publication.publishedAt?.toISOString() ?? null,
    cancelledAt: publication.cancelledAt?.toISOString() ?? null,
  };
}

export const publicationService = {
  async list(brandId: string, organisationId: string, context: TenantContext, filters?: { status?: PublicationStatus }) {
    await brandService.getById(brandId, organisationId, context);
    const rows = await prisma.publication.findMany({
      where: {
        organisationId,
        brandId,
        ...(filters?.status ? { status: filters.status } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
    return rows.map(toSafePublication);
  },

  async get(brandId: string, organisationId: string, publicationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const publication = await prisma.publication.findFirst({
      where: { id: publicationId, organisationId, brandId },
      include: {
        attempts: { orderBy: { attemptNumber: "desc" }, take: 20 },
        budgetChanges: { orderBy: { createdAt: "desc" }, take: 5 },
      },
    });
    if (!publication) throw new AppError("NOT_FOUND", "Publication not found.");
    return {
      ...toSafePublication(publication),
      attempts: publication.attempts.map((attempt) => ({
        id: attempt.id,
        attemptNumber: attempt.attemptNumber,
        status: attempt.status,
        dryRun: attempt.dryRun,
        errorCode: attempt.errorCode,
        errorMessageSafe: attempt.errorMessageSafe,
        requestId: attempt.requestId,
        startedAt: attempt.startedAt?.toISOString() ?? null,
        completedAt: attempt.completedAt?.toISOString() ?? null,
        createdAt: attempt.createdAt.toISOString(),
      })),
      budgetChanges: publication.budgetChanges,
    };
  },

  async create(brandId: string, organisationId: string, input: CreatePublicationInput, context: TenantContext, requestId?: string) {
    if (!isOutboundOperation(input.operationType)) {
      throw new AppError("VALIDATION_ERROR", "Unsupported operation type.");
    }

    const brand = await brandService.getById(brandId, organisationId, context);
    if (!hasPermission(context.organisationRole, PERMISSIONS["content.publish"])) {
      throw new AppError("FORBIDDEN", "You do not have permission to create publications.");
    }

    const existing = await prisma.publication.findFirst({
      where: { organisationId, brandId, idempotencyKey: input.idempotencyKey },
    });
    if (existing) {
      const validation = (existing.validationResult ?? {}) as {
        governance?: { blockers: string[]; warnings: string[] };
        adaptation?: { valid: boolean; issues: Array<{ message: string }> };
      };
      return {
        publication: toSafePublication(existing),
        governance: validation.governance ?? { allowed: true, blockers: [], warnings: [], requiresApproval: false, requiresBudgetApproval: false },
        adaptation: validation.adaptation ?? { valid: true, adaptedPayload: {}, issues: [], warnings: [] },
      };
    }

    const content = await prisma.contentItem.findFirst({
      where: { id: input.contentItemId, organisationId, brandId, archivedAt: null },
      include: { variants: true, assets: true },
    });
    if (!content) throw new AppError("NOT_FOUND", "Content item not found.");

    const connection = await prisma.providerConnection.findFirst({
      where: { id: input.connectionId, organisationId },
    });
    if (!connection) throw new AppError("NOT_FOUND", "Provider connection not found.");

    if (!input.dryRun && !isCommercialUsageExempt(organisationId)) {
      await entitlementService.assert({
        workspaceId: organisationId,
        organisationId,
        entitlement: ENTITLEMENT_KEYS.PUBLICATIONS_MONTHLY,
        requestedAmount: 1,
      });
    }

    const variant = input.contentVariantId
      ? content.variants.find((entry) => entry.id === input.contentVariantId)
      : content.variants[0];

    const adaptation = adaptContentForProvider({
      providerKey: connection.providerKey,
      operationType: input.operationType,
      caption: variant?.caption,
      destinationUrl: variant?.destinationUrl ?? content.destinationUrl,
      imageCount: content.assets.length,
      subject: content.title,
    });

    let compliancePassed = false;
    let complianceOverridden = false;
    try {
      await complianceAgentService.assertPublishable(brandId, organisationId, content.id, context, variant?.id);
      compliancePassed = true;
    } catch {
      const override = await prisma.complianceOverride.findFirst({
        where: { evaluation: { contentItemId: content.id, organisationId } },
        orderBy: { createdAt: "desc" },
      });
      complianceOverridden = Boolean(override);
    }

    const governance = evaluatePublicationGovernance({
      organisationRole: context.organisationRole,
      operationType: input.operationType,
      contentStatus: content.status,
      compliancePassed,
      complianceOverridden,
      assetsReady: content.assets.length > 0 || input.operationType.includes("GET"),
      connectionStatus: connection.status,
      connectionRevoked: Boolean(connection.revokedAt),
      externalAccountId: connection.externalAccountId ?? input.externalAccountId,
      destinationAccountId: input.externalAccountId,
      scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : null,
      timezone: input.timezone ?? "UTC",
      adaptation,
      publicationApproved: input.publicationApproved ?? false,
      humanApprovalRequired: input.humanApprovalRequired ?? true,
      emergencyShutdown: getPublishingConfig().emergencyShutdown,
    });

    const status: PublicationStatus = governance.requiresApproval
      ? "PENDING_APPROVAL"
      : input.scheduledFor
        ? "SCHEDULED"
        : "APPROVED";

    const publication = await prisma.publication.create({
      data: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        campaignId: input.campaignId,
        contentItemId: content.id,
        contentVariantId: variant?.id,
        connectionId: connection.id,
        providerKey: connection.providerKey,
        externalAccountId: input.externalAccountId,
        destinationType: input.destinationType,
        destinationId: input.destinationId,
        operationType: input.operationType,
        status: input.dryRun ? "DRAFT" : status,
        scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : null,
        timezone: input.timezone ?? "UTC",
        idempotencyKey: input.idempotencyKey,
        dryRun: input.dryRun ?? false,
        validationResult: { governance, adaptation } as object,
        providerPayload: input.providerPayload as object | undefined,
        requestedByUserId: context.userProfileId,
      },
    });

    await recordAuditEvent({
      organisationId,
      projectId: brand.projectId,
      actorUserId: context.userProfileId,
      action: "publication.created",
      resourceType: "publication",
      resourceId: publication.id,
      requestId,
      metadata: { operationType: input.operationType, status: publication.status },
    });

    if (!input.dryRun && !isCommercialUsageExempt(organisationId)) {
      await usageMeteringService.recordUsage({
        organisationId,
        meterKey: USAGE_METER_KEYS.PUBLICATIONS,
        amount: 1,
        idempotencyKey: `publication-${publication.id}`,
        period: "BILLING_PERIOD",
      });
    }

    return { publication: toSafePublication(publication), governance, adaptation };
  },

  async approve(brandId: string, organisationId: string, publicationId: string, context: TenantContext, requestId?: string) {
    if (!hasPermission(context.organisationRole, PERMISSIONS["content.approve"])) {
      throw new AppError("FORBIDDEN", "You do not have permission to approve publications.");
    }

    const publication = await prisma.publication.findFirst({
      where: { id: publicationId, organisationId, brandId },
    });
    if (!publication) throw new AppError("NOT_FOUND", "Publication not found.");
    if (publication.status !== "PENDING_APPROVAL") {
      throw new AppError("VALIDATION_ERROR", "Publication is not pending approval.");
    }

    const updated = await prisma.publication.update({
      where: { id: publicationId },
      data: {
        status: publication.scheduledFor ? "SCHEDULED" : "APPROVED",
        approvedByUserId: context.userProfileId,
        approvedAt: new Date(),
      },
    });

    await recordAuditEvent({
      organisationId,
      actorUserId: context.userProfileId,
      action: "publication.approved",
      resourceType: "publication",
      resourceId: publicationId,
      requestId,
    });

    return toSafePublication(updated);
  },

  async cancel(brandId: string, organisationId: string, publicationId: string, context: TenantContext, requestId?: string) {
    const publication = await prisma.publication.findFirst({
      where: { id: publicationId, organisationId, brandId },
    });
    if (!publication) throw new AppError("NOT_FOUND", "Publication not found.");

    const updated = await prisma.publication.update({
      where: { id: publicationId },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });

    await recordAuditEvent({
      organisationId,
      actorUserId: context.userProfileId,
      action: "publication.cancelled",
      resourceType: "publication",
      resourceId: publicationId,
      requestId,
    });

    return toSafePublication(updated);
  },
};
