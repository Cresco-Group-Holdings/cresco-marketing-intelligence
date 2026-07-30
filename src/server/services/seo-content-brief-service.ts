import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { brandService } from "@/server/services/workspace-service";

export const seoContentBriefService = {
  async list(brandId: string, organisationId: string, context: TenantContext, filters?: { status?: string }) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.seoContentBrief.findMany({
      where: {
        organisationId,
        brandId,
        archivedAt: null,
        ...(filters?.status ? { status: filters.status as "APPROVED" } : {}),
      },
      include: {
        primaryKeyword: { select: { id: true, displayKeyword: true } },
        cluster: { select: { id: true, name: true } },
        _count: { select: { versions: true, comments: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
  },

  async getById(briefId: string, brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const brief = await prisma.seoContentBrief.findFirst({
      where: { id: briefId, organisationId, brandId },
      include: {
        primaryKeyword: true,
        cluster: true,
        targetPage: true,
        keywords: true,
        questions: { orderBy: { priority: "asc" } },
        headings: { orderBy: { sortOrder: "asc" } },
        competitorEvidence: true,
        internalLinks: true,
        schemaSuggestions: true,
        citationRequirements: true,
        versions: { orderBy: { versionNumber: "desc" }, take: 10 },
        approvals: { orderBy: { createdAt: "desc" }, take: 10 },
        comments: { orderBy: { createdAt: "desc" }, take: 20, include: { author: { select: { id: true } } } },
      },
    });
    if (!brief) throw new AppError("NOT_FOUND", "Brief not found.");
    return brief;
  },

  async create(
    brandId: string,
    organisationId: string,
    input: {
      workingTitle?: string;
      contentType?: string;
      primaryKeywordId?: string;
      clusterId?: string;
      targetPageId?: string;
      audience?: string;
      offer?: string;
      cta?: string;
      secondaryKeywordIds?: string[];
    },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const brief = await prisma.seoContentBrief.create({
      data: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        workingTitle: input.workingTitle,
        contentType: input.contentType as "GUIDE" | undefined,
        primaryKeywordId: input.primaryKeywordId,
        clusterId: input.clusterId,
        targetPageId: input.targetPageId,
        audience: input.audience,
        offer: input.offer,
        cta: input.cta,
        createdByUserId: context.userProfileId,
        status: "DRAFT",
      },
    });

    if (input.primaryKeywordId) {
      const kw = await prisma.seoKeyword.findFirst({ where: { id: input.primaryKeywordId, brandId } });
      if (kw) {
        await prisma.seoBriefKeyword.create({
          data: {
            organisationId,
            briefId: brief.id,
            keywordId: kw.id,
            keyword: kw.displayKeyword,
            role: "PRIMARY",
            intent: kw.primaryIntent,
            source: "manual",
          },
        });
      }
    }

    for (const kid of input.secondaryKeywordIds ?? []) {
      const kw = await prisma.seoKeyword.findFirst({ where: { id: kid, brandId } });
      if (kw) {
        await prisma.seoBriefKeyword.create({
          data: {
            organisationId,
            briefId: brief.id,
            keywordId: kw.id,
            keyword: kw.displayKeyword,
            role: "SECONDARY",
            intent: kw.primaryIntent,
            source: "manual",
          },
        });
      }
    }

    await prisma.seoContentBriefVersion.create({
      data: {
        organisationId,
        briefId: brief.id,
        versionNumber: 1,
        status: "DRAFT",
        structuredOutput: { note: "Initial draft created" },
        createdByUserId: context.userProfileId,
      },
    });

    return brief;
  },

  async update(
    briefId: string,
    brandId: string,
    organisationId: string,
    input: { workingTitle?: string; audience?: string; offer?: string; cta?: string },
    context: TenantContext,
  ) {
    await this.getById(briefId, brandId, organisationId, context);
    return prisma.seoContentBrief.update({ where: { id: briefId }, data: input });
  },

  async getHistory(briefId: string, brandId: string, organisationId: string, context: TenantContext) {
    await this.getById(briefId, brandId, organisationId, context);
    const versions = await prisma.seoContentBriefVersion.findMany({
      where: { briefId, organisationId },
      orderBy: { versionNumber: "desc" },
    });
    const approvals = await prisma.seoBriefApproval.findMany({
      where: { briefId, organisationId },
      orderBy: { createdAt: "desc" },
    });
    const comments = await prisma.seoBriefComment.findMany({
      where: { briefId, organisationId },
      orderBy: { createdAt: "desc" },
    });
    return { versions, approvals, comments };
  },

  async persistGeneratedBrief(
    briefId: string,
    organisationId: string,
    brandId: string,
    versionNumber: number,
    output: Record<string, unknown>,
    evidence: {
      bundle: Record<string, unknown>;
      limitations: string[];
      aiRequestId?: string;
      aiModel?: string;
      aiProvider?: string;
    },
    context: TenantContext,
  ) {
    const version = await prisma.seoContentBriefVersion.create({
      data: {
        organisationId,
        briefId,
        versionNumber,
        status: "GENERATED",
        structuredOutput: output as Prisma.InputJsonValue,
        evidenceSummary: evidence.bundle as Prisma.InputJsonValue,
        limitations: evidence.limitations.join(" "),
        aiRequestId: evidence.aiRequestId,
        aiModel: evidence.aiModel,
        aiProvider: evidence.aiProvider,
        createdByUserId: context.userProfileId,
      },
    });

    await prisma.seoContentBrief.update({
      where: { id: briefId },
      data: {
        status: "GENERATED",
        currentVersionId: version.id,
        workingTitle: (output.workingTitle as string) ?? undefined,
      },
    });

    // Clear and repopulate child records
    await prisma.seoBriefQuestion.deleteMany({ where: { briefId } });
    await prisma.seoBriefHeading.deleteMany({ where: { briefId } });
    await prisma.seoBriefSchemaSuggestion.deleteMany({ where: { briefId } });
    await prisma.seoBriefCitationRequirement.deleteMany({ where: { briefId } });

    const questions = (output.questionsToAnswer as string[]) ?? [];
    for (let i = 0; i < questions.length; i++) {
      await prisma.seoBriefQuestion.create({
        data: { organisationId, briefId, question: questions[i], priority: i },
      });
    }

    const faq = (output.faq as Array<{ question: string }>) ?? [];
    for (const item of faq) {
      await prisma.seoBriefQuestion.create({
        data: { organisationId, briefId, question: item.question, isFaq: true, priority: 100 },
      });
    }

    const headings = (output.headings as Array<{ level: number; text: string; notes?: string }>) ?? [];
    for (let i = 0; i < headings.length; i++) {
      await prisma.seoBriefHeading.create({
        data: {
          organisationId,
          briefId,
          level: headings[i].level,
          text: headings[i].text,
          sortOrder: i,
          notes: headings[i].notes,
        },
      });
    }

    const schemas = (output.schemaSuggestions as Array<{ schemaType: string; rationale?: string; eligibilityNote?: string }>) ?? [];
    for (const s of schemas) {
      await prisma.seoBriefSchemaSuggestion.create({
        data: {
          organisationId,
          briefId,
          schemaType: s.schemaType,
          rationale: s.rationale,
          eligibilityNote: s.eligibilityNote,
        },
      });
    }

    const citations = (output.externalEvidenceNeeds as string[]) ?? [];
    for (const req of citations) {
      await prisma.seoBriefCitationRequirement.create({
        data: { organisationId, briefId, requirement: req, sourceType: "external" },
      });
    }

    return version;
  },
};
