import type { MarketingDataProvider } from "@prisma/client";
import type {
  RawRecordContext,
  RawRecordInput,
  RawRecordNormaliser,
  NormalisationResult,
} from "@/lib/warehouse/transformation/types";
import { GA4_METRIC_MAP, GA4_TRANSFORMATION_VERSION } from "@/lib/ga4/constants";
import { getGa4QueryDefinition } from "@/lib/ga4/query-registry";
import { getStubNormaliser, supportsStubNormaliser } from "@/lib/warehouse/transformation/stub-adapter";
import { Ga4WarehouseNormaliser } from "@/lib/warehouse/transformation/ga4-normaliser";

const ga4Normaliser = new Ga4WarehouseNormaliser();

export function getWarehouseNormaliser(provider: MarketingDataProvider): RawRecordNormaliser {
  if (provider === "GA4") return ga4Normaliser;
  if (supportsStubNormaliser(provider)) return getStubNormaliser(provider);
  throw new Error(`No warehouse normaliser registered for provider: ${provider}`);
}

export function supportsWarehouseNormaliser(provider: MarketingDataProvider): boolean {
  return provider === "GA4" || supportsStubNormaliser(provider);
}

export { getGa4QueryDefinition };
