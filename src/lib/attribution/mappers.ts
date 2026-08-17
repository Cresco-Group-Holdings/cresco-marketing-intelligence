import type { AttributionTouchpointInput } from "@/lib/attribution/types";

export type DbAttributionTouchpoint = {
  id: string;
  occurredAt: Date | string;
  channel?: string | null;
  campaign?: string | null;
  contentKey?: string | null;
  position?: number | null;
  isExcluded?: boolean;
  exclusionReason?: string | null;
};

export function mapAttributionTouchpointToInput(
  touchpoint: DbAttributionTouchpoint,
): AttributionTouchpointInput {
  const channel = touchpoint.channel?.toUpperCase() ?? "";

  return {
    id: touchpoint.id,
    occurredAt:
      touchpoint.occurredAt instanceof Date
        ? touchpoint.occurredAt
        : new Date(touchpoint.occurredAt),
    channel: touchpoint.channel,
    campaign: touchpoint.campaign,
    contentKey: touchpoint.contentKey,
    position: touchpoint.position ?? undefined,
    isDirect: channel === "DIRECT" || channel === "(NONE)",
    isExcluded: touchpoint.isExcluded,
    exclusionReason: touchpoint.exclusionReason ?? undefined,
  };
}
