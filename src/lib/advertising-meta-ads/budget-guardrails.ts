import {
  BUDGET_EMERGENCY_PAUSE_THRESHOLD_PERCENT,
  DEFAULT_DAILY_BUDGET_CHANGE_LIMIT_PERCENT,
  META_MIN_DAILY_BUDGET_CENTS,
} from "./constants";

export type BudgetGuardrailInput = {
  proposedDailyCents: number;
  approvedMaxDailyCents: number;
  currentDailyCents?: number;
  lifetimeBudgetCents?: number;
  approvedBidStrategy?: string;
  proposedBidStrategy?: string;
  accountCurrency: string;
  planCurrency: string;
  isAiSuggested?: boolean;
  emergencyPauseActive?: boolean;
};

export function evaluateBudgetGuardrails(input: BudgetGuardrailInput): {
  allowed: boolean;
  violations: string[];
  warnings: string[];
} {
  const violations: string[] = [];
  const warnings: string[] = [];

  if (input.emergencyPauseActive) violations.push("Emergency budget pause is active.");
  if (input.isAiSuggested) violations.push("Budget mutations cannot be applied from AI output alone.");
  if (input.accountCurrency !== input.planCurrency) {
    violations.push(`Currency mismatch: account (${input.accountCurrency}) vs plan (${input.planCurrency}).`);
  }
  if (input.proposedDailyCents > input.approvedMaxDailyCents) {
    violations.push("Proposed daily budget exceeds approved maximum.");
  }
  if (input.proposedDailyCents < META_MIN_DAILY_BUDGET_CENTS) {
    violations.push("Proposed daily budget is below Meta minimum guardrail.");
  }
  if (
    input.approvedBidStrategy &&
    input.proposedBidStrategy &&
    input.approvedBidStrategy !== input.proposedBidStrategy
  ) {
    violations.push("Bid strategy change requires renewed approval.");
  }
  if (input.currentDailyCents && input.currentDailyCents > 0) {
    const changePercent = Math.abs(input.proposedDailyCents - input.currentDailyCents) / input.currentDailyCents * 100;
    if (changePercent > DEFAULT_DAILY_BUDGET_CHANGE_LIMIT_PERCENT) {
      violations.push(`Budget change of ${changePercent.toFixed(1)}% exceeds ${DEFAULT_DAILY_BUDGET_CHANGE_LIMIT_PERCENT}% limit.`);
    }
    if (input.proposedDailyCents > input.currentDailyCents) {
      const increase = (input.proposedDailyCents - input.currentDailyCents) / input.currentDailyCents * 100;
      if (increase > BUDGET_EMERGENCY_PAUSE_THRESHOLD_PERCENT) {
        warnings.push("Budget increase exceeds emergency pause threshold.");
      }
    }
  }

  return { allowed: violations.length === 0, violations, warnings };
}
