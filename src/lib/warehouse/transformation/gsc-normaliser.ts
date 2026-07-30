import type { MarketingDataProvider } from "@prisma/client";
import { GSC_ANONYMIZED_QUERY_PATTERNS, GSC_METRIC_MAP, GSC_TRANSFORMATION_VERSION } from "@/lib/gsc/constants";
import { getGscQueryDefinition } from "@/lib/gsc/query-registry";
import { providerIdForValue } from "@/lib/connectors/adapters/gsc-search-console-adapter";
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
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value.includes("T") ? value : `${value}T00:00:00.000Z`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return fallback;
}

function isAnonymizedQuery(query: string): boolean {
  return GSC_ANONYMIZED_QUERY_PATTERNS.some((pattern) => pattern.test(query));
}

export class GscWarehouseNormaliser implements RawRecordNormaliser {
  readonly provider: MarketingDataProvider = "GOOGLE_SEARCH_CONSOLE";

  async normalise(record: RawRecordInput, context: RawRecordContext): Promise<NormalisationResult> {
    const reportKey = String(record.payload.reportKey ?? "unknown");
    const definition = getGscQueryDefinition(reportKey);
    const observedAt = parseDate(record.payload.date ?? record.eventTime, new Date());
    const grain = String(record.payload.grain ?? definition?.grain ?? "aggregate");

    const metrics = Object.entries(GSC_METRIC_MAP)
      .map(([gscMetric, canonicalKey]) => {
        const metricValue = parseNumber(record.payload[gscMetric]);
        if (metricValue === null) return null;
        return {
          metricKey: canonicalKey,
          metricValue,
          observedAt,
          grain: grain as NormalisationResult["metrics"][number]["grain"],
          dimensions: {
            reportKey,
            grain,
            siteUrl: record.payload.siteUrl,
            transformationVersion: GSC_TRANSFORMATION_VERSION,
            date: record.payload.date,
            query: record.payload.query,
            page: record.payload.page,
            country: record.payload.country,
            device: record.payload.device,
            searchAppearance: record.payload.searchAppearance,
          },
          dimensionProviderIds: {
            searchQuery:
              typeof record.payload.query === "string"
                ? providerIdForValue(String(record.payload.query))
                : undefined,
            landingPage:
              typeof record.payload.page === "string"
                ? providerIdForValue(String(record.payload.page))
                : undefined,
            geography:
              typeof record.payload.country === "string"
                ? providerIdForValue(String(record.payload.country))
                : undefined,
            device:
              typeof record.payload.device === "string"
                ? providerIdForValue(String(record.payload.device))
                : undefined,
          },
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    const dimensions: NormalisationResult["dimensions"] = [
      {
        entityType: "channel",
        providerId: "gsc:organic_search",
        name: "Organic Search",
        metadata: { provider: "GOOGLE_SEARCH_CONSOLE", channelType: "ORGANIC_SEARCH" },
      },
    ];

    if (typeof record.payload.query === "string") {
      const query = String(record.payload.query);
      dimensions.push({
        entityType: "search_query",
        providerId: providerIdForValue(query),
        name: query,
        metadata: { isAnonymized: isAnonymizedQuery(query), grain: "query" },
      });
    }

    if (typeof record.payload.page === "string") {
      const page = String(record.payload.page);
      let path = page;
      try {
        path = new URL(page).pathname;
      } catch {
        /* keep original */
      }
      dimensions.push({
        entityType: "landing_page",
        providerId: providerIdForValue(page),
        name: page,
        metadata: { url: page, path, grain: "page" },
      });
    }

    if (typeof record.payload.country === "string") {
      const country = String(record.payload.country);
      dimensions.push({
        entityType: "geography",
        providerId: providerIdForValue(country),
        name: country,
        metadata: { countryCode: country },
      });
    }

    if (typeof record.payload.device === "string") {
      const device = String(record.payload.device);
      dimensions.push({
        entityType: "device",
        providerId: providerIdForValue(device),
        name: device,
        metadata: { deviceCategory: device },
      });
    }

    return {
      status: metrics.length ? "TRANSFORMED" : "REJECTED",
      metrics,
      events: [],
      dimensions,
      ...(metrics.length ? {} : { errors: ["No GSC metrics present in row"] }),
    };
  }
}
