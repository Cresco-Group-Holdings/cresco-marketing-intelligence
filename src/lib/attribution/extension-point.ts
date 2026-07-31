import type { AttributionModelType } from "@prisma/client";
import type { AttributionCalculationInput, AttributionCalculationResult } from "@/lib/attribution/types";

export type ExtendedAttributionModelType =
  | AttributionModelType
  | "DATA_DRIVEN"
  | "MARKOV"
  | "INCREMENTALITY";

export type AttributionExtensionHandler = {
  modelType: ExtendedAttributionModelType;
  calculate: (input: AttributionCalculationInput) => AttributionCalculationResult;
};

const extensionHandlers = new Map<ExtendedAttributionModelType, AttributionExtensionHandler>();

export function registerAttributionExtension(handler: AttributionExtensionHandler) {
  extensionHandlers.set(handler.modelType, handler);
}

export function getAttributionExtension(
  modelType: ExtendedAttributionModelType,
): AttributionExtensionHandler | undefined {
  return extensionHandlers.get(modelType);
}

export function isExtendedModelType(modelType: string): modelType is ExtendedAttributionModelType {
  return modelType === "DATA_DRIVEN" || modelType === "MARKOV" || modelType === "INCREMENTALITY";
}
