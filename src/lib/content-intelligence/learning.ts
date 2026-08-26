import type { ContentLearning, EvidenceStrength } from "@/lib/content-intelligence/types";
import type { PatternResult } from "@/lib/growth/patterns";

const DISCLAIMER =
  "Based on observed account performance. Correlation does not imply causation.";

function strengthFromSample(sampleSize: number): EvidenceStrength {
  if (sampleSize >= 12) return "strong";
  if (sampleSize >= 6) return "moderate";
  return "emerging";
}

export function learningsFromPatterns(patterns: PatternResult[]): ContentLearning[] {
  return patterns.slice(0, 8).map((pattern, index) => ({
    id: `learning-pattern-${index}`,
    pattern: `${pattern.dimensionValue} · ${pattern.metricKey}`,
    observation: `${pattern.dimensionValue} shows ${pattern.metricValue.toFixed(1)}% on ${pattern.metricKey.replace(/_/g, " ")} (n=${pattern.sampleSize}).`,
    evidenceStrength: strengthFromSample(pattern.sampleSize),
    dimension: mapPatternDimension(pattern.dimension),
    sampleSize: pattern.sampleSize,
    disclaimer: pattern.correlationNote || DISCLAIMER,
  }));
}

function mapPatternDimension(
  dimension: string,
): ContentLearning["dimension"] {
  switch (dimension) {
    case "contentPillar":
      return "theme";
    case "hookType":
      return "hook";
    case "format":
      return "format";
    case "cta":
      return "cta";
    case "day":
    case "time":
      return "channel";
    default:
      return "theme";
  }
}

export function buildHookLearning(input: {
  hookPrefix: string;
  liftRatio: number;
  sampleSize: number;
}): ContentLearning {
  return {
    id: "learning-hook",
    pattern: "Strong hook pattern",
    observation: `Posts beginning with "${input.hookPrefix}" perform ${input.liftRatio.toFixed(1)}× above baseline.`,
    evidenceStrength: strengthFromSample(input.sampleSize),
    dimension: "hook",
    sampleSize: input.sampleSize,
    disclaimer: DISCLAIMER,
  };
}

export function buildFatigueLearning(input: {
  theme: string;
  declinePercent: number;
  sampleSize: number;
}): ContentLearning {
  return {
    id: `learning-fatigue-${input.theme}`,
    pattern: "Possible content fatigue",
    observation: `${input.theme.replace(/_/g, " ")} content shows declining engagement (${input.declinePercent.toFixed(0)}% vs prior period).`,
    evidenceStrength: strengthFromSample(input.sampleSize),
    dimension: "theme",
    sampleSize: input.sampleSize,
    disclaimer: "Possible content fatigue — not confirmed causally.",
  };
}
