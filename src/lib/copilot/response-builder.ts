import type {
  CopilotFact,
  CopilotInference,
  CopilotRecommendation,
  CopilotResponse,
  CopilotSuggestedAction,
  EvidenceItem,
} from "@/lib/copilot/types";
import { computeCopilotConfidence } from "@/lib/copilot/confidence";
import type { CopilotIntent } from "@/lib/copilot/types";

export function buildCopilotResponse(input: {
  intent: CopilotIntent;
  answer: string;
  facts: CopilotFact[];
  inferences?: CopilotInference[];
  recommendations?: CopilotRecommendation[];
  evidence: EvidenceItem[];
  suggestedActions?: CopilotSuggestedAction[];
  followUpQuestions?: string[];
  limitations?: string[];
  outputSource?: CopilotResponse["outputSource"];
  sampleSize?: number | null;
  coverage?: number | null;
  truncated?: boolean;
}): CopilotResponse {
  const limitations = input.limitations ?? [];
  const confidence = computeCopilotConfidence({
    evidence: input.evidence,
    limitations,
    sampleSize: input.sampleSize,
    coverage: input.coverage,
    truncated: input.truncated,
    corroboratingSignals: input.facts.length,
  });

  return {
    answer: input.answer,
    facts: input.facts,
    inferences: input.inferences ?? [],
    recommendations: input.recommendations ?? [],
    evidence: input.evidence,
    confidence,
    suggestedActions: input.suggestedActions ?? [],
    followUpQuestions: input.followUpQuestions ?? [],
    limitations,
    intent: input.intent,
    outputSource: input.outputSource ?? "deterministic",
  };
}

export function composeAnswerSections(input: {
  summary: string;
  facts: CopilotFact[];
  inferences: CopilotInference[];
  recommendations: CopilotRecommendation[];
}): string {
  const sections: string[] = [input.summary];

  if (input.facts.length > 0) {
    sections.push("FACT", ...input.facts.map((fact) => `• ${fact.statement}`));
  }
  if (input.inferences.length > 0) {
    sections.push("INFERENCE", ...input.inferences.map((item) => `• ${item.statement}`));
  }
  if (input.recommendations.length > 0) {
    sections.push("RECOMMENDATION", ...input.recommendations.map((item) => `• ${item.statement}`));
  }

  return sections.join("\n\n");
}
