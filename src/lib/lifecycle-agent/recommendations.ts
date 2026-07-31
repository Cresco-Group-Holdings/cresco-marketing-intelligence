import { MATERIAL_ACTION_CLASSES } from "./constants";
import type { FindingCandidate } from "./findings";
import type { EvidencePackage } from "./evidence";

export type RecommendationCandidate = {
  recommendationType: string;
  title: string;
  description: string;
  confidenceLevel: "LOW" | "MEDIUM" | "HIGH";
  evidenceStrength: string;
  dataQualityState: "POOR" | "FAIR" | "GOOD";
  alternativeExplanations: string[];
  risk: string;
  missingData: string[];
  requiresApproval: boolean;
  consentRequired: boolean;
  measurementPlan: string;
  findingType: string;
  entityType: "lead" | "opportunity" | "portfolio";
  entityId: string | null;
};

const FINDING_TO_RECOMMENDATION: Record<string, string> = {
  NO_OWNER: "ASSIGN_OWNER",
  NO_NEXT_ACTION: "CREATE_FOLLOW_UP_TASK",
  OVERDUE_TASK: "CREATE_FOLLOW_UP_TASK",
  STALE_OPPORTUNITY: "SCHEDULE_CALL",
  STALE_LEAD: "RE_ENGAGE",
  CLOSE_DATE_PASSED: "ESCALATE_TO_MANAGER",
  TRIAL_ENDING_SOON: "TRIAL_CHECK_IN",
  TRIAL_INACTIVE: "TRIAL_CHECK_IN",
  RENEWAL_APPROACHING: "RENEWAL_OUTREACH",
  RENEWAL_AT_RISK: "RENEWAL_OUTREACH",
  CHURN_SIGNAL: "RE_ENGAGE",
  LOW_ENGAGEMENT: "RE_ENGAGE",
  MISSING_DECISION_MAKER: "COLLECT_MISSING_INFO",
  MISSING_VALUE: "COLLECT_MISSING_INFO",
  STAGE_DURATION_EXCEEDED: "REVIEW_PROPOSAL",
  STAGE_REVERSAL: "SCHEDULE_MEETING",
  CONSENT_RESTRICTED: "REVIEW_CONSENT",
  SUPPRESSED_CONTACT: "INFORMATION_ONLY",
  DATA_STALE: "WAIT_FOR_MORE_DATA",
  INSUFFICIENT_CRM_DATA: "WAIT_FOR_MORE_DATA",
  STRONG_ENGAGEMENT: "CREATE_FOLLOW_UP_TASK",
  HEALTHY_PIPELINE: "INFORMATION_ONLY",
};

export function deriveRecommendations(
  findings: FindingCandidate[],
  evidence: EvidencePackage,
): RecommendationCandidate[] {
  const recommendations: RecommendationCandidate[] = [];
  const activeFindings = findings.filter((f) => !f.suppressed);

  for (const finding of activeFindings) {
    const recType = FINDING_TO_RECOMMENDATION[finding.findingType] ?? "INFORMATION_ONLY";
    const dataQualityState = classifyDataQuality(evidence);
    const consentRequired =
      finding.findingType === "CONSENT_RESTRICTED" || finding.findingType === "SUPPRESSED_CONTACT";

    recommendations.push({
      recommendationType: recType,
      title: `Address: ${finding.title}`,
      description: finding.description,
      confidenceLevel:
        dataQualityState === "GOOD" && finding.severity === "CRITICAL"
          ? "HIGH"
          : dataQualityState === "POOR"
            ? "LOW"
            : "MEDIUM",
      evidenceStrength: finding.severity === "CRITICAL" ? "STRONG" : "MODERATE",
      dataQualityState,
      alternativeExplanations: getAlternativeExplanations(finding.findingType),
      risk: consentRequired
        ? "Outreach restricted by consent or suppression status."
        : recType === "ESCALATE_TO_MANAGER"
          ? "Deal may be at risk without management attention."
          : "Low if monitored.",
      missingData: evidence.dataConfidenceLevel === "LOW" ? ["Additional CRM activity history"] : [],
      requiresApproval: requiresApprovalFor(recType),
      consentRequired,
      measurementPlan: "Track activity response and stage progression over 14-day window.",
      findingType: finding.findingType,
      entityType: finding.entityType,
      entityId: finding.entityId,
    });
  }

  if (activeFindings.length === 0 && evidence.dataConfidenceLevel === "LOW") {
    recommendations.push({
      recommendationType: "WAIT_FOR_MORE_DATA",
      title: "Wait for more CRM data",
      description: "Insufficient CRM data to produce reliable lifecycle recommendations.",
      confidenceLevel: "LOW",
      evidenceStrength: "WEAK",
      dataQualityState: classifyDataQuality(evidence),
      alternativeExplanations: [],
      risk: "Acting on insufficient data may cause false positives.",
      missingData: ["Logged CRM activities", "Owner assignments"],
      requiresApproval: false,
      consentRequired: false,
      measurementPlan: "Re-run analysis when data confidence improves.",
      findingType: "INSUFFICIENT_CRM_DATA",
      entityType: "portfolio",
      entityId: null,
    });
  }

  return recommendations;
}

