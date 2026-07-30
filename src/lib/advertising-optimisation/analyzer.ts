import { buildEvidencePackage } from "./evidence";
import { deriveFindings } from "./findings";
import { evaluateGuardrails, sanitiseAnalysisNotes } from "./guardrails";
import {
  deriveRecommendations,
  mapRecommendationToActionClass,
} from "./recommendations";
import { evaluateActionProposal } from "./actions";
import type { AnalysisInput } from "./analysis-inputs";

export type OptimisationAnalysisResult = {
  evidence: ReturnType<typeof buildEvidencePackage>;
  guardrails: ReturnType<typeof evaluateGuardrails>;
  findings: ReturnType<typeof deriveFindings>;
  recommendations: ReturnType<typeof deriveRecommendations>;
  actionProposals: Array<{
    recommendationType: string;
    actionClass: string;
    title: string;
    description: string;
    evaluation: ReturnType<typeof evaluateActionProposal>;
  }>;
};

export function runOptimisationAnalysis(input: AnalysisInput): OptimisationAnalysisResult {
  if (input.userNotes) {
    const noteCheck = sanitiseAnalysisNotes(input.userNotes);
    if (noteCheck.blocked) {
      throw new Error("Analysis input blocked by guardrails: prompt injection or PII detected.");
    }
  }

  const evidence = buildEvidencePackage(input);
  const guardrails = evaluateGuardrails(input, evidence);
  const findings = deriveFindings(evidence);

  const recommendations = guardrails.blocked
    ? []
    : deriveRecommendations(findings, evidence);

  const actionProposals = recommendations.map((rec) => {
    const actionClass = mapRecommendationToActionClass(rec.recommendationType);
    const evaluation = evaluateActionProposal({
      actionClass,
      title: rec.title,
      description: rec.description,
      fromLlmOutput: true,
    });
    return {
      recommendationType: rec.recommendationType,
      actionClass,
      title: rec.title,
      description: rec.description,
      evaluation,
    };
  });

  return { evidence, guardrails, findings, recommendations, actionProposals };
}
