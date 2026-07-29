export type RetryClassification = {
  retryable: boolean;
  terminal: boolean;
  reason: string;
};

const RETRYABLE_CODES = new Set([
  "RATE_LIMITED",
  "TRANSIENT",
  "PROCESSING_FAILED",
  "UPLOAD_FAILED",
  "TIMEOUT",
  "PROVIDER_ERROR",
]);

const TERMINAL_CODES = new Set([
  "PERMISSION_MISSING",
  "INVALID_MEDIA",
  "POLICY_VIOLATION",
  "ACCOUNT_SUSPENDED",
  "NOT_FOUND",
]);

export function classifyRetryError(code: string, message: string): RetryClassification {
  if (TERMINAL_CODES.has(code)) {
    return { retryable: false, terminal: true, reason: message };
  }
  if (RETRYABLE_CODES.has(code)) {
    return { retryable: true, terminal: false, reason: message };
  }
  return { retryable: false, terminal: true, reason: message };
}

export function exponentialBackoffMs(attempt: number, baseMs = 5_000, maxMs = 300_000): number {
  return Math.min(baseMs * 2 ** Math.min(attempt, 6), maxMs);
}

export function shouldMoveToDeadLetter(attemptCount: number, maxAttempts: number): boolean {
  return attemptCount >= maxAttempts;
}

export function nextRetryDate(attemptCount: number, now = new Date()): Date {
  return new Date(now.getTime() + exponentialBackoffMs(attemptCount));
}
