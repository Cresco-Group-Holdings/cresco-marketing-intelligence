import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import { resetEnvCacheForTests } from "@/lib/environment";
import { aiModelRegistry } from "@/lib/ai/model-registry";
import { isMockAiAllowed } from "@/lib/ai/mock-policy";
import { resolveModelForCapability } from "@/lib/ai/model-routing";
import { getAIProvider } from "@/lib/ai/providers";

describe("AI production mock guard", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    resetEnvCacheForTests();
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GOOGLE_AI_API_KEY;
    delete process.env.AI_ALLOW_MOCK;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetEnvCacheForTests();
  });

  it("does not allow mock in production environment", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(isMockAiAllowed()).toBe(false);
  });

  it("allows mock in test environment", () => {
    vi.stubEnv("NODE_ENV", "test");
    expect(isMockAiAllowed()).toBe(true);
  });

  it("allows mock in development only when AI_ALLOW_MOCK=true", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(isMockAiAllowed()).toBe(false);
    process.env.AI_ALLOW_MOCK = "true";
    expect(isMockAiAllowed()).toBe(true);
  });

  it("throws AI_CONFIGURATION_REQUIRED when no provider is configured in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => aiModelRegistry.resolveModel()).toThrow(AppError);
    try {
      aiModelRegistry.resolveModel();
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe("AI_CONFIGURATION_REQUIRED");
    }
  });

  it("never silently falls back to mock in production when OpenAI key is missing", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => aiModelRegistry.resolveModel("OPENAI", "gpt-4o-mini")).toThrow(AppError);
    const models = aiModelRegistry.listModels().filter((model) => model.provider === "MOCK");
    expect(models.every((model) => !model.available)).toBe(true);
  });

  it("blocks mock provider access in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => getAIProvider("MOCK")).toThrow();
  });

  it("resolveModelForCapability throws AI_CONFIGURATION_REQUIRED without providers", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() =>
      resolveModelForCapability({
        capabilities: ["TEXT_GENERATION", "STRUCTURED_OUTPUT"],
      }),
    ).toThrow(AppError);
  });

  it("uses real provider when configured in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.OPENAI_API_KEY = ["sk", "test-key"].join("-");
    resetEnvCacheForTests();
    const model = aiModelRegistry.resolveModel();
    expect(model.provider).toBe("OPENAI");
    expect(model.modelId).toBe("gpt-4o-mini");
  });
});
