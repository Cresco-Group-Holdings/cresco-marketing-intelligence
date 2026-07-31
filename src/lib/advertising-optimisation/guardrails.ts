import { detectPromptInjection, sanitiseUserInput } from "@/lib/ai/prompt-injection";
import type { AnalysisInput } from "./analysis-inputs";
import type { EvidencePackage } from "./evidence";

export type GuardrailResult = {
  passed: boolean;
  warnings: string[];
  blocked: boolean;
  blockReasons: string[];
};

export function evaluateGuardrails(input: AnalysisInput, evidence: EvidencePackage): GuardrailResult {
  const warnings: string[] = [];
  const blockReasons: string[] = [];

  if (
    input.comparisonAttributionModel &&
    input.comparisonAttributionModel !== input.attributionModel
  ) {
    warnings.push(
      `Attribution model mismatch: current (${input.attributionModel}) vs comparison (${input.comparisonAttributionModel}). Metrics may not be comparable.`,
    );
  }

  if (input.currency !== input.reportingCurrency && input.reportingCurrency) {
    warnings.push(
      `Currency difference: account (${input.currency}) vs reporting (${input.reportingCurrency}). Cross-currency comparisons require FX conversion.`,
    );
  }

  if (input.dataQuality.freshnessHours !== null && input.dataQuality.freshnessHours > 48) {
    blockReasons.push("Provider data is stale. Recommendations suppressed until fresh data is available.");
  }

  if (!evidence.minimumVolumeMet) {
    blockReasons.push("Sample volume below minimum threshold. Material recommendations suppressed.");
  }

  if (input.activeExperiment?.status === "RUNNING" && input.activeExperiment.isValid) {
    warnings.push(
      "Active valid experiment in progress. Material campaign changes may confound test results.",
    );
  }

  if (input.activeExperiment?.hasMaterialChangeRisk) {
    warnings.push(
      "Recent material change during active experiment. Interpret performance cautiously.",
    );
  }

  if (!input.dataQuality.hasTracking) {
    warnings.push("Tracking not confirmed. Conversion-based recommendations are unreliable.");
  }

  if (input.userNotes && containsPersonalLeadData(input.userNotes)) {
    blockReasons.push("Input contains potential personal lead data. Remove PII before analysis.");
  }

  return {
    passed: blockReasons.length === 0,
    warnings,
    blocked: blockReasons.length > 0,
    blockReasons,
  };
}

export function blockDirectProviderMutation(actionClass: string, fromLlmOutput: boolean): {
  allowed: boolean;
  reason: string;
} {
  const providerActions = ["REQUEST_PROVIDER_CHANGE", "REQUEST_PAUSE", "REQUEST_RESUME"];
  if (fromLlmOutput && providerActions.includes(actionClass)) {
    return {
      allowed: false,
      reason: "Provider changes cannot be applied directly from LLM output. Human approval required.",
    };
  }
  return { allowed: true, reason: "Action may proceed through approval workflow." };
}

export function blockAutonomousSpendIncrease(
  recommendationType: string,
  approved: boolean,
): { allowed: boolean; reason: string } {
  if (recommendationType === "REQUEST_BUDGET_INCREASE" && !approved) {
    return {
      allowed: false,
      reason: "Budget increases are never applied autonomously.",
    };
  }
  return { allowed: true, reason: "Approved or non-increase action." };
}

const PII_PATTERNS = [
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/,
  /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/,
];

function containsPersonalLeadData(text: string): boolean {
  return PII_PATTERNS.some((p) => p.test(text));
}

export function sanitiseAnalysisNotes(notes: string): { safe: boolean; sanitised: string; blocked: boolean } {
  const sanitised = sanitiseUserInput(notes);
  if (detectPromptInjection(sanitised)) {
    return { safe: false, sanitised, blocked: true };
  }
  if (containsPersonalLeadData(sanitised)) {
    return { safe: false, sanitised, blocked: true };
  }
  return { safe: true, sanitised, blocked: false };
}
