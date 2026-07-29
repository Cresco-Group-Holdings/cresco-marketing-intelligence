import type { SocialReportNarrative } from "@/lib/ai/social-report-output-schemas";
import { buildAllowedNumericCatalog } from "@/lib/growth/ai-validation";
import { AppError } from "@/lib/errors";

const CAUSAL_CLAIM_PATTERNS = [
  /\bcaused\b/i,
  /\bbecause of\b/i,
  /\bdue to\b/i,
  /\bresulted from\b/i,
  /\bdrove\b/i,
  /\bled to\b/i,
];

const REQUIRED_HEDGING =
  /\b(may be associated with|the data suggests|requires further testing|correlation is not causation)\b/i;

function flattenText(narrative: SocialReportNarrative): string {
  return [
    narrative.executiveSummary,
    ...narrative.keyImprovements,
    ...narrative.keyDeclines,
    ...narrative.notableContent,
    ...narrative.recommendedActions,
    ...narrative.dataLimitations,
  ].join("\n");
}

export function validateSocialReportNarrative(
  narrative: SocialReportNarrative,
  metricsPayload: unknown,
): void {
  const allowedNumerics = buildAllowedNumericCatalog({
    sourceMetrics: metricsPayload,
    evidence: [],
  });
  const text = flattenText(narrative);

  for (const pattern of CAUSAL_CLAIM_PATTERNS) {
    if (pattern.test(text) && !REQUIRED_HEDGING.test(text)) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Narrative must hedge causal claims using approved language such as 'may be associated with' or 'the data suggests'.",
      );
    }
  }

  const numericTokens = text.match(/-?\d{1,3}(?:,\d{3})*(?:\.\d+)?%?|-?\d+(?:\.\d+)?%?/g) ?? [];
  for (const token of numericTokens) {
    const normalized = token.replace(/,/g, "");
    if (!allowedNumerics.has(normalized) && !allowedNumerics.has(normalized.replace(/%$/, ""))) {
      throw new AppError(
        "VALIDATION_ERROR",
        `Narrative contains unsupported metric value: ${token}`,
      );
    }
  }
}

export function buildDeterministicReportNarrative(input: {
  overview: {
    totals: Record<string, number>;
    derived: Record<string, number | null>;
    postsMeasured: number;
    accountsMeasured: number;
  };
  topContent: Array<{ label: string; score: number }>;
  weakContent: Array<{ label: string; score: number }>;
  leadsCreated: number;
  dataLimitations: string[];
}): SocialReportNarrative {
  const engagementRate = input.overview.derived.engagementRate;
  const followerGrowth = input.overview.derived.followerGrowth;
  return {
    executiveSummary:
      `The data suggests ${input.overview.postsMeasured} posts were measured across ${input.overview.accountsMeasured} accounts in the reporting period. ` +
      `Engagement rate was ${engagementRate ?? "unavailable"} and follower growth was ${followerGrowth ?? "unavailable"}. ` +
      "Correlation is not causation; further testing may be required to confirm drivers.",
    keyImprovements:
      input.topContent.length > 0
        ? input.topContent.map(
            (item) =>
              `Top content "${item.label}" may be associated with stronger observed engagement (${item.score}).`,
          )
        : ["Insufficient evidence to identify clear improvements in this period."],
    keyDeclines:
      input.weakContent.length > 0
        ? input.weakContent.map(
            (item) =>
              `Weak content "${item.label}" may be associated with lower observed engagement (${item.score}).`,
          )
        : ["No clear declines were identified from available metrics."],
    notableContent: input.topContent.map((item) => `${item.label} (${item.score})`),
    recommendedActions: [
      "Review top and weak content sections before changing production plans.",
      "Requires further testing before attributing performance changes to specific tactics.",
    ],
    dataLimitations:
      input.dataLimitations.length > 0
        ? input.dataLimitations
        : ["No additional data limitations were recorded."],
  };
}
