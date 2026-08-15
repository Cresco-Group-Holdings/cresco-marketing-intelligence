import { AGENT_MODEL_RETRY_ATTEMPTS, AGENT_MODEL_RETRY_BASE_MS } from "@/lib/agent-platform/constants";

export type RetryableError = {
  retryable: boolean;
  message: string;
};

export type FallbackRetryResult<T> = {
  result: T;
  attempts: number;
  usedFallback: boolean;
  errors: string[];
};

export async function executeWithFallbackRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options?: {
    maxAttempts?: number;
    baseDelayMs?: number;
    isRetryable?: (error: unknown) => boolean;
  },
): Promise<FallbackRetryResult<T>> {
  const maxAttempts = options?.maxAttempts ?? AGENT_MODEL_RETRY_ATTEMPTS;
  const baseDelayMs = options?.baseDelayMs ?? AGENT_MODEL_RETRY_BASE_MS;
  const isRetryable = options?.isRetryable ?? defaultRetryable;
  const errors: string[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await operation(attempt);
      return {
        result,
        attempts: attempt,
        usedFallback: attempt > 1,
        errors,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      errors.push(message);
      if (!isRetryable(error) || attempt === maxAttempts) {
        throw error;
      }
      await delay(baseDelayMs * attempt);
    }
  }

  throw new Error("Retry contract exhausted.");
}

function defaultRetryable(error: unknown): boolean {
  if (error instanceof Error) {
    return /timeout|rate limit|temporarily unavailable|503|429/i.test(error.message);
  }
  return false;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
