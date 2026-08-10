import {
  KnowledgeActivityAction,
  KnowledgeBaseStatus,
  KnowledgeDocumentStatus,
  KnowledgeEntryStatus,
  KnowledgeEntryType,
  Prisma,
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { KNOWLEDGE_DEFAULT_BASE_NAME } from "@/lib/knowledge-base/constants";
import {
  buildKnowledgeDocumentStorageKey,
  processKnowledgeDocumentUpload,
} from "@/lib/knowledge-base/file-processing";
import type {
  KnowledgeRetrievalRequest,
  KnowledgeRetrievalResponse,
} from "@/lib/knowledge-base/retrieval";
import { KNOWLEDGE_DOCUMENT_SIGNED_URL_TTL_SECONDS } from "@/lib/knowledge-base/constants";
import type {
  KnowledgeBaseCreateInput,
  KnowledgeBaseUpdateInput,
  KnowledgeDocumentUpdateInput,
  KnowledgeEntryCreateInput,
  KnowledgeEntryListQuery,
  KnowledgeEntryUpdateInput,
  KnowledgeRelationshipCreateInput,
  KnowledgeTagCreateInput,
} from "@/lib/validation/knowledge-base";
import { createObjectStorageProvider } from "@/lib/storage/supabase-storage-provider";
import type { TenantContext } from "@/lib/tenancy/context";
import { recordAuditEvent } from "@/server/services/audit-service";
import { brandService } from "@/server/services/workspace-service";

type BrandScope = {
  organisationId: string;
  projectId: string;
  brandId: string;
};

const ACTIVE_ONLY = { archivedAt: null } as const;

async function resolveBrandScope(
  brandId: string,
  organisationId: string,
  context: TenantContext,
): Promise<BrandScope> {
  const brand = await brandService.getById(brandId, organisationId, context);
  return { organisationId, projectId: brand.projectId, brandId };
}

async function getKnowledgeBaseForBrand(
  knowledgeBaseId: string,
  scope: BrandScope,
  includeArchived = false,
) {
  const knowledgeBase = await prisma.knowledgeBase.findFirst({
    where: {
      id: knowledgeBaseId,
      organisationId: scope.organisationId,
      brandId: scope.brandId,
      ...(includeArchived ? {} : { status: KnowledgeBaseStatus.ACTIVE }),
    },
  });

  if (!knowledgeBase) {
    throw new AppError("NOT_FOUND", "Knowledge base was not found.");
  }

  return knowledgeBase;
}

async function getEntryForBase(entryId: string, knowledgeBaseId: string, scope: BrandScope) {
  const entry = await prisma.knowledgeEntry.findFirst({
    where: {
      id: entryId,
      knowledgeBaseId,
      organisationId: scope.organisationId,
      brandId: scope.brandId,
    },
    include: {
      createdBy: { select: { id: true, displayName: true, email: true } },
      approvedBy: { select: { id: true, displayName: true, email: true } },
      entryTags: { include: { tag: true } },
    },
  });

  if (!entry) {
    throw new AppError("NOT_FOUND", "Knowledge entry was not found.");
  }

  return entry;
}

async function assertCampaignBelongsToBrand(
  campaignId: string | null | undefined,
  scope: BrandScope,
): Promise<void> {
  if (!campaignId) return;

  const campaign = await prisma.contentCampaign.findFirst({
    where: {
      id: campaignId,
      organisationId: scope.organisationId,
      brandId: scope.brandId,
      archivedAt: null,
    },
    select: { id: true },
  });

  if (!campaign) {
    throw new AppError("VALIDATION_ERROR", "Campaign was not found for this brand.");
  }
}

async function recordKnowledgeActivity(
  scope: BrandScope,
  knowledgeBaseId: string,
  actorUserId: string,
  action: KnowledgeActivityAction,
  options?: { entryId?: string; documentId?: string; metadata?: Record<string, unknown> },
): Promise<void> {
  await prisma.knowledgeActivity.create({
    data: {
      organisationId: scope.organisationId,
      knowledgeBaseId,
      entryId: options?.entryId,
      documentId: options?.documentId,
      actorUserId,
      action,
      metadata: options?.metadata as Prisma.InputJsonValue | undefined,
    },
  });
}

async function auditKnowledge(
  scope: BrandScope,
  context: TenantContext,
  action: string,
  resourceType: string,
  resourceId: string,
  requestId?: string,
): Promise<void> {
  await recordAuditEvent({
    organisationId: scope.organisationId,
    projectId: scope.projectId,
    actorUserId: context.userProfileId,
    action,
    resourceType,
    resourceId,
    requestId,
  });
}

function isCurrentlyValid(validFrom: Date | null, validUntil: Date | null, now = new Date()): boolean {
  if (validFrom && validFrom > now) return false;
  if (validUntil && validUntil < now) return false;
  return true;
}

function computeRelevanceScore(query: string, title: string, summary: string | null, content: string): number {
  const normalisedQuery = query.toLowerCase().trim();
  if (!normalisedQuery) return 0;

  const titleLower = title.toLowerCase();
  const summaryLower = (summary ?? "").toLowerCase();
  const contentLower = content.toLowerCase();

  let score = 0;
  if (titleLower === normalisedQuery) score += 100;
  else if (titleLower.includes(normalisedQuery)) score += 50;

  if (summaryLower.includes(normalisedQuery)) score += 25;
  if (contentLower.includes(normalisedQuery)) score += 10;

  const queryTerms = normalisedQuery.split(/\s+/).filter(Boolean);
  for (const term of queryTerms) {
    if (titleLower.includes(term)) score += 5;
    if (contentLower.includes(term)) score += 2;
  }

  return score;
}

export const knowledgeBaseService = {
  async ensureDefaultForBrand(brandId: string, organisationId: string, context: TenantContext) {
    const scope = await resolveBrandScope(brandId, organisationId, context);

    const existing = await prisma.knowledgeBase.findFirst({
      where: {
        organisationId: scope.organisationId,
        brandId: scope.brandId,
        status: KnowledgeBaseStatus.ACTIVE,
      },
    });

    if (existing) return existing;

    return prisma.knowledgeBase.create({
      data: {
        organisationId: scope.organisationId,
        projectId: scope.projectId,
        brandId: scope.brandId,
        name: KNOWLEDGE_DEFAULT_BASE_NAME,
        description: "Canonical approved knowledge for AI and content modules.",
      },
    });
  },

  bases: {
    async list(brandId: string, organisationId: string, context: TenantContext) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      return prisma.knowledgeBase.findMany({
        where: {
          organisationId: scope.organisationId,
          brandId: scope.brandId,
          status: KnowledgeBaseStatus.ACTIVE,
        },
        include: {
          _count: { select: { entries: true, documents: true } },
        },
        orderBy: { createdAt: "asc" },
      });
    },

    async create(
      brandId: string,
      organisationId: string,
      input: KnowledgeBaseCreateInput,
      context: TenantContext,
      requestId?: string,
    ) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      const knowledgeBase = await prisma.knowledgeBase.create({
        data: {
          organisationId: scope.organisationId,
          projectId: scope.projectId,
          brandId: scope.brandId,
          name: input.name,
          description: input.description ?? null,
        },
      });

      await auditKnowledge(scope, context, "knowledgeBase.created", "KnowledgeBase", knowledgeBase.id, requestId);
      return knowledgeBase;
    },

    async update(
      brandId: string,
      organisationId: string,
      knowledgeBaseId: string,
      input: KnowledgeBaseUpdateInput,
      context: TenantContext,
      requestId?: string,
    ) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      await getKnowledgeBaseForBrand(knowledgeBaseId, scope);

      const knowledgeBase = await prisma.knowledgeBase.update({
        where: { id: knowledgeBaseId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description ?? null } : {}),
        },
      });

      await auditKnowledge(scope, context, "knowledgeBase.updated", "KnowledgeBase", knowledgeBase.id, requestId);
      return knowledgeBase;
    },

    async archive(
      brandId: string,
      organisationId: string,
      knowledgeBaseId: string,
      context: TenantContext,
      requestId?: string,
    ) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      await getKnowledgeBaseForBrand(knowledgeBaseId, scope);

      const knowledgeBase = await prisma.knowledgeBase.update({
        where: { id: knowledgeBaseId },
        data: { status: KnowledgeBaseStatus.ARCHIVED },
      });

      await auditKnowledge(scope, context, "knowledgeBase.archived", "KnowledgeBase", knowledgeBase.id, requestId);
      return knowledgeBase;
    },
  },

  entries: {
    async list(
      brandId: string,
      organisationId: string,
      knowledgeBaseId: string,
      context: TenantContext,
      query?: Partial<KnowledgeEntryListQuery>,
    ) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      await getKnowledgeBaseForBrand(knowledgeBaseId, scope);
      const filters = query ?? {};

      return prisma.knowledgeEntry.findMany({
        where: {
          knowledgeBaseId,
          organisationId: scope.organisationId,
          brandId: scope.brandId,
          ...(filters.includeArchived ? {} : ACTIVE_ONLY),
          ...(filters.status ? { status: filters.status } : {}),
          ...(filters.type ? { type: filters.type } : {}),
          ...(filters.sourceType ? { sourceType: filters.sourceType } : {}),
          ...(filters.campaignId ? { campaignId: filters.campaignId } : {}),
          ...(filters.tagId
            ? { entryTags: { some: { tagId: filters.tagId } } }
            : {}),
          ...(filters.search
            ? {
                OR: [
                  { title: { contains: filters.search, mode: "insensitive" } },
                  { summary: { contains: filters.search, mode: "insensitive" } },
                  { content: { contains: filters.search, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        include: {
          createdBy: { select: { id: true, displayName: true, email: true } },
          approvedBy: { select: { id: true, displayName: true, email: true } },
          entryTags: { include: { tag: true } },
        },
        orderBy: [{ updatedAt: "desc" }],
      });
    },

    async getById(
      brandId: string,
      organisationId: string,
      knowledgeBaseId: string,
      entryId: string,
      context: TenantContext,
    ) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      await getKnowledgeBaseForBrand(knowledgeBaseId, scope);
      return getEntryForBase(entryId, knowledgeBaseId, scope);
    },

    async create(
      brandId: string,
      organisationId: string,
      knowledgeBaseId: string,
      input: KnowledgeEntryCreateInput,
      context: TenantContext,
      requestId?: string,
    ) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      await getKnowledgeBaseForBrand(knowledgeBaseId, scope);
      await assertCampaignBelongsToBrand(input.campaignId, scope);

      const entry = await prisma.knowledgeEntry.create({
        data: {
          knowledgeBaseId,
          organisationId: scope.organisationId,
          projectId: scope.projectId,
          brandId: scope.brandId,
          campaignId: input.campaignId ?? null,
          type: input.type,
          title: input.title,
          summary: input.summary ?? null,
          content: input.content,
          sourceType: input.sourceType ?? "MANUAL",
          sourceReference: input.sourceReference ?? null,
          confidence: input.confidence ?? null,
          validFrom: input.validFrom ?? null,
          validUntil: input.validUntil ?? null,
          createdByUserId: context.userProfileId,
          entryTags: input.tagIds?.length
            ? {
                create: input.tagIds.map((tagId) => ({ tagId })),
              }
            : undefined,
        },
        include: {
          createdBy: { select: { id: true, displayName: true, email: true } },
          entryTags: { include: { tag: true } },
        },
      });

      await prisma.knowledgeEntryVersion.create({
        data: {
          entryId: entry.id,
          organisationId: scope.organisationId,
          version: 1,
          title: entry.title,
          summary: entry.summary,
          content: entry.content,
          type: entry.type,
          status: entry.status,
          validFrom: entry.validFrom,
          validUntil: entry.validUntil,
          changedByUserId: context.userProfileId,
          changeNote: "Initial version",
        },
      });

      await recordKnowledgeActivity(scope, knowledgeBaseId, context.userProfileId, "CREATED", {
        entryId: entry.id,
      });
      await auditKnowledge(scope, context, "knowledgeEntry.created", "KnowledgeEntry", entry.id, requestId);
      return entry;
    },

    async update(
      brandId: string,
      organisationId: string,
      knowledgeBaseId: string,
      entryId: string,
      input: KnowledgeEntryUpdateInput,
      context: TenantContext,
      requestId?: string,
    ) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      await getKnowledgeBaseForBrand(knowledgeBaseId, scope);
      const existing = await getEntryForBase(entryId, knowledgeBaseId, scope);

      if (existing.status === KnowledgeEntryStatus.ARCHIVED) {
        throw new AppError("VALIDATION_ERROR", "Archived entries cannot be edited. Restore first.");
      }

      if (existing.version !== input.expectedVersion) {
        throw new AppError(
          "CONFLICT",
          `Version conflict: expected version ${input.expectedVersion} but current is ${existing.version}.`,
        );
      }

      if (input.campaignId !== undefined) {
        await assertCampaignBelongsToBrand(input.campaignId, scope);
      }

      const nextVersion = existing.version + 1;
      const updated = await prisma.$transaction(async (tx) => {
        const entry = await tx.knowledgeEntry.update({
          where: { id: entryId },
          data: {
            ...(input.type !== undefined ? { type: input.type } : {}),
            ...(input.title !== undefined ? { title: input.title } : {}),
            ...(input.summary !== undefined ? { summary: input.summary ?? null } : {}),
            ...(input.content !== undefined ? { content: input.content } : {}),
            ...(input.sourceType !== undefined ? { sourceType: input.sourceType } : {}),
            ...(input.sourceReference !== undefined ? { sourceReference: input.sourceReference ?? null } : {}),
            ...(input.confidence !== undefined ? { confidence: input.confidence ?? null } : {}),
            ...(input.validFrom !== undefined ? { validFrom: input.validFrom } : {}),
            ...(input.validUntil !== undefined ? { validUntil: input.validUntil } : {}),
            ...(input.campaignId !== undefined ? { campaignId: input.campaignId } : {}),
            version: nextVersion,
            status:
              existing.status === KnowledgeEntryStatus.APPROVED
                ? KnowledgeEntryStatus.DRAFT
                : existing.status,
            approvedByUserId: null,
            approvedAt: null,
          },
          include: {
            createdBy: { select: { id: true, displayName: true, email: true } },
            entryTags: { include: { tag: true } },
          },
        });

        await tx.knowledgeEntryVersion.create({
          data: {
            entryId: entry.id,
            organisationId: scope.organisationId,
            version: nextVersion,
            title: entry.title,
            summary: entry.summary,
            content: entry.content,
            type: entry.type,
            status: entry.status,
            validFrom: entry.validFrom,
            validUntil: entry.validUntil,
            changedByUserId: context.userProfileId,
            changeNote: input.changeNote ?? null,
          },
        });

        return entry;
      });

      await recordKnowledgeActivity(scope, knowledgeBaseId, context.userProfileId, "VERSION_CREATED", {
        entryId,
        metadata: { version: nextVersion },
      });
      await auditKnowledge(scope, context, "knowledgeEntry.updated", "KnowledgeEntry", entryId, requestId);
      return updated;
    },

    async submitForReview(
      brandId: string,
      organisationId: string,
      knowledgeBaseId: string,
      entryId: string,
      context: TenantContext,
      requestId?: string,
    ) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      await getKnowledgeBaseForBrand(knowledgeBaseId, scope);
      const existing = await getEntryForBase(entryId, knowledgeBaseId, scope);

      if (![KnowledgeEntryStatus.DRAFT, KnowledgeEntryStatus.REJECTED].includes(existing.status)) {
        throw new AppError("VALIDATION_ERROR", "Only draft or rejected entries can be submitted for review.");
      }

      const entry = await prisma.knowledgeEntry.update({
        where: { id: entryId },
        data: { status: KnowledgeEntryStatus.IN_REVIEW },
      });

      await recordKnowledgeActivity(scope, knowledgeBaseId, context.userProfileId, "SUBMITTED_FOR_REVIEW", {
        entryId,
      });
      await auditKnowledge(scope, context, "knowledgeEntry.submitted", "KnowledgeEntry", entryId, requestId);
      return entry;
    },

    async approve(
      brandId: string,
      organisationId: string,
      knowledgeBaseId: string,
      entryId: string,
      context: TenantContext,
      requestId?: string,
      note?: string,
    ) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      await getKnowledgeBaseForBrand(knowledgeBaseId, scope);
      const existing = await getEntryForBase(entryId, knowledgeBaseId, scope);

      if (existing.status !== KnowledgeEntryStatus.IN_REVIEW) {
        throw new AppError("VALIDATION_ERROR", "Only entries in review can be approved.");
      }

      const entry = await prisma.knowledgeEntry.update({
        where: { id: entryId },
        data: {
          status: KnowledgeEntryStatus.APPROVED,
          approvedByUserId: context.userProfileId,
          approvedAt: new Date(),
        },
      });

      await recordKnowledgeActivity(scope, knowledgeBaseId, context.userProfileId, "APPROVED", {
        entryId,
        metadata: note ? { note } : undefined,
      });
      await auditKnowledge(scope, context, "knowledgeEntry.approved", "KnowledgeEntry", entryId, requestId);
      return entry;
    },

    async reject(
      brandId: string,
      organisationId: string,
      knowledgeBaseId: string,
      entryId: string,
      reason: string,
      context: TenantContext,
      requestId?: string,
    ) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      await getKnowledgeBaseForBrand(knowledgeBaseId, scope);
      const existing = await getEntryForBase(entryId, knowledgeBaseId, scope);

      if (existing.status !== KnowledgeEntryStatus.IN_REVIEW) {
        throw new AppError("VALIDATION_ERROR", "Only entries in review can be rejected.");
      }

      const entry = await prisma.knowledgeEntry.update({
        where: { id: entryId },
        data: {
          status: KnowledgeEntryStatus.REJECTED,
          approvedByUserId: null,
          approvedAt: null,
        },
      });

      await recordKnowledgeActivity(scope, knowledgeBaseId, context.userProfileId, "REJECTED", {
        entryId,
        metadata: { reason },
      });
      await auditKnowledge(scope, context, "knowledgeEntry.rejected", "KnowledgeEntry", entryId, requestId);
      return entry;
    },

    async archive(
      brandId: string,
      organisationId: string,
      knowledgeBaseId: string,
      entryId: string,
      context: TenantContext,
      requestId?: string,
    ) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      await getKnowledgeBaseForBrand(knowledgeBaseId, scope);
      await getEntryForBase(entryId, knowledgeBaseId, scope);

      const entry = await prisma.knowledgeEntry.update({
        where: { id: entryId },
        data: {
          status: KnowledgeEntryStatus.ARCHIVED,
          archivedAt: new Date(),
        },
      });

      await recordKnowledgeActivity(scope, knowledgeBaseId, context.userProfileId, "ARCHIVED", { entryId });
      await auditKnowledge(scope, context, "knowledgeEntry.archived", "KnowledgeEntry", entryId, requestId);
      return entry;
    },

    async restore(
      brandId: string,
      organisationId: string,
      knowledgeBaseId: string,
      entryId: string,
      context: TenantContext,
      requestId?: string,
    ) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      await getKnowledgeBaseForBrand(knowledgeBaseId, scope);
      const existing = await getEntryForBase(entryId, knowledgeBaseId, scope);

      if (existing.status !== KnowledgeEntryStatus.ARCHIVED) {
        throw new AppError("VALIDATION_ERROR", "Only archived entries can be restored.");
      }

      const entry = await prisma.knowledgeEntry.update({
        where: { id: entryId },
        data: {
          status: KnowledgeEntryStatus.DRAFT,
          archivedAt: null,
        },
      });

      await recordKnowledgeActivity(scope, knowledgeBaseId, context.userProfileId, "RESTORED", { entryId });
      await auditKnowledge(scope, context, "knowledgeEntry.restored", "KnowledgeEntry", entryId, requestId);
      return entry;
    },

    async listVersions(
      brandId: string,
      organisationId: string,
      knowledgeBaseId: string,
      entryId: string,
      context: TenantContext,
    ) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      await getKnowledgeBaseForBrand(knowledgeBaseId, scope);
      await getEntryForBase(entryId, knowledgeBaseId, scope);

      return prisma.knowledgeEntryVersion.findMany({
        where: { entryId, organisationId: scope.organisationId },
        include: {
          changedBy: { select: { id: true, displayName: true, email: true } },
        },
        orderBy: { version: "desc" },
      });
    },

    async listApprovalQueue(
      brandId: string,
      organisationId: string,
      knowledgeBaseId: string,
      context: TenantContext,
    ) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      await getKnowledgeBaseForBrand(knowledgeBaseId, scope);

      return prisma.knowledgeEntry.findMany({
        where: {
          knowledgeBaseId,
          organisationId: scope.organisationId,
          brandId: scope.brandId,
          status: KnowledgeEntryStatus.IN_REVIEW,
          archivedAt: null,
        },
        include: {
          createdBy: { select: { id: true, displayName: true, email: true } },
        },
        orderBy: { updatedAt: "asc" },
      });
    },

    async listConflicts(
      brandId: string,
      organisationId: string,
      knowledgeBaseId: string,
      entryId: string,
      context: TenantContext,
    ) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      await getKnowledgeBaseForBrand(knowledgeBaseId, scope);
      await getEntryForBase(entryId, knowledgeBaseId, scope);

      return prisma.knowledgeRelationship.findMany({
        where: {
          organisationId: scope.organisationId,
          OR: [{ sourceEntryId: entryId }, { targetEntryId: entryId }],
          relationshipType: "CONFLICTS_WITH",
        },
        include: {
          sourceEntry: { select: { id: true, title: true, type: true, status: true } },
          targetEntry: { select: { id: true, title: true, type: true, status: true } },
        },
      });
    },

    async listActivity(
      brandId: string,
      organisationId: string,
      knowledgeBaseId: string,
      entryId: string,
      context: TenantContext,
    ) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      await getKnowledgeBaseForBrand(knowledgeBaseId, scope);
      await getEntryForBase(entryId, knowledgeBaseId, scope);

      return prisma.knowledgeActivity.findMany({
        where: {
          organisationId: scope.organisationId,
          knowledgeBaseId,
          entryId,
        },
        include: {
          actor: { select: { id: true, displayName: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    },
  },

  relationships: {
    async list(
      brandId: string,
      organisationId: string,
      knowledgeBaseId: string,
      entryId: string,
      context: TenantContext,
    ) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      await getKnowledgeBaseForBrand(knowledgeBaseId, scope);
      await getEntryForBase(entryId, knowledgeBaseId, scope);

      return prisma.knowledgeRelationship.findMany({
        where: {
          organisationId: scope.organisationId,
          OR: [{ sourceEntryId: entryId }, { targetEntryId: entryId }],
        },
        include: {
          sourceEntry: { select: { id: true, title: true, type: true, status: true } },
          targetEntry: { select: { id: true, title: true, type: true, status: true } },
          createdBy: { select: { id: true, displayName: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    },

    async create(
      brandId: string,
      organisationId: string,
      knowledgeBaseId: string,
      entryId: string,
      input: KnowledgeRelationshipCreateInput,
      context: TenantContext,
      requestId?: string,
    ) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      await getKnowledgeBaseForBrand(knowledgeBaseId, scope);
      await getEntryForBase(entryId, knowledgeBaseId, scope);
      await getEntryForBase(input.targetEntryId, knowledgeBaseId, scope);

      if (entryId === input.targetEntryId) {
        throw new AppError("VALIDATION_ERROR", "An entry cannot relate to itself.");
      }

      const relationship = await prisma.knowledgeRelationship.create({
        data: {
          organisationId: scope.organisationId,
          sourceEntryId: entryId,
          targetEntryId: input.targetEntryId,
          relationshipType: input.relationshipType,
          note: input.note ?? null,
          createdByUserId: context.userProfileId,
        },
      });

      await recordKnowledgeActivity(scope, knowledgeBaseId, context.userProfileId, "RELATIONSHIP_ADDED", {
        entryId,
        metadata: { relationshipId: relationship.id, type: input.relationshipType },
      });
      await auditKnowledge(
        scope,
        context,
        "knowledgeRelationship.created",
        "KnowledgeRelationship",
        relationship.id,
        requestId,
      );
      return relationship;
    },

    async remove(
      brandId: string,
      organisationId: string,
      knowledgeBaseId: string,
      entryId: string,
      relationshipId: string,
      context: TenantContext,
      requestId?: string,
    ) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      await getKnowledgeBaseForBrand(knowledgeBaseId, scope);
      await getEntryForBase(entryId, knowledgeBaseId, scope);

      const relationship = await prisma.knowledgeRelationship.findFirst({
        where: {
          id: relationshipId,
          organisationId: scope.organisationId,
          OR: [{ sourceEntryId: entryId }, { targetEntryId: entryId }],
        },
      });

      if (!relationship) {
        throw new AppError("NOT_FOUND", "Relationship was not found.");
      }

      await prisma.knowledgeRelationship.delete({ where: { id: relationshipId } });
      await recordKnowledgeActivity(scope, knowledgeBaseId, context.userProfileId, "RELATIONSHIP_REMOVED", {
        entryId,
        metadata: { relationshipId },
      });
      await auditKnowledge(
        scope,
        context,
        "knowledgeRelationship.removed",
        "KnowledgeRelationship",
        relationshipId,
        requestId,
      );
    },
  },

  tags: {
    async list(brandId: string, organisationId: string, knowledgeBaseId: string, context: TenantContext) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      await getKnowledgeBaseForBrand(knowledgeBaseId, scope);

      return prisma.knowledgeTag.findMany({
        where: { knowledgeBaseId, organisationId: scope.organisationId },
        orderBy: { name: "asc" },
      });
    },

    async create(
      brandId: string,
      organisationId: string,
      knowledgeBaseId: string,
      input: KnowledgeTagCreateInput,
      context: TenantContext,
      requestId?: string,
    ) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      await getKnowledgeBaseForBrand(knowledgeBaseId, scope);

      const tag = await prisma.knowledgeTag.create({
        data: {
          knowledgeBaseId,
          organisationId: scope.organisationId,
          name: input.name,
          colour: input.colour ?? null,
        },
      });

      await auditKnowledge(scope, context, "knowledgeTag.created", "KnowledgeTag", tag.id, requestId);
      return tag;
    },
  },

  documents: {
    async list(brandId: string, organisationId: string, knowledgeBaseId: string, context: TenantContext) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      await getKnowledgeBaseForBrand(knowledgeBaseId, scope);

      return prisma.knowledgeDocument.findMany({
        where: {
          knowledgeBaseId,
          organisationId: scope.organisationId,
          brandId: scope.brandId,
          archivedAt: null,
        },
        include: {
          uploadedBy: { select: { id: true, displayName: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    },

    async upload(
      brandId: string,
      organisationId: string,
      knowledgeBaseId: string,
      input: { filename: string; buffer: Buffer; title?: string; entryId?: string },
      context: TenantContext,
      requestId?: string,
    ) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      await getKnowledgeBaseForBrand(knowledgeBaseId, scope);

      if (input.entryId) {
        await getEntryForBase(input.entryId, knowledgeBaseId, scope);
      }

      const processed = await processKnowledgeDocumentUpload(input.filename, input.buffer);
      const documentId = randomUUID();
      const storageKey = buildKnowledgeDocumentStorageKey(
        scope.organisationId,
        scope.brandId,
        documentId,
        processed.safeFilename,
      );

      const storage = createObjectStorageProvider();
      const status =
        processed.extractedText === null && processed.mimeType !== "application/pdf"
          ? KnowledgeDocumentStatus.QUARANTINED
          : KnowledgeDocumentStatus.READY;

      try {
        await storage.upload({
          key: storageKey,
          body: processed.buffer,
          contentType: processed.mimeType,
        });

        const document = await prisma.knowledgeDocument.create({
          data: {
            id: documentId,
            knowledgeBaseId,
            organisationId: scope.organisationId,
            projectId: scope.projectId,
            brandId: scope.brandId,
            entryId: input.entryId ?? null,
            title: input.title ?? processed.safeFilename,
            filename: processed.safeFilename,
            mimeType: processed.mimeType,
            fileSizeBytes: processed.buffer.byteLength,
            storageKey,
            status,
            uploadedByUserId: context.userProfileId,
            versions: {
              create: {
                organisationId: scope.organisationId,
                version: 1,
                filename: processed.safeFilename,
                mimeType: processed.mimeType,
                fileSizeBytes: processed.buffer.byteLength,
                storageKey,
                extractedText: processed.extractedText,
                uploadedByUserId: context.userProfileId,
              },
            },
          },
          include: {
            uploadedBy: { select: { id: true, displayName: true, email: true } },
          },
        });

        await recordKnowledgeActivity(scope, knowledgeBaseId, context.userProfileId, "DOCUMENT_UPLOADED", {
          documentId: document.id,
          entryId: input.entryId,
        });
        await auditKnowledge(scope, context, "knowledgeDocument.uploaded", "KnowledgeDocument", document.id, requestId);
        return document;
      } catch (error) {
        try {
          await storage.delete(storageKey);
        } catch {
          // best effort rollback
        }
        throw error;
      }
    },

    async getSignedUrl(
      brandId: string,
      organisationId: string,
      knowledgeBaseId: string,
      documentId: string,
      context: TenantContext,
    ) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      await getKnowledgeBaseForBrand(knowledgeBaseId, scope);

      const document = await prisma.knowledgeDocument.findFirst({
        where: {
          id: documentId,
          knowledgeBaseId,
          organisationId: scope.organisationId,
          brandId: scope.brandId,
          archivedAt: null,
        },
      });

      if (!document) {
        throw new AppError("NOT_FOUND", "Knowledge document was not found.");
      }

      if (document.status === KnowledgeDocumentStatus.QUARANTINED) {
        throw new AppError("FORBIDDEN", "Document is quarantined and cannot be accessed.");
      }

      const storage = createObjectStorageProvider();
      return storage.createSignedUrl(document.storageKey, KNOWLEDGE_DOCUMENT_SIGNED_URL_TTL_SECONDS);
    },

    async update(
      brandId: string,
      organisationId: string,
      knowledgeBaseId: string,
      documentId: string,
      input: KnowledgeDocumentUpdateInput,
      context: TenantContext,
      requestId?: string,
    ) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      await getKnowledgeBaseForBrand(knowledgeBaseId, scope);

      if (input.entryId) {
        await getEntryForBase(input.entryId, knowledgeBaseId, scope);
      }

      const document = await prisma.knowledgeDocument.update({
        where: { id: documentId },
        data: {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.entryId !== undefined ? { entryId: input.entryId } : {}),
        },
      });

      await auditKnowledge(scope, context, "knowledgeDocument.updated", "KnowledgeDocument", document.id, requestId);
      return document;
    },

    async archive(
      brandId: string,
      organisationId: string,
      knowledgeBaseId: string,
      documentId: string,
      context: TenantContext,
      requestId?: string,
    ) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      await getKnowledgeBaseForBrand(knowledgeBaseId, scope);

      const document = await prisma.knowledgeDocument.update({
        where: { id: documentId },
        data: {
          status: KnowledgeDocumentStatus.ARCHIVED,
          archivedAt: new Date(),
        },
      });

      await auditKnowledge(scope, context, "knowledgeDocument.archived", "KnowledgeDocument", document.id, requestId);
      return document;
    },
  },

  async retrieve(request: KnowledgeRetrievalRequest): Promise<KnowledgeRetrievalResponse> {
    const organisationId = request.organisationId;
    const now = new Date();
    const limit = request.limit ?? 20;
    const approvedOnly = request.approvedOnly !== false;

    const entries = await prisma.knowledgeEntry.findMany({
      where: {
        organisationId,
        archivedAt: null,
        ...(request.projectId ? { projectId: request.projectId } : {}),
        ...(request.brandId ? { brandId: request.brandId } : {}),
        ...(request.campaignId ? { campaignId: request.campaignId } : {}),
        ...(approvedOnly ? { status: KnowledgeEntryStatus.APPROVED } : {}),
        ...(request.entryTypes?.length ? { type: { in: request.entryTypes } } : {}),
        OR: [
          { title: { contains: request.query, mode: "insensitive" } },
          { summary: { contains: request.query, mode: "insensitive" } },
          { content: { contains: request.query, mode: "insensitive" } },
        ],
      },
      take: limit * 3,
    });

    const validEntries = entries.filter((entry) =>
      isCurrentlyValid(entry.validFrom, entry.validUntil, now),
    );

    const scored = validEntries
      .map((entry) => ({
        id: entry.id,
        type: entry.type as KnowledgeEntryType,
        title: entry.title,
        summary: entry.summary,
        content: entry.content,
        confidence: entry.confidence ? Number(entry.confidence) : null,
        sourceType: entry.sourceType,
        sourceReference: entry.sourceReference,
        relevanceScore: computeRelevanceScore(request.query, entry.title, entry.summary, entry.content),
      }))
      .filter((item) => item.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);

    return {
      results: scored,
      totalMatched: scored.length,
      searchMode: "deterministic",
    };
  },
};

export const retrieveKnowledge = knowledgeBaseService.retrieve.bind(knowledgeBaseService);
