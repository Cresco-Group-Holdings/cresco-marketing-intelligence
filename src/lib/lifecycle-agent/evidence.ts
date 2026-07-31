import {
  CHURN_LIKELIHOOD_DISCLAIMER,
  PREDICTIVE_SIGNAL_DISCLAIMER,
  PURCHASE_LIKELIHOOD_DISCLAIMER,
} from "./constants";
import type { LifecycleAnalysisInput } from "./analysis-inputs";

export type EvidencePackage = {
  analysisDate: Date;
  dateRangeStart: Date;
  dateRangeEnd: Date;
  brandId: string;
  organisationId: string;
  scope: LifecycleAnalysisInput["scope"];
  leadCount: number;
  opportunityCount: number;
  activityCount: number;
  taskCount: number;
  openOpportunityCount: number;
  overdueTaskCount: number;
  unownedLeadCount: number;
  staleOpportunityCount: number;
  trialEndingCount: number;
  renewalApproachingCount: number;
  metrics: Record<string, number>;
  metricDefinitions: Record<string, string>;
  freshnessHours: number | null;
  qualityWarnings: string[];
  dataConfidenceLevel: "LOW" | "MEDIUM" | "HIGH";
  consentRestrictedCount: number;
  suppressedContactCount: number;
  predictiveSignalDisclaimer: string;
  churnLikelihoodDisclaimer: string;
  purchaseLikelihoodDisclaimer: string;
  recentActivities: Array<{ type: string; occurredAt: string; entityId?: string }>;
  scopeSummary: string;
};

const METRIC_DEFINITIONS: Record<string, string> = {
  leadCount: "Total leads in analysis scope",
  opportunityCount: "Total opportunities in analysis scope",
  openOpportunityCount: "Opportunities with OPEN status",
  overdueTaskCount: "Tasks past due date and not completed",
  unownedLeadCount: "Leads without an assigned owner",
  staleOpportunityCount: "Open opportunities without activity beyond threshold",
  trialEndingCount: "Trials ending within warning window",
  renewalApproachingCount: "Renewals approaching within warning window",
  activityCount: "Logged CRM activities in date range",
  avgLeadScore: "Average lead score (rule-based, not predictive)",
  avgPurchaseLikelihood: "Average purchase likelihood estimate (heuristic, not proven)",
  avgChurnLikelihood: "Average churn likelihood estimate (heuristic, not proven)",
};

