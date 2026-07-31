import type { MarketingDataProvider } from "@prisma/client";
import type { PaidAdsProviderError } from "@/lib/paid-ads/types";

export function normalisePaidAdsHttpError(
  provider: MarketingDataProvider,
  status: number,
  body: unknown,
): PaidAdsProviderError {
  const message =
    typeof body === "object" && body !== null && "message" in body
      ? String((body as { message: unknown }).message)
      : `Provider request failed with status ${status}`;

  const retryable = status === 429 || status >= 500;
  const code =
    typeof body === "object" && body !== null && "code" in body
      ? String((body as { code: unknown }).code)
      : `HTTP_${status}`;

  return { code, message, retryable, provider };
}

export class PaidAdsApiError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly provider: MarketingDataProvider;

  constructor(error: PaidAdsProviderError) {
    super(error.message);
    this.name = "PaidAdsApiError";
    this.code = error.code;
    this.retryable = error.retryable;
    this.provider = error.provider;
  }
}
