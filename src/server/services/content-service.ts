import {
  ContentRevisionSource,
  ContentStatus,
  Prisma,
  type ContentApprovalMode,
} from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import {
  assertCanApproveContent,
  DEFAULT_CONTENT_WORKFLOW_SETTINGS,
  requiresApproval,
  resolveStatusAfterApproval,
  type ContentWorkflowSettings,
} from "@/lib/content/approval";
import {
  hasBlockingComplianceFailures,
  runComplianceChecks,
} from "@/lib/content/compliance";
import {
  assertContentStatusTransition,
  EDITABLE_CONTENT_STATUSES,
} from "@/lib/content/status-transitions";
import type { TenantContext } from "@/lib/tenancy/context";
import type {
  ContentCreateInput,
  ContentUpdateInput,
  ContentVariantInput,
} from "@/lib/validation/content";
import { recordAuditEvent } from "@/server/services/audit-service";
import { getOrganisationApproverUserIds } from "@/lib/notifications/recipients";
import { notificationEventService } from "@/server/services/notification-event-service";
import { complianceAgentService } from "@/server/services/compliance-agent-service";
import { brandService } from "@/server/services/workspace-service";

type BrandScope = {
  organisationId: string;
  projectId: string;
  brandId: string;
};

const CONTENT_ITEM_INCLUDE = {
  variants: { include: { socialAccount: true } },
  assets: { include: { marketingAsset: true } },
  provenance: true,
  approvals: { orderBy: { createdAt: "desc" as const }, take: 5 },
  comments: {
    where: { status: "OPEN" as const },
    orderBy: { createdAt: "desc" as const },
    take: 10,
  },
  complianceChecks: { orderBy: { checkedAt: "desc" as const }, take: 20 },
} satisfies Prisma.ContentItemInclude;

async function resolveBrandScope(
  brandId: string,
  organisationId: string,
  context: TenantContext,
): Promise<BrandScope> {
  const brand = await brandService.getById(brandId, organisationId, context);
  return { organisationId, projectId: brand.projectId, brandId };
}

async function getWorkflowSettings(organisationId: string): Promise<ContentWorkflowSettings> {
  const settings = await prisma.organisationContentSettings.findUnique({
    where: { organisationId },
  });
  return settings ?? DEFAULT_CONTENT_WORKFLOW_SETTINGS;
}

async function getContentOrThrow(scope: BrandScope, contentId: string) {
  const item = await prisma.contentItem.findFirst({
    where: {
      id: contentId,
      organisationId: scope.organisationId,
      brandId: scope.brandId,
      archivedAt: null,
    },
    include: CONTENT_ITEM_INCLUDE,
  });
  if (!item) {
    throw new AppError("NOT_FOUND", "Content item was not found.");
  }
  return item;
}

function toPublicContentItem(item: Awaited<ReturnType<typeof getContentOrThrow>>) {
  return {
    id: item.id,
    title: item.title,
    campaignName: item.campaignName,
    contentPillar: item.contentPillar,
    contentType: item.contentType,
    primaryMessage: item.primaryMessage,
    primaryCTA: item.primaryCTA,
    destinationUrl: item.destinationUrl,
    status: item.status,
    priority: item.priority,
    objectiveId: item.objectiveId,
    targetAudienceId: item.targetAudienceId,
    ownerUserId: item.ownerUserId,
    createdByUserId: item.createdByUserId,
    approvedByUserId: item.approvedByUserId,
    approvedAt: item.approvedAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    variants: item.variants.map((variant) => ({
      id: variant.id,
      provider: variant.provider,
      socialAccountId: variant.socialAccountId,
      socialAccount: variant.socialAccount
        ? {
            id: variant.socialAccount.id,
            providerAccountId: variant.socialAccount.providerAccountId,
            accountType: variant.socialAccount.accountType,
            displayName: variant.socialAccount.displayName,
            username: variant.socialAccount.username,
          }
        : null,
      format: variant.format,
      caption: variant.caption,
      headline: variant.headline,
      description: variant.description,
      hashtags: variant.hashtags,
      mentions: variant.mentions,
      destinationUrl: variant.destinationUrl,
      firstComment: variant.firstComment,
      altText: variant.altText,
      thumbnailAssetId: variant.thumbnailAssetId,
      durationSeconds: variant.durationSeconds,
      aspectRatio: variant.aspectRatio,
      status: variant.status,
      validationErrors: variant.validationErrors,
    })),
    assets: item.assets.map((asset) => ({
      id: asset.id,
      marketingAssetId: asset.marketingAssetId,
      sortOrder: asset.sortOrder,
      title: asset.marketingAsset.title,
      approvedForMarketing: asset.marketingAsset.approvedForMarketing,
    })),
    provenance: item.provenance,
    openCommentCount: item.comments.length,
    complianceChecks: item.complianceChecks,
    approvals: item.approvals,
  };
}

