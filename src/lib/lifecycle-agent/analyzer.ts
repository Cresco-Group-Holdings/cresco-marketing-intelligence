import { buildEvidencePackage } from "./evidence";
import { detectFindings } from "./findings";
import { evaluateGuardrails, sanitiseAnalysisNotes } from "./guardrails";
import {
  deriveRecommendations,
  mapRecommendationToActionClass,
} from "./recommendations";
import { prioritiseRecommendations } from "./prioritisation";
import { evaluateActionProposal } from "./actions";
import {
  generateDailySalesBrief,
  weeklyPipelineReview,
  trialRiskReview,
  renewalReview,
  lifecycleHealthSummary,
} from "./briefs";
import type { LifecycleAnalysisInput } from "./analysis-inputs";
import type { LifecycleBrief } from "./briefs";

export type LifecycleAnalysisResult = {
  evidence: ReturnType<typeof buildEvidencePackage>;
  guardrails: ReturnType<typeof evaluateGuardrails>;
  findings: ReturnType<typeof detectFindings>;
  recommendations: ReturnType<typeof deriveRecommendations>;
  prioritisedRecommendations: ReturnType<typeof prioritiseRecommendations>;
  actionProposals: Array<{
    recommendationType: string;
    actionClass: string;
    title: string;
    description: string;
    entityId: string | null;
    priorityScore: number;
    priorityBand: string;
    evaluation: ReturnType<typeof evaluateActionProposal>;
  }>;
  briefs: {
    dailySales?: LifecycleBrief;
    weeklyPipeline?: LifecycleBrief;
    trialRisk?: LifecycleBrief;
    renewal?: LifecycleBrief;
    lifecycleHealth: LifecycleBrief;
  };
};

export function runLifecycleAnalysis(input: LifecycleAnalysisInput): LifecycleAnalysisResult {
  if (input.userNotes) {
    const noteCheck = sanitiseAnalysisNotes(input.userNotes);
    if (noteCheck.blocked) {
      throw new Error("Analysis input blocked by guardrails: prompt injection, PII, or prohibited commercial action detected.");
    }
  }

  const evidence = buildEvidencePackage(input);
  const guardrails = evaluateGuardrails(input, evidence);
  const findings = detectFindings(input, evidence);

  const recommendations = guardrails.blocked
    ? []
    : deriveRecommendations(findings, evidence);

  const prioritisedRecommendations = guardrails.blocked
    ? []
    : prioritiseRecommendations(recommendations, input, evidence);

  const actionProposals = prioritisedRecommendations.map((rec) => {
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
      entityId: rec.entityId,
      priorityScore: rec.priorityScore,
      priorityBand: rec.priorityBand,
      evaluation,
    };
  });

  const briefs = {
    dailySales: generateDailySalesBrief(input, evidence, findings, prioritisedRecommendations),
    weeklyPipeline: weeklyPipelineReview(input, evidence, findings),
    trialRisk: trialRiskReview(input, findings),
    renewal: renewalReview(input, findings),
    lifecycleHealth: lifecycleHealthSummary(evidence, findings),
  };

  return {
    evidence,
    guardrails,
    findings,
    recommendations,
    prioritisedRecommendations,
    actionProposals,
    briefs,
  };
}
