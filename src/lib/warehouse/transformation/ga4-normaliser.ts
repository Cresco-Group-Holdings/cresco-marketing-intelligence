import type { MarketingDataProvider } from "@prisma/client";
import { GA4_METRIC_MAP, GA4_TRANSFORMATION_VERSION } from "@/lib/ga4/constants";
import { getGa4QueryDefinition } from "@/lib/ga4/query-registry";
import type {
  NormalisationResult,
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
  if (typeof value === "string" && /^\d{8}$/.test(value)) {
    const iso = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T00:00:00.000Z`;
    const parsed = new Date(iso);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return fallback;
}

export class Ga4WarehouseNormaliser implements RawRecordNormaliser {
  readonly provider: MarketingDataProvider = "GA4";

  async normalise(record: RawRecordInput, context: RawRecordContext): Promise<NormalisationResult> {
    const reportKey =
      (typeof record.payload.reportKey === "string" && record.payload.reportKey) || "unknown";
    const definition = getGa4QueryDefinition(reportKey);
    const observedAt = parseDate(record.payload.date ?? record.eventTime, new Date());

    const metrics = Object.entries(GA4_METRIC_MAP)
      .map(([ga4Metric, canonicalKey]) => {
        const metricValue = parseNumber(record.payload[ga4Metric]);
        if (metricValue === null) return null;
        return {
          metricKey: canonicalKey,
          metricValue,
          observedAt,
          dimensions: {
            reportKey,
            propertyId: record.payload.propertyId,
            transformationVersion: GA4_TRANSFORMATION_VERSION,
            date: record.payload.date,
            sessionSource: record.payload.sessionSource,
            sessionMedium: record.payload.sessionMedium,
            sessionCampaignName: record.payload.sessionCampaignName,
            landingPagePlusQueryString: record.payload.landingPagePlusQueryString,
            pagePath: record.payload.pagePath,
            deviceCategory: record.payload.deviceCategory,
            country: record.payload.country,
          },
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    const dimensions: NormalisationResult["dimensions"] = [];
    const source = String(record.payload.sessionSource ?? "direct");
    const medium = String(record.payload.sessionMedium ?? "(none)");
    const campaign = String(record.payload.sessionCampaignName ?? "(not set)");

    if (definition?.entityTypes.includes("channel")) {
      dimensions.push({
        entityType: "channel",
        providerId: `ga4:${source}/${medium}`,
        name: `${source} / ${medium}`,
        metadata: {
          source,
          medium,
          provider: "GA4",
          reportKey,
        },
      });
    }

    if (definition?.entityTypes.includes("campaign") && campaign !== "(not set)") {
      dimensions.push({
        entityType: "campaign",
        providerId: `ga4:${campaign}`,
        name: campaign,
        metadata: { source, medium, provider: "GA4" },
      });
    }

    const landingPage = record.payload.landingPagePlusQueryString;
    if (definition?.entityTypes.includes("landing_page") && typeof landingPage === "string") {
      dimensions.push({
        entityType: "content",
        providerId: `ga4:landing:${landingPage}`,
        name: landingPage,
        metadata: { landingPage, provider: "GA4", entitySubtype: "landing_page" },
      });
    }

    return {
      status: metrics.length ? "TRANSFORMED" : "REJECTED",
      metrics,
      events: [],
      dimensions,
      ...(metrics.length ? {} : { errors: ["No GA4 metrics present in row"] }),
    };
  }
}
