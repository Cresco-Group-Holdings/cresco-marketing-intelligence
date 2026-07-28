import { getServerEnv } from "@/lib/environment";
import type { AIProviderTextRequest, AIProviderTextResponse } from "@/lib/ai/types";
import { BaseAIProvider, mapFetchError } from "@/lib/ai/providers/base";

type AnthropicResponse = {
  content?: Array<{ text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
};

export class AnthropicProvider extends BaseAIProvider {
  readonly name = "ANTHROPIC" as const;

  isConfigured(): boolean {
    return Boolean(getServerEnv().ANTHROPIC_API_KEY);
  }

  async generateText(request: AIProviderTextRequest): Promise<AIProviderTextResponse> {
    if (!this.isConfigured()) {
      throw { category: "CONFIGURATION_ERROR", message: "Anthropic is not configured.", retryable: false };
    }

    const system = request.messages.find((message) => message.role === "system")?.content;
    const messages = request.messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: message.content,
      }));

    try {
      const { result, latencyMs } = await this.timed(async () => {
        const response = await this.wrapTimeout(
          fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "x-api-key": getServerEnv().ANTHROPIC_API_KEY!,
              "anthropic-version": "2023-06-01",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: request.model,
              max_tokens: request.maxOutputTokens ?? 1024,
              system,
              messages,
              temperature: request.temperature ?? 0.2,
            }),
            signal: request.signal,
          }),
          request.signal,
        );

        if (response.status === 429) {
          throw { category: "RATE_LIMIT", message: "Anthropic rate limit exceeded.", retryable: true, statusCode: 429 };
        }
        if (!response.ok) {
          throw { category: "PROVIDER_ERROR", message: `Anthropic error ${response.status}`, retryable: response.status >= 500, statusCode: response.status };
        }

        const payload = (await response.json()) as AnthropicResponse;
        const content = payload.content?.map((part) => part.text ?? "").join("") ?? "";
        const promptTokens = payload.usage?.input_tokens ?? 0;
        const completionTokens = payload.usage?.output_tokens ?? 0;
        return {
          content,
          usage: {
            promptTokens,
            completionTokens,
            totalTokens: promptTokens + completionTokens,
          },
          model: request.model,
          provider: this.name,
          latencyMs: 0,
        } satisfies AIProviderTextResponse;
      });

      return { ...result, latencyMs };
    } catch (error) {
      mapFetchError(error);
    }
  }
}
