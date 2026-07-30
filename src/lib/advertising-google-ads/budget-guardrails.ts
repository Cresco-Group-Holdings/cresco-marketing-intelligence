import {
  BUDGET_EMERGENCY_PAUSE_THRESHOLD_PERCENT,
  DEFAULT_DAILY_BUDGET_CHANGE_LIMIT_PERCENT,
  GOOGLE_ADS_MIN_DAILY_BUDGET_MICROS,
} from "./constants";

export type BudgetGuardrailInput = {
  proposedDailyMicros: number;
  approvedMaxDailyMicros: number;
  currentDailyMicros?: number;
  planLimitMicros?: number;
  organisationPolicyMaxMicros?: number;
  accountCurrency: string;
  planCurrency: string;
  isAiSuggested?: boolean;
  emergencyPauseActive?: boolean;
};

export type BudgetGuardrailResult = {
  allowed: boolean;
  violations: string[];
  warnings: string[];
};

export function evaluateBudgetGuardrails(input: BudgetGuardrailInput): BudgetGuardrailResult {
  const violations: string[] = [];
  const warnings: string[] = [];

  if (input.emergencyPauseActive) {
    violations.push("Emergency budget pause is active — no increases permitted.");
  }

  if (input.isAiSuggested) {
    violations.push("Budget mutations cannot be applied from AI output alone.");
  }

  if (input.accountCurrency !== input.planCurrency) {
    violations.push(`Currency mismatch: account (${input.accountCurrency}) vs plan (${input.planCurrency}).`);
  }

  if (input.proposedDailyMicros > input.approvedMaxDailyMicros) {
    violations.push("Proposed daily budget exceeds approved maximum.");
  }

  if (input.planLimitMicros && input.proposedDailyMicros > input.planLimitMicros) {
    violations.push("Proposed daily budget exceeds campaign plan limit.");
  }

  if (input.organisationPolicyMaxMicros && input.proposedDailyMicros > input.organisationPolicyMaxMicros) {
    violations.push("Proposed daily budget exceeds organisation policy maximum.");
  }

  if (input.proposedDailyMicros < GOOGLE_ADS_MIN_DAILY_BUDGET_MICROS) {
    violations.push("Proposed daily budget is below Google Ads minimum guardrail.");
  }

  if (input.currentDailyMicros && input.currentDailyMicros > 0) {
    const changePercent =
      Math.abs(input.proposedDailyMicros - input.currentDailyMicros) / input.currentDailyMicros * 100;
    if (changePercent > DEFAULT_DAILY_BUDGET_CHANGE_LIMIT_PERCENT) {
      violations.push(
        `Daily budget change of ${changePercent.toFixed(1)}% exceeds ${DEFAULT_DAILY_BUDGET_CHANGE_LIMIT_PERCENT}% limit.`,
      );
    }
    if (input.proposedDailyMicros > input.currentDailyMicros) {
      const increasePercent = (input.proposedDailyMicros - input.currentDailyMicros) / input.currentDailyMicros * 100;
      if (increasePercent > BUDGET_EMERGENCY_PAUSE_THRESHOLD_PERCENT) {
        warnings.push("Budget increase exceeds emergency pause threshold — review carefully.");
      }
    }
  }

  if (input.proposedDailyMicros > input.currentDailyMicros!) {
    warnings.push("Automatic budget increases are not permitted without explicit approval.");
  }

  return { allowed: violations.length === 0, violations, warnings };
}

export function microsToCurrency(micros: number): number {
  return micros / 1_000_000;
}

export function currencyToMicros(amount: number): number {
  return Math.round(amount * 1_000_000);
}
