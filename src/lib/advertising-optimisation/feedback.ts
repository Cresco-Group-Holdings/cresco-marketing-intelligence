import { FEEDBACK_STATUSES } from "./constants";

export type FeedbackInput = {
  status: string;
  userExplanation?: string;
};

export type OutcomeInput = {
  preMetrics?: Record<string, number>;
  postMetrics?: Record<string, number>;
  outcomeStatus: "PENDING" | "MEASURED" | "UNAVAILABLE";
  notes?: string;
};

export function validateFeedback(input: FeedbackInput): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!(FEEDBACK_STATUSES as readonly string[]).includes(input.status)) {
    errors.push(`Invalid feedback status: ${input.status}`);
  }
  if (input.status === "REJECTED" && !input.userExplanation?.trim()) {
    errors.push("Rejection requires user explanation.");
  }
  return { valid: errors.length === 0, errors };
}

export function recordOutcome(input: OutcomeInput): {
  successClaimed: boolean;
  outcomeStatus: string;
  reason: string;
} {
  if (input.outcomeStatus === "UNAVAILABLE") {
    return {
      successClaimed: false,
      outcomeStatus: "UNAVAILABLE",
      reason: "Outcome cannot be measured. Success is not claimed.",
    };
  }

  if (input.outcomeStatus === "MEASURED" && input.postMetrics && Object.keys(input.postMetrics).length > 0) {
    return {
      successClaimed: true,
      outcomeStatus: "MEASURED",
      reason: "Post-change metrics recorded. Success may be evaluated against measurement plan.",
    };
  }

  return {
    successClaimed: false,
    outcomeStatus: input.outcomeStatus,
    reason: "Outcome not yet measured. Do not label action as successful without post-change evidence.",
  };
}

export function canClaimSuccess(feedbackStatus: string, outcomeMeasured: boolean): boolean {
  if (feedbackStatus !== "IMPLEMENTED" && feedbackStatus !== "OUTCOME_MEASURED") return false;
  return outcomeMeasured;
}
