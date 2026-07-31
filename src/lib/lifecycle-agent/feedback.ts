import { FEEDBACK_STATUSES } from "./constants";

export type FeedbackInput = {
  status: string;
  userExplanation?: string;
  recommendationId?: string;
};

export type OutcomeInput = {
  preMetrics?: Record<string, number | string>;
  postMetrics?: Record<string, number | string>;
  outcomeStatus: "PENDING" | "MEASURED" | "UNAVAILABLE";
  activityLogged?: boolean;
  stageProgressed?: boolean;
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
  effectivenessClaimed: boolean;
} {
  if (input.outcomeStatus === "UNAVAILABLE") {
    return {
      successClaimed: false,
      outcomeStatus: "UNAVAILABLE",
      reason: "Outcome cannot be measured. Effectiveness is not claimed.",
      effectivenessClaimed: false,
    };
  }

  const hasPostEvidence =
    input.outcomeStatus === "MEASURED" &&
    ((input.postMetrics && Object.keys(input.postMetrics).length > 0) ||
      input.activityLogged === true ||
      input.stageProgressed === true);

  if (hasPostEvidence) {
    return {
      successClaimed: true,
      outcomeStatus: "MEASURED",
      reason: "Post-action evidence recorded. Effectiveness may be evaluated against measurement plan.",
      effectivenessClaimed: true,
    };
  }

  return {
    successClaimed: false,
    outcomeStatus: input.outcomeStatus,
    reason: "Outcome not yet measured. Do not label recommendation as effective without post-action evidence.",
    effectivenessClaimed: false,
  };
}

export function canClaimSuccess(feedbackStatus: string, outcomeMeasured: boolean): boolean {
  if (feedbackStatus !== "IMPLEMENTED" && feedbackStatus !== "OUTCOME_MEASURED") return false;
  return outcomeMeasured;
}

export function canClaimEffectiveness(
  feedbackStatus: string,
  outcome: OutcomeInput,
): { allowed: boolean; reason: string } {
  if (!canClaimSuccess(feedbackStatus, outcome.outcomeStatus === "MEASURED")) {
    return {
      allowed: false,
      reason: "Effectiveness cannot be claimed without implemented status and measured outcome.",
    };
  }

  const hasEvidence =
    (outcome.postMetrics && Object.keys(outcome.postMetrics).length > 0) ||
    outcome.activityLogged === true ||
    outcome.stageProgressed === true;

  if (!hasEvidence) {
    return {
      allowed: false,
      reason: "Effectiveness requires post-action evidence (metrics, logged activity, or stage progression).",
    };
  }

  return { allowed: true, reason: "Sufficient evidence to evaluate effectiveness." };
}
