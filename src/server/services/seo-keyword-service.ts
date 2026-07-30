import { createHash } from "node:crypto";
import {
  Prisma,
  SeoKeywordSourceType,
  SeoKeywordStatus,
  type SeoKeywordIntentType,
} from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { classifyIntentDeterministic } from "@/lib/keywords/intent-classifier";
import { normaliseKeyword } from "@/lib/keywords/normalisation";
import type { TenantContext } from "@/lib/tenancy/context";
import { brandService } from "@/server/services/workspace-service";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");

export const seoKeywordService = {
  async list(
    brandId: string,
    organisationId: string,
    filters: {
      status?: SeoKeywordStatus;
      intent?: SeoKeywordIntentType;
      language?: string;
      country?: string;
      siteId?: string;
      search?: string;
      tag?: string;
      limit?: number;
    },
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    const items = await prisma.seoKeyword.findMany({
      where: {
        organisationId,
        brandId,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.intent ? { primaryIntent: filters.intent } : {}),
        ...(filters.language ? { language: filters.language } : {}),
        ...(filters.country ? { country: filters.country } : {}),
        ...(filters.siteId ? { seoSiteId: filters.siteId } : {}),
        ...(filters.search
          ? { OR: [{ normalisedKeyword: { contains: filters.search.toLowerCase() } }, { displayKeyword: { contains: filters.search, mode: "insensitive" } }] }
          : {}),
        ...(filters.tag ? { tags: { some: { tag: filters.tag } } } : {}),
      },
      include: {
        sources: true,
        tags: true,
        metrics: { take: 4, orderBy: { measuredAt: "desc" } },
        pageMappings: { include: { page: { select: { normalisedUrl: true } } } },
        _count: { select: { opportunities: true, groupMembers: true } },
      },
      orderBy: { lastSeenAt: "desc" },
      take: filters.limit ?? 50,
    });
    return items;
  },

  async getById(keywordId: string, brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const keyword = await prisma.seoKeyword.findFirst({
      where: { id: keywordId, organisationId, brandId },
      include: {
        sources: { orderBy: { lastSeenAt: "desc" } },
        metrics: { orderBy: { measuredAt: "desc" }, take: 20 },
        intents: { orderBy: { createdAt: "desc" }, take: 10 },
        entities: true,
        pageMappings: { include: { page: true } },
        tags: true,
        groupMembers: { include: { group: true } },
        opportunities: { where: { status: "OPEN" } },
        statusHistory: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });
    if (!keyword) throw new AppError("NOT_FOUND", "Keyword not found.");
    return keyword;
  },

  async upsert(
    brandId: string,
    organisationId: string,
    input: {
      keyword: string;
      language?: string;
      country?: string;
      locale?: string;
      siteId?: string;
      sourceType: SeoKeywordSourceType;
      provider?: string;
      externalId?: string;
      isSuggestion?: boolean;
      tags?: string[];
    },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const normalised = normaliseKeyword(input.keyword, {
      language: input.language,
      country: input.country,
      locale: input.locale,
    });

    const existing = await prisma.seoKeyword.findUnique({
      where: {
        brandId_normalisedKeyword_language_country: {
          brandId,
          normalisedKeyword: normalised.normalised,
          language: normalised.language,
          country: normalised.country ?? "",
        },
      },
    });

    let keyword;
    if (existing) {
      keyword = await prisma.seoKeyword.update({
        where: { id: existing.id },
        data: {
          lastSeenAt: new Date(),
          sourceCount: { increment: 1 },
          displayKeyword: normalised.display,
        },
      });
    } else {
      const intent = classifyIntentDeterministic(normalised.display, brand.name);
      keyword = await prisma.seoKeyword.create({
        data: {
          organisationId,
          projectId: brand.projectId,
          brandId,
          seoSiteId: input.siteId,
          normalisedKeyword: normalised.normalised,
          displayKeyword: normalised.display,
          language: normalised.language,
          country: normalised.country,
          locale: normalised.locale,
          primaryIntent: intent.intent,
          sourceCount: 1,
        },
      });

      await prisma.seoKeywordIntent.create({
        data: {
          organisationId,
          keywordId: keyword.id,
          intent: intent.intent,
          confidence: intent.confidence,
          source: intent.source,
          evidence: intent.evidence as Prisma.InputJsonValue,
        },
      });
    }

    await prisma.seoKeywordSource.upsert({
      where: {
        keywordId_sourceType_externalId: {
          keywordId: keyword.id,
          sourceType: input.sourceType,
          externalId: input.externalId ?? digest(`${input.sourceType}:${normalised.normalised}`),
        },
      },
      create: {
        organisationId,
        keywordId: keyword.id,
        sourceType: input.sourceType,
        provider: input.provider,
        externalId: input.externalId ?? digest(`${input.sourceType}:${normalised.normalised}`),
        isSuggestion: input.isSuggestion ?? false,
      },
      update: { lastSeenAt: new Date() },
    });

    if (input.tags?.length) {
      for (const tag of input.tags) {
        await prisma.seoKeywordTag.upsert({
          where: { keywordId_tag: { keywordId: keyword.id, tag } },
          create: { keywordId: keyword.id, tag },
          update: {},
        });
      }
    }

    return keyword;
  },

  async createManual(
    brandId: string,
    organisationId: string,
    input: {
      keyword: string;
      language?: string;
      country?: string;
      siteId?: string;
      tags?: string[];
    },
    context: TenantContext,
  ) {
    return this.upsert(
      brandId,
      organisationId,
      { ...input, sourceType: "MANUAL", provider: "MANUAL" },
      context,
    );
  },

  async updateStatus(
    keywordId: string,
    brandId: string,
    organisationId: string,
    status: SeoKeywordStatus,
    note: string | undefined,
    context: TenantContext,
  ) {
    const keyword = await this.getById(keywordId, brandId, organisationId, context);
    const updated = await prisma.seoKeyword.update({
      where: { id: keywordId },
      data: { status },
    });
    await prisma.seoKeywordStatusHistory.create({
      data: {
        organisationId,
        keywordId,
        fromStatus: keyword.status,
        toStatus: status,
        note,
        changedByUserId: context.userProfileId,
      },
    });
    return updated;
  },

  async overrideIntent(
    keywordId: string,
    brandId: string,
    organisationId: string,
    intent: SeoKeywordIntentType,
    note: string | undefined,
    context: TenantContext,
  ) {
    await this.getById(keywordId, brandId, organisationId, context);
    await prisma.seoKeywordIntent.create({
      data: {
        organisationId,
        keywordId,
        intent,
        confidence: 1,
        source: "manual",
        isManualOverride: true,
        overriddenByUserId: context.userProfileId,
        evidence: note ? ({ note } as Prisma.InputJsonValue) : undefined,
      },
    });
    return prisma.seoKeyword.update({
      where: { id: keywordId },
      data: { primaryIntent: intent },
    });
  },

  async addPageMapping(
    keywordId: string,
    brandId: string,
    organisationId: string,
    input: {
      pageId?: string;
      intendedUrl?: string;
      relationType: import("@prisma/client").SeoKeywordPageRelationType;
    },
    context: TenantContext,
  ) {
    await this.getById(keywordId, brandId, organisationId, context);
    return prisma.seoKeywordPageMapping.create({
      data: {
        organisationId,
        keywordId,
        pageId: input.pageId,
        intendedUrl: input.intendedUrl,
        relationType: input.relationType,
        isManual: true,
        confidence: 1,
      },
    });
  },

  async bulkTag(
    brandId: string,
    organisationId: string,
    keywordIds: string[],
    tags: string[],
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    let count = 0;
    for (const keywordId of keywordIds) {
      for (const tag of tags) {
        await prisma.seoKeywordTag.upsert({
          where: { keywordId_tag: { keywordId, tag } },
          create: { keywordId, tag },
          update: {},
        });
        count += 1;
      }
    }
    return { tagged: count };
  },
};
