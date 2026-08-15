import {
  ContentStatus,
  ContentType,
  Prisma,
  type ContentStudioType,
} from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import {
  runBrandKnowledgeComplianceChecks,
  type BrandKnowledgeComplianceFinding,
} from "@/lib/content/brand-knowledge-compliance";
import {
  assertCanApproveContent,
  DEFAULT_CONTENT_WORKFLOW_SETTINGS,
  type ContentWorkflowSettings,
} from "@/lib/content/approval";
import {
  assertStudioStatusTransition,
  getAllowedStudioTransitions,
  isStudioEditableStatus,
} from "@/lib/content/studio-workflow";
import { assertContentStatusTransition } from "@/lib/content/status-transitions";
import type { TenantContext } from "@/lib/tenancy/context";
import type {
  ContentStudioCreateInput,
  ContentStudioUpdateInput,
  ContentStudioVariantInput,
  ContentStudioTemplateCreateInput,
  ContentStudioKnowledgeRefInput,
} from "@/lib/validation/content-studio";
import { recordAuditEvent } from "@/server/services/audit-service";
import { brandService } from "@/server/services/workspace-service";

type BrandScope = {
  organisationId: string;
  projectId: string;
  brandId: string;
};

const STUDIO_INCLUDE = {
  variants: true,
  assets: { include: { marketingAsset: true } },
  knowledgeReferences: { orderBy: { createdAt: "asc" as const } },
  versions: { orderBy: { versionNumber: "desc" as const }, take: 20 },
  reviews: { orderBy: { createdAt: "desc" as const }, take: 10 },
  comments: {
    where: { status: "OPEN" as const },
    orderBy: { createdAt: "desc" as const },
    take: 20,
  },
  complianceChecks: { orderBy: { checkedAt: "desc" as const }, take: 30 },
} satisfies Prisma.ContentItemInclude;

const STUDIO_TYPE_TO_CONTENT_TYPE: Record<ContentStudioType, ContentType> = {
  SOCIAL_POST: "TEXT_POST",
  AD_COPY: "TEXT_POST",
  EMAIL: "TEXT_POST",
  BLOG_ARTICLE: "ARTICLE_LINK",
  LANDING_PAGE: "ARTICLE_LINK",
  VIDEO_SCRIPT: "LONG_VIDEO",
  IMAGE_BRIEF: "IMAGE_POST",
  PRESS_RELEASE: "ARTICLE_LINK",
  CASE_STUDY: "ARTICLE_LINK",
  SALES_COPY: "TEXT_POST",
  SEO_CONTENT: "ARTICLE_LINK",
  OTHER: "TEXT_POST",
};

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

async function getStudioItemOrThrow(scope: BrandScope, contentId: string) {
  const item = await prisma.contentItem.findFirst({
    where: {
      id: contentId,
      organisationId: scope.organisationId,
      brandId: scope.brandId,
      archivedAt: null,
      studioType: { not: null },
    },
    include: STUDIO_INCLUDE,
  });
  if (!item) {
    throw new AppError("NOT_FOUND", "Content studio item was not found.");
  }
  return item;
}

async function loadBrandContext(scope: BrandScope) {
  const [profile, messaging, voice, audiences, complianceRules] = await Promise.all([
    prisma.brandProfile.findUnique({ where: { brandId: scope.brandId } }),
    prisma.brandMessage.findUnique({ where: { brandId: scope.brandId } }),
    prisma.brandVoiceRule.findUnique({ where: { brandId: scope.brandId } }),
    prisma.brandAudience.count({
      where: { brandId: scope.brandId, organisationId: scope.organisationId, archivedAt: null },
    }),
    prisma.brandComplianceRule.findMany({
      where: {
        brandId: scope.brandId,
        organisationId: scope.organisationId,
        archivedAt: null,
        ruleType: "PROHIBITED_CLAIM",
      },
      select: { ruleText: true },
    }),
  ]);

  return {
    hasProfile: Boolean(profile),
    hasMessaging: Boolean(messaging),
    hasVoice: Boolean(voice),
    hasAudiences: audiences > 0,
    prohibitedClaims: [
      ...(messaging?.prohibitedClaims ?? []),
      ...complianceRules.map((r) => r.ruleText),
    ],
    prohibitedVocabulary: voice?.prohibitedVocabulary ?? [],
    proofPoints: messaging?.proofPoints ?? [],
    preferredTone: voice?.preferredTone ?? null,
    ctaLibrary: messaging?.ctaLibrary ?? [],
  };
}

