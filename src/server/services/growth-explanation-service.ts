import type { GrowthInsight, InsightEvidence } from "@prisma/client";
import { aiModelRegistry } from "@/lib/ai/model-registry";
import type { GrowthInsightExplanation } from "@/lib/ai/growth-output-schemas";
import {
  buildAllowedLabels,
  buildAllowedNumericCatalog,
  validateGrowthAiExplanation,
} from "@/lib/growth/ai-validation";
import { buildDeterministicExplanation } from "@/lib/growth/deterministic-explanation";
import { INSUFFICIENT_DATA_MESSAGE } from "@/lib/growth/constants";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { brandContextBuilder } from "@/lib/ai/brand-context-builder";
import { aiRequestService } from "@/server/services/ai-request-service";
import { brandKnowledgeService } from "@/server/services/brand-knowledge-service";

type ExplainableRecommendation = {
  id: string;
  finding: string | null;
  description: string;
  recommendedAction: string | null;
  measurementPlan: string | null;
  expectedHypothesis: string | null;
  insightType: string | null;
  growthInsight: (GrowthInsight & { evidence: InsightEvidence[] }) | null;
};

export type ExplanationResult = GrowthInsightExplanation & {
  explanationSource: "AI" | "DETERMINISTIC_FALLBACK";
  aiGenerated: boolean;
  aiRequestId?: string;
};

function buildPromptPayload(recommendation: ExplainableRecommendation) {
  const evidencePayload = recommendation.growthInsight?.evidence ?? [];
  return {
    evidencePayload,
    allowedEvidenceKeys: new Set(evidencePayload.map((item) => item.evidenceKey)),
    allowedNumerics: buildAllowedNumericCatalog({
      sourceMetrics: recommendation.growthInsight?.sourceMetrics ?? {},
      evidence: evidencePayload.map((item) => ({
        evidenceKey: item.evidenceKey,
        evidenceValue: item.evidenceValue,
      })),
    }),
    allowedLabels: buildAllowedLabels({
      insightType: recommendation.insightType,
      periodStart: recommendation.growthInsight?.analysisPeriodStart,
      periodEnd: recommendation.growthInsight?.analysisPeriodEnd,
      evidenceLabels: evidencePayload.map((item) => item.evidenceLabel),
    }),
    userInput: [
      "Explain the following deterministic growth insight. Do NOT invent statistics.",
      "Only reference the supplied metrics and evidence keys.",
      "Use only numeric values present in the supplied evidence JSON.",
      "",
      `Finding: ${recommendation.finding ?? recommendation.description}`,
      `Insight type: ${recommendation.insightType ?? "GENERAL"}`,
      `Source metrics: ${JSON.stringify(recommendation.growthInsight?.sourceMetrics ?? {})}`,
      `Evidence: ${JSON.stringify(
        evidencePayload.map((item) => ({
          key: item.evidenceKey,
          label: item.evidenceLabel,
          value: item.evidenceValue,
        })),
      )}`,
      `Recommended action constraint: ${recommendation.recommendedAction ?? "Suggest a practical next step."}`,
    ].join("\n"),
  };
}

export const growthExplanationService = {
  async explain(
    input: {
      brandId: string;
      organisationId: string;
      projectId: string;
      recommendation: ExplainableRecommendation;
    },
    context: TenantContext,
    requestId?: string,
  ): Promise<ExplanationResult> {
    if (input.recommendation.growthInsight?.dataStatus === "INSUFFICIENT") {
      throw new AppError("VALIDATION_ERROR", INSUFFICIENT_DATA_MESSAGE);
    }

    const prompt = buildPromptPayload(input.recommendation);
    const snapshot = await brandKnowledgeService.getSnapshot(
      input.brandId,
      input.organisationId,
      context,
    );
    const brandContext = brandContextBuilder.build(snapshot, {});
    const resolvedModel = aiModelRegistry.resolveModel();

    const deterministic = buildDeterministicExplanation({
      insightType: input.recommendation.insightType as never,
      finding: input.recommendation.finding ?? input.recommendation.description,
      recommendedAction: input.recommendation.recommendedAction,
      measurementPlan: input.recommendation.measurementPlan,
      expectedHypothesis: input.recommendation.expectedHypothesis,
      evidence: prompt.evidencePayload.map((item) => ({
        evidenceKey: item.evidenceKey,
        evidenceLabel: item.evidenceLabel,
        evidenceValue: item.evidenceValue,
      })),
    });

    try {
      const aiResult = await aiRequestService.executeStructured(
        {
          organisationId: input.organisationId,
          projectId: input.projectId,
          brandId: input.brandId,
          userProfileId: context.userProfileId,
          purpose: "ANALYTICS_INSIGHT",
          templateKey: "growth.insight.explain",
          schemaKey: "growth.insight.explain",
          provider: resolvedModel.provider,
          model: resolvedModel.modelId,
          userInput: prompt.userInput,
          brandContext,
          requestId,
        },
        context,
      );

      const output = aiResult.output as GrowthInsightExplanation;
      validateGrowthAiExplanation(output, {
        allowedEvidenceKeys: prompt.allowedEvidenceKeys,
        allowedNumerics: prompt.allowedNumerics,
        allowedLabels: prompt.allowedLabels,
      });

      return {
        ...output,
        explanationSource: "AI",
        aiGenerated: true,
        aiRequestId: aiResult.requestId,
      };
    } catch {
      return {
        finding: deterministic.finding,
        explanation: deterministic.explanation,
        recommendedAction: deterministic.recommendedAction,
        evidence: deterministic.evidence,
        expectedHypothesis: deterministic.expectedHypothesis,
        measurementPlan: deterministic.measurementPlan,
        explanationSource: "DETERMINISTIC_FALLBACK",
        aiGenerated: false,
      };
    }
  },
};
