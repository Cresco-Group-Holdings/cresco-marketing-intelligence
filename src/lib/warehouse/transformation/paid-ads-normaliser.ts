import type { MarketingDataProvider } from "@prisma/client";
import { mapPaidAdsMetric } from "@/lib/paid-ads/metric-map";
import { PAID_ADS_TRANSFORMATION_VERSION } from "@/lib/paid-ads/constants";
import type {
  NormalisationResult,
  NormalisedCostRecord,
  RawRecordContext,
  RawRecordInput,
  RawRecordNormaliser,
} from "@/lib/warehouse/transformation/types";

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseDate(value: unknown, fallback: Date): Date {
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value.includes("T") ? value : `${value}T00:00:00.000Z`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return fallback;
}

function providerId(value: string): string {
  return value.trim().toLowerCase();
}

export class PaidAdsWarehouseNormaliser implements RawRecordNormaliser {
  readonly provider: MarketingDataProvider;

  constructor(provider: MarketingDataProvider) {
    this.provider = provider;
  }

  async normalise(record: RawRecordInput, context: RawRecordContext): Promise<NormalisationResult> {
    const recordType = record.recordType.replace(/^paid_ads_/, "");
    const payload = record.payload;
    const observedAt = parseDate(payload.date ?? record.eventTime, new Date());

    const dimensions: NormalisationResult["dimensions"] = [];
    const metrics: NormalisationResult["metrics"] = [];
    const costRecords: NormalisedCostRecord[] = [];

    const accountId = typeof payload.accountId === "string" ? payload.accountId : undefined;
    const campaignId = typeof payload.campaignId === "string" ? payload.campaignId : undefined;
    const adGroupId = typeof payload.adGroupId === "string" ? payload.adGroupId : undefined;
    const adId = typeof payload.adId === "string" ? payload.adId : undefined;
    const creativeId = typeof payload.creativeId === "string" ? payload.creativeId : undefined;

    if (accountId) {
      dimensions.push({
        entityType: "account",
        providerId: providerId(accountId),
        name: String(payload.name ?? accountId),
        metadata: {
          currency: payload.currency,
          timezone: payload.timezone,
          provider: this.provider,
        },
      });
    }

    if (recordType === "campaign" || campaignId) {
      const id = campaignId ?? String(payload.campaignId ?? "");
      if (id) {
        dimensions.push({
          entityType: "campaign",
          providerId: providerId(id),
          name: String(payload.name ?? id),
          metadata: {
            status: payload.status,
            campaignType: payload.campaignType,
            providerHierarchy: payload.metadata,
          },
        });
      }
    }

    if (recordType === "ad_group" || adGroupId) {
      const id = adGroupId ?? String(payload.adGroupId ?? "");
      if (id) {
        dimensions.push({
          entityType: "ad_group",
          providerId: providerId(id),
          name: String(payload.name ?? id),
          metadata: { status: payload.status, campaignId },
        });
      }
    }

    if (recordType === "ad" || adId) {
      const id = adId ?? String(payload.adId ?? "");
      if (id) {
        dimensions.push({
          entityType: "ad",
          providerId: providerId(id),
          name: String(payload.name ?? id),
          metadata: { status: payload.status, adType: payload.adType, adGroupId },
        });
      }
    }

    if (recordType === "creative" || creativeId) {
      const id = creativeId ?? String(payload.creativeId ?? "");
      if (id) {
        dimensions.push({
          entityType: "creative",
          providerId: providerId(id),
          name: String(payload.name ?? id),
          metadata: { creativeType: payload.creativeType, adId },
        });
      }
    }

    dimensions.push({
      entityType: "channel",
      providerId: `${this.provider.toLowerCase()}:paid`,
      name: `${this.provider} Paid`,
      metadata: { provider: this.provider, channelType: this.provider === "GOOGLE_ADS" ? "PAID_SEARCH" : "PAID_SOCIAL" },
    });

    if (recordType === "metrics_row" && payload.metrics && typeof payload.metrics === "object") {
      const rawMetrics = payload.metrics as Record<string, unknown>;
      for (const [providerMetric, value] of Object.entries(rawMetrics)) {
        const metricKey = mapPaidAdsMetric(providerMetric);
        const metricValue = parseNumber(value);
        if (!metricKey || metricValue === null) continue;

        metrics.push({
          metricKey,
          metricValue,
          observedAt,
          dimensions: {
            recordType,
            provider: this.provider,
            transformationVersion: PAID_ADS_TRANSFORMATION_VERSION,
            attributionWindow: payload.attributionWindow,
            conversionDefinitions: payload.conversionDefinitions,
            currency: payload.currency,
            accountId,
            campaignId,
            adGroupId,
            adId,
            creativeId,
          },
          dimensionProviderIds: {
            account: accountId ? providerId(accountId) : undefined,
            campaign: campaignId ? providerId(campaignId) : undefined,
            adGroup: adGroupId ? providerId(adGroupId) : undefined,
            ad: adId ? providerId(adId) : undefined,
            creative: creativeId ? providerId(creativeId) : undefined,
          },
        });
      }
    }

    if (recordType === "spend_row") {
      const amount = parseNumber(payload.amount);
      const currency = typeof payload.currency === "string" ? payload.currency : "USD";
      if (amount !== null) {
        costRecords.push({
          providerCostId: `${accountId}:${campaignId ?? ""}:${adGroupId ?? ""}:${adId ?? ""}:${observedAt.toISOString().slice(0, 10)}`,
          amount,
          currency,
          periodStart: observedAt,
          periodEnd: observedAt,
          dimensionProviderIds: {
            account: accountId ? providerId(accountId) : undefined,
            campaign: campaignId ? providerId(campaignId) : undefined,
            adGroup: adGroupId ? providerId(adGroupId) : undefined,
            ad: adId ? providerId(adId) : undefined,
          },
          metadata: {
            originalAmount: amount,
            originalCurrency: currency,
            provider: this.provider,
          },
        });

        metrics.push({
          metricKey: "cost",
          metricValue: amount,
          observedAt,
          dimensions: {
            currency,
            originalCurrency: currency,
            provider: this.provider,
            accountId,
            campaignId,
          },
          dimensionProviderIds: {
            account: accountId ? providerId(accountId) : undefined,
            campaign: campaignId ? providerId(campaignId) : undefined,
            adGroup: adGroupId ? providerId(adGroupId) : undefined,
            ad: adId ? providerId(adId) : undefined,
          },
        });
      }
    }

    const hasData = metrics.length > 0 || costRecords.length > 0 || dimensions.some((d) => d.entityType !== "channel");

    return {
      status: hasData ? "TRANSFORMED" : "REJECTED",
      metrics,
      events: [],
      dimensions,
      costRecords,
      ...(hasData ? {} : { errors: ["No paid ads data present in record"] }),
    };
  }
}

const normaliserCache = new Map<MarketingDataProvider, PaidAdsWarehouseNormaliser>();

export function getPaidAdsNormaliser(provider: MarketingDataProvider): PaidAdsWarehouseNormaliser {
  const cached = normaliserCache.get(provider);
  if (cached) return cached;
  const normaliser = new PaidAdsWarehouseNormaliser(provider);
  normaliserCache.set(provider, normaliser);
  return normaliser;
}
