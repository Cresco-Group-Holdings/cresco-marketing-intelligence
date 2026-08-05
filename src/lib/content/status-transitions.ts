import { ContentStatus } from "@prisma/client";
import { AppError } from "@/lib/errors";

const ALLOWED_TRANSITIONS: Record<ContentStatus, ContentStatus[]> = {
  IDEA: ["BRIEF", "DRAFT", "ARCHIVED", "CANCELLED"],
  BRIEF: ["DRAFT", "IDEA", "ARCHIVED"],
  DRAFT: ["IN_REVIEW", "AI_GENERATED", "APPROVED", "BRIEF", "ARCHIVED", "CANCELLED"],
  AI_GENERATED: ["DRAFT", "IN_REVIEW", "ARCHIVED", "CANCELLED"],
  IN_REVIEW: ["CHANGES_REQUESTED", "APPROVED", "CANCELLED", "DRAFT"],
  CHANGES_REQUESTED: ["DRAFT", "IN_REVIEW", "CANCELLED"],
  APPROVED: ["READY", "SCHEDULED", "PUBLISHING", "DRAFT", "ARCHIVED", "CANCELLED"],
  READY: ["SCHEDULED", "APPROVED", "ARCHIVED"],
  SCHEDULED: ["PUBLISHING", "PUBLISHED", "READY", "APPROVED", "CANCELLED", "ARCHIVED"],
  PUBLISHING: ["PUBLISHED", "PARTIALLY_PUBLISHED", "FAILED"],
  PUBLISHED: ["ARCHIVED"],
  PARTIALLY_PUBLISHED: ["PUBLISHING", "ARCHIVED", "FAILED"],
  FAILED: ["DRAFT", "IN_REVIEW", "CANCELLED", "ARCHIVED"],
  CANCELLED: ["ARCHIVED", "DRAFT", "IDEA"],
  ARCHIVED: [],
};

export function canTransitionContentStatus(
  from: ContentStatus,
  to: ContentStatus,
): boolean {
  if (from === to) {
    return true;
  }
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertContentStatusTransition(
  from: ContentStatus,
  to: ContentStatus,
): void {
  if (!canTransitionContentStatus(from, to)) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Invalid content status transition from ${from} to ${to}.`,
    );
  }
}

export function getAllowedContentTransitions(from: ContentStatus): ContentStatus[] {
  return ALLOWED_TRANSITIONS[from];
}

export const TERMINAL_CONTENT_STATUSES: ContentStatus[] = ["ARCHIVED", "PUBLISHED"];

export const EDITABLE_CONTENT_STATUSES: ContentStatus[] = [
  "IDEA",
  "BRIEF",
  "DRAFT",
  "AI_GENERATED",
  "CHANGES_REQUESTED",
];
