import { prisma } from "@/lib/database/prisma";
import { generateSearchOpportunities } from "@/lib/gsc/opportunities";
import type { TenantContext } from "@/lib/tenancy/context";
import { brandService } from "@/server/services/workspace-service";
import { gscConnectionService } from "@/server/services/gsc-connection-service";
import { gscSyncService } from "@/server/services/gsc-sync-service";

export const gscDashboardService = {
  async getOverview(brandId: string, organisationId: string, from: Date, to: Date, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const [clicks, impressions, avgPosition] = await Promise.all([
      this.sumMetric(brandId, organisationId, "clicks", from, to),
      this.sumMetric(brandId, organisationId, "impressions", from, to),
      this.avgMetric(brandId, organisationId, "avg_position", from, to),
    ]);

    const sync = await gscSyncService.getSyncStatus(brandId, organisationId, context);
    const connection = await gscConnectionService.getConnectionStatus(brandId, organisationId, context);

    return {
      clicks,
      impressions,
      ctr: impressions > 0 ? clicks / impressions : 0,
      avgPosition,
      freshness: {
        lastSyncedDate: sync.lastSyncedDate,
        dataDelayDays: sync.dataDelayDays,
        disclaimer: "Search Console data is typically 2–3 days behind and current-day data is incomplete.",
      },
      connection,
    };
  },

  async getTopQueries(brandId: string, organisationId: string, from: Date, to: Date, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.marketingMetricObservation.groupBy({
      by: ["marketingSearchQueryId"],
      where: {
        brandId,
        organisationId,
        provider: "GOOGLE_SEARCH_CONSOLE",
        metricKey: "clicks",
        observedAt: { gte: from, lte: to },
        marketingSearchQueryId: { not: null },
      },
      _sum: { metricValue: true },
      orderBy: { _sum: { metricValue: "desc" } },
      take: 25,
    }).then(async (groups) => {
      const queries = await prisma.marketingSearchQuery.findMany({
        where: { id: { in: groups.map((g) => g.marketingSearchQueryId!).filter(Boolean) } },
      });
      const queryMap = new Map(queries.map((q) => [q.id, q]));
      return groups.map((group) => ({
        query: queryMap.get(group.marketingSearchQueryId!)?.queryText ?? "Unknown",
        clicks: Number(group._sum.metricValue ?? 0),
        isAnonymized: queryMap.get(group.marketingSearchQueryId!)?.isAnonymized ?? false,
      }));
    });
  },

  async getTopPages(brandId: string, organisationId: string, from: Date, to: Date, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.marketingMetricObservation.groupBy({
      by: ["marketingLandingPageId"],
      where: {
        brandId,
        organisationId,
        provider: "GOOGLE_SEARCH_CONSOLE",
        metricKey: "clicks",
        observedAt: { gte: from, lte: to },
        marketingLandingPageId: { not: null },
      },
      _sum: { metricValue: true },
      orderBy: { _sum: { metricValue: "desc" } },
      take: 25,
    }).then(async (groups) => {
      const pages = await prisma.marketingLandingPage.findMany({
        where: { id: { in: groups.map((g) => g.marketingLandingPageId!).filter(Boolean) } },
      });
      const pageMap = new Map(pages.map((p) => [p.id, p]));
      return groups.map((group) => ({
        page: pageMap.get(group.marketingLandingPageId!)?.url ?? "Unknown",
        clicks: Number(group._sum.metricValue ?? 0),
      }));
    });
  },

  async getOpportunities(brandId: string, organisationId: string, from: Date, to: Date, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const observations = await prisma.marketingMetricObservation.findMany({
      where: {
        brandId,
        organisationId,
        provider: "GOOGLE_SEARCH_CONSOLE",
        observedAt: { gte: from, lte: to },
      },
      include: {
        marketingSearchQuery: true,
        marketingLandingPage: true,
      },
      take: 5000,
    });

    const rows = new Map<string, {
      query?: string;
      page?: string;
      clicks: number;
      impressions: number;
      ctr: number;
      position: number;
    }>();

    for (const obs of observations) {
      const key = `${obs.marketingSearchQueryId ?? ""}:${obs.marketingLandingPageId ?? ""}`;
      const row = rows.get(key) ?? {
        query: obs.marketingSearchQuery?.queryText,
        page: obs.marketingLandingPage?.url,
        clicks: 0,
        impressions: 0,
        ctr: 0,
        position: 0,
      };
      const value = Number(obs.metricValue);
      if (obs.metricKey === "clicks") row.clicks += value;
      if (obs.metricKey === "impressions") row.impressions += value;
      if (obs.metricKey === "ctr") row.ctr = value;
      if (obs.metricKey === "avg_position") row.position = value;
      rows.set(key, row);
    }

    return generateSearchOpportunities([...rows.values()]);
  },

  async getIndexing(brandId: string, organisationId: string, context: TenantContext) {
    const account = await gscConnectionService.requireConnectorAccount(brandId, organisationId, context);
    const [inspections, sitemaps] = await Promise.all([
      prisma.searchConsoleUrlInspection.findMany({
        where: { brandId, organisationId },
        orderBy: { inspectedAt: "desc" },
        take: 20,
      }),
      prisma.searchConsoleSitemap.findMany({
        where: { connectorAccountId: account.id },
        orderBy: { fetchedAt: "desc" },
      }),
    ]);
    return { inspections, sitemaps };
  },

  async sumMetric(
    brandId: string,
    organisationId: string,
    metricKey: string,
    from: Date,
    to: Date,
  ) {
    const result = await prisma.marketingMetricObservation.aggregate({
      where: {
        brandId,
        organisationId,
        provider: "GOOGLE_SEARCH_CONSOLE",
        metricKey,
        observedAt: { gte: from, lte: to },
      },
      _sum: { metricValue: true },
    });
    return Number(result._sum.metricValue ?? 0);
  },

  async avgMetric(
    brandId: string,
    organisationId: string,
    metricKey: string,
    from: Date,
    to: Date,
  ) {
    const result = await prisma.marketingMetricObservation.aggregate({
      where: {
        brandId,
        organisationId,
        provider: "GOOGLE_SEARCH_CONSOLE",
        metricKey,
        observedAt: { gte: from, lte: to },
      },
      _avg: { metricValue: true },
    });
    return Number(result._avg.metricValue ?? 0);
  },
};
