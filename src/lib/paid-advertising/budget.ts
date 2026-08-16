import type { BudgetAllocationItem, BudgetPacingState } from "@/lib/paid-advertising/types";

export function calculateSpendShare(spend: number, totalSpend: number): number | null {
  if (totalSpend <= 0) {
    return null;
  }
  return spend / totalSpend;
}

export function calculateBudgetPacing(input: {
  spend: number;
  budget: number | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  now?: Date;
}): BudgetPacingState {
  if (input.budget == null || input.budget <= 0) {
    return "Unavailable";
  }

  const now = input.now ?? new Date();
  const start = input.periodStart ?? new Date(now.getFullYear(), now.getMonth(), 1);
  const end =
    input.periodEnd ??
    new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const totalMs = end.getTime() - start.getTime();
  const elapsedMs = Math.min(Math.max(now.getTime() - start.getTime(), 0), totalMs);

  if (totalMs <= 0) {
    return "Unavailable";
  }

  const expectedSpend = (input.budget * elapsedMs) / totalMs;
  const utilisation = input.spend / input.budget;
  const expectedUtilisation = expectedSpend / input.budget;

  if (utilisation > expectedUtilisation * 1.15) {
    return utilisation >= 1 ? "Overspending" : "Projected overspend";
  }
  if (utilisation < expectedUtilisation * 0.85) {
    return "Underspending";
  }
  return "On track";
}

export function projectPeriodSpend(input: {
  spend: number;
  periodStart: Date;
  periodEnd: Date;
  now?: Date;
}): number | null {
  const now = input.now ?? new Date();
  const elapsedMs = Math.max(now.getTime() - input.periodStart.getTime(), 0);
  const totalMs = input.periodEnd.getTime() - input.periodStart.getTime();

  if (elapsedMs <= 0 || totalMs <= 0) {
    return null;
  }

  const runRate = input.spend / (elapsedMs / 86_400_000);
  const remainingDays = Math.max((totalMs - elapsedMs) / 86_400_000, 0);
  return input.spend + runRate * remainingDays;
}

export function buildBudgetAllocation(
  channels: Array<{
    provider: string;
    spend: number;
    roas: number | null;
    budget: number | null;
    periodStart: Date | null;
    periodEnd: Date | null;
  }>,
  totalSpend: number,
  now?: Date,
): BudgetAllocationItem[] {
  return channels
    .filter((channel) => channel.spend > 0)
    .map((channel) => ({
      provider: channel.provider,
      spend: channel.spend,
      spendShare: calculateSpendShare(channel.spend, totalSpend) ?? 0,
      roas: channel.roas,
      pacing: calculateBudgetPacing({
        spend: channel.spend,
        budget: channel.budget,
        periodStart: channel.periodStart,
        periodEnd: channel.periodEnd,
        now,
      }),
      projectedSpend: projectPeriodSpend({
        spend: channel.spend,
        periodStart: channel.periodStart ?? new Date(),
        periodEnd: channel.periodEnd ?? new Date(),
        now,
      }),
    }))
    .sort((a, b) => b.spend - a.spend);
}
