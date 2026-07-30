import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { gscMetricsFromRow } from "@/lib/keywords/metric-registry";
import { evaluateOpportunities } from "@/lib/keywords/opportunity-rules";
import type { TenantContext } from "@/lib/tenancy/context";
import { seoKeywordService } from "@/server/services/seo-keyword-service";
import { brandService } from "@/server/services/workspace-service";

export const seoKeywordGscSyncService = {
  async syncFromWarehouseQueries(brandId: string, organisationId: string, context: TenantContext) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const queries = await prisma.marketingSearchQuery.findMany({
      where: { brandId, organisationId, status: "ACTIVE", isAnonymized: false },
      include: {
        metricObservations: {
          orderBy: { observedAt: "desc" },
          take: 30,
        },
      },
      take: 500,
    });

    let synced = 0;
    for (const query of queries) {
      const keyword = await seoKeywordService.upsert(
        brandId,
        organisationId,
        {
          keyword: query.queryText,
          sourceType: "SEARCH_CONSOLE",
          provider: "GOOGLE_SEARCH_CONSOLE",
          externalId: query.providerQueryId,
        },
        context,
      );

      const latestByDate = new Map<string, { clicks: number; impressions: number; ctr: number; position: number }>();
      for (const obs of query.metricObservations) {
        const date = obs.observedAt.toISOString().slice(0, 10);
        const dims = (obs.dimensions ?? {}) as Record<string, number>;
        const existing = latestByDate.get(date) ?? { clicks: 0, impressions: 0, ctr: 0, position: 0 };
        if (obs.metricKey === "clicks") existing.clicks = Number(obs.metricValue);
        if (obs.metricKey === "impressions") existing.impressions = Number(obs.metricValue);
        if (obs.metricKey === "ctr") existing.ctr = Number(obs.metricValue);
        if (obs.metricKey === "position") existing.position = Number(obs.metricValue);
        if (dims.clicks != null) existing.clicks = dims.clicks;
        if (dims.impressions != null) existing.impressions = dims.impressions;
        if (dims.ctr != null) existing.ctr = dims.ctr;
        if (dims.position != null) existing.position = dims.position;
        latestByDate.set(date, existing);
      }

      for (const [date, row] of latestByDate) {
        const metrics = gscMetricsFromRow({ ...row, date });
        for (const metric of metrics) {
          if (metric.value == null) continue;
          await prisma.seoKeywordMetric.upsert({
            where: {
              keywordId_metricType_provider_source_location_language_measuredAt: {
                keywordId: keyword.id,
                metricType: metric.metricType,
                provider: metric.provider,
                source: metric.source,
                location: metric.location ?? "",
                language: metric.language ?? "en",
                measuredAt: metric.measuredAt,
              },
            },
            create: {
              organisationId,
              keywordId: keyword.id,
              metricType: metric.metricType,
              provider: metric.provider,
              source: metric.source,
              value: metric.value,
              measuredAt: metric.measuredAt,
              providerDefinition: "Google Search Console",
              confidence: 1,
            },
            update: { value: metric.value },
          });
        }
      }
      synced += 1;
    }

    return { synced, total: queries.length };
  },
};

export const seoKeywordOpportunityService = {
  async evaluateForBrand(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const keywords = await prisma.seoKeyword.findMany({
      where: { brandId, organisationId, status: "ACTIVE" },
      include: {
        metrics: { orderBy: { measuredAt: "desc" }, take: 10 },
        pageMappings: true,
      },
      take: 200,
    });

    let created = 0;
    for (const keyword of keywords) {
      const impressions = keyword.metrics.find((m) => m.metricType === "IMPRESSIONS");
      const clicks = keyword.metrics.find((m) => m.metricType === "CLICKS");
      const ctr = keyword.metrics.find((m) => m.metricType === "CTR");
      const position = keyword.metrics.find((m) => m.metricType === "AVERAGE_POSITION");

      const opportunities = evaluateOpportunities(keyword.displayKeyword, {
        impressions: impressions?.value,
        clicks: clicks?.value,
        ctr: ctr?.value,
        averagePosition: position?.value,
        hasTargetPage: keyword.pageMappings.some((m) =>
          ["PRIMARY_TARGET", "SECONDARY_TARGET"].includes(m.relationType),
        ),
      });

      for (const opp of opportunities) {
        const existing = await prisma.seoKeywordOpportunity.findFirst({
          where: {
            keywordId: keyword.id,
            opportunityType: opp.opportunityType,
            status: "OPEN",
          },
        });
        if (existing) continue;

        await prisma.seoKeywordOpportunity.create({
          data: {
            organisationId,
            projectId: keyword.projectId,
            brandId,
            keywordId: keyword.id,
            opportunityType: opp.opportunityType,
            severity: opp.severity,
            title: opp.title,
            explanation: opp.explanation,
            evidence: opp.evidence as Prisma.InputJsonValue,
            recommendedAction: opp.recommendedAction,
          },
        });
        created += 1;
      }
    }

    return { evaluated: keywords.length, created };
  },

  async list(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.seoKeywordOpportunity.findMany({
      where: { brandId, organisationId, status: "OPEN" },
      include: { keyword: { select: { displayKeyword: true, normalisedKeyword: true } } },
      orderBy: { detectedAt: "desc" },
      take: 100,
    });
  },
};
