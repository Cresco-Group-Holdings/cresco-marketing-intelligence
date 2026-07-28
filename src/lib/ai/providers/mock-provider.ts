import type { z } from "zod";
import type {
  AIProviderStructuredRequest,
  AIProviderStructuredResponse,
  AIProviderTextRequest,
  AIProviderTextResponse,
} from "@/lib/ai/types";
import { BaseAIProvider } from "@/lib/ai/providers/base";
import { aiResponseParser } from "@/lib/ai/response-parser";

export class MockAIProvider extends BaseAIProvider {
  readonly name = "MOCK" as const;

  isConfigured(): boolean {
    return true;
  }

  async generateText(request: AIProviderTextRequest): Promise<AIProviderTextResponse> {
    this.guardAbort(request.signal);
    const started = Date.now();
    const userMessage = request.messages.find((message) => message.role === "user")?.content ?? "";
    const content = `Mock response for: ${userMessage.slice(0, 120)}`;
    const usage = {
      promptTokens: Math.max(1, Math.ceil(userMessage.length / 4)),
      completionTokens: Math.max(1, Math.ceil(content.length / 4)),
      totalTokens: 0,
    };
    usage.totalTokens = usage.promptTokens + usage.completionTokens;

    return {
      content,
      usage,
      model: request.model,
      provider: this.name,
      latencyMs: Date.now() - started,
    };
  }

  async generateStructured<TSchema extends z.ZodTypeAny>(
    request: AIProviderStructuredRequest<TSchema>,
  ): Promise<AIProviderStructuredResponse<TSchema>> {
    const started = Date.now();
    const payload =
      request.schemaName === "diagnostics.structured"
        ? { ok: true, provider: "MOCK", latencyCategory: "fast" as const }
        : { ok: true, message: "mock structured response" };
    const rawContent = JSON.stringify(payload);
    const data = aiResponseParser.parseStructured(
      {
        content: rawContent,
        usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        model: request.model,
        provider: this.name,
        latencyMs: 0,
      },
      request.schema,
    );

    return {
      data,
      rawContent,
      usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      model: request.model,
      provider: this.name,
      latencyMs: Date.now() - started,
    };
  }
}
