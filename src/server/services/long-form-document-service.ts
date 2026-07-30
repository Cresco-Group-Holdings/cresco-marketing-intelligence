import type { LongFormDocumentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { assertStatusTransition } from "@/lib/long-form/constants";
import type { TenantContext } from "@/lib/tenancy/context";
import { brandService } from "@/server/services/workspace-service";

function mapBriefContentType(contentType?: string | null): "BLOG_ARTICLE" | "GUIDE" | "LANDING_PAGE" | "COMPARISON" | "CASE_STUDY" | "FAQ" | "GLOSSARY" | "DOCUMENTATION" | "PILLAR_PAGE" | "SUPPORTING_ARTICLE" {
  const mapping: Record<string, ReturnType<typeof mapBriefContentType>> = {
    PILLAR: "PILLAR_PAGE",
    SUPPORTING_ARTICLE: "SUPPORTING_ARTICLE",
    LANDING_PAGE: "LANDING_PAGE",
    COMPARISON: "COMPARISON",
    GUIDE: "GUIDE",
    FAQ: "FAQ",
    GLOSSARY: "GLOSSARY",
    CASE_STUDY: "CASE_STUDY",
    DOCUMENTATION: "DOCUMENTATION",
    BLOG_ARTICLE: "BLOG_ARTICLE",
  };
  return mapping[contentType ?? ""] ?? "BLOG_ARTICLE";
}

export const longFormDocumentService = {
  async list(brandId: string, organisationId: string, context: TenantContext, filters?: { status?: string }) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.longFormContentDocument.findMany({
      where: {
        organisationId,
        brandId,
        archivedAt: null,
        ...(filters?.status ? { status: filters.status as "APPROVED" } : {}),
      },
      include: {
        brief: { select: { id: true, workingTitle: true, status: true } },
        _count: { select: { versions: true, sections: true, claims: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
  },

  async getById(documentId: string, brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const document = await prisma.longFormContentDocument.findFirst({
      where: { id: documentId, organisationId, brandId },
      include: {
        brief: {
          include: {
            keywords: true,
            questions: { orderBy: { priority: "asc" } },
            headings: { orderBy: { sortOrder: "asc" } },
            citationRequirements: true,
          },
        },
        briefVersion: true,
        sections: { orderBy: { sortOrder: "asc" } },
        citations: true,
        claims: { orderBy: { createdAt: "desc" } },
        generationRuns: { orderBy: { createdAt: "desc" }, take: 20 },
        reviews: { orderBy: { createdAt: "desc" }, take: 20 },
        versions: { orderBy: { versionNumber: "desc" }, take: 10 },
        exports: { orderBy: { createdAt: "desc" }, take: 10 },
      },
    });
    if (!document) throw new AppError("NOT_FOUND", "Long-form document not found.");
    return document;
  },

  async createFromBrief(
    brandId: string,
    organisationId: string,
    input: { briefId: string; title?: string; contentType?: string },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const brief = await prisma.seoContentBrief.findFirst({
      where: { id: input.briefId, organisationId, brandId },
      include: {
        versions: { orderBy: { versionNumber: "desc" }, take: 1 },
        headings: { orderBy: { sortOrder: "asc" } },
      },
    });

    if (!brief) throw new AppError("NOT_FOUND", "Brief not found.");
    if (brief.status !== "APPROVED") {
      throw new AppError("VALIDATION_ERROR", "Only approved SEO briefs can seed long-form documents.");
    }

    const briefVersion = brief.versions[0];
    const document = await prisma.longFormContentDocument.create({
      data: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        briefId: brief.id,
        briefVersionId: briefVersion?.id,
        title: input.title ?? brief.workingTitle ?? "Untitled document",
        contentType: (input.contentType as "GUIDE" | undefined) ?? mapBriefContentType(brief.contentType),
        status: "OUTLINE_PENDING",
        createdByUserId: context.userProfileId,
      },
    });

    const version = await prisma.longFormContentVersion.create({
      data: {
        organisationId,
        documentId: document.id,
        versionNumber: 1,
        status: "OUTLINE_PENDING",
        outline: briefVersion?.structuredOutput ?? { fromBrief: true },
        createdByUserId: context.userProfileId,
      },
    });

    await prisma.longFormContentDocument.update({
      where: { id: document.id },
      data: { currentVersionId: version.id },
    });

    return this.getById(document.id, brandId, organisationId, context);
  },

  async update(
    documentId: string,
    brandId: string,
    organisationId: string,
    input: { title?: string; slug?: string; metaDescription?: string },
    context: TenantContext,
  ) {
    await this.getById(documentId, brandId, organisationId, context);
    return prisma.longFormContentDocument.update({ where: { id: documentId }, data: input });
  },

  async transitionStatus(
    documentId: string,
    brandId: string,
    organisationId: string,
    toStatus: string,
    context: TenantContext,
    changeNote?: string,
  ) {
    const doc = await this.getById(documentId, brandId, organisationId, context);
    assertStatusTransition(doc.status, toStatus);

    await prisma.longFormContentDocument.update({
      where: { id: documentId },
      data: { status: toStatus as LongFormDocumentStatus },
    });

    const latestVersion = doc.versions[0];
    const versionNumber = (latestVersion?.versionNumber ?? 0) + 1;

    const version = await prisma.longFormContentVersion.create({
      data: {
        organisationId,
        documentId,
        versionNumber,
        status: toStatus as LongFormDocumentStatus,
        changeNote,
        createdByUserId: context.userProfileId,
      },
    });

    await prisma.longFormContentDocument.update({
      where: { id: documentId },
      data: { currentVersionId: version.id },
    });

    return this.getById(documentId, brandId, organisationId, context);
  },

  async getHistory(documentId: string, brandId: string, organisationId: string, context: TenantContext) {
    await this.getById(documentId, brandId, organisationId, context);
    const versions = await prisma.longFormContentVersion.findMany({
      where: { documentId, organisationId },
      orderBy: { versionNumber: "desc" },
    });
    const runs = await prisma.longFormGenerationRun.findMany({
      where: { documentId, organisationId },
      orderBy: { createdAt: "desc" },
    });
    return { versions, generationRuns: runs };
  },

  async updateSection(
    documentId: string,
    sectionId: string,
    brandId: string,
    organisationId: string,
    input: {
      heading?: string;
      headingLevel?: number;
      body?: string;
      isLocked?: boolean;
      lockedRanges?: Array<{ start: number; end: number }>;
    },
    context: TenantContext,
  ) {
    await this.getById(documentId, brandId, organisationId, context);
    const section = await prisma.longFormSection.findFirst({
      where: { id: sectionId, documentId, organisationId },
    });
    if (!section) throw new AppError("NOT_FOUND", "Section not found.");

    return prisma.longFormSection.update({
      where: { id: sectionId },
      data: {
        heading: input.heading,
        headingLevel: input.headingLevel,
        body: input.body,
        isLocked: input.isLocked,
        lockedRanges: input.lockedRanges as Prisma.InputJsonValue,
      },
    });
  },
};
