import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { brandService } from "@/server/services/workspace-service";

export const onPageAuditService = {
  async list(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.onPageSeoAudit.findMany({
      where: { organisationId, brandId, archivedAt: null },
      include: {
        targetKeyword: { select: { id: true, displayKeyword: true } },
        crawlPage: { select: { id: true, normalisedUrl: true } },
        _count: { select: { findings: true, recommendations: true, versions: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
  },

  async getById(auditId: string, brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const audit = await prisma.onPageSeoAudit.findFirst({
      where: { id: auditId, organisationId, brandId },
      include: {
        targetKeyword: true,
        keywordGroup: true,
        cluster: true,
        crawlPage: true,
        pageSnapshot: true,
        longFormDocument: { include: { sections: { orderBy: { sortOrder: "asc" } } } },
        brief: { include: { keywords: true, questions: true, headings: true } },
        findings: { orderBy: [{ priority: "desc" }, { createdAt: "desc" }] },
        recommendations: { orderBy: [{ priority: "desc" }, { createdAt: "desc" }] },
        targets: true,
        comparisons: { orderBy: { createdAt: "desc" }, take: 10 },
        overrides: { orderBy: { createdAt: "desc" }, take: 20 },
        versions: { orderBy: { versionNumber: "desc" }, take: 10 },
      },
    });
    if (!audit) throw new AppError("NOT_FOUND", "On-page SEO audit not found.");
    return audit;
  },

  async create(
    brandId: string,
    organisationId: string,
    input: {
      sourceType: string;
      crawlPageId?: string;
      pageSnapshotId?: string;
      longFormDocumentId?: string;
      briefId?: string;
      url?: string;
      targetKeywordId?: string;
      keywordGroupId?: string;
      clusterId?: string;
    },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);

    let url = input.url;
    let pageTitle: string | undefined;

    if (input.crawlPageId) {
      const page = await prisma.seoCrawlPage.findFirst({
        where: { id: input.crawlPageId, brandId, organisationId },
        include: { snapshots: { orderBy: { createdAt: "desc" }, take: 1 } },
      });
      if (!page) throw new AppError("NOT_FOUND", "Crawl page not found.");
      url = page.normalisedUrl;
      pageTitle = page.snapshots[0]?.title ?? undefined;
    }

    if (input.longFormDocumentId) {
      const doc = await prisma.longFormContentDocument.findFirst({
        where: { id: input.longFormDocumentId, brandId, organisationId },
      });
      if (!doc) throw new AppError("NOT_FOUND", "Long-form document not found.");
      pageTitle = doc.title ?? undefined;
    }

    const audit = await prisma.onPageSeoAudit.create({
      data: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        sourceType: input.sourceType as "CRAWL_SNAPSHOT",
        url,
        pageTitle,
        crawlPageId: input.crawlPageId,
        pageSnapshotId: input.pageSnapshotId,
        longFormDocumentId: input.longFormDocumentId,
        briefId: input.briefId,
        targetKeywordId: input.targetKeywordId,
        keywordGroupId: input.keywordGroupId,
        clusterId: input.clusterId,
        createdByUserId: context.userProfileId,
        status: "DRAFT",
      },
    });

    if (input.targetKeywordId || input.keywordGroupId || input.clusterId) {
      await prisma.onPageSeoTarget.create({
        data: {
          organisationId,
          auditId: audit.id,
          targetKeywordId: input.targetKeywordId,
          keywordGroupId: input.keywordGroupId,
          clusterId: input.clusterId,
          targetUrl: url,
        },
      });
    }

    await prisma.onPageSeoAuditVersion.create({
      data: {
        organisationId,
        auditId: audit.id,
        versionNumber: 1,
        status: "DRAFT",
        inputSnapshot: input as Prisma.InputJsonValue,
      },
    });

    return this.getById(audit.id, brandId, organisationId, context);
  },

  async getHistory(auditId: string, brandId: string, organisationId: string, context: TenantContext) {
    await this.getById(auditId, brandId, organisationId, context);
    return prisma.onPageSeoAuditVersion.findMany({
      where: { auditId, organisationId },
      orderBy: { versionNumber: "desc" },
      include: { _count: { select: { findings: true } } },
    });
  },
};
