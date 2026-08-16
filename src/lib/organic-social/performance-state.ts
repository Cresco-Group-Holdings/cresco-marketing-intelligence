import type { OrganicPerformanceState } from "@/lib/organic-social/types";

const MIN_ENGAGEMENT_FOR_STATE = 10;
const MIN_REACH_FOR_STATE = 100;

export function mapContentPipelineStatus(status: string): import("@/lib/organic-social/types").ContentPipelineStatus {
  const normalised = status.toUpperCase();
  if (normalised === "IDEA" || normalised === "BRIEF") return "Idea";
  if (normalised === "DRAFT" || normalised === "AI_GENERATED" || normalised === "CHANGES_REQUESTED") {
    return "Draft";
  }
  if (normalised === "IN_REVIEW") return "In Review";
  if (normalised === "APPROVED" || normalised === "READY") return "Ready";
  if (normalised === "SCHEDULED") return "Scheduled";
  if (normalised === "PUBLISHING") return "Publishing";
  if (normalised === "PUBLISHED" || normalised === "PARTIALLY_PUBLISHED") return "Published";
  if (normalised === "FAILED") return "Failed";
  if (normalised === "ARCHIVED" || normalised === "CANCELLED") return "Archived";
  return "Draft";
}

export function calculateOrganicPerformanceState(input: {
  engagement: number | null;
  reach: number | null;
  baselineEngagementRate: number | null;
  engagementRate: number | null;
}): OrganicPerformanceState {
  if (
    (input.engagement ?? 0) < MIN_ENGAGEMENT_FOR_STATE &&
    (input.reach ?? 0) < MIN_REACH_FOR_STATE
  ) {
    return "Insufficient data";
  }

  const rate = input.engagementRate;
  const baseline = input.baselineEngagementRate;

  if (rate != null && baseline != null && baseline > 0) {
    const ratio = rate / baseline;
    if (ratio >= 1.3) return "Strong";
    if (ratio >= 0.9) return "Healthy";
    return "Needs attention";
  }

  return "Insufficient data";
}

export function mapPublicationToQueueSection(
  status: string,
): import("@/lib/organic-social/types").PublishingQueueSection {
  const normalised = status.toUpperCase();
  if (normalised === "APPROVED" || normalised === "READY" || normalised === "DRAFT") {
    return "Ready";
  }
  if (normalised === "SCHEDULED" || normalised === "QUEUED") return "Scheduled";
  if (normalised === "PUBLISHING") return "Publishing";
  if (normalised === "PUBLISHED" || normalised === "PARTIALLY_PUBLISHED") return "Published";
  if (normalised === "FAILED" || normalised === "CANCELLED") return "Failed";
  return "Ready";
}
