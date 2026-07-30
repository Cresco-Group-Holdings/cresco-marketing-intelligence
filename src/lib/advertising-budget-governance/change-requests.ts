import { CHANGE_REQUEST_TYPES } from "./constants";
import { calculatePercentageChange } from "./pacing";

export type ChangeRequestInput = {
  requestType: string;
  reason: string;
  evidence?: string;
  currentBudget: number;
  proposedBudget: number;
  projectedImpact?: string;
  risk?: string;
};

export type ChangeRequestValidation = {
  valid: boolean;
  errors: string[];
  percentageChange: number;
  isIncrease: boolean;
};

export function validateChangeRequest(input: ChangeRequestInput): ChangeRequestValidation {
  const errors: string[] = [];

  if (!(CHANGE_REQUEST_TYPES as readonly string[]).includes(input.requestType)) {
    errors.push(`Invalid request type: ${input.requestType}`);
  }

  if (!input.reason?.trim()) {
    errors.push("Reason is required.");
  }

  if (input.currentBudget < 0 || input.proposedBudget < 0) {
    errors.push("Budget amounts must be non-negative.");
  }

  if (input.requestType === "INCREASE_BUDGET" && input.proposedBudget <= input.currentBudget) {
    errors.push("Increase request must have proposed budget greater than current budget.");
  }

  if (input.requestType === "DECREASE_BUDGET" && input.proposedBudget >= input.currentBudget) {
    errors.push("Decrease request must have proposed budget less than current budget.");
  }

  const percentageChange = calculatePercentageChange(input.currentBudget, input.proposedBudget);
  const isIncrease = input.proposedBudget > input.currentBudget;

  return {
    valid: errors.length === 0,
    errors,
    percentageChange,
    isIncrease,
  };
}

/**
 * Budget increases are never applied without explicit approval.
 * This guard is called before any mutation path.
 */
export function assertNoAutonomousSpendIncrease(
  requestType: string,
  approved: boolean,
): { allowed: boolean; reason: string } {
  const increaseTypes = ["INCREASE_BUDGET", "RESUME_CAMPAIGN"];
  if (increaseTypes.includes(requestType) && !approved) {
    return {
      allowed: false,
      reason: "Spend increases require explicit human approval. Autonomous increases are blocked.",
    };
  }
  return { allowed: true, reason: "Approved or non-increase request." };
}
