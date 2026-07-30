import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { detectContentGaps } from "@/lib/competitors/content-gap";
import { calculateKeywordOverlaps, overlapSummary } from "@/lib/competitors/overlap-analysis";
import { comparePages } from "@/lib/competitors/page-comparison";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { seoCompetitorService } from "@/server/services/seo-competitor-service";
import { brandService } from "@/server/services/workspace-service";

export const seoCompetitorAnalysisService = {
  async calculateOverlaps(
    competitorId: string,
    brandId: string,
    organisationId: string,
    context: TenantContext,
  ) {
    await seoCompetitorService.getById(competitorId, brandId, organisationId, context);

    const brandKeywords = await prisma.seoKeyword.findMany({
      where: { organisationId, brandId, status: "ACTIVE" },
      include: {
        metrics: { where: { metricType: { in: ["AVERAGE_POSITION", "RANK_POSITION", "RANKING_URL"] } } },
      },
    });

    const competitorKeywords = await prisma.seoCompetitorKeyword.findMany({
      where: { organisationId, competitorId },
      orderBy: { observedAt: "desc" },
    });

    const brandKw = brandKeywords.map((k) => ({
      id: k.id,
      keyword: k.displayKeyword,
      normalisedKeyword: k.normalisedKeyword,
      position: k.metrics.find((m) => m.metricType === "AVERAGE_POSITION" || m.metricType === "RANK_POSITION")?.value,
      url: k.metrics.find((m) => m.metricType === "RANKING_URL")?.value?.toString() ?? null,
    }));

    const compKw = competitorKeywords.map((k) => ({
      id: k.id,
      keyword: k.keyword,
      normalisedKeyword: k.normalisedKeyword,
      position: k.position,
      url: k.rankingUrl,
      source: k.source,
    }));

    const overlaps = calculateKeywordOverlaps(brandKw, compKw);
    const summary = overlapSummary(overlaps);

    await prisma.seoKeywordOverlap.deleteMany({
      where: { organisationId, brandId, competitorId },
    });

    for (const overlap of overlaps) {
      await prisma.seoKeywordOverlap.create({
        data: {
          organisationId,
          brandId,
          competitorId,
          brandKeywordId: overlap.brandKeyword?.id,
          competitorKeywordId: overlap.competitorKeyword?.id,
          keyword: overlap.keyword,
          overlapType: overlap.overlapType,
          brandPosition: overlap.brandKeyword?.position ?? null,
          competitorPosition: overlap.competitorKeyword?.position ?? null,
          brandUrl: overlap.brandKeyword?.url ?? null,
          competitorUrl: overlap.competitorKeyword?.url ?? null,
          sourceCoverage: overlap.sourceCoverage as Prisma.InputJsonValue,
          evidence: overlap.evidence as Prisma.InputJsonValue,
        },
      });
    }

    return { overlaps, summary };
  },

  async listOverlaps(
    competitorId: string | undefined,
    brandId: string,
    organisationId: string,
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    const items = await prisma.seoKeywordOverlap.findMany({
      where: {
        organisationId,
        brandId,
        ...(competitorId ? { competitorId } : {}),
      },
      include: { competitor: { select: { id: true, name: true } } },
      orderBy: { keyword: "asc" },
      take: 200,
    });
    return { items, summary: overlapSummary(items.map((o) => ({
      keyword: o.keyword,
      overlapType: o.overlapType,
      sourceCoverage: {
        hasBrandData: Boolean((o.sourceCoverage as { hasBrandData?: boolean } | null)?.hasBrandData),
        hasCompetitorData: Boolean((o.sourceCoverage as { hasCompetitorData?: boolean } | null)?.hasCompetitorData),
      },
      evidence: (o.evidence as Record<string, unknown>) ?? {},
    }))) };
  },

  async detectAndPersistGaps(
    competitorId: string,
    brandId: string,
    organisationId: string,
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const competitor = await seoCompetitorService.getById(competitorId, brandId, organisationId, context);

    const brandPagesRaw = await prisma.seoCrawlPage.findMany({
      where: { organisationId, brandId },
      include: { snapshots: { orderBy: { createdAt: "desc" }, take: 1 } },
      take: 200,
      orderBy: { lastSeenAt: "desc" },
    });

    const brandPages = brandPagesRaw.map((p) => {
      const snap = p.snapshots[0];
      return {
        url: snap?.finalUrl ?? p.normalisedUrl,
        title: snap?.title ?? undefined,
        wordCount: snap?.wordCount ?? undefined,
        topics: ((snap?.headings as Array<{ level: number; text: string }> | null) ?? [])
          .filter((h) => h.level <= 2)
          .map((h) => h.text),
        contentType: snap?.contentType ?? undefined,
      };
    });

    const competitorPages = await prisma.seoCompetitorPage.findMany({
      where: { organisationId, competitorId },
      take: 200,
      orderBy: { observedAt: "desc" },
    });

    const competitorTopics = await prisma.seoCompetitorTopic.findMany({
      where: { competitorId },
    });

    const brandTopics = [...new Set(brandPages.flatMap((p) => p.topics ?? []))];

    const overlaps = await prisma.seoKeywordOverlap.findMany({
      where: { organisationId, brandId, competitorId, overlapType: { in: ["SHARED", "COMPETITOR_UNIQUE"] } },
    });

    const keywordGaps = overlaps.map((o) => ({
      keyword: o.keyword,
      competitorUrl: o.competitorUrl ?? undefined,
      brandUrl: o.brandUrl ?? undefined,
    }));

    const candidates = detectContentGaps({
      brandPages,
      competitorPages: competitorPages.map((p) => ({
        url: p.url,
        title: p.title ?? undefined,
        wordCount: p.wordCount ?? undefined,
        topics: p.detectedTopics,
        contentType: p.contentType ?? undefined,
      })),
      competitorTopics: competitorTopics.map((t) => t.topic),
      brandTopics,
      keywordGaps,
    });

    await prisma.seoContentGap.deleteMany({
      where: { organisationId, brandId, competitorId, status: "OPEN" },
    });

    const gaps = [];
    for (const gap of candidates) {
      const created = await prisma.seoContentGap.create({
        data: {
          organisationId,
          projectId: brand.projectId,
          brandId,
          competitorId,
          gapType: gap.gapType,
          topic: gap.topic,
          keyword: gap.keyword,
          title: gap.title,
          explanation: gap.explanation,
          evidence: gap.evidence as Prisma.InputJsonValue,
          recommendedAction: gap.recommendedAction,
          originalityGuidance: gap.originalityGuidance,
        },
      });
      gaps.push(created);
    }

    return { gaps, competitor: { id: competitor.id, name: competitor.name } };
  },

  async listContentGaps(
    brandId: string,
    organisationId: string,
    context: TenantContext,
    filters?: { competitorId?: string; status?: string },
  ) {
    await brandService.getById(brandId, organisationId, context);
    const items = await prisma.seoContentGap.findMany({
      where: {
        organisationId,
        brandId,
        ...(filters?.competitorId ? { competitorId: filters.competitorId } : {}),
        ...(filters?.status ? { status: filters.status as "OPEN" } : {}),
      },
      include: { competitor: { select: { id: true, name: true } } },
      orderBy: { detectedAt: "desc" },
      take: 100,
    });
    return items;
  },

  async listTopics(
    brandId: string,
    organisationId: string,
    context: TenantContext,
    competitorId?: string,
  ) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.seoCompetitorTopic.findMany({
      where: {
        organisationId,
        ...(competitorId ? { competitorId } : { competitor: { brandId } }),
      },
      include: { competitor: { select: { id: true, name: true } } },
      orderBy: { pageCount: "desc" },
      take: 100,
    });
  },

  async comparePages(
    competitorId: string,
    brandId: string,
    organisationId: string,
    input: { brandPageId?: string; competitorPageId?: string; brandUrl?: string; competitorUrl?: string },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    await seoCompetitorService.getById(competitorId, brandId, organisationId, context);

    let brandPage = null;
    let brandSnapshot = null;
    if (input.brandPageId) {
      brandPage = await prisma.seoCrawlPage.findFirst({
        where: { id: input.brandPageId, organisationId, brandId },
        include: { snapshots: { orderBy: { createdAt: "desc" }, take: 1 } },
      });
      if (!brandPage) throw new AppError("NOT_FOUND", "Brand page not found.");
      brandSnapshot = brandPage.snapshots[0] ?? null;
    }

    let competitorPage = null;
    if (input.competitorPageId) {
      competitorPage = await prisma.seoCompetitorPage.findFirst({
        where: { id: input.competitorPageId, organisationId, competitorId },
      });
      if (!competitorPage) throw new AppError("NOT_FOUND", "Competitor page not found.");
    }

    const result = comparePages({
      brandUrl: brandSnapshot?.finalUrl ?? brandPage?.normalisedUrl ?? input.brandUrl,
      competitorUrl: competitorPage?.url ?? input.competitorUrl,
      brandTitle: brandSnapshot?.title ?? undefined,
      competitorTitle: competitorPage?.title ?? undefined,
      brandHeadings: (brandSnapshot?.headings as Array<{ level: number; text: string }> | null) ?? undefined,
      competitorHeadings: (competitorPage?.headings as Array<{ level: number; text: string }> | null) ?? undefined,
      brandWordCount: brandSnapshot?.wordCount ?? undefined,
      competitorWordCount: competitorPage?.wordCount ?? undefined,
      brandTopics: brandSnapshot
        ? ((brandSnapshot.headings as Array<{ level: number; text: string }> | null) ?? [])
            .filter((h) => h.level <= 2)
            .map((h) => h.text)
        : undefined,
      competitorTopics: competitorPage?.detectedTopics,
      brandStructuredData: undefined,
      competitorStructuredData: (competitorPage?.structuredData as string[] | null) ?? undefined,
      brandInternalLinks: undefined,
      competitorInternalLinks: competitorPage?.internalLinkCount ?? undefined,
      brandCtaType: undefined,
      competitorCtaType: competitorPage?.ctaType ?? undefined,
    });

    const saved = await prisma.seoCompetitorComparison.create({
      data: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        competitorId,
        brandPageId: brandPage?.id,
        competitorPageId: competitorPage?.id,
        brandUrl: brandSnapshot?.finalUrl ?? brandPage?.normalisedUrl ?? input.brandUrl,
        competitorUrl: competitorPage?.url ?? input.competitorUrl,
        comparison: result.comparison,
        limitations: result.limitations,
      },
    });

    return { comparison: result, saved };
  },
};
