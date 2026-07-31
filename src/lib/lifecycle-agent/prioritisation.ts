import type { LifecycleAnalysisInput } from "./analysis-inputs";
import type { RecommendationCandidate } from "./recommendations";
import type { EvidencePackage } from "./evidence";

export type PriorityFactor = {
  factor: string;
  weight: number;
  rawScore: number;
  weightedScore: number;
  rationale: string;
};

export type PrioritisedRecommendation = RecommendationCandidate & {
  priorityScore: number;
  priorityBand: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  factors: PriorityFactor[];
  monetaryValueExcluded: true;
};

const FACTOR_WEIGHTS = {
  customerImpact: 0.2,
  urgency: 0.2,
  lifecycle: 0.15,
  leadScore: 0.1,
  inactivity: 0.15,
  deadline: 0.1,
  dataConfidence: 0.05,
  consent: 0.05,
} as const;

const SEVERITY_SCORES: Record<string, number> = {
  CRITICAL: 100,
  WARNING: 70,
  INFO: 40,
};

const LIFECYCLE_URGENCY: Record<string, number> = {
  TRIAL: 90,
  OPPORTUNITY: 80,
  SALES_QUALIFIED: 75,
  CUSTOMER: 60,
  ACTIVE_CUSTOMER: 55,
  RENEWAL_APPROACHING: 85,
  TRIAL_ENDING_SOON: 95,
  CLOSE_DATE_PASSED: 100,
};

export function prioritiseRecommendations(
  recommendations: RecommendationCandidate[],
  input: LifecycleAnalysisInput,
  evidence: EvidencePackage,
): PrioritisedRecommendation[] {
  return recommendations
    .map((rec) => scoreRecommendation(rec, input, evidence))
    .sort((a, b) => b.priorityScore - a.priorityScore);
}

function scoreRecommendation(
  rec: RecommendationCandidate,
  input: LifecycleAnalysisInput,
  evidence: EvidencePackage,
): PrioritisedRecommendation {
  const factors: PriorityFactor[] = [];

  const customerImpact = scoreCustomerImpact(rec, input);
  factors.push(makeFactor("customerImpact", FACTOR_WEIGHTS.customerImpact, customerImpact, "Impact on customer relationship and retention."));

  const urgency = scoreUrgency(rec);
  factors.push(makeFactor("urgency", FACTOR_WEIGHTS.urgency, urgency, "Severity and time-sensitivity of the finding."));

  const lifecycle = scoreLifecycle(rec, input);
  factors.push(makeFactor("lifecycle", FACTOR_WEIGHTS.lifecycle, lifecycle, "Lifecycle stage relevance (trial, renewal, opportunity)."));

  const leadScore = scoreLeadScore(rec, input);
  factors.push(makeFactor("leadScore", FACTOR_WEIGHTS.leadScore, leadScore, "Rule-based lead score signal (not predictive)."));

  const inactivity = scoreInactivity(rec, input);
  factors.push(makeFactor("inactivity", FACTOR_WEIGHTS.inactivity, inactivity, "Days since last logged activity."));

  const deadline = scoreDeadline(rec, input);
  factors.push(makeFactor("deadline", FACTOR_WEIGHTS.deadline, deadline, "Proximity to trial end, renewal, or close date."));

  const dataConfidence = scoreDataConfidence(evidence);
  factors.push(makeFactor("dataConfidence", FACTOR_WEIGHTS.dataConfidence, dataConfidence, "CRM data freshness and activity coverage."));

  const consent = scoreConsent(rec);
  factors.push(makeFactor("consent", FACTOR_WEIGHTS.consent, consent, "Consent and suppression status (lower if restricted)."));

  const priorityScore = Math.round(factors.reduce((sum, f) => sum + f.weightedScore, 0));

  return {
    ...rec,
    priorityScore,
    priorityBand: classifyPriorityBand(priorityScore),
    factors,
    monetaryValueExcluded: true,
  };
}

function makeFactor(
  factor: string,
  weight: number,
  rawScore: number,
  rationale: string,
): PriorityFactor {
  return {
    factor,
    weight,
    rawScore,
    weightedScore: rawScore * weight,
    rationale,
  };
}