function toPublicStudioItem(item: Awaited<ReturnType<typeof getStudioItemOrThrow>>) {
  return {
    id: item.id,
    title: item.title,
    studioType: item.studioType,
    contentType: item.contentType,
    status: item.status,
    version: item.version,
    studioObjective: item.studioObjective,
    audienceSummary: item.audienceSummary,
    contentBody: item.contentBody,
    primaryMessage: item.primaryMessage,
    primaryCTA: item.primaryCTA,
    primaryChannel: item.primaryChannel,
    contentCampaignId: item.contentCampaignId,
    campaignName: item.campaignName,
    dueAt: item.dueAt?.toISOString() ?? null,
    scheduledFor: item.scheduledFor?.toISOString() ?? null,
    timezone: item.timezone,
    ownerUserId: item.ownerUserId,
    createdByUserId: item.createdByUserId,
    approvedByUserId: item.approvedByUserId,
    approvedAt: item.approvedAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    variants: item.variants.map((v) => ({
      id: v.id,
      marketingChannel: v.marketingChannel,
      provider: v.provider,
      format: v.format,
      channelBody: v.channelBody,
      caption: v.caption,
      headline: v.headline,
      description: v.description,
      destinationUrl: v.destinationUrl,
      altText: v.altText,
      status: v.status,
    })),
    assets: item.assets.map((a) => ({
      id: a.id,
      marketingAssetId: a.marketingAssetId,
      sortOrder: a.sortOrder,
      title: a.marketingAsset.title,
      approvedForMarketing: a.marketingAsset.approvedForMarketing,
    })),
    knowledgeReferences: item.knowledgeReferences,
    versions: item.versions.map((v) => ({
      id: v.id,
      versionNumber: v.versionNumber,
      changeSummary: v.changeSummary,
      createdByUserId: v.createdByUserId,
      createdAt: v.createdAt.toISOString(),
    })),
    reviews: item.reviews,
    comments: item.comments,
    complianceChecks: item.complianceChecks,
    allowedTransitions: getAllowedStudioTransitions(item.status),
  };
}

function buildStudioVariantRows(
  scope: BrandScope,
  contentItemId: string,
  variants: ContentStudioVariantInput[],
) {
  return variants.map((variant) => ({
    organisationId: scope.organisationId,
    projectId: scope.projectId,
    brandId: scope.brandId,
    contentItemId,
    marketingChannel: variant.marketingChannel,
    format: variant.format ?? "TEXT_POST",
    channelBody: variant.channelBody || null,
    caption: variant.caption || null,
    headline: variant.headline || null,
    description: variant.description || null,
    destinationUrl: variant.destinationUrl || null,
    altText: variant.altText || null,
    status: "DRAFT" as const,
  }));
}

async function createContentVersion(input: {
  scope: BrandScope;
  contentItemId: string;
  versionNumber: number;
  snapshot: Record<string, unknown>;
  createdByUserId: string;
  changeSummary?: string;
}) {
  return prisma.contentVersion.create({
    data: {
      organisationId: input.scope.organisationId,
      projectId: input.scope.projectId,
      brandId: input.scope.brandId,
      contentItemId: input.contentItemId,
      versionNumber: input.versionNumber,
      snapshot: input.snapshot as Prisma.InputJsonValue,
      changeSummary: input.changeSummary,
      createdByUserId: input.createdByUserId,
    },
  });
}

