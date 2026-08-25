import { resolveMarketingDateRange } from "@/lib/marketing/date-range";
import type { MarketingIntelligenceContext } from "@/lib/marketing-intelligence/types";
import { resolveDataFreshness } from "@/lib/marketing-intelligence/format";
import type { TenantContext } from "@/lib/tenancy/context";
import { paidAdsConnectionService } from "@/server/services/paid-ads-connection-service";
import { paidAdsDashboardService } from "@/server/services/paid-ads-dashboard-service";
import { socialConnectionService } from "@/server/services/social-connection-service";
import { socialAnalyticsQueryService } from "@/server/services/social-analytics-query-service";
import { publicationService } from "@/server/services/publication-service";
import {
  latestOrganicSyncAt,
  latestPaidSyncAt,
  sumPaidRevenue,
} from "@/server/services/marketing-command-centre-metrics";

const PAID_CONNECTORS = ["GOOGLE_ADS", "META", "TIKTOK", "LINKEDIN"] as const;
const ORGANIC_PROVIDERS = ["LINKEDIN", "INSTAGRAM", "FACEBOOK", "X", "YOUTUBE", "TIKTOK"] as const;

async function safePaidOverview(
  brandId: string,
  organisationId: string,
  from: Date,
  to: Date,
  tenant: TenantContext,
) {
  try {
    return await paidAdsDashboardService.getOverview(brandId, organisationId, from, to, tenant);
  } catch {
    return { spend: 0, conversions: 0, impressions: 0, clicks: 0, byProvider: [] };
  }
}

/**
 * Builds canonical MarketingIntelligenceContext for background jobs (digest, automations).
 * Uses the same data sources as Command Centre without requiring an active user session.
 */
export const marketingIntelligenceContextService = {
  async buildWeeklyContext(input: {
    organisationId: string;
    brandId: string;
    tenant: TenantContext;
  }): Promise<MarketingIntelligenceContext> {
    const range = resolveMarketingDateRange({ preset: "7d" });
    const { brandId, organisationId, tenant } = input;

    const [
      paidOverview,
      previousPaidOverview,
      currentRevenue,
      previousRevenue,
      paidConnections,
      socialCatalogue,
      publications,
      socialOverview,
      previousSocialOverview,
      paidSyncAt,
      organicSyncAt,
    ] = await Promise.all([
      safePaidOverview(brandId, organisationId, range.from, range.to, tenant),
      safePaidOverview(brandId, organisationId, range.comparisonFrom, range.comparisonTo, tenant),
      sumPaidRevenue(brandId, organisationId, range.from, range.to),
      sumPaidRevenue(brandId, organisationId, range.comparisonFrom, range.comparisonTo),
      Promise.all(
        PAID_CONNECTORS.map(async (connector) => ({
          connector,
          status: await paidAdsConnectionService
            .getConnectionStatus(brandId, organisationId, connector, tenant)
            .catch(() => ({ connected: false, accountSelected: false, account: null })),
        })),
      ),
      socialConnectionService.getCatalogue(brandId, organisationId, tenant).catch(() => []),
      publicationService.list(brandId, organisationId, tenant).catch(() => []),
      socialAnalyticsQueryService
        .overview(brandId, organisationId, { from: range.from, to: range.to }, tenant)
        .catch(() => null),
      socialAnalyticsQueryService
        .overview(
          brandId,
          organisationId,
          { from: range.comparisonFrom, to: range.comparisonTo },
          tenant,
        )
        .catch(() => null),
      latestPaidSyncAt(brandId, organisationId),
      latestOrganicSyncAt(brandId, organisationId),
    ]);

    const connectedPaidCount = paidConnections.filter(
      (item: { connector: string; status: { connected: boolean } }) => item.status.connected,
    ).length;
    const connectedOrganic = new Set(
      socialCatalogue
        .filter((item) => item.connection != null)
        .map((item) => item.provider),
    );
    const publishedInRange = publications.filter(
      (item: { status: string }) => item.status === "PUBLISHED",
    ).length;
    const scheduledUpcoming = publications.filter(
      (item: { status: string }) => item.status === "SCHEDULED",
    ).length;

    return {
      rangeLabel: range.label,
      comparisonLabel: range.comparisonLabel,
      paid: {
        connectedCount: connectedPaidCount,
        totalProviders: PAID_CONNECTORS.length,
        spend: paidOverview.spend,
        previousSpend: previousPaidOverview.spend,
        conversions: paidOverview.conversions,
        previousConversions: previousPaidOverview.conversions,
        revenue: currentRevenue,
        previousRevenue,
        roas: paidOverview.spend > 0 ? currentRevenue / paidOverview.spend : null,
        previousRoas:
          previousPaidOverview.spend > 0 ? previousRevenue / previousPaidOverview.spend : null,
        cpa:
          paidOverview.conversions > 0 ? paidOverview.spend / paidOverview.conversions : null,
        previousCpa:
          previousPaidOverview.conversions > 0
            ? previousPaidOverview.spend / previousPaidOverview.conversions
            : null,
        byProvider: [],
        freshness: resolveDataFreshness(paidSyncAt),
        lastSyncedAt: paidSyncAt,
      },
      organic: {
        connectedCount: connectedOrganic.size,
        totalProviders: ORGANIC_PROVIDERS.length,
        reach: socialOverview?.totals?.reach ?? null,
        previousReach: previousSocialOverview?.totals?.reach ?? null,
        engagement:
          socialOverview?.totals != null
            ? (socialOverview.totals.likes ?? 0) +
              (socialOverview.totals.comments ?? 0) +
              (socialOverview.totals.shares ?? 0)
            : null,
        previousEngagement:
          previousSocialOverview?.totals != null
            ? (previousSocialOverview.totals.likes ?? 0) +
              (previousSocialOverview.totals.comments ?? 0) +
              (previousSocialOverview.totals.shares ?? 0)
            : null,
        engagementRate: socialOverview?.derived?.engagementRate ?? null,
        published: publishedInRange,
        scheduled: scheduledUpcoming,
        channels: [],
        freshness: resolveDataFreshness(organicSyncAt),
        lastSyncedAt: organicSyncAt,
      },
      publishing: {
        publishedInRange,
        scheduledUpcoming,
        daysWithoutScheduled: scheduledUpcoming === 0 ? 7 : 0,
        strongestOrganicFormat: null,
      },
      connectivity: {
        paidConnected: connectedPaidCount,
        paidTotal: PAID_CONNECTORS.length,
        organicConnected: connectedOrganic.size,
        organicTotal: ORGANIC_PROVIDERS.length,
      },
    };
  },
};
