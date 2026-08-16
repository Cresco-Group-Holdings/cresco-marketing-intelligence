import type { AttributionModelType } from "@prisma/client";
import { calculateAttributionCredits, filterTouchpointsByLookback } from "@/lib/attribution/models";
import type { AttributionTouchpointInput } from "@/lib/attribution/types";

export type ChannelAttributionAggregate = {
  channel: string;
  creditPercent: number;
  creditValue: number;
  conversions: number;
};

export type JourneyAttributionInput = {
  journeyEnd: string | null;
  journeyStart: string;
  revenueValue: number;
  status: string;
  touchpoints: Array<{
    id: string;
    occurredAt: string;
    channel: string | null;
    campaign?: string | null;
    contentKey?: string | null;
    position: number;
    isExcluded: boolean;
  }>;
};

export function computeAttributionFromJourneys(
  journeys: JourneyAttributionInput[],
  modelType: AttributionModelType,
  lookbackWindowDays: number,
): {
  attributedRevenue: number;
  attributedConversions: number;
  channelBreakdown: ChannelAttributionAggregate[];
  unattributedConversions: number;
} {
  const channelMap = new Map<string, ChannelAttributionAggregate>();
  let attributedRevenue = 0;
  let attributedConversions = 0;
  let unattributedConversions = 0;

  for (const journey of journeys) {
    const conversionAt = new Date(journey.journeyEnd ?? journey.journeyStart);
    const touchpoints: AttributionTouchpointInput[] = journey.touchpoints.map((tp) => ({
      id: tp.id,
      occurredAt: new Date(tp.occurredAt),
      channel: tp.channel,
      campaign: tp.campaign ?? null,
      contentKey: tp.contentKey ?? null,
      position: tp.position,
      isExcluded: tp.isExcluded,
    }));

    const { included } = filterTouchpointsByLookback(
      touchpoints,
      conversionAt,
      lookbackWindowDays,
    );

    if (included.length === 0) {
      unattributedConversions += 1;
      continue;
    }

    const result = calculateAttributionCredits({
      modelType,
      touchpoints: included,
      revenueValue: journey.revenueValue,
      directTrafficPolicy: "RETAIN",
      conversionAt,
    });

    if (result.credits.length === 0) {
      unattributedConversions += 1;
      continue;
    }

    attributedConversions += 1;
    attributedRevenue += journey.revenueValue;

    for (const credit of result.credits) {
      const channel = credit.channel ?? "Unknown";
      const existing = channelMap.get(channel) ?? {
        channel,
        creditPercent: 0,
        creditValue: 0,
        conversions: 0,
      };
      existing.creditPercent += credit.creditPercent;
      existing.creditValue += credit.creditValue ?? 0;
      if (credit.creditPercent > 0) {
        existing.conversions += credit.creditPercent / 100;
      }
      channelMap.set(channel, existing);
    }
  }

  return {
    attributedRevenue,
    attributedConversions: Math.round(attributedConversions),
    channelBreakdown: [...channelMap.values()].sort((a, b) => b.creditValue - a.creditValue),
    unattributedConversions,
  };
}

export function resolveCreditedChannel(
  touchpoints: AttributionTouchpointInput[],
  conversionAt: Date,
  modelType: AttributionModelType,
  lookbackWindowDays: number,
): { channel: string | null; sourceType: "paid" | "organic" | "other" } {
  const { included } = filterTouchpointsByLookback(
    touchpoints,
    conversionAt,
    lookbackWindowDays,
  );

  if (included.length === 0) {
    return { channel: null, sourceType: "other" };
  }

  const result = calculateAttributionCredits({
    modelType,
    touchpoints: included,
    revenueValue: 0,
    directTrafficPolicy: "RETAIN",
    conversionAt,
  });

  const top = result.credits.reduce(
    (best, credit) => ((credit.creditPercent ?? 0) > (best?.creditPercent ?? 0) ? credit : best),
    result.credits[0],
  );
  const channel = top?.channel ?? null;

  if (!channel) {
    return { channel: null, sourceType: "other" };
  }

  const normalised = channel.toUpperCase();
  if (normalised.includes("ADS") || ["GOOGLE", "META", "TIKTOK", "LINKEDIN"].some((p) => normalised.includes(p) && normalised.includes("AD"))) {
    return { channel, sourceType: "paid" };
  }
  if (
    normalised.includes("INSTAGRAM") ||
    normalised.includes("TIKTOK") ||
    normalised.includes("YOUTUBE") ||
    normalised.includes("LINKEDIN") ||
    normalised.includes("FACEBOOK") ||
    normalised.includes("ORGANIC")
  ) {
    return { channel, sourceType: "organic" };
  }

  return { channel, sourceType: "other" };
}
