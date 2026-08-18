import type { AIProviderName } from "@prisma/client";
import type { AIProvider } from "@/lib/ai/types";
import { assertMockAiAllowed } from "@/lib/ai/mock-policy";
import { AnthropicProvider } from "@/lib/ai/providers/anthropic-provider";
import { GoogleAIProvider } from "@/lib/ai/providers/google-provider";
import { MockAIProvider } from "@/lib/ai/providers/mock-provider";
import { OpenAIProvider } from "@/lib/ai/providers/openai-provider";

const providerInstances: Record<AIProviderName, AIProvider> = {
  OPENAI: new OpenAIProvider(),
  ANTHROPIC: new AnthropicProvider(),
  GOOGLE: new GoogleAIProvider(),
  MOCK: new MockAIProvider(),
};

export function getAIProvider(provider: AIProviderName): AIProvider {
  if (provider === "MOCK") {
    assertMockAiAllowed();
  }
  return providerInstances[provider];
}

export function listConfiguredProviders(): Array<{ provider: AIProviderName; configured: boolean }> {
  return (Object.keys(providerInstances) as AIProviderName[]).map((provider) => ({
    provider,
    configured: providerInstances[provider].isConfigured(),
  }));
}

export function setAIProviderForTests(provider: AIProviderName, instance: AIProvider): void {
  providerInstances[provider] = instance;
}

export function resetAIProvidersForTests(): void {
  providerInstances.OPENAI = new OpenAIProvider();
  providerInstances.ANTHROPIC = new AnthropicProvider();
  providerInstances.GOOGLE = new GoogleAIProvider();
  providerInstances.MOCK = new MockAIProvider();
}