function scoreCustomerImpact(rec: RecommendationCandidate, input: LifecycleAnalysisInput): number {
  if (rec.findingType === "CHURN_SIGNAL" || rec.findingType === "RENEWAL_AT_RISK") return 90;
  if (rec.findingType === "TRIAL_INACTIVE" || rec.findingType === "CLOSE_DATE_PASSED") return 85;
  if (rec.entityType === "opportunity") {
    const opp = input.opportunities.find((o) => o.id === rec.entityId);
    if (opp?.stageCategory === "TRIAL") return 80;
    if (opp?.stageCategory === "NEGOTIATION" || opp?.stageCategory === "PROPOSAL") return 75;
  }
  if (rec.findingType === "NO_OWNER") return 70;
  return 50;
}

function scoreUrgency(rec: RecommendationCandidate): number {
  if (rec.findingType === "CLOSE_DATE_PASSED" || rec.findingType === "TRIAL_INACTIVE") return 100;
  if (rec.findingType === "TRIAL_ENDING_SOON" || rec.findingType === "OVERDUE_TASK") return 85;
  if (rec.findingType === "RENEWAL_AT_RISK") return 80;
  if (rec.findingType === "STALE_OPPORTUNITY") return 70;
  return SEVERITY_SCORES[rec.evidenceStrength === "STRONG" ? "CRITICAL" : "WARNING"] ?? 50;
}

function scoreLifecycle(rec: RecommendationCandidate, input: LifecycleAnalysisInput): number {
  if (rec.entityType === "lead" && rec.entityId) {
    const lead = input.leads.find((l) => l.id === rec.entityId);
    return LIFECYCLE_URGENCY[lead?.lifecycleStage ?? ""] ?? 50;
  }
  if (rec.entityType === "opportunity" && rec.entityId) {
    const opp = input.opportunities.find((o) => o.id === rec.entityId);
    if (opp?.trialEndsAt) return LIFECYCLE_URGENCY.TRIAL_ENDING_SOON;
    if (opp?.renewalDate) return LIFECYCLE_URGENCY.RENEWAL_APPROACHING;
    return LIFECYCLE_URGENCY[opp?.stageCategory ?? ""] ?? 50;
  }
  return 40;
}

function scoreLeadScore(rec: RecommendationCandidate, input: LifecycleAnalysisInput): number {
  if (rec.entityType !== "lead" || !rec.entityId) return 50;
  const lead = input.leads.find((l) => l.id === rec.entityId);
  if (lead?.leadScore === undefined) return 30;
  return Math.min(lead.leadScore, 100);
}

function scoreInactivity(rec: RecommendationCandidate, input: LifecycleAnalysisInput): number {
  const now = input.analysisDate;
  let lastActivity: Date | null | undefined;

  if (rec.entityType === "lead" && rec.entityId) {
    lastActivity = input.leads.find((l) => l.id === rec.entityId)?.lastActivityAt;
  } else if (rec.entityType === "opportunity" && rec.entityId) {
    lastActivity = input.opportunities.find((o) => o.id === rec.entityId)?.lastActivityAt;
  }

  if (!lastActivity) return 80;
  const days = (now.getTime() - lastActivity.getTime()) / 86_400_000;
  return Math.min(days * 3, 100);
}

function scoreDeadline(rec: RecommendationCandidate, input: LifecycleAnalysisInput): number {
  if (rec.entityType !== "opportunity" || !rec.entityId) {
    if (rec.findingType === "CLOSE_DATE_PASSED") return 100;
    return 30;
  }
  const opp = input.opportunities.find((o) => o.id === rec.entityId);
  if (!opp) return 30;
  const now = input.analysisDate;

  const deadlines = [opp.trialEndsAt, opp.renewalDate, opp.expectedCloseDate].filter(Boolean) as Date[];
  if (deadlines.length === 0) return 30;

  const nearestDays = Math.min(
    ...deadlines.map((d) => (d.getTime() - now.getTime()) / 86_400_000),
  );
  if (nearestDays < 0) return 100;
  if (nearestDays <= 7) return 95;
  if (nearestDays <= 14) return 80;
  if (nearestDays <= 30) return 60;
  return 40;
}

function scoreDataConfidence(evidence: EvidencePackage): number {
  switch (evidence.dataConfidenceLevel) {
    case "HIGH":
      return 90;
    case "MEDIUM":
      return 60;
    case "LOW":
      return 20;
  }
}

function scoreConsent(rec: RecommendationCandidate): number {
  if (rec.consentRequired) return 10;
  if (rec.findingType === "SUPPRESSED_CONTACT") return 0;
  return 80;
}

function classifyPriorityBand(score: number): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  if (score >= 80) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 40) return "MEDIUM";
  return "LOW";
}
