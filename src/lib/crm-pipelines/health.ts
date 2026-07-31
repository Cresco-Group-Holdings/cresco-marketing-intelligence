import { STALE_OPPORTUNITY_DAYS, STAGE_REVERSAL_WINDOW_DAYS } from "./constants";

export type HealthOpportunity = {
  id: string;
  name: string;
  status: string;
  nextAction?: string | null;
  expectedCloseDate?: Date | null;
  expectedValue?: number;
  lastActivityAt?: Date | null;
  stageEnteredAt?: Date;
  maxDurationDays?: number | null;
  hasDecisionMaker?: boolean;
  stageReversalCount?: number;
  overdueTaskCount?: number;
};

export type HealthSignal = {
  type: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  message: string;
  opportunityId: string;
};

export function detectHealthSignals(opportunity: HealthOpportunity, asOf = new Date()): HealthSignal[] {
  const signals: HealthSignal[] = [];
  const base = { opportunityId: opportunity.id };

  if (!opportunity.nextAction?.trim()) {
    signals.push({ ...base, type: "no_next_action", severity: "WARNING", message: "No next action defined." });
  }

  if ((opportunity.overdueTaskCount ?? 0) > 0) {
    signals.push({ ...base, type: "overdue_task", severity: "WARNING", message: `${opportunity.overdueTaskCount} overdue task(s).` });
  }

  if (opportunity.lastActivityAt) {
    const staleDays = (asOf.getTime() - opportunity.lastActivityAt.getTime()) / 86_400_000;
    if (staleDays > STALE_OPPORTUNITY_DAYS) {
      signals.push({ ...base, type: "stale_opportunity", severity: "WARNING", message: `No activity for ${Math.round(staleDays)} days.` });
    }
  }

  if (opportunity.expectedCloseDate && opportunity.expectedCloseDate < asOf && opportunity.status === "OPEN") {
    signals.push({ ...base, type: "close_date_passed", severity: "CRITICAL", message: "Expected close date has passed." });
  }

  if (!opportunity.hasDecisionMaker) {
    signals.push({ ...base, type: "missing_decision_maker", severity: "INFO", message: "No decision-maker contact assigned." });
  }

  if (!opportunity.expectedValue || opportunity.expectedValue <= 0) {
    signals.push({ ...base, type: "missing_value", severity: "WARNING", message: "Expected value not set." });
  }

  if (opportunity.maxDurationDays && opportunity.stageEnteredAt) {
    const stageDays = (asOf.getTime() - opportunity.stageEnteredAt.getTime()) / 86_400_000;
    if (stageDays > opportunity.maxDurationDays) {
      signals.push({
        ...base,
        type: "stage_duration_exceeded",
        severity: "WARNING",
        message: `In stage ${Math.round(stageDays)} days (max ${opportunity.maxDurationDays}).`,
      });
    }
  }

  if ((opportunity.stageReversalCount ?? 0) > 1) {
    signals.push({ ...base, type: "repeated_stage_reversal", severity: "INFO", message: "Repeated backward stage movement detected." });
  }

  if (opportunity.lastActivityAt) {
    const inactiveDays = (asOf.getTime() - opportunity.lastActivityAt.getTime()) / 86_400_000;
    if (inactiveDays > STAGE_REVERSAL_WINDOW_DAYS && opportunity.status === "OPEN") {
      signals.push({ ...base, type: "no_recent_activity", severity: "INFO", message: "Opportunity without recent activity." });
    }
  }

  return signals;
}

export function computePipelineHealth(opportunities: HealthOpportunity[]): {
  signals: HealthSignal[];
  summary: Record<string, number>;
} {
  const signals = opportunities.flatMap((o) => detectHealthSignals(o));
  const summary: Record<string, number> = {};
  for (const s of signals) {
    summary[s.type] = (summary[s.type] ?? 0) + 1;
  }
  return { signals, summary };
}
