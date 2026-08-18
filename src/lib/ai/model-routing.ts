import type { AIProviderName } from "@prisma/client";
import type { AICapability } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { aiModelRegistry } from "@/lib/ai/model-registry";
import type { RegisteredAIModel } from "@/lib/ai/types";

export type ModelRoutingCriteria = {
  capabilities: AICapability[];
  preferredProvider?: AIProviderName;
  preferredModelId?: string;
  qualityRequirement?: "standard" | "high";
  latencyPreference?: "fast" | "balanced";
  tenantPlan?: "starter" | "professional" | "enterprise";
};

const PROVIDER_PRIORITY: AIProviderName[] = ["OPENAI", "ANTHROPIC", "GOOGLE"];

function scoreModel(model: RegisteredAIModel, criteria: ModelRoutingCriteria): number {
  let score = 0;
  if (criteria.preferredProvider && model.provider === criteria.preferredProvider) score += 100;
  if (criteria.preferredModelId && model.modelId === criteria.preferredModelId) score += 200;
  if (criteria.qualityRequirement === "high" && model.inputCostPer1kTokensUsd > 0.0005) score += 20;
  if (criteria.latencyPreference === "fast" && model.modelId.includes("mini")) score += 15;
  if (criteria.latencyPreference === "fast" && model.modelId.includes("flash")) score += 15;
  if (criteria.latencyPreference === "fast" && model.modelId.includes("haiku")) score += 15;
  if (criteria.tenantPlan === "starter" && model.inputCostPer1kTokensUsd < 0.0002) score += 10;
  score += PROVIDER_PRIORITY.indexOf(model.provider) >= 0
    ? PROVIDER_PRIORITY.length - PROVIDER_PRIORITY.indexOf(model.provider)
    : 0;
  return score;
}

/** Resolve a model by capability — business modules request capability, not hardcoded model names. */
export function resolveModelForCapability(criteria: ModelRoutingCriteria): RegisteredAIModel {
  const candidates = aiModelRegistry
    .listModels()
    .filter(
      (model) =>
        model.available &&
        model.provider !== "MOCK" &&
        criteria.capabilities.every((capability) => model.capabilities.includes(capability)),
    );

  if (candidates.length === 0) {
    throw new AppError(
      "AI_CONFIGURATION_REQUIRED",
      "No AI provider is configured for the requested capability. Configure OpenAI, Anthropic, or Google AI server credentials.",
    );
  }

  const ranked = [...candidates].sort((a, b) => scoreModel(b, criteria) - scoreModel(a, criteria));
  return ranked[0]!;
}
