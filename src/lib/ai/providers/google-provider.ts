import type { AIProviderTextRequest, AIProviderTextResponse } from "@/lib/ai/types";
import { BaseAIProvider, mapFetchError } from "@/lib/ai/providers/base";

type GoogleResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
};

export class GoogleAIProvider extends BaseAIProvider {
  readonly name = "GOOGLE" as const;

  isConfigured(): boolean {
    return Boolean(process.env.GOOGLE_AI_API_KEY?.trim());
  }

  async generateText(request: AIProviderTextRequest): Promise<AIProviderTextResponse> {
    const apiKey = process.env.GOOGLE_AI_API_KEY?.trim();
    if (!apiKey) {
      throw { category: "CONFIGURATION_ERROR", message: "Google AI is not configured.", retryable: false };
    }

    const prompt = request.messages
      .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
      .join("\n\n");

    try {
      const { result, latencyMs } = await this.timed(async () => {
        const response = await this.wrapTimeout(
          fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${request.model}:generateContent?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                  maxOutputTokens: request.maxOutputTokens ?? 1024,
                  temperature: request.temperature ?? 0.2,
                },
              }),
              signal: request.signal,
            },
          ),
          request.signal,
        );

        if (response.status === 429) {
          throw { category: "RATE_LIMIT", message: "Google AI rate limit exceeded.", retryable: true, statusCode: 429 };
        }
        if (!response.ok) {
          throw { category: "PROVIDER_ERROR", message: `Google AI error ${response.status}`, retryable: response.status >= 500, statusCode: response.status };
        }

        const payload = (await response.json()) as GoogleResponse;
        const content = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
        const promptTokens = payload.usageMetadata?.promptTokenCount ?? 0;
        const completionTokens = payload.usageMetadata?.candidatesTokenCount ?? 0;
        return {
          content,
          usage: {
            promptTokens,
            completionTokens,
            totalTokens: payload.usageMetadata?.totalTokenCount ?? promptTokens + completionTokens,
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