async function recordActivity(input: {
  scope: BrandScope;
  contentItemId: string;
  activityType: import("@prisma/client").ContentActivityType;
  actorUserId: string;
  summary: string;
  campaignId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await prisma.contentActivity.create({
    data: {
      organisationId: input.scope.organisationId,
      projectId: input.scope.projectId,
      brandId: input.scope.brandId,
      contentItemId: input.contentItemId,
      campaignId: input.campaignId ?? null,
      activityType: input.activityType,
      actorUserId: input.actorUserId,
      summary: input.summary,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    },
  });
}

async function persistBrandComplianceChecks(
  scope: BrandScope,
  contentItemId: string,
  item: Awaited<ReturnType<typeof getStudioItemOrThrow>>,
): Promise<BrandKnowledgeComplianceFinding[]> {
  const brandContext = await loadBrandContext(scope);
  const findings = runBrandKnowledgeComplianceChecks({
    title: item.title,
    studioObjective: item.studioObjective,
    audienceSummary: item.audienceSummary,
    contentBody: item.contentBody,
    primaryMessage: item.primaryMessage,
    primaryCTA: item.primaryCTA,
    contentCampaignId: item.contentCampaignId,
    primaryChannel: item.primaryChannel,
    variants: item.variants.map((v) => ({
      id: v.id,
      marketingChannel: v.marketingChannel,
      channelBody: v.channelBody,
      caption: v.caption,
    })),
    assets: item.assets.map((a) => ({
      id: a.marketingAssetId,
      approvedForMarketing: a.marketingAsset.approvedForMarketing,
    })),
    knowledgeReferences: item.knowledgeReferences.map((r) => ({
      referenceType: r.referenceType,
      label: r.label,
    })),
    brandContext,
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

async function transitionStudioStatus(input: {
  scope: BrandScope;
  contentItemId: string;
  fromStatus: ContentStatus;
  toStatus: ContentStatus;
  changedByUserId: string;
  reason?: string;
  extraData?: Prisma.ContentItemUpdateInput;
}) {
  assertStudioStatusTransition(input.fromStatus, input.toStatus);
  assertContentStatusTransition(input.fromStatus, input.toStatus);

  await prisma.$transaction([
    prisma.contentItem.update({
      where: { id: input.contentItemId },
      data: { status: input.toStatus, ...(input.extraData ?? {}) },
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

export const contentStudioService = {
  async list(
    brandId: string,
    organisationId: string,
    context: TenantContext,
    filters?: {
      status?: ContentStatus;
      studioType?: ContentStudioType;
      ownerUserId?: string;
      campaignId?: string;
      search?: string;
    },
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const items = await prisma.contentItem.findMany({
      where: {
        organisationId: scope.organisationId,
        brandId: scope.brandId,
        archivedAt: null,
        studioType: { not: null },
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.studioType ? { studioType: filters.studioType } : {}),
        ...(filters?.ownerUserId ? { ownerUserId: filters.ownerUserId } : {}),
        ...(filters?.campaignId ? { contentCampaignId: filters.campaignId } : {}),
        ...(filters?.search
          ? {
              OR: [
                { title: { contains: filters.search, mode: "insensitive" } },
                { contentBody: { contains: filters.search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: { variants: true },
      orderBy: { updatedAt: "desc" },
    });

    return items.map((item) => ({
      id: item.id,
      title: item.title,
      studioType: item.studioType,
      status: item.status,
      version: item.version,
      contentCampaignId: item.contentCampaignId,
      primaryChannel: item.primaryChannel,
      dueAt: item.dueAt?.toISOString() ?? null,
      scheduledFor: item.scheduledFor?.toISOString() ?? null,
      updatedAt: item.updatedAt.toISOString(),
      variants: item.variants.map((v) => ({
        id: v.id,
        marketingChannel: v.marketingChannel,
      })),
    }));
  },

  async getById(
    brandId: string,
    organisationId: string,
    contentId: string,
    context: TenantContext,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const item = await getStudioItemOrThrow(scope, contentId);
    return toPublicStudioItem(item);
  },

  async create(
    brandId: string,
    organisationId: string,
    input: ContentStudioCreateInput,
    context: TenantContext,
    requestId?: string,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);

    let templateData: Partial<ContentStudioCreateInput> = {};
    if (input.templateId) {
      const template = await prisma.contentTemplate.findFirst({
        where: {
          id: input.templateId,
          brandId: scope.brandId,
          organisationId: scope.organisationId,
          archivedAt: null,
          isActive: true,
        },
      });
      if (!template) {
        throw new AppError("NOT_FOUND", "Content template was not found.");
      }
      templateData = {
        title: template.titleTemplate ?? input.title,
        studioObjective: template.objectiveTemplate ?? undefined,
        audienceSummary: template.audienceSummaryTemplate ?? undefined,
        contentBody: template.contentBodyTemplate ?? undefined,
        primaryCTA: template.callToActionTemplate ?? undefined,
        primaryChannel: template.primaryChannel ?? undefined,
      };
    }

    const merged = { ...templateData, ...input };
    const contentType = STUDIO_TYPE_TO_CONTENT_TYPE[merged.studioType];

    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.contentItem.create({
        data: {
          organisationId: scope.organisationId,
          projectId: scope.projectId,
          brandId: scope.brandId,
          title: merged.title,
          studioType: merged.studioType,
          contentType,
          contentCampaignId: merged.contentCampaignId ?? null,
          studioObjective: merged.studioObjective || null,
          audienceSummary: merged.audienceSummary || null,
          contentBody: merged.contentBody || null,
          primaryMessage: merged.contentBody || null,
          primaryCTA: merged.primaryCTA || null,
          primaryChannel: merged.primaryChannel ?? null,
          dueAt: merged.dueAt ? new Date(merged.dueAt) : null,
          scheduledFor: merged.scheduledFor ? new Date(merged.scheduledFor) : null,
          timezone: merged.timezone || null,
          status: "IDEA",
          version: 1,
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

      if (merged.variants?.length) {
        await tx.contentVariant.createMany({
          data: buildStudioVariantRows(scope, created.id, merged.variants),
        });
      }

      if (merged.assetIds?.length) {
        await tx.contentAsset.createMany({
          data: merged.assetIds.map((marketingAssetId, index) => ({
            organisationId: scope.organisationId,
            projectId: scope.projectId,
            brandId: scope.brandId,
            contentItemId: created.id,
            marketingAssetId,
            sortOrder: index,
          })),
        });
      }

      if (merged.knowledgeReferences?.length) {
        await tx.contentKnowledgeReference.createMany({
          data: merged.knowledgeReferences.map((ref) => ({
            organisationId: scope.organisationId,
            projectId: scope.projectId,
            brandId: scope.brandId,
            contentItemId: created.id,
            referenceType: ref.referenceType,
            referenceId: ref.referenceId ?? null,
            label: ref.label,
            excerpt: ref.excerpt || null,
            createdByUserId: context.userProfileId,
          })),
        });
      }

      return created;
    });

    await createContentVersion({
      scope,
      contentItemId: item.id,
      versionNumber: 1,
      snapshot: { title: item.title, status: item.status, studioType: item.studioType },
      createdByUserId: context.userProfileId,
      changeSummary: "Initial creation",
    });

    await recordActivity({
      scope,
      contentItemId: item.id,
      activityType: input.templateId ? "TEMPLATE_APPLIED" : "STATUS_TRANSITION",
      actorUserId: context.userProfileId,
      summary: input.templateId ? "Content created from template" : "Content created",
      campaignId: item.contentCampaignId,
    });

    await recordAuditEvent({
      organisationId: scope.organisationId,
      projectId: scope.projectId,
      actorUserId: context.userProfileId,
      action: "contentStudio.created",
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
    input: ContentStudioUpdateInput,
    context: TenantContext,
    requestId?: string,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const existing = await getStudioItemOrThrow(scope, contentId);

    if (!isStudioEditableStatus(existing.status)) {
      throw new AppError("VALIDATION_ERROR", "Content cannot be edited in its current status.");
    }

    if (input.expectedVersion !== undefined && input.expectedVersion !== existing.version) {
      throw new AppError(
        "CONFLICT",
        `Version conflict: expected ${input.expectedVersion}, current is ${existing.version}.`,
      );
    }

    const nextVersion = existing.version + 1;
    const allowedFields: Prisma.ContentItemUpdateInput = { version: nextVersion };

    if (input.title !== undefined) allowedFields.title = input.title;
    if (input.studioType !== undefined) {
      allowedFields.studioType = input.studioType;
      allowedFields.contentType = STUDIO_TYPE_TO_CONTENT_TYPE[input.studioType];
    }
    if (input.contentCampaignId !== undefined) {
      allowedFields.contentCampaign = input.contentCampaignId
        ? { connect: { id: input.contentCampaignId } }
        : { disconnect: true };
    }
    if (input.studioObjective !== undefined) allowedFields.studioObjective = input.studioObjective || null;
    if (input.audienceSummary !== undefined) allowedFields.audienceSummary = input.audienceSummary || null;
    if (input.contentBody !== undefined) {
      allowedFields.contentBody = input.contentBody || null;
      allowedFields.primaryMessage = input.contentBody || null;
    }
    if (input.primaryCTA !== undefined) allowedFields.primaryCTA = input.primaryCTA || null;
    if (input.primaryChannel !== undefined) allowedFields.primaryChannel = input.primaryChannel ?? null;
    if (input.dueAt !== undefined) allowedFields.dueAt = input.dueAt ? new Date(input.dueAt) : null;
    if (input.scheduledFor !== undefined) {
      allowedFields.scheduledFor = input.scheduledFor ? new Date(input.scheduledFor) : null;
    }
    if (input.timezone !== undefined) allowedFields.timezone = input.timezone || null;
    if (input.ownerUserId !== undefined) {
      allowedFields.owner = { connect: { id: input.ownerUserId } };
    }

    await prisma.$transaction(async (tx) => {
      await tx.contentItem.update({ where: { id: contentId }, data: allowedFields });

      if (input.variants) {
        await tx.contentVariant.deleteMany({
          where: { contentItemId: contentId, marketingChannel: { not: null } },
        });
        if (input.variants.length > 0) {
          await tx.contentVariant.createMany({
            data: buildStudioVariantRows(scope, contentId, input.variants),
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

      if (input.knowledgeReferences) {
        await tx.contentKnowledgeReference.deleteMany({ where: { contentItemId: contentId } });
        if (input.knowledgeReferences.length > 0) {
          await tx.contentKnowledgeReference.createMany({
            data: input.knowledgeReferences.map((ref) => ({
              organisationId: scope.organisationId,
              projectId: scope.projectId,
              brandId: scope.brandId,
              contentItemId: contentId,
              referenceType: ref.referenceType,
              referenceId: ref.referenceId ?? null,
              label: ref.label,
              excerpt: ref.excerpt || null,
              createdByUserId: context.userProfileId,
            })),
          });
        }
      }
    });

    const updated = await getStudioItemOrThrow(scope, contentId);
    await createContentVersion({
      scope,
      contentItemId: contentId,
      versionNumber: nextVersion,
      snapshot: toPublicStudioItem(updated) as unknown as Record<string, unknown>,
      createdByUserId: context.userProfileId,
      changeSummary: "Content updated",
    });

    await persistBrandComplianceChecks(scope, contentId, updated);
    await recordActivity({
      scope,
      contentItemId: contentId,
      activityType: "VERSION_CREATED",
      actorUserId: context.userProfileId,
      summary: `Version ${nextVersion} saved`,
      campaignId: updated.contentCampaignId,
    });

    await recordAuditEvent({
      organisationId: scope.organisationId,
      projectId: scope.projectId,
      actorUserId: context.userProfileId,
      action: "contentStudio.updated",
      resourceType: "contentItem",
      resourceId: contentId,
      requestId,
    });

    return toPublicStudioItem(updated);
  },

  async transition(
    brandId: string,
    organisationId: string,
    contentId: string,
    toStatus: ContentStatus,
    context: TenantContext,
    reason?: string,
    requestId?: string,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const item = await getStudioItemOrThrow(scope, contentId);

    if (toStatus === "SCHEDULED" && !item.scheduledFor) {
      throw new AppError("VALIDATION_ERROR", "Scheduled date is required before scheduling.");
    }

    if (toStatus === "IN_REVIEW") {
      const findings = await persistBrandComplianceChecks(scope, contentId, item);
      await recordActivity({
        scope,
        contentItemId: contentId,
        activityType: "COMPLIANCE_CHECKED",
        actorUserId: context.userProfileId,
        summary: `Compliance check: ${findings.length} finding(s)`,
        campaignId: item.contentCampaignId,
        metadata: { findingCount: findings.length },
      });
    }

    await transitionStudioStatus({
      scope,
      contentItemId: contentId,
      fromStatus: item.status,
      toStatus,
      changedByUserId: context.userProfileId,
      reason,
    });

    await recordActivity({
      scope,
      contentItemId: contentId,
      activityType: "STATUS_TRANSITION",
      actorUserId: context.userProfileId,
      summary: `Status changed from ${item.status} to ${toStatus}`,
      campaignId: item.contentCampaignId,
    });

    await recordAuditEvent({
      organisationId: scope.organisationId,
      projectId: scope.projectId,
      actorUserId: context.userProfileId,
      action: "contentStudio.transition",
      resourceType: "contentItem",
      resourceId: contentId,
      requestId,
    });

    return this.getById(brandId, organisationId, contentId, context);
  },

  async submitForReview(
    brandId: string,
    organisationId: string,
    contentId: string,
    context: TenantContext,
    requestId?: string,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const item = await getStudioItemOrThrow(scope, contentId);

    await prisma.contentReview.create({
      data: {
        organisationId: scope.organisationId,
        projectId: scope.projectId,
        brandId: scope.brandId,
        contentItemId: contentId,
        contentVersion: item.version,
        requestedByUserId: context.userProfileId,
        status: "PENDING",
      },
    });

    await recordActivity({
      scope,
      contentItemId: contentId,
      activityType: "REVIEW_SUBMITTED",
      actorUserId: context.userProfileId,
      summary: "Submitted for review",
      campaignId: item.contentCampaignId,
    });

    return this.transition(brandId, organisationId, contentId, "IN_REVIEW", context, undefined, requestId);
  },

  async approveReview(
    brandId: string,
    organisationId: string,
    contentId: string,
    context: TenantContext,
    feedback?: string,
    requestId?: string,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const item = await getStudioItemOrThrow(scope, contentId);
    const settings = await getWorkflowSettings(scope.organisationId);

    assertCanApproveContent({
      settings,
      approverUserId: context.userProfileId,
      createdByUserId: item.createdByUserId,
      ownerUserId: item.ownerUserId,
    });

    await prisma.contentReview.updateMany({
      where: { contentItemId: contentId, status: "PENDING" },
      data: {
        status: "APPROVED",
        reviewerUserId: context.userProfileId,
        feedback: feedback ?? null,
        decidedAt: new Date(),
      },
    });

    await transitionStudioStatus({
      scope,
      contentItemId: contentId,
      fromStatus: item.status,
      toStatus: "APPROVED",
      changedByUserId: context.userProfileId,
      extraData: {
        approvedBy: { connect: { id: context.userProfileId } },
        approvedAt: new Date(),
      },
    });

    await recordActivity({
      scope,
      contentItemId: contentId,
      activityType: "APPROVAL",
      actorUserId: context.userProfileId,
      summary: "Content approved",
      campaignId: item.contentCampaignId,
    });

    await recordAuditEvent({
      organisationId: scope.organisationId,
      projectId: scope.projectId,
      actorUserId: context.userProfileId,
      action: "contentStudio.approved",
      resourceType: "contentItem",
      resourceId: contentId,
      requestId,
    });

    return this.getById(brandId, organisationId, contentId, context);
  },

  async requestChanges(
    brandId: string,
    organisationId: string,
    contentId: string,
    feedback: string,
    context: TenantContext,
    requestId?: string,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const item = await getStudioItemOrThrow(scope, contentId);

    await prisma.contentReview.updateMany({
      where: { contentItemId: contentId, status: "PENDING" },
      data: {
        status: "CHANGES_REQUESTED",
        reviewerUserId: context.userProfileId,
        feedback,
        decidedAt: new Date(),
      },
    });

    await transitionStudioStatus({
      scope,
      contentItemId: contentId,
      fromStatus: item.status,
      toStatus: "CHANGES_REQUESTED",
      changedByUserId: context.userProfileId,
      reason: feedback,
    });

    await recordAuditEvent({
      organisationId: scope.organisationId,
      projectId: scope.projectId,
      actorUserId: context.userProfileId,
      action: "contentStudio.changesRequested",
      resourceType: "contentItem",
      resourceId: contentId,
      requestId,
    });

    return this.getById(brandId, organisationId, contentId, context);
  },

  async runCompliance(
    brandId: string,
    organisationId: string,
    contentId: string,
    context: TenantContext,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const item = await getStudioItemOrThrow(scope, contentId);
    const findings = await persistBrandComplianceChecks(scope, contentId, item);
    return { findings };
  },

  async archive(
    brandId: string,
    organisationId: string,
    contentId: string,
    context: TenantContext,
    requestId?: string,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const item = await getStudioItemOrThrow(scope, contentId);

    await prisma.contentItem.update({
      where: { id: contentId },
      data: { archivedAt: new Date(), status: "ARCHIVED" },
    });

    await recordActivity({
      scope,
      contentItemId: contentId,
      activityType: "STATUS_TRANSITION",
      actorUserId: context.userProfileId,
      summary: "Content archived",
      campaignId: item.contentCampaignId,
    });

    await recordAuditEvent({
      organisationId: scope.organisationId,
      projectId: scope.projectId,
      actorUserId: context.userProfileId,
      action: "contentStudio.archived",
      resourceType: "contentItem",
      resourceId: contentId,
      requestId,
    });

    return { id: contentId, archived: true };
  },

  async listTemplates(brandId: string, organisationId: string, context: TenantContext) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const templates = await prisma.contentTemplate.findMany({
      where: {
        organisationId: scope.organisationId,
        brandId: scope.brandId,
        archivedAt: null,
        isActive: true,
      },
      orderBy: { name: "asc" },
    });
    return templates;
  },

  async createTemplate(
    brandId: string,
    organisationId: string,
    input: ContentStudioTemplateCreateInput,
    context: TenantContext,
    requestId?: string,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const template = await prisma.contentTemplate.create({
      data: {
        organisationId: scope.organisationId,
        projectId: scope.projectId,
        brandId: scope.brandId,
        name: input.name,
        studioType: input.studioType,
        primaryChannel: input.primaryChannel ?? null,
        titleTemplate: input.titleTemplate || null,
        objectiveTemplate: input.objectiveTemplate || null,
        audienceSummaryTemplate: input.audienceSummaryTemplate || null,
        contentBodyTemplate: input.contentBodyTemplate || null,
        callToActionTemplate: input.callToActionTemplate || null,
        variantTemplates: input.variantTemplates as Prisma.InputJsonValue | undefined,
        createdByUserId: context.userProfileId,
      },
    });

    await recordAuditEvent({
      organisationId: scope.organisationId,
      projectId: scope.projectId,
      actorUserId: context.userProfileId,
      action: "contentStudio.templateCreated",
      resourceType: "contentTemplate",
      resourceId: template.id,
      requestId,
    });

    return template;
  },

  async addKnowledgeReference(
    brandId: string,
    organisationId: string,
    contentId: string,
    input: ContentStudioKnowledgeRefInput,
    context: TenantContext,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    await getStudioItemOrThrow(scope, contentId);

    return prisma.contentKnowledgeReference.create({
      data: {
        organisationId: scope.organisationId,
        projectId: scope.projectId,
        brandId: scope.brandId,
        contentItemId: contentId,
        referenceType: input.referenceType,
        referenceId: input.referenceId ?? null,
        label: input.label,
        excerpt: input.excerpt || null,
        createdByUserId: context.userProfileId,
      },
    });
  },

  async getVersionHistory(
    brandId: string,
    organisationId: string,
    contentId: string,
    context: TenantContext,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    await getStudioItemOrThrow(scope, contentId);

    return prisma.contentVersion.findMany({
      where: { contentItemId: contentId, organisationId: scope.organisationId },
      orderBy: { versionNumber: "desc" },
    });
  },
};
