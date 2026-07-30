import type { FunnelSegmentDimension } from "@prisma/client";
import { APPROVED_SEGMENT_DIMENSIONS, MAX_SEGMENT_CARDINALITY } from "@/lib/funnel/constants";
import type { FunnelSubjectEvent } from "@/lib/funnel/types";

export function isApprovedSegmentDimension(value: string): value is FunnelSegmentDimension {
  return (APPROVED_SEGMENT_DIMENSIONS as readonly string[]).includes(value);
}

export function getSegmentValue(event: FunnelSubjectEvent, dimension: FunnelSegmentDimension): string | null {
  switch (dimension) {
    case "CHANNEL":
      return event.channel ?? null;
    case "CAMPAIGN":
      return event.campaign ?? null;
    case "PROVIDER":
      return event.provider ?? null;
    case "LANDING_PAGE":
      return event.landingPage ?? null;
    case "DEVICE":
      return event.device ?? null;
    case "COUNTRY":
      return event.country ?? null;
    case "NEW_VS_RETURNING":
      return event.isReturning === true ? "returning" : event.isReturning === false ? "new" : null;
    case "BRAND":
      return event.audience ?? null;
    case "AUDIENCE":
      return event.audience ?? null;
    case "CONTENT":
      return event.contentKey ?? null;
    case "DATE_COHORT":
      return event.cohortDate ?? null;
    default:
      return null;
  }
}

export function enforceSegmentCardinality(
  segments: Map<string, number>,
): { allowed: string[]; rejected: string[] } {
  const sorted = [...segments.entries()].sort((a, b) => b[1] - a[1]);
  const allowed = sorted.slice(0, MAX_SEGMENT_CARDINALITY).map(([key]) => key);
  const rejected = sorted.slice(MAX_SEGMENT_CARDINALITY).map(([key]) => key);
  return { allowed, rejected };
}
