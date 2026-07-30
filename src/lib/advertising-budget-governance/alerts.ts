import {
  DEFAULT_DAILY_CHANGE_LIMIT_PCT,
  OVERSPEND_RISK_THRESHOLD_PCT,
  SPEND_SPIKE_THRESHOLD_PCT,
  STALE_PROVIDER_DATA_HOURS,
} from "./constants";
import type { PacingResult } from "./pacing";

export type AlertContext = {
  pacing: PacingResult;
  totalBudget: number;
  campaignEndDate?: Date | null;
  asOf?: Date;
  hasTracking?: boolean;
  conversions?: number;
  accountCurrency?: string;
  expectedCurrency?: string;
  providerDataAgeHours?: number;
  previousDaySpend?: number;
  currentDaySpend?: number;
  providerBudget?: number;
  lastKnownProviderBudget?: number;
};

export type BudgetAlertCandidate = {
  alertType: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  message: string;
};

export function evaluateBudgetAlerts(context: AlertContext): BudgetAlertCandidate[] {
  const alerts: BudgetAlertCandidate[] = [];
  const asOf = context.asOf ?? new Date();
  const { pacing } = context;

  if (context.previousDaySpend && context.currentDaySpend && context.previousDaySpend > 0) {
    const spikePct = ((context.currentDaySpend - context.previousDaySpend) / context.previousDaySpend) * 100;
    if (spikePct >= SPEND_SPIKE_THRESHOLD_PCT) {
      alerts.push({
        alertType: "SPEND_SPIKE",
        severity: "WARNING",
        message: `Daily spend increased ${spikePct.toFixed(1)}% vs prior day (threshold ${SPEND_SPIKE_THRESHOLD_PCT}%).`,
      });
    }
  }

  if (pacing.overspendRisk) {
    alerts.push({
      alertType: "OVERSPEND_RISK",
      severity: "WARNING",
      message: `Projected spend (${pacing.projectedSpend.toFixed(2)}) exceeds budget with ${OVERSPEND_RISK_THRESHOLD_PCT}% tolerance.`,
    });
  }

  if (pacing.remainingBudget <= 0) {
    alerts.push({
      alertType: "BUDGET_EXHAUSTED",
      severity: "CRITICAL",
      message: "Budget is fully consumed for the current period.",
    });
  }

  if (context.campaignEndDate && asOf > context.campaignEndDate && pacing.actualSpend > 0) {
    alerts.push({
      alertType: "SPEND_AFTER_END_DATE",
      severity: "CRITICAL",
      message: `Campaign ended ${context.campaignEndDate.toISOString()} but spend continues.`,
    });
  }

  if (context.hasTracking === false) {
    alerts.push({
      alertType: "SPEND_WITHOUT_TRACKING",
      severity: "WARNING",
      message: "Spend detected without active conversion tracking.",
    });
  }

  if (pacing.actualSpend > 0 && (context.conversions ?? 0) === 0) {
    alerts.push({
      alertType: "SPEND_WITHOUT_CONVERSIONS",
      severity: "INFO",
      message: "Spend recorded with zero conversions in the observation window.",
    });
  }

  if (context.accountCurrency && context.expectedCurrency && context.accountCurrency !== context.expectedCurrency) {
    alerts.push({
      alertType: "CURRENCY_MISMATCH",
      severity: "WARNING",
      message: `Account currency (${context.accountCurrency}) differs from expected (${context.expectedCurrency}).`,
    });
  }

  if ((context.providerDataAgeHours ?? 0) > STALE_PROVIDER_DATA_HOURS) {
    alerts.push({
      alertType: "PROVIDER_DATA_STALE",
      severity: "WARNING",
      message: `Provider data is ${context.providerDataAgeHours}h old (stale after ${STALE_PROVIDER_DATA_HOURS}h).`,
    });
  }

  if (context.previousDaySpend !== undefined && context.currentDaySpend !== undefined && context.previousDaySpend > 0) {
    const dailyChangePct = Math.abs((context.currentDaySpend - context.previousDaySpend) / context.previousDaySpend) * 100;
    if (dailyChangePct > DEFAULT_DAILY_CHANGE_LIMIT_PCT) {
      alerts.push({
        alertType: "DAILY_CHANGE_ABOVE_POLICY",
        severity: "WARNING",
        message: `Daily spend change ${dailyChangePct.toFixed(1)}% exceeds policy limit ${DEFAULT_DAILY_CHANGE_LIMIT_PCT}%.`,
      });
    }
  }

  if (
    context.providerBudget !== undefined &&
    context.lastKnownProviderBudget !== undefined &&
    context.providerBudget !== context.lastKnownProviderBudget
  ) {
    alerts.push({
      alertType: "UNEXPECTED_PROVIDER_BUDGET_CHANGE",
      severity: "CRITICAL",
      message: `Provider budget changed from ${context.lastKnownProviderBudget} to ${context.providerBudget} outside approved workflow.`,
    });
  }

  return alerts;
}
