import { DECISION_OUTCOMES } from "./constants";

export type DecisionInput = {
  outcome: string;
  winningVariantId?: string;
  recommendation: string;
  limitations: string;
  analysisSignificanceClaimed: boolean;
};

export function validateDecision(input: DecisionInput) {
  const errors: string[] = [];

  if (!(DECISION_OUTCOMES as readonly string[]).includes(input.outcome)) {
    errors.push(`Invalid decision outcome: ${input.outcome}`);
  }

  if (input.outcome === "ADOPT_VARIANT" && !input.winningVariantId) {
    errors.push("ADOPT_VARIANT requires a winning variant.");
  }

  if (!input.recommendation?.trim()) errors.push("Recommendation is required.");
  if (!input.limitations?.trim()) errors.push("Limitations must be documented.");

  return { valid: errors.length === 0, errors };
}

export function requiresHumanApproval(outcome: string): boolean {
  return outcome === "ADOPT_VARIANT";
}