export function buildEvidencePackage(input: LifecycleAnalysisInput): EvidencePackage {
  const now = input.analysisDate;
  const qualityWarnings = [...(input.dataQuality.warnings ?? [])];

  const openOpportunities = input.opportunities.filter((o) => o.status === "OPEN");
  const overdueTasks = input.tasks.filter(
    (t) => t.dueDate && t.dueDate < now && !["COMPLETED", "CANCELLED"].includes(t.status),
  );
  const unownedLeads = input.leads.filter((l) => !l.ownerUserId);
  const consentRestricted = input.leads.filter(
    (l) => l.suppressed || l.unsubscribed || l.consentGranted === false,
  );
  const suppressedContacts = input.leads.filter((l) => l.suppressed || l.unsubscribed);

  const staleOpportunities = openOpportunities.filter((o) => {
    if (!o.lastActivityAt) return true;
    const days = (now.getTime() - o.lastActivityAt.getTime()) / 86_400_000;
    return days > 14;
  });

  const trialEnding = input.opportunities.filter((o) => {
    if (!o.trialEndsAt) return false;
    const days = (o.trialEndsAt.getTime() - now.getTime()) / 86_400_000;
    return days >= 0 && days <= 7;
  });

  const renewalApproaching = input.opportunities.filter((o) => {
    if (!o.renewalDate) return false;
    const days = (o.renewalDate.getTime() - now.getTime()) / 86_400_000;
    return days >= 0 && days <= 30;
  });

  const scoredLeads = input.leads.filter((l) => l.leadScore !== undefined);
  const purchaseLeads = input.leads.filter((l) => l.purchaseLikelihoodEstimate !== undefined);
  const churnLeads = input.leads.filter((l) => l.churnLikelihoodEstimate !== undefined);

  const avg = (values: number[]) =>
    values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;

  const metrics: Record<string, number> = {
    leadCount: input.leads.length,
    opportunityCount: input.opportunities.length,
    openOpportunityCount: openOpportunities.length,
    overdueTaskCount: overdueTasks.length,
    unownedLeadCount: unownedLeads.length,
    staleOpportunityCount: staleOpportunities.length,
    trialEndingCount: trialEnding.length,
    renewalApproachingCount: renewalApproaching.length,
    activityCount: input.activities.length,
    avgLeadScore: avg(scoredLeads.map((l) => l.leadScore!)),
    avgPurchaseLikelihood: avg(purchaseLeads.map((l) => l.purchaseLikelihoodEstimate!)),
    avgChurnLikelihood: avg(churnLeads.map((l) => l.churnLikelihoodEstimate!)),
  };

  if (!input.dataQuality.hasOwnerCoverage) {
    qualityWarnings.push("Owner coverage incomplete across scoped records.");
  }
  if (input.dataQuality.freshnessHours !== null && input.dataQuality.freshnessHours > 48) {
    qualityWarnings.push(`CRM data is ${input.dataQuality.freshnessHours}h old.`);
  }
  if (input.dataQuality.activityCount < 3) {
    qualityWarnings.push("Limited activity history reduces analysis confidence.");
  }

  const dataConfidenceLevel = classifyDataConfidence(input, qualityWarnings);

  const scopeParts: string[] = [];
  if (input.scope.pipelineId) scopeParts.push(`pipeline ${input.scope.pipelineId}`);
  if (input.scope.ownerUserId) scopeParts.push(`owner ${input.scope.ownerUserId}`);
  if (input.scope.lifecycleStages?.length) scopeParts.push(`stages: ${input.scope.lifecycleStages.join(", ")}`);
  const scopeSummary = scopeParts.length > 0 ? scopeParts.join("; ") : "all scoped CRM records";

  return {
    analysisDate: input.analysisDate,
    dateRangeStart: input.dateRangeStart,
    dateRangeEnd: input.dateRangeEnd,
    brandId: input.brandId,
    organisationId: input.organisationId,
    scope: input.scope,
    leadCount: input.leads.length,
    opportunityCount: input.opportunities.length,
    activityCount: input.activities.length,
    taskCount: input.tasks.length,
    openOpportunityCount: openOpportunities.length,
    overdueTaskCount: overdueTasks.length,
    unownedLeadCount: unownedLeads.length,
    staleOpportunityCount: staleOpportunities.length,
    trialEndingCount: trialEnding.length,
    renewalApproachingCount: renewalApproaching.length,
    metrics,
    metricDefinitions: { ...METRIC_DEFINITIONS, ...input.metricDefinitions },
    freshnessHours: input.dataQuality.freshnessHours,
    qualityWarnings,
    dataConfidenceLevel,
    consentRestrictedCount: consentRestricted.length,
    suppressedContactCount: suppressedContacts.length,
    predictiveSignalDisclaimer: PREDICTIVE_SIGNAL_DISCLAIMER,
    churnLikelihoodDisclaimer: CHURN_LIKELIHOOD_DISCLAIMER,
    purchaseLikelihoodDisclaimer: PURCHASE_LIKELIHOOD_DISCLAIMER,
    recentActivities: input.activities
      .slice(0, 20)
      .map((a) => ({
        type: a.type,
        occurredAt: a.occurredAt.toISOString(),
        entityId: a.leadId ?? a.opportunityId,
      })),
    scopeSummary,
  };
}

function classifyDataConfidence(
  input: LifecycleAnalysisInput,
  warnings: string[],
): "LOW" | "MEDIUM" | "HIGH" {
  if (warnings.length >= 3 || input.dataQuality.activityCount < 1) return "LOW";
  if (warnings.length > 0 || input.dataQuality.activityCount < 3) return "MEDIUM";
  return "HIGH";
}
