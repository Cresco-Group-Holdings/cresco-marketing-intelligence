import type { AttributionModelType } from "@prisma/client";
import {
  DEFAULT_TIME_DECAY_HALF_LIFE_DAYS,
  POSITION_BASED_FIRST_PERCENT,
  POSITION_BASED_LAST_PERCENT,
  POSITION_BASED_MIDDLE_PERCENT,
} from "@/lib/attribution/constants";
import { applyDirectTrafficPolicy, applyShowBothVariants } from "@/lib/attribution/direct-traffic";
import type {
  AttributionCalculationInput,
  AttributionCalculationResult,
  AttributionCreditLine,
  AttributionModelConfig,
  AttributionTouchpointInput,
} from "@/lib/attribution/types";

const PERCENT_TOTAL = 100;

function roundPercent(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function normaliseCredits(credits: AttributionCreditLine[]): AttributionCreditLine[] {
  if (credits.length === 0) return credits;

  const rounded = credits.map((c) => ({ ...c, creditPercent: roundPercent(c.creditPercent) }));
  const sum = rounded.reduce((acc, c) => acc + c.creditPercent, 0);
  const delta = roundPercent(PERCENT_TOTAL - sum);

  if (delta !== 0 && rounded.length > 0) {
    const last = rounded[rounded.length - 1]!;
    last.creditPercent = roundPercent(last.creditPercent + delta);
  }

  return rounded;
}

function buildCreditLines(
  touchpoints: AttributionTouchpointInput[],
  weights: number[],
  revenueValue: number,
): AttributionCreditLine[] {
  return touchpoints.map((tp, index) => ({
    touchpointId: tp.id,
    creditPercent: weights[index] ?? 0,
    creditValue: revenueValue > 0 ? roundPercent(((weights[index] ?? 0) / PERCENT_TOTAL) * revenueValue) : 0,
    channel: tp.channel,
    campaign: tp.campaign,
    contentKey: tp.contentKey,
    position: tp.position ?? index + 1,
    wasExcluded: false,
  }));
}

function firstTouchWeights(count: number): number[] {
  if (count === 0) return [];
  const weights = new Array<number>(count).fill(0);
  weights[0] = PERCENT_TOTAL;
  return weights;
}

function lastTouchWeights(count: number): number[] {
  if (count === 0) return [];
  const weights = new Array<number>(count).fill(0);
  weights[count - 1] = PERCENT_TOTAL;
  return weights;
}

function linearWeights(count: number): number[] {
  if (count === 0) return [];
  const each = PERCENT_TOTAL / count;
  return new Array<number>(count).fill(each);
}

function positionBasedWeights(count: number, config?: AttributionModelConfig): number[] {
  if (count === 0) return [];
  if (count === 1) return [PERCENT_TOTAL];
  if (count === 2) {
    const first = config?.positionFirstPercent ?? POSITION_BASED_FIRST_PERCENT;
    return [first, PERCENT_TOTAL - first];
  }

  const first = config?.positionFirstPercent ?? POSITION_BASED_FIRST_PERCENT;
  const last = config?.positionLastPercent ?? POSITION_BASED_LAST_PERCENT;
  const middleTotal = config
    ? PERCENT_TOTAL - (config.positionFirstPercent ?? POSITION_BASED_FIRST_PERCENT) - (config.positionLastPercent ?? POSITION_BASED_LAST_PERCENT)
    : POSITION_BASED_MIDDLE_PERCENT;
  const middleCount = count - 2;
  const eachMiddle = middleTotal / middleCount;

  const weights = new Array<number>(count).fill(eachMiddle);
  weights[0] = first;
  weights[count - 1] = last;
  return weights;
}

function timeDecayWeights(
  touchpoints: AttributionTouchpointInput[],
  conversionAt: Date,
  config?: AttributionModelConfig,
): number[] {
  if (touchpoints.length === 0) return [];

  const halfLifeDays = config?.timeDecayHalfLifeDays ?? DEFAULT_TIME_DECAY_HALF_LIFE_DAYS;
  const halfLifeMs = halfLifeDays * 86_400_000;
  const conversionTime = conversionAt.getTime();

  const rawWeights = touchpoints.map((tp) => {
    const ageMs = Math.max(0, conversionTime - tp.occurredAt.getTime());
    return Math.pow(0.5, ageMs / halfLifeMs);
  });

  const total = rawWeights.reduce((sum, w) => sum + w, 0);
  if (total === 0) return linearWeights(touchpoints.length);

  return rawWeights.map((w) => (w / total) * PERCENT_TOTAL);
}

function computeWeights(
  modelType: AttributionModelType,
  touchpoints: AttributionTouchpointInput[],
  conversionAt: Date,
  config?: AttributionModelConfig,
): number[] {
  const count = touchpoints.length;
  switch (modelType) {
    case "FIRST_TOUCH":
      return firstTouchWeights(count);
    case "LAST_TOUCH":
      return lastTouchWeights(count);
    case "LINEAR":
      return linearWeights(count);
    case "POSITION_BASED":
      return positionBasedWeights(count, config);
    case "TIME_DECAY":
      return timeDecayWeights(touchpoints, conversionAt, config);
    default:
      return linearWeights(count);
  }
}

function parseConfig(config?: Record<string, unknown> | null): AttributionModelConfig {
  if (!config) return {};
  return {
    timeDecayHalfLifeDays:
      typeof config.timeDecayHalfLifeDays === "number" ? config.timeDecayHalfLifeDays : undefined,
    positionFirstPercent:
      typeof config.positionFirstPercent === "number" ? config.positionFirstPercent : undefined,
    positionLastPercent:
      typeof config.positionLastPercent === "number" ? config.positionLastPercent : undefined,
  };
}

export function calculateAttributionCredits(
  input: AttributionCalculationInput,
): AttributionCalculationResult {
  const limitations: string[] = [];
  const config = parseConfig(input.config);
  const activeTouchpoints = input.touchpoints.filter((tp) => !tp.isExcluded);

  if (activeTouchpoints.length === 0) {
    limitations.push("No eligible touchpoints within lookback window.");
    return {
      credits: [],
      excludedTouchpoints: input.touchpoints,
      totalCreditPercent: 0,
      limitations,
    };
  }

  if (input.directTrafficPolicy === "SHOW_BOTH") {
    const variants = applyShowBothVariants(activeTouchpoints);
    const retainWeights = computeWeights(input.modelType, variants.retain.included, input.conversionAt, config);
    const credits = normaliseCredits(
      buildCreditLines(variants.retain.included, retainWeights, input.revenueValue),
    );
    limitations.push("Direct traffic policy: showing retain variant. Compare view includes ignore-direct variant.");
    return {
      credits,
      excludedTouchpoints: [...variants.retain.excluded, ...variants.ignoreDirect.excluded],
      totalCreditPercent: credits.reduce((sum, c) => sum + c.creditPercent, 0),
      directTrafficVariant: "retain",
      limitations,
    };
  }

  const directResult = applyDirectTrafficPolicy(activeTouchpoints, input.directTrafficPolicy);
  if (directResult.included.length === 0) {
    limitations.push("All touchpoints excluded by direct traffic policy.");
    return {
      credits: [],
      excludedTouchpoints: directResult.excluded,
      totalCreditPercent: 0,
      directTrafficVariant: directResult.variant,
      limitations,
    };
  }

  const weights = computeWeights(input.modelType, directResult.included, input.conversionAt, config);
  const credits = normaliseCredits(
    buildCreditLines(directResult.included, weights, input.revenueValue),
  );

  return {
    credits,
    excludedTouchpoints: directResult.excluded,
    totalCreditPercent: credits.reduce((sum, c) => sum + c.creditPercent, 0),
    directTrafficVariant: directResult.variant,
    limitations,
  };
}

export function filterTouchpointsByLookback(
  touchpoints: AttributionTouchpointInput[],
  conversionAt: Date,
  lookbackWindowDays: number,
): { included: AttributionTouchpointInput[]; excluded: AttributionTouchpointInput[] } {
  const windowStart = new Date(conversionAt.getTime() - lookbackWindowDays * 86_400_000);
  const included: AttributionTouchpointInput[] = [];
  const excluded: AttributionTouchpointInput[] = [];

  for (const tp of touchpoints) {
    if (tp.occurredAt >= windowStart && tp.occurredAt <= conversionAt) {
      included.push(tp);
    } else {
      excluded.push({
        ...tp,
        isExcluded: true,
        exclusionReason: tp.occurredAt < windowStart ? "outside_lookback_window" : "after_conversion",
      });
    }
  }

  return { included, excluded };
}
