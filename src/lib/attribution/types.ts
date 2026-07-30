import type { AttributionModelType, DirectTrafficPolicy } from "@prisma/client";

export type AttributionTouchpointInput = {
  id: string;
  occurredAt: Date;
  channel?: string | null;
  campaign?: string | null;
  contentKey?: string | null;
  position?: number;
  isDirect?: boolean;
  isExcluded?: boolean;
  exclusionReason?: string | null;
};

export type AttributionCreditLine = {
  touchpointId: string;
  creditPercent: number;
  creditValue?: number;
  channel?: string | null;
  campaign?: string | null;
  contentKey?: string | null;
  position?: number;
  wasExcluded?: boolean;
};

export type AttributionCalculationInput = {
  modelType: AttributionModelType;
  touchpoints: AttributionTouchpointInput[];
  revenueValue: number;
  directTrafficPolicy: DirectTrafficPolicy;
  config?: Record<string, unknown> | null;
  conversionAt: Date;
};

export type AttributionCalculationResult = {
  credits: AttributionCreditLine[];
  excludedTouchpoints: AttributionTouchpointInput[];
  totalCreditPercent: number;
  directTrafficVariant?: "retain" | "ignore_direct" | null;
  limitations: string[];
};

export type AttributionModelConfig = {
  timeDecayHalfLifeDays?: number;
  positionFirstPercent?: number;
  positionLastPercent?: number;
};
