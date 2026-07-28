import {
  CONNECTOR_SYNC_BASE_DELAY_MS,
  CONNECTOR_SYNC_MAX_DELAY_MS,
  CONNECTOR_SYNC_MAX_RETRIES,
} from "@/lib/connectors/constants";

export type RetryableError = {
  retryable: boolean;
  retryAfterMs?: number;
  message: string;
};

export function calculateBackoffDelayMs(attempt: number, retryAfterMs?: number): number {
  if (retryAfterMs) {
    return Math.min(retryAfterMs, CONNECTOR_SYNC_MAX_DELAY_MS);
  }

  const exponential = CONNECTOR_SYNC_BASE_DELAY_MS * 2 ** Math.max(0, attempt - 1);
  return Math.min(exponential, CONNECTOR_SYNC_MAX_DELAY_MS);
}

export async function withRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options?: {
    maxRetries?: number;
    isRetryable?: (error: unknown) => RetryableError;
  },
): Promise<T> {
  const maxRetries = options?.maxRetries ?? CONNECTOR_SYNC_MAX_RETRIES;
  let attempt = 0;

  while (true) {
    attempt += 1;
    try {
      return await operation(attempt);
    } catch (error) {
      const retryable = options?.isRetryable?.(error) ?? { retryable: false, message: "Operation failed." };
      if (!retryable.retryable || attempt > maxRetries) {
        throw error;
      }

      const delay = calculateBackoffDelayMs(attempt, retryable.retryAfterMs);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

export function isRateLimitError(error: unknown): RetryableError {
  if (
    typeof error === "object" &&
    error !== null &&
    "category" in error &&
    (error as { category?: string }).category === "RATE_LIMIT"
  ) {
    return {
      retryable: true,
      retryAfterMs: (error as { retryAfterMs?: number }).retryAfterMs,
      message: (error as { message?: string }).message ?? "Rate limited.",
    };
  }

  return { retryable: false, message: "Not retryable." };
}