async function createRevision(input: {
  scope: BrandScope;
  contentItemId: string;
  editorUserId: string;
  changedFields: Record<string, unknown>;
  snapshot: Record<string, unknown>;
  source?: ContentRevisionSource;
  changeNote?: string;
}) {
  const latest = await prisma.contentRevision.findFirst({
    where: { contentItemId: input.contentItemId },
    orderBy: { revisionNumber: "desc" },
  });
  const revisionNumber = (latest?.revisionNumber ?? 0) + 1;
  return prisma.contentRevision.create({
    data: {
      organisationId: input.scope.organisationId,
      projectId: input.scope.projectId,
      brandId: input.scope.brandId,
      contentItemId: input.contentItemId,
      revisionNumber,
      changedFields: input.changedFields as Prisma.InputJsonValue,
      snapshot: input.snapshot as Prisma.InputJsonValue,
      editorUserId: input.editorUserId,
      source: input.source ?? "USER",
      changeNote: input.changeNote,
    },
  });
}

async function transitionStatus(input: {
  scope: BrandScope;
  contentItemId: string;
  fromStatus: ContentStatus;
  toStatus: ContentStatus;
  changedByUserId: string;
  reason?: string;
  extraData?: Prisma.ContentItemUpdateInput;
}) {
  assertContentStatusTransition(input.fromStatus, input.toStatus);
  await prisma.$transaction([
    prisma.contentItem.update({
      where: { id: input.contentItemId },
      data: {
        status: input.toStatus,
        ...(input.extraData ?? {}),
      },
    }),
    prisma.contentStatusHistory.create({
      data: {
        organisationId: input.scope.organisationId,
        projectId: input.scope.projectId,
        brandId: input.scope.brandId,
        contentItemId: input.contentItemId,
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
        changedByUserId: input.changedByUserId,
        reason: input.reason,
      },
    }),
  ]);
}

async function persistComplianceChecks(
  scope: BrandScope,
  contentItemId: string,
  item: Awaited<ReturnType<typeof getContentOrThrow>>,
  context?: TenantContext,
) {
  if (context) {
    try {
      const evaluation = await complianceAgentService.evaluate(
        scope.brandId,
        scope.organisationId,
        contentItemId,
        context,
      );
      return evaluation.findings.map((finding) => ({
        checkType: "PROHIBITED_CLAIM" as const,
        result: finding.isBlocking ? ("FAIL" as const) : ("WARNING" as const),
        message: finding.message,
        blocking: finding.isBlocking,
        contentVariantId: finding.contentVariantId ?? undefined,
      }));
    } catch {
      // Fall through to legacy deterministic checks when no policy is configured.
    }
  }

  const prohibitedClaims = await prisma.brandComplianceRule.findMany({
    where: {
      brandId: scope.brandId,
      organisationId: scope.organisationId,
      archivedAt: null,
      ruleType: "PROHIBITED_CLAIM",
    },
    select: { ruleText: true },
  });

  const findings = runComplianceChecks({
    contentType: item.contentType,
    primaryMessage: item.primaryMessage,
    destinationUrl: item.destinationUrl,
    variants: item.variants.map((variant) => ({
      id: variant.id,
      provider: variant.provider,
      format: variant.format,
      caption: variant.caption,
      altText: variant.altText,
      destinationUrl: variant.destinationUrl,
    })),
    assets: item.assets.map((asset) => ({
      id: asset.marketingAssetId,
      approvedForMarketing: asset.marketingAsset.approvedForMarketing,
      licenceExpiresAt: asset.marketingAsset.licenceExpiresAt,
      attributionRequired: asset.marketingAsset.attributionRequired,
    })),
    provenance: item.provenance,
    prohibitedClaims: prohibitedClaims.map((rule) => rule.ruleText),
  });

  await prisma.contentComplianceCheck.deleteMany({ where: { contentItemId } });
  if (findings.length > 0) {
    await prisma.contentComplianceCheck.createMany({
      data: findings.map((finding) => ({
        organisationId: scope.organisationId,
        projectId: scope.projectId,
        brandId: scope.brandId,
        contentItemId,
        contentVariantId: finding.contentVariantId,
        checkType: finding.checkType,
        result: finding.result,
        message: finding.message,
        blocking: finding.blocking,
      })),
    });
  }

  return findings;
}

