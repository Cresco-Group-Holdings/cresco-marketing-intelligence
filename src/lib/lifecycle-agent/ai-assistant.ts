import {
  CHURN_LIKELIHOOD_DISCLAIMER,
  LIFECYCLE_DISCLAIMER,
  PREDICTIVE_SIGNAL_DISCLAIMER,
  PURCHASE_LIKELIHOOD_DISCLAIMER,
} from "./constants";
import type { FindingCandidate } from "./findings";
import type { EvidencePackage } from "./evidence";
import type { PrioritisedRecommendation } from "./prioritisation";

export type LifecycleExplanation = {
  summary: string;
  findingSummaries: Array<{ findingType: string; title: string; explanation: string }>;
  recommendationSummaries: Array<{
    recommendationType: string;
    title: string;
    explanation: string;
    priorityBand: string;
    factors: string[];
  }>;
  evidence: Record<string, unknown>;
  grounded: true;
  modifiesScore: false;
  modifiesThresholds: false;
  disclaimer: string;
  predictiveDisclaimers: string[];
};

export function generateExplanation(
  evidence: EvidencePackage,
  findings: FindingCandidate[],
  recommendations: PrioritisedRecommendation[],
): LifecycleExplanation {
  const activeFindings = findings.filter((f) => !f.suppressed);
  const topFindings = activeFindings.slice(0, 5);
  const topRecs = recommendations.slice(0, 5);

  const criticalCount = activeFindings.filter((f) => f.severity === "CRITICAL").length;
  const warningCount = activeFindings.filter((f) => f.severity === "WARNING").length;

  const summary = [
    `Lifecycle analysis for ${evidence.scopeSummary}.`,
    `${evidence.leadCount} leads and ${evidence.openOpportunityCount} open opportunities analysed.`,
    `${activeFindings.length} active findings (${criticalCount} critical, ${warningCount} warning).`,
    `Data confidence: ${evidence.dataConfidenceLevel}.`,
    topRecs.length > 0
      ? `Top priority: ${topRecs[0].title} (${topRecs[0].priorityBand}, score ${topRecs[0].priorityScore}).`
      : "No material recommendations due to guardrails or insufficient data.",
  ].join(" ");

  const findingSummaries = topFindings.map((f) => ({
    findingType: f.findingType,
    title: f.title,
    explanation: buildFindingExplanation(f),
  }));

  const recommendationSummaries = topRecs.map((r) => ({
    recommendationType: r.recommendationType,
    title: r.title,
    explanation: r.description,
    priorityBand: r.priorityBand,
    factors: r.factors.map((f) => `${f.factor}: ${f.rawScore} (${f.rationale})`),
  }));

  const predictiveDisclaimers: string[] = [PREDICTIVE_SIGNAL_DISCLAIMER];
  if (activeFindings.some((f) => f.findingType === "CHURN_SIGNAL")) {
    predictiveDisclaimers.push(CHURN_LIKELIHOOD_DISCLAIMER);
  }
  if (findings.some((f) => f.evidence.purchaseLikelihoodEstimate !== undefined)) {
    predictiveDisclaimers.push(PURCHASE_LIKELIHOOD_DISCLAIMER);
  }

  return {
    summary,
    findingSummaries,
    recommendationSummaries,
    evidence: {
      leadCount: evidence.leadCount,
      opportunityCount: evidence.opportunityCount,
      openOpportunityCount: evidence.openOpportunityCount,
      overdueTaskCount: evidence.overdueTaskCount,
      staleOpportunityCount: evidence.staleOpportunityCount,
      trialEndingCount: evidence.trialEndingCount,
      renewalApproachingCount: evidence.renewalApproachingCount,
      dataConfidenceLevel: evidence.dataConfidenceLevel,
      metrics: evidence.metrics,
      qualityWarnings: evidence.qualityWarnings,
      scopeSummary: evidence.scopeSummary,
      recentActivityCount: evidence.recentActivities.length,
    },
    grounded: true,
    modifiesScore: false,
    modifiesThresholds: false,
    disclaimer: LIFECYCLE_DISCLAIMER,
    predictiveDisclaimers,
  };
}

function buildFindingExplanation(finding: FindingCandidate): string {
  const base = finding.description;
  if (finding.findingType === "CHURN_SIGNAL") {
    return `${base} Note: churn likelihood is a heuristic estimate, not a proven fact.`;
  }
  if (finding.evidence.disclaimer) {
    return `${base} (${finding.evidence.disclaimer})`;
  }
  return base;
}
