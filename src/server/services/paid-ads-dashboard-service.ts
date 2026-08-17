import type { ConnectorType, MarketingDataProvider } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { PAID_ADS_PROVIDERS } from "@/lib/paid-ads/constants";
import { generatePaidAdsQualityWarnings } from "@/lib/paid-ads/creative-linking";
import type { TenantContext } from "@/lib/tenancy/context";
import { brandService } from "@/server/services/workspace-service";
import { paidAdsConnectionService } from "@/server/services/paid-ads-connection-service";
import { paidAdsSyncService } from "@/server/services/paid-ads-sync-service";

const PAID_ADS_CONNECTORS: ConnectorType[] = ["GOOGLE_ADS", "META", "LINKEDIN", "TIKTOK"];

export const paidAdsDashboardService = {
  async getOverview(brandId: string, organisationId: string, from: Date, to: Date, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);

    const [spend, impressions, clicks, conversions] = await Promise.all([
      this.sumMetric(brandId, organisationId, "cost", from, to),
      this.sumMetric(brandId, organisationId, "impressions", from, to),
      this.sumMetric(brandId, organisationId, "clicks", from, to),
      this.sumMetric(brandId, organisationId, "conversions", from, to),
    ]);

    const byProvider = await this.metricsByProvider(brandId, organisationId, from, to);
    const currencies = await this.distinctCurrencies(brandId, organisationId);

    return {
      spend,
      impressions,
      clicks,
      conversions,
      ctr: impressions > 0 ? clicks / impressions : 0,
      roasDisclaimer:
        "ROAS and conversion metrics use provider-specific attribution windows. Do not compare across providers without reviewing definitions.",
      byProvider,
      currencies,
      mixedCurrencyWarning: currencies.length > 1,
    };
  },

  async getCampaigns(brandId: string, organisationId: string, from: Date, to: Date, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const campaigns = await prisma.marketingCampaign.findMany({
      where: { brandId, organisationId, provider: { in: PAID_ADS_PROVIDERS } },
      orderBy: { lastSeenAt: "desc" },
      take: 50,
    });

    return Promise.all(
      campaigns.map(async (campaign) => {
        const spend = await prisma.marketingCostRecord.aggregate({
          where: {
            brandId,
            organisationId,
            marketingCampaignId: campaign.id,
            periodStart: { gte: from, lte: to },
          },
          _sum: { amount: true },
        });
        const clicks = await this.sumMetricForCampaign(campaign.id, "clicks", from, to);
        const conversions = await this.sumMetricForCampaign(campaign.id, "conversions", from, to);
        return {
          id: campaign.id,
          name: campaign.name,
          provider: campaign.provider,
          status: campaign.status,
          spend: Number(spend._sum.amount ?? 0),
          clicks,
          conversions,
          currency: campaign.budgetCurrency,
        };
      }),
    );
  },

  async getAds(brandId: string, organisationId: string, from: Date, to: Date, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.marketingAd.findMany({
      where: { brandId, organisationId, provider: { in: PAID_ADS_PROVIDERS } },
      include: { marketingAdGroup: { include: { marketingCampaign: true } }, creatives: true },
      orderBy: { lastSeenAt: "desc" },
      take: 50,
    });
  },

  async getCreatives(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.marketingCreative.findMany({
      where: { brandId, organisationId, provider: { in: PAID_ADS_PROVIDERS } },
      include: {
        marketingAd: true,
        creativeMappings: true,
      },
      orderBy: { lastSeenAt: "desc" },
      take: 50,
    });
  },

  async getConversions(brandId: string, organisationId: string, from: Date, to: Date, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const observations = await prisma.marketingMetricObservation.findMany({
      where: {
        brandId,
        organisationId,
        provider: { in: PAID_ADS_PROVIDERS },
        metricKey: { in: ["conversions", "conversion_value", "roas"] },
        observedAt: { gte: from, lte: to },
      },
      take: 500,
    });

    return observations.map((obs) => ({
      provider: obs.provider,
      metricKey: obs.metricKey,
      value: Number(obs.metricValue),
      observedAt: obs.observedAt.toISOString(),
      attributionWindow:
        obs.dimensions && typeof obs.dimensions === "object" && "attributionWindow" in (obs.dimensions as object)
          ? String((obs.dimensions as { attributionWindow?: string }).attributionWindow)
          : undefined,
      conversionDefinitions:
        obs.dimensions && typeof obs.dimensions === "object" && "conversionDefinitions" in (obs.dimensions as object)
          ? (obs.dimensions as { conversionDefinitions?: Record<string, string> }).conversionDefinitions
          : undefined,
    }));
  },

  async getQualityWarnings(
    brandId: string,
    organisationId: string,
    connectorType: ConnectorType,
    from: Date,
    to: Date,
    context: TenantContext,
  ) {
    const connection = await paidAdsConnectionService.getConnectionStatus(
      brandId,
      organisationId,
      connectorType,
      context,
    );
    const sync = await paidAdsSyncService.getSyncStatus(brandId, organisationId, connectorType, context);
    const spend = await this.sumMetric(brandId, organisationId, "cost", from, to, connectorType as MarketingDataProvider);
    const conversions = await this.sumMetric(
      brandId,
      organisationId,
      "conversions",
      from,
      to,
      connectorType as MarketingDataProvider,
    );

    return generatePaidAdsQualityWarnings({
      spend,
      conversions,
      currency: connection.account?.currency as string | undefined,
      lastSyncedAt: sync.lastSyncedDate,
      syncComplete: sync.latestSync?.status === "COMPLETED",
    });
  },

  async sumMetric(
    brandId: string,
    organisationId: string,
    metricKey: string,
    from: Date,
    to: Date,
    provider?: MarketingDataProvider,
  ) {
    const result = await prisma.marketingMetricObservation.aggregate({
      where: {
        brandId,
        organisationId,
        provider: provider ?? { in: PAID_ADS_PROVIDERS },
        metricKey,
        observedAt: { gte: from, lte: to },
      },
      _sum: { metricValue: true },
    });
    return Number(result._sum.metricValue ?? 0);
  },

  async sumMetricForCampaign(campaignId: string, metricKey: string, from: Date, to: Date) {
    const result = await prisma.marketingMetricObservation.aggregate({
      where: {
        marketingCampaignId: campaignId,
        metricKey,
        observedAt: { gte: from, lte: to },
      },
      _sum: { metricValue: true },
    });
    return Number(result._sum.metricValue ?? 0);
  },

  async metricsByProvider(brandId: string, organisationId: string, from: Date, to: Date) {
    const groups = await prisma.marketingMetricObservation.groupBy({
      by: ["provider", "metricKey"],
      where: {
        brandId,
        organisationId,
        provider: { in: PAID_ADS_PROVIDERS },
        observedAt: { gte: from, lte: to },
        metricKey: { in: ["cost", "impressions", "clicks", "conversions"] },
      },
      _sum: { metricValue: true },
    });

    const result: Record<string, Record<string, number>> = {};
    for (const group of groups) {
      const provider = group.provider;
      if (!result[provider]) result[provider] = {};
      result[provider][group.metricKey] = Number(group._sum.metricValue ?? 0);
    }
    return result;
  },

  async distinctCurrencies(brandId: string, organisationId: string) {
    const accounts = await prisma.marketingAccount.findMany({
      where: { brandId, organisationId, provider: { in: PAID_ADS_PROVIDERS } },
      select: { currency: true },
    });
    return [...new Set(accounts.map((a) => a.currency).filter(Boolean))] as string[];
  },

  listConnectors() {
    return PAID_ADS_CONNECTORS;
  },
};
