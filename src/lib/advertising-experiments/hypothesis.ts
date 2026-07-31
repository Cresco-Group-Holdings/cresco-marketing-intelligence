import { SUPPORTED_METRICS } from "./constants";

export type HypothesisInput = {
  observedProblem: string;
  proposedChange: string;
  expectedOutcome: string;
  primaryMetric: string;
  guardrailMetrics?: string[];
  audience: string;
  durationDays: number;
  minimumVolume: number;
  decisionRule: string;
};

export function validateHypothesis(input: HypothesisInput) {
  const errors: string[] = [];

  if (!input.observedProblem?.trim()) errors.push("Observed problem is required.");
  if (!input.proposedChange?.trim()) errors.push("Proposed change is required.");
  if (!input.expectedOutcome?.trim()) errors.push("Expected outcome is required.");
  if (!input.primaryMetric?.trim()) errors.push("Primary metric is required.");
  if (!(SUPPORTED_METRICS as readonly string[]).includes(input.primaryMetric)) {
    errors.push(`Primary metric must be one of: ${SUPPORTED_METRICS.join(", ")}`);
  }
  if (!input.audience?.trim()) errors.push("Audience description is required.");
  if (!input.durationDays || input.durationDays < 1) errors.push("Duration must be at least 1 day.");
  if (!input.minimumVolume || input.minimumVolume < 1) errors.push("Minimum volume must be at least 1.");
  if (!input.decisionRule?.trim()) errors.push("Decision rule is required.");

  for (const metric of input.guardrailMetrics ?? []) {
    if (!(SUPPORTED_METRICS as readonly string[]).includes(metric)) {
      errors.push(`Invalid guardrail metric: ${metric}`);
    }
  }

  return { valid: errors.length === 0, errors };
}
