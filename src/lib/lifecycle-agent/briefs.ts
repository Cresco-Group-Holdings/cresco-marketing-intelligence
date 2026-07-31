import {
  CHURN_LIKELIHOOD_DISCLAIMER,
  LIFECYCLE_DISCLAIMER,
  PREDICTIVE_SIGNAL_DISCLAIMER,
  PURCHASE_LIKELIHOOD_DISCLAIMER,
} from "./constants";
import type { LifecycleAnalysisInput } from "./analysis-inputs";
import type { FindingCandidate } from "./findings";
import type { EvidencePackage } from "./evidence";
import type { PrioritisedRecommendation } from "./prioritisation";

export type BriefSection = {
  title: string;
  items: Array<{
    label: string;
    detail: string;
    severity?: "INFO" | "WARNING" | "CRITICAL";
    entityId?: string;
  }>;
};

export type LifecycleBrief = {
  briefType: string;
  generatedAt: Date;
  title: string;
  summary: string;
  sections: BriefSection[];
  disclaimers: string[];
  evidenceSummary: Record<string, unknown>;
};

export function generateDailySalesBrief(
  input: LifecycleAnalysisInput,
  evidence: EvidencePackage,
  findings: FindingCandidate[],
  recommendations: PrioritisedRecommendation[],
): LifecycleBrief {
  const criticalFindings = findings.filter((f) => f.severity === "CRITICAL" && !f.suppressed);
  const overdueTasks = input.tasks.filter(
    (t) => t.dueDate && t.dueDate < input.analysisDate && !["COMPLETED", "CANCELLED"].includes(t.status),
  );
  const topRecs = recommendations.slice(0, 5);

  return {
    briefType: "DAILY_SALES",
    generatedAt: input.analysisDate,
    title: "Daily Sales Brief",
    summary: `${evidence.openOpportunityCount} open opportunities, ${overdueTasks.length} overdue tasks, ${criticalFindings.length} critical findings.`,
    sections: [
      {
        title: "Priority Actions",
        items: topRecs.map((r) => ({
          label: r.title,
          detail: `${r.description} (priority: ${r.priorityBand}, score: ${r.priorityScore})`,
          severity: r.priorityBand === "CRITICAL" ? "CRITICAL" : r.priorityBand === "HIGH" ? "WARNING" : "INFO",
          entityId: r.entityId ?? undefined,
        })),
      },
      {
        title: "Overdue Tasks",
        items: overdueTasks.slice(0, 10).map((t) => ({
          label: t.title,
          detail: `Due ${t.dueDate?.toISOString() ?? "unknown"} — ${t.taskTypeCode}`,
          severity: "WARNING",
          entityId: t.opportunityId ?? t.leadId,
        })),
      },
      {
        title: "Critical Findings",
        items: criticalFindings.map((f) => ({
          label: f.title,
          detail: f.description,
          severity: "CRITICAL",
          entityId: f.entityId ?? undefined,
        })),
      },
    ],
    disclaimers: [LIFECYCLE_DISCLAIMER, PREDICTIVE_SIGNAL_DISCLAIMER],
    evidenceSummary: {
      openOpportunityCount: evidence.openOpportunityCount,
      overdueTaskCount: evidence.overdueTaskCount,
      dataConfidenceLevel: evidence.dataConfidenceLevel,
    },
  };
}

export function weeklyPipelineReview(
  input: LifecycleAnalysisInput,
  evidence: EvidencePackage,
  findings: FindingCandidate[],
): LifecycleBrief {
  const openOpps = input.opportunities.filter((o) => o.status === "OPEN");
  const staleCount = findings.filter((f) => f.findingType === "STALE_OPPORTUNITY" && !f.suppressed).length;
  const closeDatePassed = findings.filter((f) => f.findingType === "CLOSE_DATE_PASSED").length;
  const totalWeighted = openOpps.reduce(
    (sum, o) => sum + (o.expectedValue ?? 0) * ((o.probability ?? 0) / 100),
    0,
  );

  return {
    briefType: "WEEKLY_PIPELINE",
    generatedAt: input.analysisDate,
    title: "Weekly Pipeline Review",
    summary: `${openOpps.length} open opportunities. Weighted pipeline value: ${totalWeighted.toFixed(0)} (deterministic estimate, not predictive). ${staleCount} stale, ${closeDatePassed} past close date.`,
    sections: [
      {
        title: "Pipeline Health",
        items: [
          { label: "Open opportunities", detail: String(openOpps.length) },
          { label: "Stale opportunities", detail: String(staleCount), severity: staleCount > 0 ? "WARNING" : "INFO" },
          { label: "Past close date", detail: String(closeDatePassed), severity: closeDatePassed > 0 ? "CRITICAL" : "INFO" },
          { label: "Data confidence", detail: evidence.dataConfidenceLevel },
        ],
      },
      {
        title: "Stage Distribution",
        items: summariseByField(openOpps, (o) => o.stageCategory ?? o.pipelineStage ?? "UNKNOWN"),
      },
      {
        title: "Pipeline Signals",
        items: findings
          .filter((f) => f.entityType === "opportunity" && !f.suppressed)
          .slice(0, 15)
          .map((f) => ({
            label: f.title,
            detail: f.description,
            severity: f.severity,
            entityId: f.entityId ?? undefined,
          })),
      },
    ],
    disclaimers: [LIFECYCLE_DISCLAIMER],
    evidenceSummary: {
      openOpportunityCount: evidence.openOpportunityCount,
      weightedPipelineValue: totalWeighted,
      scopeSummary: evidence.scopeSummary,
    },
  };
}

