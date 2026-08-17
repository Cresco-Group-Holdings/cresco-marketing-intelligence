import type { CopilotConfidence, CopilotConfidenceLevel, EvidenceItem } from "@/lib/copilot/types";

export function computeCopilotConfidence(input: {
  evidence: EvidenceItem[];
  limitations: string[];
  sampleSize?: number | null;
  minSampleSize?: number;
  coverage?: number | null;
  truncated?: boolean;
  corroboratingSignals?: number;
}): CopilotConfidence {
  const reasons: string[] = [];
  let score = 100;

  const minSample = input.minSampleSize ?? 10;
  const sampleSize = input.sampleSize ?? estimateSampleSize(input.evidence);

  if (sampleSize < minSample) {
    score -= 35;
    reasons.push(`Limited sample size (${sampleSize} observations).`);
  }

  if (input.coverage != null && input.coverage < 70) {
    score -= 25;
    reasons.push(`Data coverage is ${input.coverage.toFixed(0)}%.`);
  }

  if (input.truncated) {
    score -= 20;
    reasons.push("Analysis uses capped top-N results from the analytics service.");
  }

  const staleSources = input.evidence.filter((item) => item.freshness === "stale" || item.freshness === "unavailable");
  if (staleSources.length > 0) {
    score -= 15;
    reasons.push("Some source data is stale or unavailable.");
  }

  if (input.limitations.length > 0) {
    score -= Math.min(20, input.limitations.length * 5);
    reasons.push(...input.limitations.slice(0, 2));
  }

  if ((input.corroboratingSignals ?? 0) >= 2) {
    score += 10;
    reasons.push("Multiple corroborating signals support this conclusion.");
  }

  const level = scoreToLevel(score);
  return {
    level,
    label: labelForLevel(level),
    reasons: reasons.length > 0 ? reasons : ["Sufficient synchronised data for this conclusion."],
  };
}

function scoreToLevel(score: number): CopilotConfidenceLevel {
  if (score >= 80) return "high";
  if (score >= 60) return "moderate";
  if (score >= 35) return "limited";
  return "insufficient";
}

function labelForLevel(level: CopilotConfidenceLevel): string {
  switch (level) {
    case "high":
      return "High confidence";
    case "moderate":
      return "Moderate confidence";
    case "limited":
      return "Limited confidence";
    case "insufficient":
      return "Insufficient data";
  }
}

function estimateSampleSize(evidence: EvidenceItem[]): number {
  const sizes = evidence
    .map((item) => item.sampleSize)
    .filter((value): value is number => value != null && value > 0);
  if (sizes.length === 0) return evidence.length;
  return Math.max(...sizes);
}
