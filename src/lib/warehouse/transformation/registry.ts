import type { MarketingDataProvider } from "@prisma/client";
import { Ga4WarehouseNormaliser } from "@/lib/warehouse/transformation/ga4-normaliser";
import { GscWarehouseNormaliser } from "@/lib/warehouse/transformation/gsc-normaliser";
import { getPaidAdsNormaliser } from "@/lib/warehouse/transformation/paid-ads-normaliser";
import { getStubNormaliser, supportsStubNormaliser } from "@/lib/warehouse/transformation/stub-adapter";
import type { RawRecordNormaliser } from "@/lib/warehouse/transformation/types";
import { isPaidAdsProvider } from "@/lib/paid-ads/constants";

const ga4Normaliser = new Ga4WarehouseNormaliser();
const gscNormaliser = new GscWarehouseNormaliser();

export function getWarehouseNormaliser(provider: MarketingDataProvider): RawRecordNormaliser {
  if (provider === "GA4") return ga4Normaliser;
  if (provider === "GOOGLE_SEARCH_CONSOLE") return gscNormaliser;
  if (isPaidAdsProvider(provider)) return getPaidAdsNormaliser(provider);
  if (supportsStubNormaliser(provider)) return getStubNormaliser(provider);
  throw new Error(`No warehouse normaliser registered for provider: ${provider}`);
}

export function supportsWarehouseNormaliser(provider: MarketingDataProvider): boolean {
  return (
    provider === "GA4" ||
    provider === "GOOGLE_SEARCH_CONSOLE" ||
    isPaidAdsProvider(provider) ||
    supportsStubNormaliser(provider)
  );
}

export function metricSourceForProvider(provider: MarketingDataProvider): "MANUAL_IMPORT" | "FIRST_PARTY" | "CONNECTOR" {
  if (provider === "MANUAL_IMPORT") return "MANUAL_IMPORT";
  if (provider === "FIRST_PARTY") return "FIRST_PARTY";
  return "CONNECTOR";
}