export function trialRiskReview(
  input: LifecycleAnalysisInput,
  findings: FindingCandidate[],
): LifecycleBrief {
  const trialFindings = findings.filter(
    (f) =>
      ["TRIAL_ENDING_SOON", "TRIAL_INACTIVE"].includes(f.findingType) && !f.suppressed,
  );
  const trialOpps = input.opportunities.filter((o) => o.trialEndsAt);

  return {
    briefType: "TRIAL_RISK",
    generatedAt: input.analysisDate,
    title: "Trial Risk Review",
    summary: `${trialOpps.length} trials in scope. ${trialFindings.length} risk signals detected.`,
    sections: [
      {
        title: "Trials Ending Soon",
        items: trialOpps
          .filter((o) => {
            if (!o.trialEndsAt) return false;
            const days = (o.trialEndsAt.getTime() - input.analysisDate.getTime()) / 86_400_000;
            return days >= 0 && days <= 7;
          })
          .map((o) => ({
            label: o.name,
            detail: `Trial ends ${o.trialEndsAt!.toISOString()}`,
            severity: "WARNING" as const,
            entityId: o.id,
          })),
      },
      {
        title: "Trial Risk Signals",
        items: trialFindings.map((f) => ({
          label: f.title,
          detail: f.description,
          severity: f.severity,
          entityId: f.entityId ?? undefined,
        })),
      },
    ],
    disclaimers: [LIFECYCLE_DISCLAIMER, PURCHASE_LIKELIHOOD_DISCLAIMER],
    evidenceSummary: { trialCount: trialOpps.length, riskSignalCount: trialFindings.length },
  };
}

export function renewalReview(
  input: LifecycleAnalysisInput,
  findings: FindingCandidate[],
): LifecycleBrief {
  const renewalFindings = findings.filter(
    (f) =>
      ["RENEWAL_APPROACHING", "RENEWAL_AT_RISK", "CHURN_SIGNAL"].includes(f.findingType) &&
      !f.suppressed,
  );
  const renewalOpps = input.opportunities.filter((o) => o.renewalDate);

  return {
    briefType: "RENEWAL",
    generatedAt: input.analysisDate,
    title: "Renewal Review",
    summary: `${renewalOpps.length} renewals in scope. ${renewalFindings.length} renewal or churn signals.`,
    sections: [
      {
        title: "Upcoming Renewals",
        items: renewalOpps
          .filter((o) => {
            if (!o.renewalDate) return false;
            const days = (o.renewalDate.getTime() - input.analysisDate.getTime()) / 86_400_000;
            return days >= 0 && days <= 30;
          })
          .map((o) => ({
            label: o.name,
            detail: `Renewal ${o.renewalDate!.toISOString()}`,
            severity: "INFO" as const,
            entityId: o.id,
          })),
      },
      {
        title: "Renewal & Churn Signals",
        items: renewalFindings.map((f) => ({
          label: f.title,
          detail: f.description,
          severity: f.severity,
          entityId: f.entityId ?? undefined,
        })),
      },
    ],
    disclaimers: [LIFECYCLE_DISCLAIMER, CHURN_LIKELIHOOD_DISCLAIMER, PREDICTIVE_SIGNAL_DISCLAIMER],
    evidenceSummary: { renewalCount: renewalOpps.length, signalCount: renewalFindings.length },
  };
}

export function lifecycleHealthSummary(
  evidence: EvidencePackage,
  findings: FindingCandidate[],
): LifecycleBrief {
  const activeFindings = findings.filter((f) => !f.suppressed);
  const bySeverity = summariseByField(activeFindings, (f) => f.severity);
  const byType = summariseByField(activeFindings, (f) => f.findingType);

  return {
    briefType: "LIFECYCLE_HEALTH",
    generatedAt: evidence.analysisDate,
    title: "Lifecycle Health Summary",
    summary: `${evidence.leadCount} leads, ${evidence.opportunityCount} opportunities. ${activeFindings.length} active findings. Data confidence: ${evidence.dataConfidenceLevel}.`,
    sections: [
      {
        title: "Portfolio Metrics",
        items: [
          { label: "Leads", detail: String(evidence.leadCount) },
          { label: "Open opportunities", detail: String(evidence.openOpportunityCount) },
          { label: "Unowned leads", detail: String(evidence.unownedLeadCount), severity: evidence.unownedLeadCount > 0 ? "WARNING" : "INFO" },
          { label: "Stale opportunities", detail: String(evidence.staleOpportunityCount), severity: evidence.staleOpportunityCount > 0 ? "WARNING" : "INFO" },
          { label: "Consent restricted", detail: String(evidence.consentRestrictedCount) },
          { label: "Data confidence", detail: evidence.dataConfidenceLevel },
        ],
      },
      { title: "Findings by Severity", items: bySeverity },
      { title: "Top Finding Types", items: byType.slice(0, 10) },
      {
        title: "Data Quality Warnings",
        items: evidence.qualityWarnings.map((w) => ({
          label: "Warning",
          detail: w,
          severity: "WARNING" as const,
        })),
      },
    ],
    disclaimers: [LIFECYCLE_DISCLAIMER, PREDICTIVE_SIGNAL_DISCLAIMER],
    evidenceSummary: {
      metrics: evidence.metrics,
      dataConfidenceLevel: evidence.dataConfidenceLevel,
      scopeSummary: evidence.scopeSummary,
    },
  };
}

function summariseByField<T>(
  items: T[],
  accessor: (item: T) => string,
): Array<{ label: string; detail: string; severity?: "INFO" | "WARNING" | "CRITICAL" }> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const key = accessor(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .map(([label, count]) => ({ label, detail: String(count) }));
}
