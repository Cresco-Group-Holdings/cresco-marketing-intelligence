import type { RecommendationFeedbackStatus } from "@prisma/client";
import { AppError } from "@/lib/errors";

/** Terminal states — no further feedback transitions. */
const TERMINAL: RecommendationFeedbackStatus[] = [
  "DISMISSED",
  "SUCCESSFUL",
  "UNSUCCESSFUL",
  "INCONCLUSIVE",
];

const TRANSITIONS: Record<
  RecommendationFeedbackStatus | "NONE",
  RecommendationFeedbackStatus[]
> = {
  NONE: ["ACCEPTED", "DISMISSED", "PLANNED"],
  ACCEPTED: ["PLANNED", "IMPLEMENTED", "DISMISSED"],
  PLANNED: ["IMPLEMENTED", "DISMISSED", "ACCEPTED"],
  IMPLEMENTED: ["SUCCESSFUL", "UNSUCCESSFUL", "INCONCLUSIVE"],
  DISMISSED: [],
  SUCCESSFUL: [],
  UNSUCCESSFUL: [],
  INCONCLUSIVE: [],
};

export function assertFeedbackTransition(
  current: RecommendationFeedbackStatus | null | undefined,
  next: RecommendationFeedbackStatus,
): void {
  const from = current ?? "NONE";
  if (from !== "NONE" && TERMINAL.includes(from)) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Recommendation feedback is terminal (${from}) and cannot change.`,
    );
  }
  const allowed = TRANSITIONS[from];
  if (!allowed.includes(next)) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Invalid feedback transition from ${from} to ${next}.`,
    );
  }
}

export function isDuplicateFeedback(
  current: RecommendationFeedbackStatus | null | undefined,
  next: RecommendationFeedbackStatus,
): boolean {
  return current === next;
}

export function requiresMeasuredOutcome(status: RecommendationFeedbackStatus): boolean {
  return ["SUCCESSFUL", "UNSUCCESSFUL", "INCONCLUSIVE"].includes(status);
}

export function requiresExperimentLink(status: RecommendationFeedbackStatus): boolean {
  return status === "IMPLEMENTED";
}
