export type ApiFetchRetryPolicy = {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
};

export const DEFAULT_API_FETCH_RETRY_POLICY: ApiFetchRetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 400,
  maxDelayMs: 4_000,
};

export function isRetryableHttpStatus(status: number): boolean {
  if (status === 408 || status === 429) {
    return true;
  }

  return status >= 500 && status <= 599;
}

export function shouldRetryApiRequest(status: number | null): boolean {
  if (status == null) {
    return true;
  }

  if (status === 401 || status === 403 || status === 404) {
    return false;
  }

  if (status === 429) {
    return true;
  }

  if (status >= 400 && status < 500) {
    return false;
  }

  return isRetryableHttpStatus(status);
}

export function retryDelayMs(attempt: number, policy: ApiFetchRetryPolicy): number {
  const exponential = policy.baseDelayMs * 2 ** Math.max(0, attempt - 1);
  return Math.min(policy.maxDelayMs, exponential);
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
