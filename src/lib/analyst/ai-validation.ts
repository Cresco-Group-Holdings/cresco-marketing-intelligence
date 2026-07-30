import type { MarketingAnalystOutput } from "@/lib/ai/analyst-output-schemas";
import { AppError } from "@/lib/errors";
import {
  buildAllowedLabels,
  buildAllowedNumericCatalog,
} from "@/lib/growth/ai-validation";

const NUMERIC_TOKEN = /-?\d{1,3}(?:,\d{3})*(?:\.\d+)?%?|-?\d+(?:\.\d+)?%?/g;

function extractTokens(text: string): string[] {
  return [...new Set((text.match(NUMERIC_TOKEN) ?? []).map((t) => t.replace(/,/g, "")))];
}

function numericMatchesAllowed(token: string, allowed: Set<string>): boolean {
  const normalized = token.replace(/,/g, "").replace(/%$/, "");
  if (allowed.has(normalized) || allowed.has(`${normalized}%`)) return true;
  const value = Number(normalized);
  if (!Number.isFinite(value)) return false;
  for (const candidate of allowed) {
    const candidateValue = Number(candidate.replace(/%$/, "").replace(/,/g, ""));
    if (Number.isFinite(candidateValue) && Math.abs(candidateValue - value) < 0.011) return true;
  }
  return false;
}

export function buildAnalystAllowedContext(evidencePackage: {
  metrics: Array<{ key: string; value: number | null; changePercent?: number | null; changeAbsolute?: number | null }>;
  metricDefinitions: Record<string, string>;
}) {
  const allowedEvidenceKeys = new Set(evidencePackage.metrics.map((m) => m.key));
  const allowedNumerics = buildAllowedNumericCatalog({
    sourceMetrics: evidencePackage.metrics,
    evidence: evidencePackage.metrics.map((m) => ({
      evidenceKey: m.key,
      evidenceValue: { value: m.value, changePercent: m.changePercent, changeAbsolute: m.changeAbsolute },
    })),
  });
  const allowedLabels = buildAllowedLabels({
    evidenceLabels: [...Object.keys(evidencePackage.metricDefinitions), ...allowedEvidenceKeys],
  });
  return { allowedEvidenceKeys, allowedNumerics, allowedLabels };
}

export function validateAnalystOutput(
  output: MarketingAnalystOutput,
  context: ReturnType<typeof buildAnalystAllowedContext>,
): void {
  for (const ref of output.evidenceReferences) {
    if (!context.allowedEvidenceKeys.has(ref.evidenceKey)) {
      throw new AppError("VALIDATION_ERROR", `Unsupported evidence key: ${ref.evidenceKey}`);
    }
  }

  for (const finding of output.keyFindings) {
    for (const key of finding.evidenceKeys) {
      if (!context.allowedEvidenceKeys.has(key)) {
        throw new AppError("VALIDATION_ERROR", `Finding references unsupported evidence: ${key}`);
      }
    }
  }

  const prose = [
    output.summary,
    ...output.keyFindings.map((f) => f.statement),
    ...output.possibleExplanations.map((e) => e.explanation),
    ...output.recommendedActions.map((a) => `${a.title} ${a.description}`),
    output.measurementPlan,
  ].join(" ");

  for (const token of extractTokens(prose)) {
    if (!numericMatchesAllowed(token, context.allowedNumerics) && !context.allowedLabels.has(token)) {
      throw new AppError("VALIDATION_ERROR", `Analyst output contains unsupported statistic: ${token}`);
    }
  }
}
