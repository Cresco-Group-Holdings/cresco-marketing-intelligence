import type { AttributionTouchpointInput } from "@/lib/attribution/types";

export type JourneyForAssist = {
  conversionAt: Date;
  creditedChannel: string | null;
  creditedSourceType: "paid" | "organic" | "other";
  touchpoints: AttributionTouchpointInput[];
};

export function calculateOrganicAssist(journeys: JourneyForAssist[]): {
  rate: number | null;
  paidConversionsWithPriorOrganic: number;
  totalPaidAttributedConversions: number;
  topAssistingChannel: string | null;
  description: string;
} {
  const paidJourneys = journeys.filter((journey) => journey.creditedSourceType === "paid");
  if (paidJourneys.length === 0) {
    return {
      rate: null,
      paidConversionsWithPriorOrganic: 0,
      totalPaidAttributedConversions: 0,
      topAssistingChannel: null,
      description: "Insufficient paid-attributed conversion journeys for organic assist analysis.",
    };
  }

  let withPriorOrganic = 0;
  const assistingChannels = new Map<string, number>();

  for (const journey of paidJourneys) {
    const priorOrganic = journey.touchpoints.filter(
      (touchpoint) =>
        !touchpoint.isExcluded &&
        touchpoint.occurredAt < journey.conversionAt &&
        isOrganicChannel(touchpoint.channel),
    );
    if (priorOrganic.length > 0) {
      withPriorOrganic += 1;
      const channel = priorOrganic[0]?.channel ?? "Organic";
      assistingChannels.set(channel, (assistingChannels.get(channel) ?? 0) + 1);
    }
  }

  const rate = (withPriorOrganic / paidJourneys.length) * 100;
  const topAssistingChannel =
    [...assistingChannels.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return {
    rate,
    paidConversionsWithPriorOrganic: withPriorOrganic,
    totalPaidAttributedConversions: paidJourneys.length,
    topAssistingChannel,
    description: `${rate.toFixed(0)}% of paid-attributed conversions included a prior organic interaction in the selected period.`,
  };
}

function isOrganicChannel(channel: string | null | undefined): boolean {
  if (!channel) return false;
  const normalised = channel.toUpperCase();
  return (
    normalised.includes("INSTAGRAM") ||
    normalised.includes("TIKTOK") ||
    normalised.includes("YOUTUBE") ||
    normalised.includes("LINKEDIN") ||
    normalised.includes("FACEBOOK") ||
    normalised.includes("ORGANIC")
  );
}

export function calculateAssistedMetrics(
  journeys: Array<{
    revenueValue: number;
    touchpoints: AttributionTouchpointInput[];
    creditedContentKey: string | null;
    conversionAt: Date;
  }>,
): Map<
  string,
  { assistedConversions: number; assistedRevenue: number; attributedRevenue: number; attributedConversions: number }
> {
  const byContent = new Map<
    string,
    { assistedConversions: number; assistedRevenue: number; attributedRevenue: number; attributedConversions: number }
  >();

  for (const journey of journeys) {
    const contentKeys = new Set(
      journey.touchpoints
        .filter((tp) => !tp.isExcluded && tp.contentKey)
        .map((tp) => tp.contentKey as string),
    );

    for (const contentKey of contentKeys) {
      const entry = byContent.get(contentKey) ?? {
        assistedConversions: 0,
        assistedRevenue: 0,
        attributedRevenue: 0,
        attributedConversions: 0,
      };
      entry.assistedConversions += 1;
      entry.assistedRevenue += journey.revenueValue;
      if (journey.creditedContentKey === contentKey) {
        entry.attributedConversions += 1;
        entry.attributedRevenue += journey.revenueValue;
      }
      byContent.set(contentKey, entry);
    }
  }

  return byContent;
}
