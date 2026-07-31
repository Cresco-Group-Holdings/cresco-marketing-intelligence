import {
  OVERSPEND_RISK_THRESHOLD_PCT,
  UNDERSPEND_RISK_THRESHOLD_PCT,
} from "./constants";

export type PacingInput = {
  periodStart: Date;
  periodEnd: Date;
  totalBudget: number;
  actualSpend: number;
  asOf?: Date;
};

export type PacingResult = {
  elapsedTimePct: number;
  elapsedBudgetPct: number;
  expectedSpend: number;
  actualSpend: number;
  spendVariance: number;
  projectedSpend: number;
  remainingBudget: number;
  requiredDailyPace: number;
  overspendRisk: boolean;
  underspendRisk: boolean;
  remainingDays: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function daysBetween(start: Date, end: Date): number {
  return Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Deterministic budget pacing formulas.
 * All calculations use linear time-weighted expected spend.
 */
export function calculatePacing(input: PacingInput): PacingResult {
  const asOf = input.asOf ?? new Date();
  const totalMs = input.periodEnd.getTime() - input.periodStart.getTime();
  const elapsedMs = clamp(asOf.getTime() - input.periodStart.getTime(), 0, totalMs);
  const elapsedTimePct = totalMs > 0 ? (elapsedMs / totalMs) * 100 : 0;

  const totalBudget = Math.max(0, input.totalBudget);
  const actualSpend = Math.max(0, input.actualSpend);
  const elapsedBudgetPct = totalBudget > 0 ? (actualSpend / totalBudget) * 100 : 0;
  const expectedSpend = totalBudget * (elapsedTimePct / 100);
  const spendVariance = actualSpend - expectedSpend;

  const timeFraction = elapsedTimePct / 100;
  const projectedSpend = timeFraction > 0 ? actualSpend / timeFraction : actualSpend;
  const remainingBudget = totalBudget - actualSpend;

  const remainingDays = daysBetween(asOf, input.periodEnd);
  const requiredDailyPace = remainingDays > 0 ? remainingBudget / remainingDays : remainingBudget;

  const overspendThreshold = totalBudget * (1 + OVERSPEND_RISK_THRESHOLD_PCT / 100);
  const underspendThreshold = totalBudget * (1 - UNDERSPEND_RISK_THRESHOLD_PCT / 100);
  const overspendRisk = projectedSpend > overspendThreshold;
  const underspendRisk = elapsedTimePct >= 50 && projectedSpend < underspendThreshold;

  return {
    elapsedTimePct: round4(elapsedTimePct),
    elapsedBudgetPct: round4(elapsedBudgetPct),
    expectedSpend: round6(expectedSpend),
    actualSpend: round6(actualSpend),
    spendVariance: round6(spendVariance),
    projectedSpend: round6(projectedSpend),
    remainingBudget: round6(remainingBudget),
    requiredDailyPace: round6(requiredDailyPace),
    overspendRisk,
    underspendRisk,
    remainingDays: round4(remainingDays),
  };
}

export function calculatePercentageChange(current: number, proposed: number): number {
  if (current === 0) return proposed > 0 ? 100 : 0;
  return round2(((proposed - current) / current) * 100);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}
