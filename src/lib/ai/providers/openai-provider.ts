import { getServerEnv } from "@/lib/environment";
import type { AIProviderTextRequest, AIProviderTextResponse } from "@/lib/ai/types";
import { BaseAIProvider, mapFetchError } from "@/lib/ai/providers/base";

type OpenAIResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
};

export class OpenAIProvider extends BaseAIProvider {
  readonly name = "OPENAI" as const;

  isConfigured(): boolean {
    return Boolean(getServerEnv().OPENAI_API_KEY);
  }

  async generateText(request: AIProviderTextRequest): Promise<AIProviderTextResponse> {
    if (!this.isConfigured()) {
      throw { category: "CONFIGURATION_ERROR", message: "OpenAI is not configured.", retryable: false };
    }

    try {
      const { result, latencyMs } = await this.timed(async () => {
        const response = await this.wrapTimeout(
          fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${getServerEnv().OPENAI_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: request.model,
              messages: request.messages,
              max_tokens: request.maxOutputTokens,
              temperature: request.temperature ?? 0.2,
            }),
            signal: request.signal,
          }),
          request.signal,
        );

        if (response.status === 429) {
          throw { category: "RATE_LIMIT", message: "OpenAI rate limit exceeded.", retryable: true, statusCode: 429 };
        }
        if (!response.ok) {
          throw { category: "PROVIDER_ERROR", message: `OpenAI error ${response.status}`, retryable: response.status >= 500, statusCode: response.status };
        }

        const payload = (await response.json()) as OpenAIResponse;
        const content = payload.choices?.[0]?.message?.content ?? "";
        return {
          content,
          usage: {
            promptTokens: payload.usage?.prompt_tokens ?? 0,
            completionTokens: payload.usage?.completion_tokens ?? 0,
            totalTokens: payload.usage?.total_tokens ?? 0,
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