function buildVariantRows(
  scope: BrandScope,
  contentItemId: string,
  variants: ContentVariantInput[],
) {
  return variants.map((variant) => ({
    organisationId: scope.organisationId,
    projectId: scope.projectId,
    brandId: scope.brandId,
    contentItemId,
    provider: variant.provider,
    socialAccountId: variant.socialAccountId,
    format: variant.format,
    caption: variant.caption || null,
    headline: variant.headline || null,
    description: variant.description || null,
    hashtags: variant.hashtags ?? [],
    mentions: variant.mentions ?? [],
    destinationUrl: variant.destinationUrl || null,
    firstComment: variant.firstComment || null,
    altText: variant.altText || null,
    thumbnailAssetId: variant.thumbnailAssetId,
    durationSeconds: variant.durationSeconds,
    aspectRatio: variant.aspectRatio || null,
    status: "DRAFT" as const,
  }));
}

export const contentService = {
  async list(
    brandId: string,
    organisationId: string,
    context: TenantContext,
    filters?: {
      status?: ContentStatus;
      ownerUserId?: string;
      provider?: import("@prisma/client").SocialProvider;
      search?: string;
    },
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const items = await prisma.contentItem.findMany({
      where: {
        organisationId: scope.organisationId,
        brandId: scope.brandId,
        archivedAt: null,
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.ownerUserId ? { ownerUserId: filters.ownerUserId } : {}),
        ...(filters?.search
          ? {
              OR: [
                { title: { contains: filters.search, mode: "insensitive" } },
                { campaignName: { contains: filters.search, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(filters?.provider
          ? { variants: { some: { provider: filters.provider } } }
          : {}),
      },
      include: { variants: { include: { socialAccount: true } } },
      orderBy: { updatedAt: "desc" },
    });
    return items.map((item) => toPublicContentItem({ ...item, assets: [], provenance: null, comments: [], complianceChecks: [], approvals: [] }));
  },

  async getById(brandId: string, organisationId: string, contentId: string, context: TenantContext) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const item = await getContentOrThrow(scope, contentId);
    return toPublicContentItem(item);
  },

  async create(
    brandId: string,
    organisationId: string,
    input: ContentCreateInput,
    context: TenantContext,
    requestId?: string,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.contentItem.create({
        data: {
          organisationId: scope.organisationId,
          projectId: scope.projectId,
          brandId: scope.brandId,
          title: input.title,
          objectiveId: input.objectiveId,
          campaignName: input.campaignName || null,
          contentPillar: input.contentPillar || null,
          contentType: input.contentType,
          primaryMessage: input.primaryMessage || null,
          targetAudienceId: input.targetAudienceId,
          primaryCTA: input.primaryCTA || null,
          destinationUrl: input.destinationUrl || null,
          priority: input.priority ?? "NORMAL",
          status: "IDEA",
          ownerUserId: context.userProfileId,
          createdByUserId: context.userProfileId,
          provenance: {
            create: {
              organisationId: scope.organisationId,
              projectId: scope.projectId,
              brandId: scope.brandId,
              createdManually: true,
            },
          },
        },
      });

      if (input.variants?.length) {
        await tx.contentVariant.createMany({
          data: buildVariantRows(scope, created.id, input.variants),
        });
      }

      if (input.assetIds?.length) {
        await tx.contentAsset.createMany({
          data: input.assetIds.map((marketingAssetId, index) => ({
            organisationId: scope.organisationId,
            projectId: scope.projectId,
            brandId: scope.brandId,
            contentItemId: created.id,
            marketingAssetId,
            sortOrder: index,
          })),
        });
      }

      return created;
    });

    await createRevision({
      scope,
      contentItemId: item.id,
      editorUserId: context.userProfileId,
      changedFields: { action: "created" },
      snapshot: { title: item.title, status: item.status, contentType: item.contentType },
      source: "USER",
      changeNote: "Initial content creation",
    });

    await recordAuditEvent({
      organisationId: scope.organisationId,
      projectId: scope.projectId,
      actorUserId: context.userProfileId,
      action: "content.created",
      resourceType: "contentItem",
      resourceId: item.id,
      requestId,
    });

    return this.getById(brandId, organisationId, item.id, context);
  },

  async update(
    brandId: string,
    organisationId: string,
    contentId: string,
    input: ContentUpdateInput,
    context: TenantContext,
    requestId?: string,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const existing = await getContentOrThrow(scope, contentId);

    if (!EDITABLE_CONTENT_STATUSES.includes(existing.status) && existing.status !== "IN_REVIEW") {
      throw new AppError("VALIDATION_ERROR", "Content cannot be edited in its current status.");
    }

    const allowedFields: Prisma.ContentItemUpdateInput = {};
    if (input.title !== undefined) allowedFields.title = input.title;
    if (input.objectiveId !== undefined) {
      allowedFields.objective = input.objectiveId
        ? { connect: { id: input.objectiveId } }
        : { disconnect: true };
    }
    if (input.campaignName !== undefined) allowedFields.campaignName = input.campaignName || null;
    if (input.contentPillar !== undefined) allowedFields.contentPillar = input.contentPillar || null;
    if (input.contentType !== undefined) allowedFields.contentType = input.contentType;
    if (input.primaryMessage !== undefined) allowedFields.primaryMessage = input.primaryMessage || null;
    if (input.targetAudienceId !== undefined) {
      allowedFields.targetAudience = input.targetAudienceId
        ? { connect: { id: input.targetAudienceId } }
        : { disconnect: true };
    }
    if (input.primaryCTA !== undefined) allowedFields.primaryCTA = input.primaryCTA || null;
    if (input.destinationUrl !== undefined) allowedFields.destinationUrl = input.destinationUrl || null;
    if (input.priority !== undefined) allowedFields.priority = input.priority;
    if (input.ownerUserId !== undefined) {
      allowedFields.owner = { connect: { id: input.ownerUserId } };
    }

    if (existing.status === "IDEA" && Object.keys(allowedFields).length > 0) {
      allowedFields.status = "DRAFT";
    }

    await prisma.$transaction(async (tx) => {
      await tx.contentItem.update({ where: { id: contentId }, data: allowedFields });

      if (input.variants) {
        await tx.contentVariant.deleteMany({ where: { contentItemId: contentId } });
        if (input.variants.length > 0) {
          await tx.contentVariant.createMany({
            data: buildVariantRows(scope, contentId, input.variants),
          });
        }
      }

      if (input.assetIds) {
        await tx.contentAsset.deleteMany({ where: { contentItemId: contentId } });
        if (input.assetIds.length > 0) {
          await tx.contentAsset.createMany({
            data: input.assetIds.map((marketingAssetId, index) => ({
              organisationId: scope.organisationId,
              projectId: scope.projectId,
              brandId: scope.brandId,
              contentItemId: contentId,
              marketingAssetId,
              sortOrder: index,
            })),
          });
        }
      }
    });

    const updated = await getContentOrThrow(scope, contentId);
    await createRevision({
      scope,
      contentItemId: contentId,
      editorUserId: context.userProfileId,
      changedFields: input as Record<string, unknown>,
      snapshot: toPublicContentItem(updated) as unknown as Record<string, unknown>,
      source: "USER",
    });

    await persistComplianceChecks(scope, contentId, updated, context);

    await recordAuditEvent({
      organisationId: scope.organisationId,
      projectId: scope.projectId,
      actorUserId: context.userProfileId,
      action: "content.updated",
      resourceType: "contentItem",
      resourceId: contentId,
      requestId,
    });

    return toPublicContentItem(updated);
  },

  async submitForReview(
    brandId: string,
    organisationId: string,
    contentId: string,
    context: TenantContext,
    requestId?: string,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const item = await getContentOrThrow(scope, contentId);
    const settings = await getWorkflowSettings(scope.organisationId);
    const findings = await persistComplianceChecks(scope, contentId, item, context);
    if (hasBlockingComplianceFailures(findings)) {
      throw new AppError("VALIDATION_ERROR", "Compliance checks must pass before review.");
    }

    if (!requiresApproval(settings.approvalMode)) {
      await transitionStatus({
        scope,
        contentItemId: contentId,
        fromStatus: item.status,
        toStatus: "APPROVED",
        changedByUserId: context.userProfileId,
        reason: "No approval required",
        extraData: {
          approvedBy: { connect: { id: context.userProfileId } },
          approvedAt: new Date(),
        },
      });
    } else {
      await transitionStatus({
        scope,
        contentItemId: contentId,
        fromStatus: item.status,
        toStatus: "IN_REVIEW",
        changedByUserId: context.userProfileId,
        reason: "Submitted for review",
      });
      await prisma.contentApproval.create({
        data: {
          organisationId: scope.organisationId,
          projectId: scope.projectId,
          brandId: scope.brandId,
          contentItemId: contentId,
          approvalMode: settings.approvalMode,
          requestedByUserId: context.userProfileId,
        },
      });
      const approverIds = await getOrganisationApproverUserIds(scope.organisationId);
      await notificationEventService
        .contentSubmittedForReview({
          organisationId: scope.organisationId,
          projectId: scope.projectId,
          brandId: scope.brandId,
          contentId,
          recipientUserIds: approverIds.filter((id) => id !== context.userProfileId),
          idempotencyKey: `content-review:${contentId}`,
        })
        .catch(() => undefined);
    }

    await recordAuditEvent({
      organisationId: scope.organisationId,
      projectId: scope.projectId,
      actorUserId: context.userProfileId,
      action: "content.submittedForReview",
      resourceType: "contentItem",
      resourceId: contentId,
      requestId,
    });

    return this.getById(brandId, organisationId, contentId, context);
  },

  async approve(
    brandId: string,
    organisationId: string,
    contentId: string,
    context: TenantContext,
    decisionNote?: string,
    requestId?: string,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const item = await getContentOrThrow(scope, contentId);
    const settings = await getWorkflowSettings(scope.organisationId);

    if (item.status !== "IN_REVIEW") {
      throw new AppError("VALIDATION_ERROR", "Only content in review can be approved.");
    }

    assertCanApproveContent({
      settings,
      approverUserId: context.userProfileId,
      createdByUserId: item.createdByUserId,
      ownerUserId: item.ownerUserId,
    });

    const findings = await persistComplianceChecks(scope, contentId, item, context);
    if (hasBlockingComplianceFailures(findings)) {
      throw new AppError("VALIDATION_ERROR", "Compliance checks must pass before approval.");
    }

    const nextStatus = resolveStatusAfterApproval(settings.approvalMode);
    await transitionStatus({
      scope,
      contentItemId: contentId,
      fromStatus: item.status,
      toStatus: nextStatus,
      changedByUserId: context.userProfileId,
      reason: decisionNote ?? "Approved",
      extraData: {
        approvedBy: { connect: { id: context.userProfileId } },
        approvedAt: new Date(),
      },
    });

    await prisma.contentApproval.updateMany({
      where: { contentItemId: contentId, decision: "PENDING" },
      data: {
        decision: "APPROVED",
        approverUserId: context.userProfileId,
        decisionNote: decisionNote ?? null,
        decidedAt: new Date(),
      },
    });

    await recordAuditEvent({
      organisationId: scope.organisationId,
      projectId: scope.projectId,
      actorUserId: context.userProfileId,
      action: "content.approved",
      resourceType: "contentItem",
      resourceId: contentId,
      requestId,
    });

    const notifyIds = [item.createdByUserId, item.ownerUserId].filter(
      (id): id is string => Boolean(id) && id !== context.userProfileId,
    );
    if (notifyIds.length > 0) {
      await notificationEventService
        .contentApproved({
          organisationId: scope.organisationId,
          projectId: scope.projectId,
          brandId: scope.brandId,
          contentId,
          recipientUserIds: [...new Set(notifyIds)],
          idempotencyKey: `content-approved:${contentId}`,
        })
        .catch(() => undefined);
    }

    return this.getById(brandId, organisationId, contentId, context);
  },

  async requestChanges(
    brandId: string,
    organisationId: string,
    contentId: string,
    decisionNote: string,
    context: TenantContext,
    requestId?: string,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const item = await getContentOrThrow(scope, contentId);

    if (item.status !== "IN_REVIEW") {
      throw new AppError("VALIDATION_ERROR", "Only content in review can have changes requested.");
    }

    await transitionStatus({
      scope,
      contentItemId: contentId,
      fromStatus: item.status,
      toStatus: "CHANGES_REQUESTED",
      changedByUserId: context.userProfileId,
      reason: decisionNote,
    });

    await prisma.contentApproval.updateMany({
      where: { contentItemId: contentId, decision: "PENDING" },
      data: {
        decision: "CHANGES_REQUESTED",
        approverUserId: context.userProfileId,
        decisionNote,
        decidedAt: new Date(),
      },
    });

    await recordAuditEvent({
      organisationId: scope.organisationId,
      projectId: scope.projectId,
      actorUserId: context.userProfileId,
      action: "content.changesRequested",
      resourceType: "contentItem",
      resourceId: contentId,
      requestId,
      metadata: { decisionNote },
    });

    const notifyIds = [item.createdByUserId, item.ownerUserId].filter(
      (id): id is string => Boolean(id) && id !== context.userProfileId,
    );
    if (notifyIds.length > 0) {
      await notificationEventService
        .contentChangesRequested({
          organisationId: scope.organisationId,
          projectId: scope.projectId,
          brandId: scope.brandId,
          contentId,
          recipientUserIds: [...new Set(notifyIds)],
          idempotencyKey: `content-changes:${contentId}:${Date.now()}`,
          note: decisionNote,
        })
        .catch(() => undefined);
    }

    return this.getById(brandId, organisationId, contentId, context);
  },

  async archive(
    brandId: string,
    organisationId: string,
    contentId: string,
    context: TenantContext,
    requestId?: string,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const item = await getContentOrThrow(scope, contentId);

    await transitionStatus({
      scope,
      contentItemId: contentId,
      fromStatus: item.status,
      toStatus: "ARCHIVED",
      changedByUserId: context.userProfileId,
      reason: "Archived",
      extraData: { archivedAt: new Date() },
    });

    await recordAuditEvent({
      organisationId: scope.organisationId,
      projectId: scope.projectId,
      actorUserId: context.userProfileId,
      action: "content.archived",
      resourceType: "contentItem",
      resourceId: contentId,
      requestId,
    });
  },

  async listRevisions(brandId: string, organisationId: string, contentId: string, context: TenantContext) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    await getContentOrThrow(scope, contentId);
    const revisions = await prisma.contentRevision.findMany({
      where: { contentItemId: contentId, organisationId: scope.organisationId },
      orderBy: { revisionNumber: "desc" },
    });
    return revisions.map((revision) => ({
      id: revision.id,
      revisionNumber: revision.revisionNumber,
      changedFields: revision.changedFields,
      editorUserId: revision.editorUserId,
      source: revision.source,
      changeNote: revision.changeNote,
      createdAt: revision.createdAt.toISOString(),
    }));
  },

  async restoreRevision(
    brandId: string,
    organisationId: string,
    contentId: string,
    revisionNumber: number,
    context: TenantContext,
    changeNote?: string,
    requestId?: string,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const item = await getContentOrThrow(scope, contentId);
    const revision = await prisma.contentRevision.findFirst({
      where: { contentItemId: contentId, revisionNumber },
    });
    if (!revision) {
      throw new AppError("NOT_FOUND", "Revision was not found.");
    }

    const snapshot = revision.snapshot as Record<string, unknown>;
    await prisma.contentItem.update({
      where: { id: contentId },
      data: {
        title: String(snapshot.title ?? item.title),
        primaryMessage:
          snapshot.primaryMessage === undefined
            ? item.primaryMessage
            : (snapshot.primaryMessage as string | null),
        destinationUrl:
          snapshot.destinationUrl === undefined
            ? item.destinationUrl
            : (snapshot.destinationUrl as string | null),
        status: item.status === "APPROVED" ? "DRAFT" : item.status,
        approvedBy: { disconnect: true },
        approvedAt: null,
      },
    });

    await createRevision({
      scope,
      contentItemId: contentId,
      editorUserId: context.userProfileId,
      changedFields: { restoredFromRevision: revisionNumber },
      snapshot,
      source: "USER",
      changeNote: changeNote ?? `Restored revision ${revisionNumber}`,
    });

    await recordAuditEvent({
      organisationId: scope.organisationId,
      projectId: scope.projectId,
      actorUserId: context.userProfileId,
      action: "content.revisionRestored",
      resourceType: "contentItem",
      resourceId: contentId,
      requestId,
      metadata: { revisionNumber },
    });

    return this.getById(brandId, organisationId, contentId, context);
  },

  async addComment(
    brandId: string,
    organisationId: string,
    contentId: string,
    body: string,
    context: TenantContext,
    contentVariantId?: string,
    requestId?: string,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    await getContentOrThrow(scope, contentId);

    const comment = await prisma.contentComment.create({
      data: {
        organisationId: scope.organisationId,
        projectId: scope.projectId,
        brandId: scope.brandId,
        contentItemId: contentId,
        contentVariantId,
        authorUserId: context.userProfileId,
        body,
      },
    });

    await recordAuditEvent({
      organisationId: scope.organisationId,
      projectId: scope.projectId,
      actorUserId: context.userProfileId,
      action: "content.commentAdded",
      resourceType: "contentComment",
      resourceId: comment.id,
      requestId,
      metadata: { contentItemId: contentId, contentVariantId },
    });

    return comment;
  },

  async resolveComment(
    brandId: string,
    organisationId: string,
    contentId: string,
    commentId: string,
    context: TenantContext,
    requestId?: string,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    await getContentOrThrow(scope, contentId);

    const comment = await prisma.contentComment.findFirst({
      where: {
        id: commentId,
        contentItemId: contentId,
        organisationId: scope.organisationId,
      },
    });
    if (!comment) {
      throw new AppError("NOT_FOUND", "Comment was not found.");
    }

    return prisma.contentComment.update({
      where: { id: commentId },
      data: {
        status: "RESOLVED",
        resolvedByUserId: context.userProfileId,
        resolvedAt: new Date(),
      },
    });
  },

  async getWorkflowSettings(organisationId: string) {
    return getWorkflowSettings(organisationId);
  },

  async updateWorkflowSettings(
    organisationId: string,
    settings: ContentWorkflowSettings,
    context: TenantContext,
    requestId?: string,
  ) {
    const saved = await prisma.organisationContentSettings.upsert({
      where: { organisationId },
      create: {
        organisationId,
        approvalMode: settings.approvalMode,
        separationOfDutiesEnabled: settings.separationOfDutiesEnabled,
      },
      update: {
        approvalMode: settings.approvalMode,
        separationOfDutiesEnabled: settings.separationOfDutiesEnabled,
      },
    });

    await recordAuditEvent({
      organisationId,
      actorUserId: context.userProfileId,
      action: "content.workflowSettingsUpdated",
      resourceType: "organisation",
      resourceId: organisationId,
      requestId,
      metadata: {
        approvalMode: saved.approvalMode,
        separationOfDutiesEnabled: saved.separationOfDutiesEnabled,
      },
    });

    return saved;
  },
};
