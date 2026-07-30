import type { DirectTrafficPolicy } from "@prisma/client";
import type { AttributionTouchpointInput } from "@/lib/attribution/types";

export type DirectTrafficResult = {
  included: AttributionTouchpointInput[];
  excluded: AttributionTouchpointInput[];
  variant: "retain" | "ignore_direct" | null;
};

function isDirectTouchpoint(touchpoint: AttributionTouchpointInput): boolean {
  if (touchpoint.isDirect) return true;
  const channel = touchpoint.channel?.toUpperCase() ?? "";
  return channel === "DIRECT" || channel === "(NONE)";
}

export function applyDirectTrafficPolicy(
  touchpoints: AttributionTouchpointInput[],
  policy: DirectTrafficPolicy,
): DirectTrafficResult {
  const sorted = [...touchpoints].sort(
    (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime(),
  );

  if (policy === "RETAIN") {
    return { included: sorted, excluded: [], variant: "retain" };
  }

  if (policy === "IGNORE_WHEN_PRIOR_KNOWN") {
    const included: AttributionTouchpointInput[] = [];
    const excluded: AttributionTouchpointInput[] = [];
    let sawKnownChannel = false;

    for (const tp of sorted) {
      if (isDirectTouchpoint(tp)) {
        if (sawKnownChannel) {
          excluded.push({ ...tp, isExcluded: true, exclusionReason: "direct_ignored_prior_known" });
        } else {
          included.push(tp);
        }
      } else {
        sawKnownChannel = true;
        included.push(tp);
      }
    }

    return { included, excluded, variant: "ignore_direct" };
  }

  if (policy === "SHOW_BOTH") {
    return { included: sorted, excluded: [], variant: "retain" };
  }

  return { included: sorted, excluded: [], variant: null };
}

export function applyShowBothVariants(
  touchpoints: AttributionTouchpointInput[],
): { retain: DirectTrafficResult; ignoreDirect: DirectTrafficResult } {
  return {
    retain: applyDirectTrafficPolicy(touchpoints, "RETAIN"),
    ignoreDirect: applyDirectTrafficPolicy(touchpoints, "IGNORE_WHEN_PRIOR_KNOWN"),
  };
}
