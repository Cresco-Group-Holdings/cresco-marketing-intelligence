import type { ProviderNormalizedError, ProviderRetryClassification } from "@/lib/providers/types";
import {
  PROVIDER_MAX_RETRIES,
  PROVIDER_REQUEST_TIMEOUT_MS,
  PROVIDER_RETRY_BASE_DELAY_MS,
  PROVIDER_RETRY_JITTER_FACTOR,
  PROVIDER_RETRY_MAX_DELAY_MS,
} from "@/lib/providers/constants";
import { sanitizeErrorMessage } from "@/lib/providers/credential-redaction";

export function classifyProviderError(error: unknown): ProviderRetryClassification {
  if (error && typeof error === "object" && "retryable" in error) {
    return (error as { retryable: boolean }).retryable ? "retryable" : "non_retryable";
  }

  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (message.includes("rate limit") || message.includes("429") || message.includes("too many requests")) {
    return "rate_limited";
  }
  if (message.includes("timeout") || message.includes("econnreset") || message.includes("503")) {
    return "retryable";
  }
  if (message.includes("401") || message.includes("403") || message.includes("invalid")) {
    return "non_retryable";
  }
  return "retryable";
}

export function normalizeProviderError(error: unknown, correlationId?: string): ProviderNormalizedError {
  const message = sanitizeErrorMessage(error instanceof Error ? error.message : String(error));
  const classification = classifyProviderError(error);
  return {
    code: classification === "rate_limited" ? "RATE_LIMITED" : "PROVIDER_ERROR",
    message,
    retryable: classification === "retryable" || classification === "rate_limited",
    correlationId,
  };
}

export function calculateRetryDelay(attempt: number): number {
  const exponential = Math.min(
    PROVIDER_RETRY_BASE_DELAY_MS * 2 ** attempt,
    PROVIDER_RETRY_MAX_DELAY_MS,
  );
  const jitter = exponential * PROVIDER_RETRY_JITTER_FACTOR * Math.random();
  return Math.floor(exponential + jitter);
}

export async function withProviderRetry<T>(
  operation: () => Promise<T>,
  options?: { maxRetries?: number; correlationId?: string },
): Promise<T> {
  const maxRetries = options?.maxRetries ?? PROVIDER_MAX_RETRIES;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const classification = classifyProviderError(error);
      if (classification === "non_retryable" || attempt === maxRetries) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, calculateRetryDelay(attempt)));
    }
  }

  throw lastError;
}

export function getProviderRequestTimeoutMs(): number {
  return PROVIDER_REQUEST_TIMEOUT_MS;
}

export function shouldOpenCircuit(consecutiveFailures: number, threshold = 5): boolean {
  return consecutiveFailures >= threshold;
}
