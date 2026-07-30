import type { MarketingDataProvider } from "@prisma/client";
import type {
  RawRecordContext,
  RawRecordInput,
  RawRecordNormaliser,
  NormalisationResult,
} from "@/lib/warehouse/transformation/types";

const SUPPORTED_PROVIDERS: MarketingDataProvider[] = ["MANUAL_IMPORT", "FIRST_PARTY"];

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseDate(value: unknown, fallback: Date): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return fallback;
}

export class StubWarehouseNormaliser implements RawRecordNormaliser {
  readonly provider: MarketingDataProvider;

  constructor(provider: MarketingDataProvider) {
    if (!SUPPORTED_PROVIDERS.includes(provider)) {
      throw new Error(`Stub normaliser does not support provider: ${provider}`);
    }
    this.provider = provider;
  }

  async normalise(record: RawRecordInput, context: RawRecordContext): Promise<NormalisationResult> {
    const observedAt = parseDate(record.eventTime ?? record.payload.observedAt, new Date());
    const metrics = Object.entries(record.payload)
      .filter(([key]) => !["eventName", "event_name", "providerEventId", "provider_event_id"].includes(key))
      .flatMap(([key, value]) => {
        const metricValue = parseNumber(value);
        if (metricValue === null) return [];
        return [{ metricKey: key, metricValue, observedAt, dimensions: record.metadata }];
      });

    const eventName =
      (typeof record.payload.eventName === "string" && record.payload.eventName) ||
      (typeof record.payload.event_name === "string" && record.payload.event_name) ||
      null;

    const events = eventName
      ? [
          {
            providerEventId:
              (typeof record.payload.providerEventId === "string" && record.payload.providerEventId) ||
              (typeof record.payload.provider_event_id === "string" && record.payload.provider_event_id) ||
              record.providerRecordId,
            eventName,
            occurredAt: observedAt,
            properties: record.payload,
          },
        ]
      : [];

    const channelName =
      (typeof record.payload.channel === "string" && record.payload.channel) ||
      (typeof record.payload.source === "string" && record.payload.source) ||
      context.provider.toLowerCase();

    return {
      status: metrics.length || events.length ? "TRANSFORMED" : "REJECTED",
      metrics,
      events,
      dimensions: [
        {
          entityType: "channel",
          providerId: `${context.provider}:default`,
          name: channelName,
          metadata: { stub: true, provider: context.provider },
        },
      ],
      ...(metrics.length || events.length ? {} : { errors: ["No normalisable metrics or events in payload"] }),
    };
  }
}

export function getStubNormaliser(provider: MarketingDataProvider): RawRecordNormaliser {
  return new StubWarehouseNormaliser(provider);
}

export function supportsStubNormaliser(provider: MarketingDataProvider): boolean {
  return SUPPORTED_PROVIDERS.includes(provider);
}
