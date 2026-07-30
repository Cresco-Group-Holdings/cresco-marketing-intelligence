import {
  QUALIFICATION_THRESHOLDS,
  REQUIRED_ENGAGEMENT_FIELDS,
  REQUIRED_FIT_FIELDS,
  type QualificationStatus,
} from "./constants";
import type { ComputedScores } from "./scoring";
import type { LeadSnapshot } from "./signals";

export type QualificationResult = {
  status: QualificationStatus;
  compositeScore: number;
  missingFields: string[];
  reasons: string[];
  confidence: "LOW" | "MEDIUM" | "HIGH";
};

function hasValue(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function detectMissingInfo(snapshot: LeadSnapshot): string[] {
  const missing: string[] = [];

  for (const field of REQUIRED_FIT_FIELDS) {
    if (!hasValue(snapshot[field])) {
      missing.push(field);
    }
  }

  for (const field of REQUIRED_ENGAGEMENT_FIELDS) {
    if (!hasValue(snapshot[field])) {
      missing.push(field);
    }
  }

  if (snapshot.consentMarketing === undefined) {
    missing.push("consentMarketing");
  }

  return missing;
}

function resolveThresholdStatus(compositeScore: number): QualificationStatus {
  if (compositeScore < 0) return "DISQUALIFIED";

  for (const [status, threshold] of Object.entries(QUALIFICATION_THRESHOLDS)) {
    if (compositeScore >= threshold.min && compositeScore <= threshold.max) {
      return status as QualificationStatus;
    }
  }

  if (compositeScore >= QUALIFICATION_THRESHOLDS.QUALIFIED.min) return "QUALIFIED";
  return "COLD";
}

function computeConfidence(
  missingFields: string[],
  scores: ComputedScores,
): "LOW" | "MEDIUM" | "HIGH" {
  const matchedEvidence = scores.evidence.filter((e) => e.matched).length;
  if (missingFields.length >= 3 || matchedEvidence === 0) return "LOW";
  if (missingFields.length > 0 || matchedEvidence < 3) return "MEDIUM";
  return "HIGH";
}

export function mapScoreToQualificationStatus(
  scores: ComputedScores,
  snapshot: LeadSnapshot,
): QualificationResult {
  const missingFields = detectMissingInfo(snapshot);
  const reasons: string[] = [];

  if (snapshot.suppressed) {
    return {
      status: "DISQUALIFIED",
      compositeScore: scores.compositeScore,
      missingFields,
      reasons: ["Lead is suppressed."],
      confidence: "HIGH",
    };
  }

  if (snapshot.unsubscribed || snapshot.consentMarketing === false) {
    reasons.push("Marketing consent not granted or lead unsubscribed.");
  }

  if (snapshot.status === "DISQUALIFIED" || snapshot.qualificationState === "DISQUALIFIED") {
    return {
      status: "DISQUALIFIED",
      compositeScore: scores.compositeScore,
      missingFields,
      reasons: ["Lead status indicates disqualification.", ...reasons],
      confidence: "HIGH",
    };
  }

  if (missingFields.length > 0) {
    return {
      status: "NEEDS_INFO",
      compositeScore: scores.compositeScore,
      missingFields,
      reasons: [
        `Missing required fields: ${missingFields.join(", ")}.`,
        ...reasons,
      ],
      confidence: computeConfidence(missingFields, scores),
    };
  }

  const status = resolveThresholdStatus(scores.compositeScore);

  if (status === "HOT" || status === "QUALIFIED") {
    reasons.push(`Composite score ${scores.compositeScore} meets ${status} threshold.`);
  } else if (status === "WARM") {
    reasons.push(`Composite score ${scores.compositeScore} indicates moderate interest.`);
  } else if (status === "COLD") {
    reasons.push(`Composite score ${scores.compositeScore} indicates low engagement or fit.`);
  }

  return {
    status,
    compositeScore: scores.compositeScore,
    missingFields,
    reasons,
    confidence: computeConfidence(missingFields, scores),
  };
}
