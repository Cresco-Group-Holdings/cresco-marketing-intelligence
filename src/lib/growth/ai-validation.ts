import type { GrowthInsightExplanation } from "@/lib/ai/growth-output-schemas";
import { AppError } from "@/lib/errors";

const PERIOD_LABEL_PATTERN =
  /\b(January|February|March|April|May|June|July|August|September|October|November|December|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|UTC|GMT)\b/gi;

const NUMERIC_TOKEN =
  /-?\d{1,3}(?:,\d{3})*(?:\.\d+)?%?|-?\d+(?:\.\d+)?%?/g;

const ISO_DATE = /\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)?/g;

function flattenNumbers(value: unknown, bucket: Set<string>): void {
  if (value === null || value === undefined) return;
  if (typeof value === "number" && Number.isFinite(value)) {
    bucket.add(String(value));
    bucket.add(value.toFixed(2));
    bucket.add(`${value.toFixed(2)}%`);
    bucket.add(String(Math.round(value)));
    bucket.add(`${Math.round(value)}%`);
    return;
  }
  if (typeof value === "string") {
    for (const match of value.match(NUMERIC_TOKEN) ?? []) bucket.add(match.replace(/,/g, ""));
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) flattenNumbers(item, bucket);
    return;
  }
  if (typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) flattenNumbers(item, bucket);
  }
}

export function buildAllowedNumericCatalog(input: {
  sourceMetrics: unknown;
  evidence: Array<{ evidenceKey: string; evidenceValue: unknown }>;
}): Set<string> {
  const allowed = new Set<string>();
  flattenNumbers(input.sourceMetrics, allowed);
  for (const item of input.evidence) {
    flattenNumbers(item.evidenceValue, allowed);
  }
  return allowed;
}

export function buildAllowedLabels(input: {
  insightType?: string | null;
  periodStart?: Date | null;
  periodEnd?: Date | null;
  evidenceLabels?: Array<string | null | undefined>;
}): Set<string> {
  const labels = new Set<string>();
  if (input.insightType) labels.add(input.insightType);
  for (const label of input.evidenceLabels ?? []) {
    if (label) labels.add(label);
  }
  if (input.periodStart) labels.add(input.periodStart.toISOString().slice(0, 10));
  if (input.periodEnd) labels.add(input.periodEnd.toISOString().slice(0, 10));
  return labels;
}

function numericMatchesAllowed(token: string, allowed: Set<string>): boolean {
  const normalized = token.replace(/,/g, "");
  if (allowed.has(normalized)) return true;
  const bare = normalized.replace(/%$/, "");
  if (allowed.has(bare)) return true;
  const asPercent = `${bare}%`;
  if (allowed.has(asPercent)) return true;
  const value = Number(bare);
  if (!Number.isFinite(value)) return false;
  for (const candidate of allowed) {
    const candidateBare = candidate.replace(/%$/, "").replace(/,/g, "");
    const candidateValue = Number(candidateBare);
    if (Number.isFinite(candidateValue) && Math.abs(candidateValue - value) < 0.011) {
      return true;
    }
  }
  return false;
}

function extractTokens(text: string): string[] {
  const tokens = new Set<string>();
  for (const match of text.match(NUMERIC_TOKEN) ?? []) tokens.add(match.replace(/,/g, ""));
  for (const match of text.match(ISO_DATE) ?? []) tokens.add(match);
  return [...tokens];
}

export function validateGrowthAiExplanation(
  explanation: GrowthInsightExplanation,
  context: {
    allowedEvidenceKeys: Set<string>;
    allowedNumerics: Set<string>;
    allowedLabels: Set<string>;
  },
): void {
  for (const item of explanation.evidence) {
    if (!context.allowedEvidenceKeys.has(item.evidenceKey)) {
      throw new AppError(
        "VALIDATION_ERROR",
        `AI cited unsupported evidence key: ${item.evidenceKey}`,
      );
    }
    if (item.value !== undefined && item.value !== null) {
      const valueTokens = extractTokens(String(item.value));
      for (const token of valueTokens) {
        if (
          !numericMatchesAllowed(token, context.allowedNumerics) &&
          !context.allowedLabels.has(token)
        ) {
          throw new AppError(
            "VALIDATION_ERROR",
            `AI evidence value contains unsupported statistic: ${token}`,
          );
        }
      }
    }
  }

  const prose = [
    explanation.finding,
    explanation.explanation,
    explanation.recommendedAction,
    explanation.expectedHypothesis,
    explanation.measurementPlan,
  ].join(" ");

  const proseWithoutLabels = prose.replace(PERIOD_LABEL_PATTERN, " ");
  for (const token of extractTokens(proseWithoutLabels)) {
    if (ISO_DATE.test(token)) {
      if (context.allowedLabels.has(token) || context.allowedLabels.has(token.slice(0, 10))) continue;
    }
    if (!numericMatchesAllowed(token, context.allowedNumerics)) {
      throw new AppError(
        "VALIDATION_ERROR",
        `AI explanation contains unsupported statistic: ${token}`,
      );
    }
  }
}
