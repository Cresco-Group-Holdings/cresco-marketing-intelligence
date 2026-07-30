import { MATERIAL_ACTION_CLASSES } from "./constants";
import type { FindingCandidate } from "./findings";
import type { EvidencePackage } from "./evidence";

export type RecommendationCandidate = {
  recommendationType: string;
  title: string;
  description: string;
  confidenceLevel: "LOW" | "MEDIUM" | "HIGH";
  evidenceStrength: string;
  sampleSizeState: "INSUFFICIENT" | "MARGINAL" | "SUFFICIENT";
  dataQualityState: "POOR" | "FAIR" | "GOOD";
  alternativeExplanations: string[];
  risk: string;
  missingData: string[];
  budgetImpact: string;
  requiresApproval: boolean;
  measurementPlan: string;
  findingType: string;
};

const FINDING_TO_RECOMMENDATION: Record<string, string> = {
  TRACKING_FAILURE: "INVESTIGATE_TRACKING",
  PROVIDER_DATA_STALE: "WAIT_FOR_MORE_DATA",
  LOW_CTR: "ROTATE_CREATIVE",
  HIGH_CPC: "REVIEW_BID_STRATEGY",
  HIGH_CPA: "REDUCE_BUDGET",
  HIGH_SPEND_LOW_RETURN: "PAUSE_FOR_REVIEW",
  LOW_CONVERSION_RATE: "REVIEW_LANDING_PAGE",
  LANDING_PAGE_MISMATCH: "REVIEW_LANDING_PAGE",
  CREATIVE_FATIGUE: "ROTATE_CREATIVE",
  AUDIENCE_SATURATION: "REVISE_AUDIENCE",
  BUDGET_OVERRUN_RISK: "REDUCE_BUDGET",
  BUDGET_CONSTRAINT: "REQUEST_BUDGET_INCREASE",
  STRONG_CAMPAIGN: "CREATE_EXPERIMENT",
  STRONG_CREATIVE: "CREATE_NEW_CREATIVE",
  INVALID_EXPERIMENT: "WAIT_FOR_MORE_DATA",
  ATTRIBUTION_GAP: "INVESTIGATE_TRACKING",
  POLICY_RISK: "PAUSE_FOR_REVIEW",
};

export function deriveRecommendations(
  findings: FindingCandidate[],
  evidence: EvidencePackage,
): RecommendationCandidate[] {
  const recommendations: RecommendationCandidate[] = [];
  const activeFindings = findings.filter((f) => !f.suppressed);

  for (const finding of activeFindings) {
    const recType = FINDING_TO_RECOMMENDATION[finding.findingType] ?? "WAIT_FOR_MORE_DATA";
    const sampleSizeState = classifySampleSize(evidence);
    const dataQualityState = classifyDataQuality(evidence);

    recommendations.push({
      recommendationType: recType,
      title: `Address: ${finding.title}`,
      description: finding.description,
      confidenceLevel: sampleSizeState === "SUFFICIENT" && dataQualityState === "GOOD" ? "HIGH" : sampleSizeState === "INSUFFICIENT" ? "LOW" : "MEDIUM",
      evidenceStrength: finding.severity === "CRITICAL" ? "STRONG" : "MODERATE",
      sampleSizeState,
      dataQualityState,
      alternativeExplanations: ["Seasonality", "Attribution lag", "Audience mix shift"],
      risk: recType === "REQUEST_BUDGET_INCREASE" ? "Spend increase requires approval workflow." : "Low if monitored.",
      missingData: evidence.minimumVolumeMet ? [] : ["Additional impression volume"],
      budgetImpact: estimateBudgetImpact(recType),
      requiresApproval: requiresApprovalFor(recType),
      measurementPlan: "Compare primary metrics over 7-day post-change window.",
      findingType: finding.findingType,
    });
  }

  if (activeFindings.length === 0 && !evidence.minimumVolumeMet) {
    recommendations.push({
      recommendationType: "WAIT_FOR_MORE_DATA",
      title: "Wait for more data",
      description: "Insufficient volume to produce reliable optimisation recommendations.",
      confidenceLevel: "LOW",
      evidenceStrength: "WEAK",
      sampleSizeState: "INSUFFICIENT",
      dataQualityState: classifyDataQuality(evidence),
      alternativeExplanations: [],
      risk: "Acting on insufficient data may cause false positives.",
      missingData: ["Minimum impression volume"],
      budgetImpact: "None",
      requiresApproval: false,
      measurementPlan: "Re-run review when minimum volume is met.",
      findingType: "OTHER",
    });
  }

  return recommendations;
}

function classifySampleSize(evidence: EvidencePackage): "INSUFFICIENT" | "MARGINAL" | "SUFFICIENT" {
  const impressions = evidence.metrics.impressions ?? 0;
  if (impressions < evidence.minimumVolume * 0.5) return "INSUFFICIENT";
  if (impressions < evidence.minimumVolume) return "MARGINAL";
  return "SUFFICIENT";
}

function classifyDataQuality(evidence: EvidencePackage): "POOR" | "FAIR" | "GOOD" {
  if (evidence.qualityWarnings.length >= 3) return "POOR";
  if (evidence.qualityWarnings.length > 0) return "FAIR";
  return "GOOD";
}

function estimateBudgetImpact(recType: string): string {
  switch (recType) {
    case "REDUCE_BUDGET":
      return "Potential spend reduction";
    case "REQUEST_BUDGET_INCREASE":
      return "Spend increase only via approval workflow";
    case "PAUSE_FOR_REVIEW":
      return "Spend pause until reviewed";
    default:
      return "Minimal direct budget impact";
  }
}

function requiresApprovalFor(recType: string): boolean {
  const approvalRequired = [
    "REDUCE_BUDGET",
    "REQUEST_BUDGET_INCREASE",
    "PAUSE_FOR_REVIEW",
    "REVISE_AUDIENCE",
    "EXCLUDE_LOW_QUALITY_PLACEMENT",
    "CHANGE_SCHEDULE",
    "REVIEW_BID_STRATEGY",
  ];
  return approvalRequired.includes(recType);
}

export function mapRecommendationToActionClass(recommendationType: string): string {
  const mapping: Record<string, string> = {
    INVESTIGATE_TRACKING: "CREATE_TASK",
    PAUSE_FOR_REVIEW: "REQUEST_PAUSE",
    REDUCE_BUDGET: "REQUEST_BUDGET_CHANGE",
    REQUEST_BUDGET_INCREASE: "REQUEST_BUDGET_CHANGE",
    CREATE_NEW_CREATIVE: "CREATE_CREATIVE_REQUEST",
    ROTATE_CREATIVE: "CREATE_CREATIVE_REQUEST",
    REVISE_AUDIENCE: "REQUEST_PROVIDER_CHANGE",
    EXCLUDE_LOW_QUALITY_PLACEMENT: "REQUEST_PROVIDER_CHANGE",
    REVIEW_LANDING_PAGE: "CREATE_TASK",
    CREATE_EXPERIMENT: "CREATE_EXPERIMENT",
    CHANGE_SCHEDULE: "REQUEST_PROVIDER_CHANGE",
    REVIEW_BID_STRATEGY: "REQUEST_PROVIDER_CHANGE",
    IMPROVE_CONVERSION_TRACKING: "CREATE_TASK",
    WAIT_FOR_MORE_DATA: "INFORMATION_ONLY",
  };
  return mapping[recommendationType] ?? "INFORMATION_ONLY";
}

export function isMaterialAction(actionClass: string): boolean {
  return (MATERIAL_ACTION_CLASSES as readonly string[]).includes(actionClass);
}
