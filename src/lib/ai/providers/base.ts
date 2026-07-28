import type { z } from "zod";
import type {
  AIProvider,
  AIProviderStructuredRequest,
  AIProviderStructuredResponse,
  AIProviderTextRequest,
  AIProviderTextResponse,
} from "@/lib/ai/types";
import { aiResponseParser } from "@/lib/ai/response-parser";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) {
    return Promise.reject(new Error("Request was cancelled."));
  }

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new Error("Request was cancelled."));
    signal.addEventListener("abort", onAbort, { once: true });
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => signal.removeEventListener("abort", onAbort));
  });
}

export abstract class BaseAIProvider implements AIProvider {
  abstract readonly name: AIProvider["name"];

  abstract isConfigured(): boolean;

  abstract generateText(request: AIProviderTextRequest): Promise<AIProviderTextResponse>;

  async generateStructured<TSchema extends z.ZodTypeAny>(
    request: AIProviderStructuredRequest<TSchema>,
  ): Promise<AIProviderStructuredResponse<TSchema>> {
    const textResponse = await this.generateText({
      ...request,
      messages: [
        ...request.messages,
        {
          role: "user",
          content: `Respond with valid JSON only matching schema ${request.schemaName}.`,
        },
      ],
    });

    const data = aiResponseParser.parseStructured(textResponse, request.schema);
    return {
      data,
      rawContent: textResponse.content,
      usage: textResponse.usage,
      model: textResponse.model,
      provider: textResponse.provider,
      latencyMs: textResponse.latencyMs,
    };
  }

  protected async timed<T>(operation: () => Promise<T>): Promise<{ result: T; latencyMs: number }> {
    const started = Date.now();
    const result = await operation();
    return { result, latencyMs: Date.now() - started };
  }

  protected guardAbort(signal?: AbortSignal): void {
    if (signal?.aborted) {
      throw new Error("Request was cancelled.");
    }
  }

  protected async delayForRetry(attempt: number): Promise<void> {
    await sleep(500 * attempt);
  }

  protected wrapTimeout<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
    return withTimeout(promise, signal);
  }
}

export function mapFetchError(error: unknown): never {
  if (error instanceof Error) {
    if (error.message.includes("cancelled")) {
      throw { category: "TIMEOUT", message: error.message, retryable: false } as const;
    }
    throw { category: "PROVIDER_ERROR", message: error.message, retryable: true } as const;
  }
  throw { category: "UNKNOWN", message: "Unknown provider error", retryable: false } as const;
}
