import type { AttributionModelType, DirectTrafficPolicy } from "@prisma/client";

export const ATTRIBUTION_DISCLAIMER =
  "Attribution is an analytical model, not proof of causation. Credit assignments depend on model choice, lookback window, and data completeness.";

export const ATTRIBUTION_MODEL_LABELS: Record<AttributionModelType, string> = {
  FIRST_TOUCH: "First touch",
  LAST_TOUCH: "Last touch",
  LINEAR: "Linear",
  POSITION_BASED: "Position-based (40/20/40)",
  TIME_DECAY: "Time decay",
};

export const DIRECT_TRAFFIC_POLICY_LABELS: Record<DirectTrafficPolicy, string> = {
  RETAIN: "Retain direct touchpoints",
  IGNORE_WHEN_PRIOR_KNOWN: "Ignore direct when a prior known channel exists",
  SHOW_BOTH: "Show both analytical variants",
};

export const DEFAULT_LOOKBACK_WINDOW_DAYS = 90;
export const DEFAULT_TIME_DECAY_HALF_LIFE_DAYS = 7;
export const POSITION_BASED_FIRST_PERCENT = 40;
export const POSITION_BASED_LAST_PERCENT = 40;
export const POSITION_BASED_MIDDLE_PERCENT = 20;

export const ATTRIBUTION_MODEL_TYPES = [
  "FIRST_TOUCH",
  "LAST_TOUCH",
  "LINEAR",
  "POSITION_BASED",
  "TIME_DECAY",
] as const satisfies readonly AttributionModelType[];

export const LAUNCH_ATTRIBUTION_MODELS = [
  "FIRST_TOUCH",
  "LAST_TOUCH",
  "LINEAR",
] as const satisfies readonly AttributionModelType[];

export const ADVANCED_ATTRIBUTION_MODELS = [
  "POSITION_BASED",
  "TIME_DECAY",
] as const satisfies readonly AttributionModelType[];

export function isAdvancedAttributionModel(type: AttributionModelType): boolean {
  return (ADVANCED_ATTRIBUTION_MODELS as readonly string[]).includes(type);
}

export function buildAttributionModelLabel(type: AttributionModelType): string {
  const base = ATTRIBUTION_MODEL_LABELS[type];
  return isAdvancedAttributionModel(type) ? `${base} (Advanced)` : base;
}

export const DEFAULT_MODEL_CONFIGS: Record<
  AttributionModelType,
  { name: string; isDefault?: boolean }
> = {
  FIRST_TOUCH: { name: "First touch", isDefault: true },
  LAST_TOUCH: { name: "Last touch" },
  LINEAR: { name: "Linear" },
  POSITION_BASED: { name: "Position-based" },
  TIME_DECAY: { name: "Time decay" },
};