function classifyDataQuality(evidence: EvidencePackage): "POOR" | "FAIR" | "GOOD" {
  if (evidence.qualityWarnings.length >= 3 || evidence.dataConfidenceLevel === "LOW") return "POOR";
  if (evidence.qualityWarnings.length > 0 || evidence.dataConfidenceLevel === "MEDIUM") return "FAIR";
  return "GOOD";
}

function getAlternativeExplanations(findingType: string): string[] {
  switch (findingType) {
    case "CHURN_SIGNAL":
      return ["Seasonal usage dip", "Contact on leave", "Product fit still being evaluated"];
    case "STALE_OPPORTUNITY":
      return ["Awaiting customer budget cycle", "Internal champion change", "Holiday period"];
    case "LOW_ENGAGEMENT":
      return ["Different communication channel preferred", "Project deprioritised internally"];
    default:
      return ["Data sync delay", "Recent ownership change"];
  }
}

function requiresApprovalFor(recType: string): boolean {
  const approvalRequired = [
    "ASSIGN_OWNER",
    "UPDATE_PIPELINE_STAGE",
    "ESCALATE_TO_MANAGER",
    "DRAFT_EMAIL",
    "RENEWAL_OUTREACH",
  ];
  return approvalRequired.includes(recType);
}

export function mapRecommendationToActionClass(recommendationType: string): string {
  const mapping: Record<string, string> = {
    ASSIGN_OWNER: "REQUEST_OWNER_ASSIGNMENT",
    CREATE_FOLLOW_UP_TASK: "CREATE_TASK",
    SCHEDULE_CALL: "CREATE_TASK",
    SCHEDULE_MEETING: "REQUEST_MEETING",
    DRAFT_EMAIL: "DRAFT_MESSAGE",
    REVIEW_PROPOSAL: "CREATE_TASK",
    TRIAL_CHECK_IN: "CREATE_TASK",
    RENEWAL_OUTREACH: "DRAFT_MESSAGE",
    RE_ENGAGE: "CREATE_TASK",
    ESCALATE_TO_MANAGER: "CREATE_TASK",
    UPDATE_PIPELINE_STAGE: "REQUEST_STAGE_CHANGE",
    COLLECT_MISSING_INFO: "CREATE_TASK",
    WAIT_FOR_MORE_DATA: "INFORMATION_ONLY",
    REVIEW_CONSENT: "INFORMATION_ONLY",
    INFORMATION_ONLY: "INFORMATION_ONLY",
  };
  return mapping[recommendationType] ?? "INFORMATION_ONLY";
}

export function isMaterialAction(actionClass: string): boolean {
  return (MATERIAL_ACTION_CLASSES as readonly string[]).includes(actionClass);
}
