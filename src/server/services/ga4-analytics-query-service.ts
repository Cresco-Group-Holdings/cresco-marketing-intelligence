import { prisma } from "@/lib/database/prisma";
import { resolveDataFreshness } from "@/lib/marketing-intelligence/format";
import type { DataFreshnessState } from "@/lib/marketing-intelligence/types";
import type { TenantContext } from "@/lib/tenancy/context";
import { ga4ConnectionService } from "@/server/services/ga4-connection-service";
import { brandService } from "@/server/services/workspace-service";

export type Ga4WebOverview = {
  connected: boolean;
  sessions: number | null;
  users: number | null;
  pageviews: number | null;
  conversions: number | null;
  freshness: DataFreshnessState;
  lastSyncedAt: string | null;
  source: "GA4" | null;
};

async function sumGa4Metric(
  brandId: string,
  organisationId: string,
  metricKey: string,
  from: Date,
  to: Date,
): Promise<number | null> {
  const result = await prisma.marketingMetricObservation.aggregate({
    where: {
      brandId,
      organisationId,
      provider: "GA4",
      metricKey,
      observedAt: { gte: from, lte: to },
    },
    _sum: { metricValue: true },
  });
  const total = result._sum.metricValue;
  if (total == null) return null;
  const value = Number(total);
  return value > 0 ? value : null;
}

export const ga4AnalyticsQueryService = {
  async getWebOverview(
    brandId: string,
    organisationId: string,
    from: Date,
    to: Date,
    context: TenantContext,
  ): Promise<Ga4WebOverview> {
    await brandService.getById(brandId, organisationId, context);
    const connection = await ga4ConnectionService.getConnectionStatus(
      brandId,
      organisationId,
      context,
    );

    if (!connection.connected || !connection.propertySelected) {
      return {
        connected: false,
        sessions: null,
        users: null,
        pageviews: null,
        conversions: null,
        freshness: "unavailable",
        lastSyncedAt: null,
        source: null,
      };
    }

    const [sessions, users, pageviews, conversions] = await Promise.all([
      sumGa4Metric(brandId, organisationId, "sessions", from, to),
      sumGa4Metric(brandId, organisationId, "activeUsers", from, to),
      sumGa4Metric(brandId, organisationId, "screenPageViews", from, to),
      sumGa4Metric(brandId, organisationId, "conversions", from, to),
    ]);

    const lastSyncedAt = connection.account?.lastSuccessfulSyncAt ?? null;
    const freshness = resolveDataFreshness(lastSyncedAt ? new Date(lastSyncedAt) : null);

    return {
      connected: true,
      sessions,
      users,
      pageviews,
      conversions,
      freshness,
      lastSyncedAt,
      source: "GA4",
    };
  },
};
