import type { AIProviderName } from "@prisma/client";
import { getServerEnv } from "@/lib/environment";
import { AppError } from "@/lib/errors";
import { isMockAiAllowed } from "@/lib/ai/mock-policy";
import type { RegisteredAIModel } from "@/lib/ai/types";

function currentEnvironment(): "development" | "test" | "production" {
  if (process.env.NODE_ENV === "test") return "test";
  if (process.env.NODE_ENV === "production") return "production";
  return "development";
}

const BASE_MODELS: RegisteredAIModel[] = [
  {
    provider: "MOCK",
    modelId: "mock-text-v1",
    displayName: "Mock Text v1",
    capabilities: ["TEXT_GENERATION", "STRUCTURED_OUTPUT"],
    contextTokenLimit: 8_000,
    maxOutputTokens: 1_024,
    inputCostPer1kTokensUsd: 0,
    outputCostPer1kTokensUsd: 0,
    enabledEnvironments: ["development", "test"],
    available: true,
  },
  {
    provider: "OPENAI",
    modelId: "gpt-4o-mini",
    displayName: "OpenAI GPT-4o Mini",
    capabilities: ["TEXT_GENERATION", "STRUCTURED_OUTPUT"],
    contextTokenLimit: 128_000,
    maxOutputTokens: 4_096,
    inputCostPer1kTokensUsd: 0.00015,
    outputCostPer1kTokensUsd: 0.0006,
    enabledEnvironments: ["development", "test", "production"],
    available: false,
  },
  {
    provider: "ANTHROPIC",
    modelId: "claude-3-5-haiku-20241022",
    displayName: "Anthropic Claude 3.5 Haiku",
    capabilities: ["TEXT_GENERATION", "STRUCTURED_OUTPUT"],
    contextTokenLimit: 200_000,
    maxOutputTokens: 4_096,
    inputCostPer1kTokensUsd: 0.0008,
    outputCostPer1kTokensUsd: 0.004,
    enabledEnvironments: ["development", "test", "production"],
    available: false,
  },
  {
    provider: "GOOGLE",
    modelId: "gemini-1.5-flash",
    displayName: "Google Gemini 1.5 Flash",
    capabilities: ["TEXT_GENERATION", "STRUCTURED_OUTPUT"],
    contextTokenLimit: 1_000_000,
    maxOutputTokens: 8_192,
    inputCostPer1kTokensUsd: 0.000075,
    outputCostPer1kTokensUsd: 0.0003,
    enabledEnvironments: ["development", "test", "production"],
    available: false,
  },
  {
    provider: "OPENAI",
    modelId: "gpt-image-1",
    displayName: "OpenAI Image (extension point)",
    capabilities: ["IMAGE_GENERATION"],
    contextTokenLimit: 0,
    maxOutputTokens: 0,
    inputCostPer1kTokensUsd: 0,
    outputCostPer1kTokensUsd: 0,
    enabledEnvironments: ["development", "test", "production"],
    available: false,
  },
];

function providerConfigured(provider: AIProviderName): boolean {
  const env = getServerEnv();
  switch (provider) {
    case "OPENAI":
      return Boolean(env.OPENAI_API_KEY);
    case "ANTHROPIC":
      return Boolean(env.ANTHROPIC_API_KEY);
    case "GOOGLE":
      return Boolean(process.env.GOOGLE_AI_API_KEY?.trim());
    case "MOCK":
      return isMockAiAllowed();
    default:
      return false;
  }
}

export function hasConfiguredAiProvider(): boolean {
  return (["OPENAI", "ANTHROPIC", "GOOGLE"] as AIProviderName[]).some((provider) =>
    providerConfigured(provider),
  );
}

export function aiConfigurationRequiredError(): AppError {
  return new AppError(
    "AI_CONFIGURATION_REQUIRED",
    "AI provider is not configured. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_AI_API_KEY on the server.",
  );
}

export class AIModelRegistry {
  listModels(): RegisteredAIModel[] {
    const environment = currentEnvironment();
    return BASE_MODELS.map((model) => ({
      ...model,
      available:
        model.enabledEnvironments.includes(environment) &&
        (model.provider === "MOCK" ? isMockAiAllowed() : providerConfigured(model.provider)),
    }));
  }

  getModel(provider: AIProviderName, modelId: string): RegisteredAIModel {
    const model = this.listModels().find(
      (entry) => entry.provider === provider && entry.modelId === modelId,
    );
    if (!model) {
      throw new Error(`Model not found: ${provider}/${modelId}`);
    }
    return model;
  }

  resolveModel(provider?: AIProviderName, modelId?: string): RegisteredAIModel {
    const models = this.listModels().filter((model) =>
      model.capabilities.includes("TEXT_GENERATION"),
    );

    if (provider === "MOCK" || modelId === "mock-text-v1") {
      if (!isMockAiAllowed()) {
        throw aiConfigurationRequiredError();
      }
      return this.getModel("MOCK", "mock-text-v1");
    }

    if (provider && modelId) {
      const selected = models.find(
        (model) => model.provider === provider && model.modelId === modelId,
      );
      if (selected?.available) return selected;
      throw aiConfigurationRequiredError();
    }

    const preferredOrder: AIProviderName[] = ["OPENAI", "ANTHROPIC", "GOOGLE"];
    for (const candidateProvider of preferredOrder) {
      const available = models.find(
        (model) => model.provider === candidateProvider && model.available,
      );
      if (available) return available;
    }

    if (isMockAiAllowed()) {
      return this.getModel("MOCK", "mock-text-v1");
    }

    throw aiConfigurationRequiredError();
  }

  isModelAllowed(provider: AIProviderName, modelId: string): boolean {
    if (provider === "MOCK") return isMockAiAllowed();
    const model = this.listModels().find(
      (entry) => entry.provider === provider && entry.modelId === modelId,
    );
    return Boolean(model?.available);
  }
}

export const aiModelRegistry = new AIModelRegistry();

export function estimateTokenCostUsd(
  model: RegisteredAIModel,
  usage: { promptTokens: number; completionTokens: number },
): number {
  const inputCost = (usage.promptTokens / 1000) * model.inputCostPer1kTokensUsd;
  const outputCost = (usage.completionTokens / 1000) * model.outputCostPer1kTokensUsd;
  return Number((inputCost + outputCost).toFixed(6));
}
