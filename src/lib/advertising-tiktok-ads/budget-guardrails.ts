import {
  BUDGET_EMERGENCY_PAUSE_THRESHOLD_PERCENT,
  DEFAULT_DAILY_BUDGET_CHANGE_LIMIT_PERCENT,
} from "./constants";

export function evaluateBudgetGuardrails(input: {
  approvedDailyBudgetCents: number;
  proposedDailyBudgetCents: number;
  currency: string;
  accountCurrency: string;
}) {
  const violations: string[] = [];

  if (input.currency !== input.accountCurrency) {
    violations.push(`Currency mismatch: plan ${input.currency} vs account ${input.accountCurrency}`);
  }

  const increasePercent =
    ((input.proposedDailyBudgetCents - input.approvedDailyBudgetCents) / input.approvedDailyBudgetCents) * 100;

  if (increasePercent > DEFAULT_DAILY_BUDGET_CHANGE_LIMIT_PERCENT) {
    violations.push(`Daily budget increase ${increasePercent.toFixed(1)}% exceeds limit.`);
  }
  if (increasePercent > BUDGET_EMERGENCY_PAUSE_THRESHOLD_PERCENT) {
    violations.push("Budget increase exceeds emergency pause threshold.");
  }

  return { allowed: violations.length === 0, violations };
}
