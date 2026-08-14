import { ContentStatus } from "@prisma/client";
import { AppError } from "@/lib/errors";

/** Centralised studio lifecycle transitions (provider-independent). */
const STUDIO_TRANSITIONS: Record<ContentStatus, ContentStatus[]> = {
  IDEA: ["BRIEF", "DRAFT", "ARCHIVED"],
  BRIEF: ["DRAFT", "IDEA", "ARCHIVED"],
  DRAFT: ["IN_REVIEW", "BRIEF", "ARCHIVED"],
  AI_GENERATED: ["DRAFT", "IN_REVIEW", "ARCHIVED"],
  IN_REVIEW: ["APPROVED", "CHANGES_REQUESTED", "DRAFT"],
  CHANGES_REQUESTED: ["DRAFT"],
  APPROVED: ["READY", "SCHEDULED", "ARCHIVED"],
  READY: ["SCHEDULED", "APPROVED", "ARCHIVED"],
  SCHEDULED: ["PUBLISHED", "READY", "ARCHIVED"],
  PUBLISHING: ["PUBLISHED", "PARTIALLY_PUBLISHED", "FAILED"],
  PUBLISHED: ["ARCHIVED"],
  PARTIALLY_PUBLISHED: ["PUBLISHING", "ARCHIVED", "FAILED"],
  FAILED: ["DRAFT", "IN_REVIEW", "ARCHIVED"],
  CANCELLED: ["ARCHIVED", "DRAFT", "IDEA"],
  ARCHIVED: [],
};

export const STUDIO_PIPELINE_COLUMNS: ContentStatus[] = [
  "IDEA",
  "BRIEF",
  "DRAFT",
  "IN_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED",
  "READY",
  "SCHEDULED",
  "PUBLISHED",
];

export const STUDIO_EDITABLE_STATUSES: ContentStatus[] = [
  "IDEA",
  "BRIEF",
  "DRAFT",
  "CHANGES_REQUESTED",
];

export function canTransitionStudioStatus(from: ContentStatus, to: ContentStatus): boolean {
  if (from === to) return true;
  return STUDIO_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertStudioStatusTransition(from: ContentStatus, to: ContentStatus): void {
  if (!canTransitionStudioStatus(from, to)) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Invalid content status transition from ${from} to ${to}.`,
    );
  }
}

export function getAllowedStudioTransitions(from: ContentStatus): ContentStatus[] {
  return STUDIO_TRANSITIONS[from] ?? [];
}

export function isStudioEditableStatus(status: ContentStatus): boolean {
  return STUDIO_EDITABLE_STATUSES.includes(status);
}
